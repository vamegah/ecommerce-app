from django.db import connection
from django.utils import timezone

from inventory_alerts.models import AuditLog, NotificationRecord, Subscription
from inventory_alerts.monitoring.stock_monitor import StockMonitor
from inventory_alerts.notification.service import NotificationService
from inventory_alerts.validators import normalize_email, sanitize_input, validate_status


class AdminInterface:
    def __init__(self, *, notification_service=None, stock_monitor=None):
        self.notification_service = notification_service or NotificationService()
        self.stock_monitor = stock_monitor or StockMonitor(notification_service=self.notification_service)

    def get_subscriptions(self, filters=None):
        filters = filters or {}
        queryset = Subscription.objects.select_related("product", "user").all()
        if filters.get("product_id"):
            queryset = queryset.filter(product_id=sanitize_input(filters["product_id"], max_length=64))
        if filters.get("email"):
            queryset = queryset.filter(email__icontains=normalize_email(filters["email"]))
        if filters.get("status"):
            queryset = queryset.filter(
                status=validate_status(filters["status"], {choice[0] for choice in Subscription.STATUS_CHOICES})
            )
        if filters.get("start_date"):
            queryset = queryset.filter(created_at__gte=filters["start_date"])
        if filters.get("end_date"):
            queryset = queryset.filter(created_at__lte=filters["end_date"])

        total = queryset.count()
        limit = min(max(int(filters.get("limit", 50)), 1), 1000)
        offset = max(int(filters.get("offset", 0)), 0)
        rows = queryset.order_by("-created_at")[offset : offset + limit]
        return {
            "subscriptions": [self._subscription_dict(subscription) for subscription in rows],
            "total": total,
            "page": (offset // limit) + 1,
            "pageSize": limit,
        }

    def cancel_subscription(self, subscription_id, reason):
        subscription = Subscription.objects.select_related("product").get(pk=subscription_id)
        self.notification_service.send_cancellation(subscription, reason=reason)
        email = subscription.email
        product_id = subscription.product_id
        subscription.delete()
        AuditLog.objects.create(
            event_type=AuditLog.EVENT_SUBSCRIPTION_CANCELLED,
            entity_id=str(subscription_id),
            details={"email": email, "product_id": product_id, "reason": reason, "actor": "admin"},
        )

    def get_statistics(self, time_range=None):
        time_range = time_range or {}
        queryset = NotificationRecord.objects.all()
        if time_range.get("start_date"):
            queryset = queryset.filter(created_at__gte=time_range["start_date"])
        if time_range.get("end_date"):
            queryset = queryset.filter(created_at__lte=time_range["end_date"])

        total_sent = queryset.filter(status=NotificationRecord.STATUS_SENT).count()
        total_failed = queryset.filter(status=NotificationRecord.STATUS_FAILED).count()
        total_pending = queryset.filter(status__in=(NotificationRecord.STATUS_PENDING, NotificationRecord.STATUS_QUEUED)).count()
        total = total_sent + total_failed + total_pending
        durations = []
        for record in queryset.filter(sent_at__isnull=False):
            start = record.delivery_started_at or record.created_at
            end = record.delivery_finished_at or record.sent_at
            durations.append(max((end - start).total_seconds(), 0))
        average_delivery_time = sum(durations) / len(durations) if durations else 0
        return {
            "totalSent": total_sent,
            "totalFailed": total_failed,
            "totalPending": total_pending,
            "averageDeliveryTime": average_delivery_time,
            "successRate": (total_sent / total) if total else 0,
        }

    def get_system_health(self):
        database_connected = self._database_connected()
        monitor_status = self.stock_monitor.get_status()
        queue_size = self.notification_service.queue_size()
        email_connected = self.notification_service.email_service_connected()
        inventory_connected = self.stock_monitor.system_connected()
        latest_error = AuditLog.objects.filter(
            event_type__in=(AuditLog.EVENT_STOCK_ERROR, AuditLog.EVENT_NOTIFICATION_FAILED, AuditLog.EVENT_SYSTEM_ALERT)
        ).first()
        return {
            "monitorStatus": {
                "isRunning": monitor_status.is_running,
                "lastCheckTime": monitor_status.last_check_time,
                "nextCheckTime": monitor_status.next_check_time,
                "totalChecks": monitor_status.total_checks,
                "totalErrors": monitor_status.total_errors,
            },
            "queueSize": queue_size,
            "databaseConnected": database_connected,
            "emailServiceConnected": email_connected,
            "inventorySystemConnected": inventory_connected,
            "lastError": latest_error.details if latest_error else None,
            "checkedAt": timezone.now(),
        }

    def _database_connected(self):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception:
            return False
        return True

    def _subscription_dict(self, subscription):
        return {
            "id": str(subscription.id),
            "email": subscription.email,
            "productId": subscription.product_id,
            "productName": subscription.product.product_name,
            "status": subscription.status,
            "createdAt": subscription.created_at,
            "notifiedAt": subscription.notified_at,
            "cancelledAt": subscription.cancelled_at,
            "unsubscribeToken": str(subscription.unsubscribe_token),
        }

    getSubscriptions = get_subscriptions
    cancelSubscription = cancel_subscription
    getStatistics = get_statistics
    getSystemHealth = get_system_health
