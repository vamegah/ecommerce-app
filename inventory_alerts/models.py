import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.urls import reverse
from django.utils import timezone

from store.models import Product


class Subscription(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_NOTIFIED = "notified"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"
    STATUS_FAILED = "failed"
    STATUS_ARCHIVED = "archived"

    STATUS_CHOICES = (
        (STATUS_ACTIVE, "Active"),
        (STATUS_NOTIFIED, "Notified"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_FAILED, "Failed"),
        (STATUS_ARCHIVED, "Archived"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="inventory_alert_subscriptions",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="inventory_alert_subscriptions",
    )
    email = models.EmailField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    unsubscribe_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    notified_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    notification_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = (
            models.Index(fields=("product", "status"), name="ia_sub_product_status"),
            models.Index(fields=("user", "product"), name="ia_sub_user_product"),
            models.Index(fields=("email",), name="ia_sub_email"),
            models.Index(fields=("status", "created_at"), name="ia_sub_status_created"),
            models.Index(fields=("unsubscribe_token",), name="ia_sub_unsub_token"),
        )
        constraints = (
            models.UniqueConstraint(
                fields=("product", "email"),
                condition=Q(status="active"),
                name="ia_unique_active_email_product",
            ),
        )

    def __str__(self):
        return f"{self.email} -> {self.product_id} ({self.status})"

    @property
    def user_identifier(self):
        return str(self.user_id or self.email.lower())

    def get_unsubscribe_url(self):
        return reverse("inventory_alerts:unsubscribe_token", args=[str(self.unsubscribe_token)])

    def mark_notified(self, notification_id=None, when=None):
        now = when or timezone.now()
        self.status = self.STATUS_NOTIFIED
        self.notified_at = now
        self.completed_at = now
        if notification_id:
            self.notification_id = notification_id
        self.save(update_fields=("status", "notified_at", "completed_at", "notification_id", "updated_at"))

    def mark_cancelled(self, when=None):
        self.status = self.STATUS_CANCELLED
        self.cancelled_at = when or timezone.now()
        self.save(update_fields=("status", "cancelled_at", "updated_at"))


class NotificationRecord(models.Model):
    STATUS_PENDING = "pending"
    STATUS_QUEUED = "queued"
    STATUS_SENT = "sent"
    STATUS_FAILED = "failed"

    KIND_RESTOCK = "restock"
    KIND_SUBSCRIBE_CONFIRMATION = "subscribe_confirmation"
    KIND_UNSUBSCRIBE_CONFIRMATION = "unsubscribe_confirmation"
    KIND_CANCELLATION = "cancellation"

    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_QUEUED, "Queued"),
        (STATUS_SENT, "Sent"),
        (STATUS_FAILED, "Failed"),
    )
    KIND_CHOICES = (
        (KIND_RESTOCK, "Restock"),
        (KIND_SUBSCRIBE_CONFIRMATION, "Subscribe confirmation"),
        (KIND_UNSUBSCRIBE_CONFIRMATION, "Unsubscribe confirmation"),
        (KIND_CANCELLATION, "Cancellation"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(
        Subscription,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notifications",
    )
    subscription_identifier = models.CharField(max_length=36, blank=True)
    product = models.ForeignKey(
        Product,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="inventory_alert_notifications",
    )
    email = models.EmailField(max_length=255)
    kind = models.CharField(max_length=40, choices=KIND_CHOICES, default=KIND_RESTOCK)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    queued_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    retry_count = models.PositiveSmallIntegerField(default=0)
    priority = models.PositiveSmallIntegerField(default=5)
    delivery_started_at = models.DateTimeField(null=True, blank=True)
    delivery_finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = (
            models.Index(fields=("status",), name="ia_notif_status"),
            models.Index(fields=("subscription",), name="ia_notif_subscription"),
            models.Index(fields=("created_at",), name="ia_notif_created"),
            models.Index(fields=("product", "status"), name="ia_notif_product_status"),
            models.Index(fields=("priority", "created_at"), name="ia_notif_priority"),
        )

    def __str__(self):
        return f"{self.kind} to {self.email} ({self.status})"

    def save(self, *args, **kwargs):
        if self.subscription_id and not self.subscription_identifier:
            self.subscription_identifier = str(self.subscription_id)
        super().save(*args, **kwargs)


class ProductStockSnapshot(models.Model):
    product = models.OneToOneField(
        Product,
        on_delete=models.CASCADE,
        related_name="inventory_alert_stock_snapshot",
    )
    stock_level = models.PositiveIntegerField(default=0)
    checked_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = (
            models.Index(fields=("checked_at",), name="ia_stock_checked"),
        )

    def __str__(self):
        return f"{self.product_id}: {self.stock_level}"


class AuditLog(models.Model):
    EVENT_SUBSCRIPTION_CREATED = "subscription_created"
    EVENT_SUBSCRIPTION_CANCELLED = "subscription_cancelled"
    EVENT_SUBSCRIPTION_ARCHIVED = "subscription_archived"
    EVENT_NOTIFICATION_SENT = "notification_sent"
    EVENT_NOTIFICATION_FAILED = "notification_failed"
    EVENT_NOTIFICATION_QUEUED = "notification_queued"
    EVENT_STOCK_CHECKED = "stock_checked"
    EVENT_STOCK_ERROR = "stock_error"
    EVENT_ALERT_TRIGGERED = "alert_triggered"
    EVENT_SYSTEM_ALERT = "system_alert"

    EVENT_CHOICES = (
        (EVENT_SUBSCRIPTION_CREATED, "Subscription created"),
        (EVENT_SUBSCRIPTION_CANCELLED, "Subscription cancelled"),
        (EVENT_SUBSCRIPTION_ARCHIVED, "Subscription archived"),
        (EVENT_NOTIFICATION_SENT, "Notification sent"),
        (EVENT_NOTIFICATION_FAILED, "Notification failed"),
        (EVENT_NOTIFICATION_QUEUED, "Notification queued"),
        (EVENT_STOCK_CHECKED, "Stock checked"),
        (EVENT_STOCK_ERROR, "Stock error"),
        (EVENT_ALERT_TRIGGERED, "Alert triggered"),
        (EVENT_SYSTEM_ALERT, "System alert"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=60, choices=EVENT_CHOICES)
    entity_id = models.CharField(max_length=100)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = (
            models.Index(fields=("event_type",), name="ia_audit_event"),
            models.Index(fields=("entity_id",), name="ia_audit_entity"),
            models.Index(fields=("created_at",), name="ia_audit_created"),
        )

    def __str__(self):
        return f"{self.event_type}:{self.entity_id}"
