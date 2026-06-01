from django.contrib import admin

from .models import SavedComparison, SharedComparison


@admin.register(SavedComparison)
class SavedComparisonAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "session_key", "product_count", "updated_at")
    search_fields = ("user__email", "session_key")
    readonly_fields = ("id", "created_at", "updated_at")

    def product_count(self, obj):
        return len(obj.product_ids)


@admin.register(SharedComparison)
class SharedComparisonAdmin(admin.ModelAdmin):
    list_display = ("share_id", "created_at", "expires_at", "is_expired")
    search_fields = ("share_id",)
    readonly_fields = ("share_id", "created_at")

# Register your models here.
