from django.contrib import admin
from .models import Product, Variation, ReviewRating, ProductGallery
import admin_thumbnails 
from recommendations.models import RelatedProduct

thumbnail = getattr(admin_thumbnails, 'thumbnail', lambda field: (lambda cls: cls))

# Register your models here.
# Register the Product model with the Django admin site
# This allows the Product model to be managed through the Django admin interface.

@thumbnail('image')
class ProductGalleryInline(admin.TabularInline):
    """
    Inline admin interface for the ProductGallery model.
    """
    model = ProductGallery
    extra = 1 # Number of empty forms to display
   

class RelatedProductInline(admin.TabularInline):
    model = RelatedProduct
    fk_name = "product"
    extra = 1
    raw_id_fields = ("related_product",)
    fields = ("related_product", "order")


# Define a custom admin class for the Product model
class ProductAdmin(admin.ModelAdmin):
    """
    Customizes the admin interface for the Product model.
    """
    list_display = ('product_name', 'price', 'stock', 'category', 'modified_date', 'is_available')
    prepopulated_fields = {'slug': ('product_name',)}
    inlines = [ProductGalleryInline, RelatedProductInline] # Add the recommendation inline
    # This line specifies that the 'slug' field should be automatically populated with the 'product_name' field.
    # This is useful for creating unique URLs for each product.

# Register the Product model with the customized ProductAdmin class
admin.site.register(Product, ProductAdmin)
# This code registers the Product model with the Django admin site, allowing it to be managed through the admin interface.

class VariationAdmin(admin.ModelAdmin):
    """
    Customizes the admin interface for the Variation model.
    """
    list_display = ('product', 'variation_category', 'variation_value', 'is_active')
    list_editable = ('is_active',)
    list_filter = ('product', 'variation_category', 'variation_value')

admin.site.register(Variation, VariationAdmin) # Register the Variation model with the admin site
# This allows the Variation model to be managed through the Django admin interface as well.

admin.site.register(ReviewRating) # Register the ReviewRating model with the admin site
# This allows the ReviewRating model to be managed through the Django admin interface as well.

# The code above defines the admin interface for the Product and Variation models in a Django application.
admin.site.register(ProductGallery) # Register the ProductGallery model with the admin site
# This allows the ProductGallery model to be managed through the Django admin interface as well.
