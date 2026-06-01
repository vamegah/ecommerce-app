from django.contrib import admin

from .models import ShippingAddress


@admin.register(ShippingAddress)
class ShippingAddressAdmin(admin.ModelAdmin):
    list_display = ("user", "street", "city", "postal_code", "country", "is_default", "updated_at")
    list_filter = ("is_default", "country", "created_at")
    search_fields = ("user__email", "street", "city", "postal_code", "company_name")
    readonly_fields = ("id", "created_at", "updated_at", "version")
