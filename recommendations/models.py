from django.db import models
from store.models import Product
from accounts.models import Account


class RelatedProduct(models.Model):
    """
    Manual related product associations set by admins.
    """
    product = models.ForeignKey(
        Product, 
        on_delete=models.CASCADE, 
        related_name='manual_related_from'
    )
    related_product = models.ForeignKey(
        Product, 
        on_delete=models.CASCADE, 
        related_name='manual_related_to'
    )
    order = models.PositiveIntegerField(
        default=0,
        help_text="Display order (lower numbers first)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True
    )
    
    class Meta:
        db_table = 'related_products'
        unique_together = ('product', 'related_product')
        ordering = ['order', '-created_at']
        indexes = [
            models.Index(fields=['product', 'order']),
        ]
    
    def __str__(self):
        return f"{self.product.product_name} -> {self.related_product.product_name}"


class RecommendationClick(models.Model):
    """
    Tracks clicks on recommended products.
    """
    SOURCE_TYPES = (
        ('related', 'Related Products'),
        ('fbt', 'Frequently Bought Together'),
        ('cart', 'Cart Recommendations'),
        ('homepage', 'Homepage Recommendations'),
    )
    
    user = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    session_key = models.CharField(
        max_length=40,
        null=True,
        blank=True,
        help_text="Session key for anonymous users"
    )
    source_type = models.CharField(
        max_length=20,
        choices=SOURCE_TYPES
    )
    source_product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recommendation_source'
    )
    recommended_product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        related_name='recommendation_target'
    )
    clicked_at = models.DateTimeField(auto_now_add=True)
    added_to_cart = models.BooleanField(
        default=False,
        help_text="Whether user added product to cart after click"
    )
    
    class Meta:
        db_table = 'recommendation_clicks'
        indexes = [
            models.Index(fields=['source_type', 'clicked_at']),
            models.Index(fields=['user', 'clicked_at']),
            models.Index(fields=['recommended_product', 'clicked_at']),
        ]
    
    def __str__(self):
        return f"{self.source_type}: {self.recommended_product.product_name if self.recommended_product else 'N/A'}"
