import time
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db.models import Q
from django.urls import reverse
from django.utils import timezone

from inventory_alerts.circuit_breaker import CircuitBreaker
from inventory_alerts.errors import ServiceError, ValidationError
from inventory_alerts.models import AuditLog, NotificationRecord, Subscription
from inventory_alerts.validators import normalize_email


@dataclass
class EmailContent:
    subject: str
    html: str
    text: str


@dataclass
class NotificationResult:
    success: bool
    notification_id: str
    delivered_at: object = None
    error: object = None
    retry_count: int = 0
    queued: bool = False


class NotificationService:
    _sent_timestamps = []
    _email_breaker = CircuitBreaker(failure_threshold=3, recovery_seconds=300, name="email service")

    def __init__(self, *, rate_limit=None, rate_window_seconds=60, sleep_fn=time.sleep):
        self.rate_limit = getattr(settings, "INVENTORY_ALERT_EMAIL_RATE_LIMIT", 1000) if rate_limit is None else rate_limit
        self.rate_window_seconds = rate_window_seconds
        self.sleep_fn = sleep_fn

    def generate_email_template(self, subscription, product, *, kind=NotificationRecord.KIND_RESTOCK, reason=""):
        unsubscribe_link = self._absolute_url(subscription.get_unsubscribe_url()) if subscription else ""
        product_link = self._product_url(product)
        stock_level = getattr(product, "stock", 0)
        product_name = getattr(product, "product_name", "Product")

        if kind == NotificationRecord.KIND_SUBSCRIBE_CONFIRMATION:
            subject = f"Inventory alert confirmed for {product_name}"
            intro = f"You are subscribed to availability alerts for {product_name}."
        elif kind == NotificationRecord.KIND_UNSUBSCRIBE_CONFIRMATION:
            subject = f"Inventory alert cancelled for {product_name}"
            intro = f"You have been unsubscribed from availability alerts for {product_name}."
        elif kind == NotificationRecord.KIND_CANCELLATION:
            subject = f"Inventory alert cancelled for {product_name}"
            intro = f"Your alert for {product_name} was cancelled. {reason}".strip()
        else:
            subject = f"{product_name} is back in stock"
            intro = f"{product_name} is available again with {stock_level} item(s) in stock."

        text_lines = [
            intro,
            f"Product: {product_name}",
            f"Current stock: {stock_level}",
            f"Product page: {product_link}",
        ]
        if unsubscribe_link:
            text_lines.append(f"Unsubscribe: {unsubscribe_link}")
        html_lines = [
            f"<p>{intro}</p>",
            f"<p><strong>Product:</strong> {product_name}</p>",
            f"<p><strong>Current stock:</strong> {stock_level}</p>",
            f'<p><a href="{product_link}">View product</a></p>',
        ]
        if unsubscribe_link:
            html_lines.append(f'<p><a href="{unsubscribe_link}">Unsubscribe</a></p>')

        return EmailContent(subject=subject, html="\n".join(html_lines), text="\n".join(text_lines))

    def send_notification(self, subscription, product=None):
        product = product or subscription.product
        record = NotificationRecord.objects.create(
            subscription=subscription,
            product=product,
            email=normalize_email(subscription.email),
            kind=NotificationRecord.KIND_RESTOCK,
            status=NotificationRecord.STATUS_PENDING,
            priority=1,
        )
        if not self._consume_rate_slot():
            record.status = NotificationRecord.STATUS_QUEUED
            record.queued_at = timezone.now()
            record.save(update_fields=("status", "queued_at", "updated_at"))
            self._audit(AuditLog.EVENT_NOTIFICATION_QUEUED, record.id, email=record.email)
            return NotificationResult(False, str(record.id), queued=True)
        return self._deliver_with_retry(record, subscription=subscription, product=product)

    def enqueue_notification(self, subscription, *, priority=1):
        record, _created = NotificationRecord.objects.get_or_create(
            subscription=subscription,
            product=subscription.product,
            email=normalize_email(subscription.email),
            kind=NotificationRecord.KIND_RESTOCK,
            status=NotificationRecord.STATUS_QUEUED,
            defaults={"queued_at": timezone.now(), "priority": priority},
        )
        self._audit(AuditLog.EVENT_NOTIFICATION_QUEUED, record.id, email=record.email, product_id=subscription.product_id)
        return record

    def process_queue(self, *, batch_size=100):
        processed = []
        queryset = (
            NotificationRecord.objects.filter(status=NotificationRecord.STATUS_QUEUED)
            .select_related("subscription", "product")
            .order_by("priority", "created_at")[:batch_size]
        )
        for record in queryset:
            if not self._consume_rate_slot():
                break
            processed.append(
                self._deliver_with_retry(record, subscription=record.subscription, product=record.product)
            )
        return processed

    def retry_failed(self, notification_id):
        try:
            record = NotificationRecord.objects.select_related("subscription", "product").get(pk=notification_id)
        except (NotificationRecord.DoesNotExist, ValueError, TypeError) as exc:
            raise ValidationError("Notification was not found.") from exc
        return self._deliver_with_retry(record, subscription=record.subscription, product=record.product)

    def get_history(self, filters=None):
        filters = filters or {}
        queryset = NotificationRecord.objects.select_related("subscription", "product").all()
        if filters.get("product_id"):
            queryset = queryset.filter(product_id=filters["product_id"])
        if filters.get("email"):
            queryset = queryset.filter(email__icontains=normalize_email(filters["email"]))
        if filters.get("status"):
            queryset = queryset.filter(status=filters["status"])
        if filters.get("start_date"):
            queryset = queryset.filter(created_at__gte=filters["start_date"])
        if filters.get("end_date"):
            queryset = queryset.filter(created_at__lte=filters["end_date"])
        limit = min(int(filters.get("limit", 1000)), 1000)
        return queryset.order_by("-created_at")[:limit]

    def send_confirmation(self, subscription, *, event="created"):
        kind = (
            NotificationRecord.KIND_SUBSCRIBE_CONFIRMATION
            if event == "created"
            else NotificationRecord.KIND_UNSUBSCRIBE_CONFIRMATION
        )
        record = NotificationRecord.objects.create(
            subscription=subscription,
            product=subscription.product,
            email=normalize_email(subscription.email),
            kind=kind,
            status=NotificationRecord.STATUS_PENDING,
            priority=3,
        )
        if not self._consume_rate_slot():
            record.status = NotificationRecord.STATUS_QUEUED
            record.queued_at = timezone.now()
            record.save(update_fields=("status", "queued_at", "updated_at"))
            return NotificationResult(False, str(record.id), queued=True)
        return self._deliver_with_retry(record, subscription=subscription, product=subscription.product, max_attempts=1)

    def send_unsubscribe_confirmation(self, *, email, product):
        normalized_email = normalize_email(email)
        record = NotificationRecord.objects.create(
            product=product,
            email=normalized_email,
            kind=NotificationRecord.KIND_UNSUBSCRIBE_CONFIRMATION,
            status=NotificationRecord.STATUS_PENDING,
            priority=3,
        )
        if not self._consume_rate_slot():
            record.status = NotificationRecord.STATUS_QUEUED
            record.queued_at = timezone.now()
            record.save(update_fields=("status", "queued_at", "updated_at"))
            return NotificationResult(False, str(record.id), queued=True)
        return self._deliver_with_retry(record, product=product, max_attempts=1)

    def send_cancellation(self, subscription, *, reason=""):
        record = NotificationRecord.objects.create(
            subscription=subscription,
            product=subscription.product,
            email=normalize_email(subscription.email),
            kind=NotificationRecord.KIND_CANCELLATION,
            status=NotificationRecord.STATUS_PENDING,
            priority=2,
        )
        if not self._consume_rate_slot():
            record.status = NotificationRecord.STATUS_QUEUED
            record.queued_at = timezone.now()
            record.save(update_fields=("status", "queued_at", "updated_at"))
            return NotificationResult(False, str(record.id), queued=True)
        return self._deliver_with_retry(record, subscription=subscription, product=subscription.product, max_attempts=1, reason=reason)

    def queue_size(self):
        return NotificationRecord.objects.filter(status=NotificationRecord.STATUS_QUEUED).count()

    def email_service_connected(self):
        return not self._email_breaker.is_open

    def _deliver_with_retry(self, record, *, subscription=None, product=None, max_attempts=3, reason=""):
        product = product or (subscription.product if subscription else record.product)
        subscription = subscription or record.subscription
        record.delivery_started_at = timezone.now()
        record.status = NotificationRecord.STATUS_PENDING
        record.save(update_fields=("delivery_started_at", "status", "updated_at"))

        last_error = None
        for attempt in range(max_attempts):
            try:
                self._email_breaker.before_call()
                content = self.generate_email_template(subscription, product, kind=record.kind, reason=reason)
                self._send_email(record.email, content)
            except Exception as exc:
                last_error = exc
                self._email_breaker.record_failure(exc)
                record.retry_count = attempt + 1
                record.error_message = str(exc)
                record.save(update_fields=("retry_count", "error_message", "updated_at"))
                if attempt < max_attempts - 1:
                    self.sleep_fn(2**attempt)
                    continue
                record.status = NotificationRecord.STATUS_FAILED
                record.delivery_finished_at = timezone.now()
                record.save(update_fields=("status", "delivery_finished_at", "updated_at"))
                if subscription and record.kind == NotificationRecord.KIND_RESTOCK:
                    subscription.status = Subscription.STATUS_FAILED
                    subscription.save(update_fields=("status", "updated_at"))
                self._audit(AuditLog.EVENT_NOTIFICATION_FAILED, record.id, email=record.email, error=str(exc))
                return NotificationResult(False, str(record.id), error=last_error, retry_count=record.retry_count)

            delivered_at = timezone.now()
            self._email_breaker.record_success()
            record.status = NotificationRecord.STATUS_SENT
            record.sent_at = delivered_at
            record.delivery_finished_at = delivered_at
            record.error_message = ""
            record.save(update_fields=("status", "sent_at", "delivery_finished_at", "error_message", "updated_at"))
            if subscription and record.kind == NotificationRecord.KIND_RESTOCK:
                subscription.mark_notified(notification_id=record.id, when=delivered_at)
            self._audit(AuditLog.EVENT_NOTIFICATION_SENT, record.id, email=record.email, product_id=product.id if product else None)
            return NotificationResult(True, str(record.id), delivered_at=delivered_at, retry_count=record.retry_count)
        raise ServiceError("Notification delivery failed unexpectedly.")

    def _send_email(self, email, content):
        message = EmailMultiAlternatives(
            subject=content.subject,
            body=content.text,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", getattr(settings, "EMAIL_HOST_USER", None)),
            to=[email],
        )
        message.attach_alternative(content.html, "text/html")
        message.send(fail_silently=False)

    def _consume_rate_slot(self):
        now = timezone.now()
        window_start = now - timedelta(seconds=self.rate_window_seconds)
        self.__class__._sent_timestamps = [
            timestamp for timestamp in self.__class__._sent_timestamps if timestamp >= window_start
        ]
        if len(self.__class__._sent_timestamps) >= self.rate_limit:
            return False
        self.__class__._sent_timestamps.append(now)
        return True

    def _product_url(self, product):
        if not product:
            return self._absolute_url("/store/")
        try:
            path = product.get_slug_url()
        except Exception:
            path = reverse("store")
        return self._absolute_url(path)

    def _absolute_url(self, path):
        base_url = getattr(settings, "SITE_URL", "http://testserver").rstrip("/")
        if str(path).startswith(("http://", "https://")):
            return str(path)
        return f"{base_url}/{str(path).lstrip('/')}"

    def _audit(self, event_type, entity_id, **details):
        AuditLog.objects.create(event_type=event_type, entity_id=str(entity_id), details=details)

    sendNotification = send_notification
    processQueue = process_queue
    retryFailed = retry_failed
    getHistory = get_history
