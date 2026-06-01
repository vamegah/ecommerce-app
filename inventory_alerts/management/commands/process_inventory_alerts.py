from django.core.management.base import BaseCommand

from inventory_alerts.monitoring.stock_monitor import StockMonitor
from inventory_alerts.notification.service import NotificationService
from inventory_alerts.subscription.manager import SubscriptionManager


class Command(BaseCommand):
    help = "Check stock levels, process queued inventory alerts, and archive old completed subscriptions."

    def add_arguments(self, parser):
        parser.add_argument("--batch-size", type=int, default=100, help="Maximum queued notifications to process.")
        parser.add_argument("--archive-days", type=int, default=30, help="Age in days before completed subscriptions are archived.")
        parser.add_argument("--skip-stock-check", action="store_true", help="Only process queued notifications and archival.")

    def handle(self, *args, **options):
        notification_service = NotificationService()
        stock_result = None
        if not options["skip_stock_check"]:
            stock_result = StockMonitor(notification_service=notification_service).check_stock_levels()

        processed = notification_service.process_queue(batch_size=options["batch_size"])
        archived = SubscriptionManager().archive_completed_subscriptions(older_than_days=options["archive_days"])

        if stock_result:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Checked {stock_result.products_checked} products, "
                    f"found {len(stock_result.stock_transitions)} transitions, "
                    f"queued {stock_result.notifications_triggered} notifications."
                )
            )
        self.stdout.write(self.style.SUCCESS(f"Processed {len(processed)} queued notifications."))
        self.stdout.write(self.style.SUCCESS(f"Archived {archived} completed subscriptions."))
