import threading
from dataclasses import dataclass, field
from datetime import timedelta

from django.utils import timezone

from inventory_alerts.circuit_breaker import CircuitBreaker
from inventory_alerts.models import AuditLog, ProductStockSnapshot, Subscription
from inventory_alerts.notification.service import NotificationService
from inventory_alerts.subscription.manager import SubscriptionManager
from inventory_alerts.validators import StockTransition, validate_stock_level
from store.models import Product


@dataclass
class StockCheckResult:
    products_checked: int = 0
    stock_transitions: list = field(default_factory=list)
    notifications_triggered: int = 0
    errors: list = field(default_factory=list)


@dataclass
class MonitorStatus:
    is_running: bool = False
    last_check_time: object = None
    next_check_time: object = None
    total_checks: int = 0
    total_errors: int = 0


class InventoryClient:
    def fetch_stock_levels(self):
        return dict(Product.objects.filter(is_available=True).values_list("id", "stock"))

    def fetch_current_stock(self, product_id):
        product = Product.objects.get(pk=product_id)
        return product.stock


class StockMonitor:
    def __init__(
        self,
        *,
        inventory_client=None,
        subscription_manager=None,
        notification_service=None,
        threshold=1,
        interval_minutes=15,
    ):
        self.inventory_client = inventory_client or InventoryClient()
        self.subscription_manager = subscription_manager or SubscriptionManager()
        self.notification_service = notification_service or NotificationService()
        self.threshold = threshold
        self.interval_minutes = interval_minutes
        self.status = MonitorStatus()
        self._stop_event = threading.Event()
        self._thread = None
        self._breaker = CircuitBreaker(failure_threshold=3, recovery_seconds=300, name="inventory system")

    def start(self, interval_minutes=None):
        if self.status.is_running:
            return
        self.interval_minutes = interval_minutes or self.interval_minutes
        self.status.is_running = True
        self._stop_event.clear()
        self.status.next_check_time = timezone.now()
        self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        self.status.is_running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)

    def check_stock_levels(self):
        result = StockCheckResult()
        try:
            self._breaker.before_call()
            stock_levels = self.inventory_client.fetch_stock_levels()
            self._breaker.record_success()
        except Exception as exc:
            self._breaker.record_failure(exc)
            result.errors.append(exc)
            self._record_error(exc, context="fetch_stock_levels")
            self._mark_check_complete(result)
            return result

        transitions = []
        for product_id, current_stock in stock_levels.items():
            try:
                current = validate_stock_level(current_stock)
                previous = self._previous_stock(product_id, current)
                self._save_snapshot(product_id, current)
                result.products_checked += 1
                if self._is_transition(previous, current):
                    transition = StockTransition(
                        product_id=str(product_id),
                        previous_stock=previous,
                        current_stock=current,
                        timestamp=timezone.now(),
                    )
                    transitions.append(transition)
            except Exception as exc:
                result.errors.append(exc)
                self._record_error(exc, product_id=product_id)

        result.stock_transitions = transitions
        for transition in transitions:
            subscriptions = self.subscription_manager.get_subscriptions_by_product(
                transition.product_id,
                status=Subscription.STATUS_ACTIVE,
            )
            for subscription in subscriptions:
                self.notification_service.enqueue_notification(subscription)
                result.notifications_triggered += 1
            self._audit(
                AuditLog.EVENT_ALERT_TRIGGERED,
                transition.product_id,
                previous_stock=transition.previous_stock,
                current_stock=transition.current_stock,
                subscriptions=result.notifications_triggered,
            )

        self._mark_check_complete(result)
        return result

    def detect_stock_transitions(self, previous_levels, current_levels):
        transitions = []
        for product_id, current_stock in current_levels.items():
            current = validate_stock_level(current_stock)
            previous = validate_stock_level(previous_levels.get(product_id, 0))
            if self._is_transition(previous, current):
                transitions.append(
                    StockTransition(
                        product_id=str(product_id),
                        previous_stock=previous,
                        current_stock=current,
                        timestamp=timezone.now(),
                    )
                )
        return transitions

    def get_status(self):
        return self.status

    def system_connected(self):
        return not self._breaker.is_open

    def _monitor_loop(self):
        while not self._stop_event.is_set():
            self.check_stock_levels()
            delay_seconds = max(int(self.interval_minutes * 60), 1)
            self.status.next_check_time = timezone.now() + timedelta(seconds=delay_seconds)
            self._stop_event.wait(delay_seconds)
        self.status.is_running = False

    def _previous_stock(self, product_id, current_stock):
        snapshot = ProductStockSnapshot.objects.filter(product_id=product_id).first()
        return snapshot.stock_level if snapshot else current_stock

    def _save_snapshot(self, product_id, current_stock):
        ProductStockSnapshot.objects.update_or_create(
            product_id=product_id,
            defaults={"stock_level": current_stock, "checked_at": timezone.now()},
        )

    def _is_transition(self, previous_stock, current_stock):
        return previous_stock < self.threshold <= current_stock

    def _mark_check_complete(self, result):
        self.status.last_check_time = timezone.now()
        self.status.total_checks += 1
        self.status.total_errors += len(result.errors)
        self._audit(
            AuditLog.EVENT_STOCK_CHECKED,
            "stock_monitor",
            products_checked=result.products_checked,
            transitions=len(result.stock_transitions),
            notifications_triggered=result.notifications_triggered,
            errors=[str(error) for error in result.errors],
        )
        if self.status.total_checks and (self.status.total_errors / self.status.total_checks) > 0.05:
            self._audit(
                AuditLog.EVENT_SYSTEM_ALERT,
                "stock_monitor",
                message="Stock monitor error rate exceeded 5 percent.",
                total_checks=self.status.total_checks,
                total_errors=self.status.total_errors,
            )

    def _record_error(self, error, **context):
        self._audit(AuditLog.EVENT_STOCK_ERROR, context.get("product_id", "stock_monitor"), error=str(error), **context)

    def _audit(self, event_type, entity_id, **details):
        AuditLog.objects.create(event_type=event_type, entity_id=str(entity_id), details=details)

    checkStockLevels = check_stock_levels
    detectStockTransitions = detect_stock_transitions
    getStatus = get_status
