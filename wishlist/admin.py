from django.contrib import admin
from .models import Wishlist, WishlistItem


class WishlistItemInline(admin.TabularInline):
    model = WishlistItem
    extra = 0
    raw_id_fields = ("product",)
    readonly_fields = ("added_at",)


@admin.register(Wishlist)
class WishlistAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at", "updated_at", "items_count")
    search_fields = ("user__email", "user__username")
    inlines = [WishlistItemInline]

    def items_count(self, obj):
        return obj.get_items_count()


@admin.register(WishlistItem)
class WishlistItemAdmin(admin.ModelAdmin):
    list_display = ("wishlist", "product", "added_at")
    list_filter = ("added_at",)
    search_fields = ("wishlist__user__email", "product__product_name")
    raw_id_fields = ("wishlist", "product")
