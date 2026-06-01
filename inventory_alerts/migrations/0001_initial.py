import uuid

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("store", "0008_alter_productgallery_options"),
    ]

    operations = [
        migrations.CreateModel(
            name="AuditLog",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("event_type", models.CharField(choices=[("subscription_created", "Subscription created"), ("subscription_cancelled", "Subscription cancelled"), ("subscription_archived", "Subscription archived"), ("notification_sent", "Notification sent"), ("notification_failed", "Notification failed"), ("notification_queued", "Notification queued"), ("stock_checked", "Stock checked"), ("stock_error", "Stock error"), ("alert_triggered", "Alert triggered"), ("system_alert", "System alert")], max_length=60)),
                ("entity_id", models.CharField(max_length=100)),
                ("details", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ("-created_at",),
            },
        ),
        migrations.CreateModel(
            name="ProductStockSnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("stock_level", models.PositiveIntegerField(default=0)),
                ("checked_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("product", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="inventory_alert_stock_snapshot", to="store.product")),
            ],
        ),
        migrations.CreateModel(
            name="Subscription",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("email", models.EmailField(max_length=255)),
                ("status", models.CharField(choices=[("active", "Active"), ("notified", "Notified"), ("completed", "Completed"), ("cancelled", "Cancelled"), ("failed", "Failed"), ("archived", "Archived")], default="active", max_length=20)),
                ("unsubscribe_token", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("notified_at", models.DateTimeField(blank=True, null=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("cancelled_at", models.DateTimeField(blank=True, null=True)),
                ("notification_id", models.UUIDField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("product", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="inventory_alert_subscriptions", to="store.product")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="inventory_alert_subscriptions", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ("-created_at",),
            },
        ),
        migrations.CreateModel(
            name="NotificationRecord",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("subscription_identifier", models.CharField(blank=True, max_length=36)),
                ("email", models.EmailField(max_length=255)),
                ("kind", models.CharField(choices=[("restock", "Restock"), ("subscribe_confirmation", "Subscribe confirmation"), ("unsubscribe_confirmation", "Unsubscribe confirmation"), ("cancellation", "Cancellation")], default="restock", max_length=40)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("queued", "Queued"), ("sent", "Sent"), ("failed", "Failed")], default="pending", max_length=20)),
                ("queued_at", models.DateTimeField(blank=True, null=True)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("error_message", models.TextField(blank=True)),
                ("retry_count", models.PositiveSmallIntegerField(default=0)),
                ("priority", models.PositiveSmallIntegerField(default=5)),
                ("delivery_started_at", models.DateTimeField(blank=True, null=True)),
                ("delivery_finished_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("product", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="inventory_alert_notifications", to="store.product")),
                ("subscription", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="notifications", to="inventory_alerts.subscription")),
            ],
            options={
                "ordering": ("-created_at",),
            },
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["event_type"], name="ia_audit_event"),
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["entity_id"], name="ia_audit_entity"),
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["created_at"], name="ia_audit_created"),
        ),
        migrations.AddIndex(
            model_name="productstocksnapshot",
            index=models.Index(fields=["checked_at"], name="ia_stock_checked"),
        ),
        migrations.AddIndex(
            model_name="subscription",
            index=models.Index(fields=["product", "status"], name="ia_sub_product_status"),
        ),
        migrations.AddIndex(
            model_name="subscription",
            index=models.Index(fields=["user", "product"], name="ia_sub_user_product"),
        ),
        migrations.AddIndex(
            model_name="subscription",
            index=models.Index(fields=["email"], name="ia_sub_email"),
        ),
        migrations.AddIndex(
            model_name="subscription",
            index=models.Index(fields=["status", "created_at"], name="ia_sub_status_created"),
        ),
        migrations.AddIndex(
            model_name="subscription",
            index=models.Index(fields=["unsubscribe_token"], name="ia_sub_unsub_token"),
        ),
        migrations.AddConstraint(
            model_name="subscription",
            constraint=models.UniqueConstraint(condition=models.Q(("status", "active")), fields=("product", "email"), name="ia_unique_active_email_product"),
        ),
        migrations.AddIndex(
            model_name="notificationrecord",
            index=models.Index(fields=["status"], name="ia_notif_status"),
        ),
        migrations.AddIndex(
            model_name="notificationrecord",
            index=models.Index(fields=["subscription"], name="ia_notif_subscription"),
        ),
        migrations.AddIndex(
            model_name="notificationrecord",
            index=models.Index(fields=["created_at"], name="ia_notif_created"),
        ),
        migrations.AddIndex(
            model_name="notificationrecord",
            index=models.Index(fields=["product", "status"], name="ia_notif_product_status"),
        ),
        migrations.AddIndex(
            model_name="notificationrecord",
            index=models.Index(fields=["priority", "created_at"], name="ia_notif_priority"),
        ),
    ]
