from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError

from .engine import RecommendationEngine


class RecommendationMixin:
    recommendation_timeout_seconds = 0.2

    @property
    def recommendation_engine(self):
        return RecommendationEngine()

    def _with_timeout(self, fn, fallback):
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(fn)
            try:
                return future.result(timeout=self.recommendation_timeout_seconds)
            except TimeoutError:
                return fallback
            except Exception:
                return fallback

    def get_related_products_context(self, product):
        return {
            "related_products": self._with_timeout(
                lambda: self.recommendation_engine.get_related_products(product, limit=6), []
            ),
            "frequently_bought_together": self._with_timeout(
                lambda: self.recommendation_engine.get_frequently_bought_together(product, limit=4), []
            ),
        }

    def get_cart_recommendations_context(self, user, cart_items, limit=6):
        return {
            "cart_recommendations": self._with_timeout(
                lambda: self.recommendation_engine.get_cart_recommendations(
                    user=user, cart_items=cart_items, limit=limit
                ),
                [],
            )
        }

    def get_homepage_recommendations_context(self, user):
        return {
            "homepage_recommendations": self._with_timeout(
                lambda: self.recommendation_engine.get_personalized_recommendations(
                    user=user, limit=8
                ),
                [],
            )
        }
