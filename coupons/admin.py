from django.contrib import admin

from .models import Coupon, Redemption


class RedemptionInline(admin.TabularInline):
    """Read-only redemption history shown on each coupon."""

    model = Redemption
    extra = 0
    can_delete = False
    readonly_fields = ("user", "order", "discount_amount", "redeemed_at")
    fields = readonly_fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    """Admin interface for creating and managing discount coupons."""

    list_display = (
        "code",
        "discount_type",
        "discount_value",
        "is_active",
        "valid_from",
        "valid_to",
        "total_redemptions",
    )
    list_filter = ("is_active", "discount_type", "created_at")
    search_fields = ("code",)
    readonly_fields = ("created_at", "updated_at", "total_redemptions")
    inlines = (RedemptionInline,)
    fieldsets = (
        ("Coupon", {
            "fields": ("code", "discount_type", "discount_value", "is_active"),
        }),
        ("Restrictions", {
            "fields": ("minimum_order_value", "max_usage_limit", "max_usage_per_user"),
        }),
        ("Validity", {
            "fields": ("valid_from", "valid_to"),
        }),
        ("Metadata", {
            "fields": ("created_at", "updated_at", "total_redemptions"),
        }),
    )

    def total_redemptions(self, obj):
        """Display total redemption count for coupon analytics."""
        if not obj.pk:
            return 0
        return obj.redemptions.count()

    total_redemptions.short_description = "Total redemptions"


@admin.register(Redemption)
class RedemptionAdmin(admin.ModelAdmin):
    """Read-only admin view for coupon redemption audit history."""

    list_display = ("coupon", "user", "order", "discount_amount", "redeemed_at")
    list_filter = ("coupon", "redeemed_at")
    search_fields = ("coupon__code", "order__order_number")
    readonly_fields = ("coupon", "user", "order", "discount_amount", "redeemed_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
