from unittest.mock import Mock
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from category.models import Category
from inventory_alerts.admin_interface.interface import AdminInterface
from inventory_alerts.errors import DuplicateError, NotFoundError, ValidationError
from inventory_alerts.models import AuditLog, NotificationRecord, ProductStockSnapshot, Subscription
from inventory_alerts.monitoring.stock_monitor import StockMonitor
from inventory_alerts.notification.service import NotificationService
from inventory_alerts.subscription.manager import SubscriptionManager
from inventory_alerts.validators import normalize_email, sanitize_input, validate_stock_level
from store.models import Product


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="alerts@example.com",
    SITE_URL="https://example.test",
)
class InventoryAlertsTests(TestCase):
    def setUp(self):
        NotificationService._sent_timestamps = []
        NotificationService._email_breaker.reset()
        self.category = Category.objects.create(category_name="Shoes", slug="shoes")
        self.product = Product.objects.create(
            product_name="Trail Runner",
            slug="trail-runner",
            description="A shoe",
            price=99,
            images="products/trail.jpg",
            stock=0,
            is_available=True,
            category=self.category,
        )
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            first_name="Ada",
            last_name="Lovelace",
            username="ada",
            email="ada@example.com",
            password="secret",
        )
        self.user.is_active = True
        self.user.save(update_fields=["is_active"])
        self.manager = SubscriptionManager()

    def test_validation_rejects_invalid_email_and_stock_and_sanitizes_input(self):
        with self.assertRaises(ValidationError):
            normalize_email("not an email")
        with self.assertRaises(ValidationError):
            validate_stock_level(-1)
        with self.assertRaises(ValidationError):
            validate_stock_level("3.5")

        sanitized = sanitize_input("<script>alert('x')</script>")
        self.assertNotIn("<script>", sanitized)
        self.assertIn("&lt;script&gt;", sanitized)

    def test_create_subscription_stores_data_and_prevents_duplicates(self):
        subscription = self.manager.create_subscription(
            user_id=self.user.id,
            product_id=self.product.id,
            email="ADA@EXAMPLE.COM",
        )

        self.assertEqual(subscription.email, "ada@example.com")
        self.assertEqual(subscription.product, self.product)
        self.assertEqual(subscription.user, self.user)
        self.assertEqual(subscription.status, Subscription.STATUS_ACTIVE)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Trail Runner", mail.outbox[0].body)

        with self.assertRaises(DuplicateError):
            self.manager.create_subscription(
                user_id=self.user.id,
                product_id=self.product.id,
                email="ada@example.com",
            )
        self.assertEqual(Subscription.objects.filter(product=self.product).count(), 1)

    def test_subscription_removal_and_unsubscribe_token_are_graceful(self):
        subscription = self.manager.create_subscription(None, self.product.id, "guest@example.com")
        removed = self.manager.remove_subscription(subscription.id)

        self.assertTrue(removed)
        self.assertFalse(Subscription.objects.filter(id=subscription.id).exists())
        self.assertFalse(self.manager.remove_subscription(subscription.id))
        self.assertGreaterEqual(len(mail.outbox), 2)

        another = self.manager.create_subscription(None, self.product.id, "other@example.com")
        self.assertTrue(self.manager.unsubscribe_by_token(another.unsubscribe_token))
        with self.assertRaises(NotFoundError):
            self.manager.unsubscribe_by_token(another.unsubscribe_token)

    def test_subscription_queries_and_mark_as_notified(self):
        first = self.manager.create_subscription(None, self.product.id, "first@example.com", send_confirmation=False)
        second_product = Product.objects.create(
            product_name="Road Runner",
            slug="road-runner",
            description="Another shoe",
            price=88,
            images="products/road.jpg",
            stock=0,
            is_available=True,
            category=self.category,
        )
        self.manager.create_subscription(None, second_product.id, "second@example.com", send_confirmation=False)

        product_subscriptions = list(self.manager.get_subscriptions_by_product(self.product.id))
        self.assertEqual(product_subscriptions, [first])
        self.assertTrue(self.manager.subscription_exists(product_id=self.product.id, email="first@example.com"))

        updated = self.manager.mark_as_notified(first.id)
        self.assertEqual(updated.status, Subscription.STATUS_NOTIFIED)
        self.assertIsNotNone(updated.notified_at)
        self.assertIsNotNone(updated.completed_at)

    def test_email_template_contains_required_notification_information(self):
        subscription = self.manager.create_subscription(None, self.product.id, "buyer@example.com", send_confirmation=False)
        self.product.stock = 5
        service = NotificationService(sleep_fn=lambda _seconds: None)
        content = service.generate_email_template(subscription, self.product)

        self.assertIn("Trail Runner", content.text)
        self.assertIn("5", content.text)
        self.assertIn("/store/category/shoes/trail-runner/", content.text)
        self.assertIn("Unsubscribe", content.text)

    def test_send_notification_marks_subscription_and_records_history(self):
        subscription = self.manager.create_subscription(None, self.product.id, "buyer@example.com", send_confirmation=False)
        self.product.stock = 7
        self.product.save(update_fields=["stock"])

        result = NotificationService(sleep_fn=lambda _seconds: None).send_notification(subscription)
        subscription.refresh_from_db()

        self.assertTrue(result.success)
        self.assertEqual(subscription.status, Subscription.STATUS_NOTIFIED)
        self.assertEqual(NotificationRecord.objects.filter(status=NotificationRecord.STATUS_SENT).count(), 1)
        self.assertEqual(AuditLog.objects.filter(event_type=AuditLog.EVENT_NOTIFICATION_SENT).count(), 1)

    def test_failed_notification_retries_and_marks_failed(self):
        subscription = self.manager.create_subscription(None, self.product.id, "buyer@example.com", send_confirmation=False)
        service = NotificationService(sleep_fn=lambda _seconds: None)
        service._send_email = Mock(side_effect=RuntimeError("email down"))

        result = service.send_notification(subscription)
        record = NotificationRecord.objects.get(id=result.notification_id)
        subscription.refresh_from_db()

        self.assertFalse(result.success)
        self.assertEqual(record.status, NotificationRecord.STATUS_FAILED)
        self.assertEqual(record.retry_count, 3)
        self.assertEqual(subscription.status, Subscription.STATUS_FAILED)
        self.assertEqual(AuditLog.objects.filter(event_type=AuditLog.EVENT_NOTIFICATION_FAILED).count(), 1)

    def test_rate_limiting_queues_notifications_and_process_queue_sends_later(self):
        subscription = self.manager.create_subscription(None, self.product.id, "buyer@example.com", send_confirmation=False)
        limited = NotificationService(rate_limit=0, sleep_fn=lambda _seconds: None)

        result = limited.send_notification(subscription)
        self.assertTrue(result.queued)
        self.assertEqual(NotificationRecord.objects.filter(status=NotificationRecord.STATUS_QUEUED).count(), 1)

        NotificationService._sent_timestamps = []
        processed = NotificationService(rate_limit=10, sleep_fn=lambda _seconds: None).process_queue()
        self.assertEqual(len(processed), 1)
        self.assertTrue(processed[0].success)

    def test_stock_transition_detection_and_check_enqueues_all_active_subscribers(self):
        first = self.manager.create_subscription(None, self.product.id, "first@example.com", send_confirmation=False)
        second = self.manager.create_subscription(None, self.product.id, "second@example.com", send_confirmation=False)
        ProductStockSnapshot.objects.create(product=self.product, stock_level=0)
        self.product.stock = 4
        self.product.save(update_fields=["stock"])

        monitor = StockMonitor(notification_service=NotificationService(sleep_fn=lambda _seconds: None))
        transitions = monitor.detect_stock_transitions({self.product.id: 0}, {self.product.id: 4})
        result = monitor.check_stock_levels()

        self.assertEqual(len(transitions), 1)
        self.assertEqual(result.products_checked, 1)
        self.assertEqual(result.notifications_triggered, 2)
        self.assertEqual(
            NotificationRecord.objects.filter(subscription__in=[first, second], status=NotificationRecord.STATUS_QUEUED).count(),
            2,
        )

    def test_monitor_errors_are_logged_without_stopping_checks(self):
        inventory_client = Mock()
        inventory_client.fetch_stock_levels.side_effect = RuntimeError("inventory timeout")
        monitor = StockMonitor(inventory_client=inventory_client)

        result = monitor.check_stock_levels()

        self.assertEqual(len(result.errors), 1)
        self.assertEqual(monitor.get_status().total_checks, 1)
        self.assertEqual(AuditLog.objects.filter(event_type=AuditLog.EVENT_STOCK_ERROR).count(), 1)

    def test_lifecycle_archival_and_product_discontinuation(self):
        old = self.manager.create_subscription(None, self.product.id, "old@example.com", send_confirmation=False)
        old.status = Subscription.STATUS_NOTIFIED
        old.completed_at = timezone.now() - timedelta(days=31)
        old.save(update_fields=["status", "completed_at"])

        self.assertEqual(self.manager.archive_completed_subscriptions(), 1)
        old.refresh_from_db()
        self.assertEqual(old.status, Subscription.STATUS_ARCHIVED)

        active = self.manager.create_subscription(None, self.product.id, "active@example.com", send_confirmation=False)
        cancelled_count = self.manager.cancel_discontinued_product(self.product.id)
        active.refresh_from_db()
        self.assertEqual(cancelled_count, 1)
        self.assertEqual(active.status, Subscription.STATUS_CANCELLED)

    def test_admin_queries_cancellation_statistics_and_health(self):
        subscription = self.manager.create_subscription(None, self.product.id, "admin@example.com", send_confirmation=False)
        sent = NotificationRecord.objects.create(
            subscription=subscription,
            product=self.product,
            email="admin@example.com",
            status=NotificationRecord.STATUS_SENT,
            sent_at=timezone.now(),
            delivery_started_at=timezone.now(),
            delivery_finished_at=timezone.now(),
        )
        NotificationRecord.objects.create(
            subscription=subscription,
            product=self.product,
            email="admin@example.com",
            status=NotificationRecord.STATUS_FAILED,
        )
        interface = AdminInterface(notification_service=NotificationService(sleep_fn=lambda _seconds: None))

        listing = interface.get_subscriptions({"product_id": self.product.id, "email": "admin@example.com"})
        statistics = interface.get_statistics()
        health = interface.get_system_health()
        interface.cancel_subscription(subscription.id, "test cancel")

        self.assertEqual(listing["total"], 1)
        self.assertEqual(statistics["totalSent"], 1)
        self.assertEqual(statistics["totalFailed"], 1)
        self.assertTrue(health["databaseConnected"])
        self.assertFalse(Subscription.objects.filter(id=subscription.id).exists())
        sent.refresh_from_db()
        self.assertEqual(sent.status, NotificationRecord.STATUS_SENT)

    def test_api_subscription_flow_and_admin_endpoints(self):
        client = Client()
        create_url = reverse("inventory_alerts:create_subscription")
        response = client.post(
            create_url,
            data={"productId": self.product.id, "email": "api@example.com"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        subscription_id = response.json()["subscription"]["id"]

        unsubscribe_token = Subscription.objects.get(id=subscription_id).unsubscribe_token
        response = client.get(reverse("inventory_alerts:unsubscribe_token", args=[unsubscribe_token]))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Subscription.objects.filter(id=subscription_id).exists())

        admin = get_user_model().objects.create_user(
            first_name="Grace",
            last_name="Hopper",
            username="grace",
            email="grace@example.com",
            password="secret",
        )
        admin.is_staff = True
        admin.is_active = True
        admin.save(update_fields=["is_staff", "is_active"])
        client.force_login(admin)
        response = client.get(reverse("inventory_alerts:admin_subscriptions"))
        self.assertEqual(response.status_code, 200)
        response = client.get(reverse("inventory_alerts:admin_statistics"))
        self.assertEqual(response.status_code, 200)
        response = client.get(reverse("inventory_alerts:admin_health"))
        self.assertEqual(response.status_code, 200)
