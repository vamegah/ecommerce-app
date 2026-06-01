from __future__ import annotations

import logging
from collections import Counter
from datetime import timedelta
from time import perf_counter

from django.db.models import Count, Q
from django.utils import timezone

from carts.models import CartItem
from orders.models import OrderProduct
from store.models import Product

from .cache import RecommendationCache
from .models import RelatedProduct

logger = logging.getLogger(__name__)


class RecommendationEngine:
    def __init__(self, cache_manager: RecommendationCache | None = None, timeout_ms: int = 200):
        self.cache = cache_manager or RecommendationCache()
        self.timeout_ms = timeout_ms

    def _within_timeout(self, start: float) -> bool:
        return (perf_counter() - start) * 1000 < self.timeout_ms

    def _filter_available_products(self, queryset):
        return queryset.filter(is_available=True, stock__gt=0).filter(Q(reviewrating__rating__gt=2.0) | Q(reviewrating__isnull=True)).distinct()

    def _variation_parent(self, product: Product) -> Product:
        # Variations are separate entities in this app; always return product itself as parent object.
        return product

    def _to_product_ids(self, products):
        return [product.id for product in products]

    def _from_product_ids(self, product_ids):
        product_map = {
            product.id: product
            for product in self._filter_available_products(Product.objects.filter(id__in=product_ids))
        }
        return [product_map[product_id] for product_id in product_ids if product_id in product_map]

    def get_related_products(self, product: Product, limit: int = 6):
        start = perf_counter()
        cache_key = f"{product.id}:{limit}"
        cached = self.cache.get("related", cache_key)
        if cached is not None:
            return self._from_product_ids(cached)
        try:
            manual = list(
                self._filter_available_products(
                    Product.objects.filter(
                        id__in=RelatedProduct.objects.filter(product=product).order_by("order").values_list("related_product_id", flat=True)[:3]
                    )
                ).exclude(id=product.id)[:3]
            )
            remaining = max(limit - len(manual), 0)
            automatic = list(
                self._filter_available_products(
                    Product.objects.filter(category=product.category)
                ).exclude(id__in=[product.id] + [item.id for item in manual]).order_by("-created_date")[:remaining]
            )
            combined = [self._variation_parent(item) for item in (manual + automatic)][:limit]
            self.cache.set("related", cache_key, self._to_product_ids(combined))
            return combined
        except Exception:
            logger.exception("Failed to build related products for product=%s", product.id)
            if not self._within_timeout(start):
                return []
            return []

    def get_frequently_bought_together(self, product: Product, limit: int = 4):
        cache_key = f"{product.id}:{limit}"
        cached = self.cache.get("fbt", cache_key)
        if cached is not None:
            return self._from_product_ids(cached)
        one_year_ago = timezone.now() - timedelta(days=365)
        try:
            order_ids = OrderProduct.objects.filter(
                product=product,
                ordered=True,
                order__is_ordered=True,
                created_at__gte=one_year_ago,
            ).values_list("order_id", flat=True)
            co_purchased = (
                OrderProduct.objects.filter(
                    order_id__in=order_ids,
                    ordered=True,
                    order__is_ordered=True,
                    created_at__gte=one_year_ago,
                )
                .exclude(product=product)
                .values("product_id")
                .annotate(freq=Count("id"))
                .order_by("-freq")
            )
            if co_purchased.count() < 3:
                return []
            product_ids = [item["product_id"] for item in co_purchased[:limit]]
            ranked_products = {
                p.id: p
                for p in self._filter_available_products(Product.objects.filter(id__in=product_ids))
            }
            result = [self._variation_parent(ranked_products[pid]) for pid in product_ids if pid in ranked_products][:limit]
            self.cache.set("fbt", cache_key, self._to_product_ids(result))
            return result
        except Exception:
            logger.exception("Failed to build frequently bought together for product=%s", product.id)
            return []

    def get_popular_products(self, limit: int = 8):
        cache_key = f"popular:{limit}"
        cached = self.cache.get("popular", cache_key)
        if cached is not None:
            return self._from_product_ids(cached)
        try:
            queryset = (
                self._filter_available_products(Product.objects.all())
                .annotate(
                    sales_count=Count("orderproduct"),
                    avg_rating=Count("reviewrating"),
                )
                .order_by("-sales_count", "-avg_rating", "-created_date")[:limit]
            )
            result = [self._variation_parent(item) for item in queryset]
            self.cache.set("popular", cache_key, self._to_product_ids(result))
            return result
        except Exception:
            logger.exception("Failed to build popular products")
            return []

    def get_cart_recommendations(self, user=None, cart_items=None, limit: int = 6):
        cart_items = cart_items if cart_items is not None else self._get_cart_items(user)
        cart_products = [item.product for item in cart_items]
        if not cart_products:
            return self.get_popular_products(limit=limit)
        frequencies = Counter()
        for source_product in cart_products:
            for rec in self.get_frequently_bought_together(source_product, limit=limit):
                if rec.id not in [p.id for p in cart_products]:
                    frequencies[rec.id] += 1
        if not frequencies:
            cart_ids = [item.id for item in cart_products]
            return [p for p in self.get_popular_products(limit=limit + len(cart_ids)) if p.id not in cart_ids][:limit]
        ordered_ids = [pid for pid, _ in frequencies.most_common(limit)]
        products = {p.id: p for p in self._filter_available_products(Product.objects.filter(id__in=ordered_ids))}
        return [products[pid] for pid in ordered_ids if pid in products][:limit]

    def get_personalized_recommendations(self, user, limit: int = 8):
        if not user or not user.is_authenticated:
            return self.get_popular_products(limit=limit)
        cache_key = f"{user.id}:{limit}"
        cached = self.cache.get("personalized", cache_key)
        if cached is not None:
            return self._from_product_ids(cached)
        one_year_ago = timezone.now() - timedelta(days=365)
        try:
            user_product_ids = list(
                OrderProduct.objects.filter(
                    user=user, ordered=True, order__is_ordered=True, created_at__gte=one_year_ago
                ).values_list("product_id", flat=True)
            )
            if not user_product_ids:
                return self.get_popular_products(limit=limit)
            peer_users = (
                OrderProduct.objects.filter(
                    product_id__in=user_product_ids, ordered=True, order__is_ordered=True, created_at__gte=one_year_ago
                )
                .exclude(user=user)
                .values_list("user_id", flat=True)
                .distinct()
            )
            candidates = (
                OrderProduct.objects.filter(
                    user_id__in=peer_users, ordered=True, order__is_ordered=True, created_at__gte=one_year_ago
                )
                .exclude(product_id__in=user_product_ids)
                .values("product_id")
                .annotate(freq=Count("id"))
                .order_by("-freq")
            )
            product_ids = [row["product_id"] for row in candidates[:limit]]
            if not product_ids:
                return self.get_popular_products(limit=limit)
            products = {
                product.id: product
                for product in self._filter_available_products(Product.objects.filter(id__in=product_ids))
            }
            result = [products[pid] for pid in product_ids if pid in products][:limit]
            if not result:
                result = self.get_popular_products(limit=limit)
            self.cache.set("personalized", cache_key, self._to_product_ids(result))
            return result
        except Exception:
            logger.exception("Failed personalized recommendations for user=%s", user.id)
            return self.get_popular_products(limit=limit)

    def _get_cart_items(self, user):
        if not user or not user.is_authenticated:
            return []
        return list(CartItem.objects.filter(user=user, is_active=True).select_related("product"))
