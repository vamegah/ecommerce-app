from __future__ import annotations

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from orders.models import Order
from store.models import Product

from .cache import RecommendationCache
from .models import RelatedProduct
from .tasks import invalidate_recommendations_after_order


@receiver(post_save, sender=Product)
def invalidate_on_product_update(sender, instance, **kwargs):
    cache_manager = RecommendationCache()
    cache_manager.invalidate_product(instance.id)


@receiver(post_save, sender=Order)
def invalidate_on_order_completion(sender, instance, created, **kwargs):
    if instance.is_ordered:
        if hasattr(invalidate_recommendations_after_order, "delay"):
            invalidate_recommendations_after_order.delay(instance.id)
        else:
            invalidate_recommendations_after_order(instance.id)


@receiver(post_save, sender=RelatedProduct)
@receiver(post_delete, sender=RelatedProduct)
def invalidate_on_manual_association_change(sender, instance, **kwargs):
    cache_manager = RecommendationCache()
    cache_manager.invalidate_product(instance.product_id)
