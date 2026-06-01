from django.contrib import admin
from .models import RelatedProduct, RecommendationClick
from .cache import RecommendationCache


class RelatedProductInline(admin.TabularInline):
    model = RelatedProduct
    fk_name = "product"
    extra = 1
    raw_id_fields = ("related_product",)
    fields = ("related_product", "order")


@admin.register(RelatedProduct)
class RelatedProductAdmin(admin.ModelAdmin):
    list_display = ('product', 'related_product', 'order', 'created_at', 'created_by')
    list_filter = ('created_at',)
    search_fields = ('product__product_name', 'related_product__product_name')
    ordering = ('product', 'order', '-created_at')
    raw_id_fields = ('product', 'related_product', 'created_by')
    actions = ("clear_manual_associations", "copy_manual_associations")
    
    def save_model(self, request, obj, form, change):
        if not change:  # If creating new object
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
        RecommendationCache().invalidate_product(obj.product_id)

    def delete_model(self, request, obj):
        product_id = obj.product_id
        super().delete_model(request, obj)
        RecommendationCache().invalidate_product(product_id)

    @admin.action(description="Clear all manual associations for selected source products")
    def clear_manual_associations(self, request, queryset):
        source_ids = queryset.values_list("product_id", flat=True).distinct()
        RelatedProduct.objects.filter(product_id__in=source_ids).delete()
        cache_manager = RecommendationCache()
        for source_id in source_ids:
            cache_manager.invalidate_product(source_id)

    @admin.action(description="Copy first selected product's associations to the rest")
    def copy_manual_associations(self, request, queryset):
        source_ids = list(queryset.values_list("product_id", flat=True).distinct())
        if len(source_ids) < 2:
            return
        template_source = source_ids[0]
        template = list(
            RelatedProduct.objects.filter(product_id=template_source).order_by("order")
        )
        for target_id in source_ids[1:]:
            RelatedProduct.objects.filter(product_id=target_id).delete()
            for item in template:
                if item.related_product_id == target_id:
                    continue
                RelatedProduct.objects.create(
                    product_id=target_id,
                    related_product_id=item.related_product_id,
                    order=item.order,
                    created_by=request.user,
                )
            RecommendationCache().invalidate_product(target_id)


@admin.register(RecommendationClick)
class RecommendationClickAdmin(admin.ModelAdmin):
    list_display = ('source_type', 'recommended_product', 'user', 'session_key', 'clicked_at', 'added_to_cart')
    list_filter = ('source_type', 'added_to_cart', 'clicked_at')
    search_fields = ('user__email', 'session_key', 'recommended_product__product_name')
    ordering = ('-clicked_at',)
    raw_id_fields = ('user', 'source_product', 'recommended_product')
    readonly_fields = ('clicked_at',)
