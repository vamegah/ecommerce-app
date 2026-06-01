from django.contrib import admin
from .models import Payment, Order, OrderProduct

# Register your models here.
# Create tabular inline
class OrderProductInline(admin.TabularInline):
    model = OrderProduct
    readonly_fields = ('payment', 'user', 'product', 'quantity', 'product_price', 'ordered')
    extra = 0

class OrderAdmin(admin.ModelAdmin):
    list_display = ['order_number', 'full_name', 'phone', 'email', 'city', 'order_total', 'tax', 'coupon_code', 'discount_amount', 'status', 'is_ordered', 'created_at']
    list_filter = ['status', 'is_ordered']
    search_fields = ['order_number', 'first_name', 'last_name', 'phone', 'email']
    list_per_page = 20
    inlines = [OrderProductInline]
    actions = ['make_accepted', 'make_processing', 'make_shipped', 'make_delivered', 'make_cancelled']

    def make_accepted(self, request, queryset):
        queryset.update(status='Accepted')
    make_accepted.short_description = "Update orders to accepted"

    def make_processing(self, request, queryset):
        queryset.update(status='Processing')
    make_processing.short_description = "Update orders to processing"

    def make_shipped(self, request, queryset):
        queryset.update(status='Shipped')
    make_shipped.short_description = "Update orders to shipped"

    def make_delivered(self, request, queryset):
        queryset.update(status='Delivered')
    make_delivered.short_description = "Update orders to delivered"

    def make_cancelled(self, request, queryset):
        queryset.update(status='Cancelled')
    make_cancelled.short_description = "Update orders to cancelled"


admin.site.register(Payment)
admin.site.register(Order, OrderAdmin)
admin.site.register(OrderProduct)

