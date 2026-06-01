from django.contrib import admin

from .models import AuditLog, NotificationRecord, ProductStockSnapshot, Subscription


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("email", "product", "status", "created_at", "notified_at")
    list_filter = ("status", "created_at", "notified_at")
    search_fields = ("email", "product__product_name", "id", "unsubscribe_token")
    readonly_fields = ("id", "unsubscribe_token", "created_at", "updated_at", "notified_at", "completed_at")
    date_hierarchy = "created_at"


@admin.register(NotificationRecord)
class NotificationRecordAdmin(admin.ModelAdmin):
    list_display = ("email", "product", "kind", "status", "retry_count", "created_at", "sent_at")
    list_filter = ("kind", "status", "created_at", "sent_at")
    search_fields = ("email", "product__product_name", "subscription_identifier", "id")
    readonly_fields = ("id", "created_at", "updated_at", "sent_at", "delivery_started_at", "delivery_finished_at")
    date_hierarchy = "created_at"


@admin.register(ProductStockSnapshot)
class ProductStockSnapshotAdmin(admin.ModelAdmin):
    list_display = ("product", "stock_level", "checked_at")
    search_fields = ("product__product_name",)
    readonly_fields = ("checked_at",)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("event_type", "entity_id", "created_at")
    list_filter = ("event_type", "created_at")
    search_fields = ("entity_id",)
    readonly_fields = ("id", "event_type", "entity_id", "details", "created_at")
    date_hierarchy = "created_at"
