from __future__ import annotations

import logging

try:
    from celery import shared_task
except ImportError:  # pragma: no cover
    def shared_task(func):
        return func

from django.db.models import Count

from orders.models import Order, OrderProduct
from store.models import Product

from .cache import RecommendationCache
from .engine import RecommendationEngine
from .models import RecommendationClick

logger = logging.getLogger(__name__)


@shared_task
def warm_cache_for_popular_products():
    engine = RecommendationEngine()
    products = (
        Product.objects.filter(is_available=True, stock__gt=0)
        .annotate(order_count=Count("orderproduct"))
        .order_by("-order_count")[:100]
    )
    for product in products:
        engine.get_related_products(product, limit=6)
        engine.get_frequently_bought_together(product, limit=4)
    engine.get_popular_products(limit=8)
    return len(products)


@shared_task
def invalidate_recommendations_after_order(order_id: int):
    cache_manager = RecommendationCache()
    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return 0
    product_ids = list(OrderProduct.objects.filter(order=order).values_list("product_id", flat=True))
    for product_id in product_ids:
        cache_manager.invalidate_product(product_id)
    if order.user_id:
        cache_manager.invalidate_user(order.user_id)
    return len(product_ids)


@shared_task
def log_recommendation_click(source_type, source_product_id, recommended_product_id, user_id=None, session_key=None):
    RecommendationClick.objects.create(
        source_type=source_type,
        source_product_id=source_product_id,
        recommended_product_id=recommended_product_id,
        user_id=user_id,
        session_key=session_key,
    )
    return True


@shared_task
def aggregate_recommendation_metrics():
    metrics = {}
    for source_type in ("related", "fbt", "cart", "homepage"):
        total = RecommendationClick.objects.filter(source_type=source_type).count()
        converted = RecommendationClick.objects.filter(source_type=source_type, added_to_cart=True).count()
        metrics[source_type] = {
            "clicks": total,
            "conversion_rate": (converted / total) if total else 0,
        }
    return metrics
