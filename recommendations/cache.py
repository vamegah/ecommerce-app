from __future__ import annotations

import logging
from typing import Any

from django.core.cache import cache

logger = logging.getLogger(__name__)


class RecommendationCache:
    DEFAULT_TTL_SECONDS = 60 * 60
    PREFIX = "recommendations"

    def __init__(self, ttl: int = DEFAULT_TTL_SECONDS):
        self.ttl = ttl

    def key(self, recommendation_type: str, identifier: str | int) -> str:
        return f"{self.PREFIX}:{recommendation_type}:{identifier}"

    def get(self, recommendation_type: str, identifier: str | int) -> Any:
        try:
            return cache.get(self.key(recommendation_type, identifier))
        except Exception:
            logger.exception("Recommendation cache get failed")
            return None

    def set(self, recommendation_type: str, identifier: str | int, value: Any, ttl: int | None = None) -> bool:
        try:
            cache.set(self.key(recommendation_type, identifier), value, timeout=ttl or self.ttl)
            return True
        except Exception:
            logger.exception("Recommendation cache set failed")
            return False

    def invalidate_product(self, product_id: int) -> None:
        for rec_type, limits in {
            "related": (3, 4, 6, 8),
            "fbt": (3, 4, 6, 8),
            "popular": (4, 6, 8),
            "cart": (4, 6, 8),
            "personalized": (4, 6, 8),
        }.items():
            for limit in limits:
                cache.delete(self.key(rec_type, f"{product_id}:{limit}"))
                cache.delete(self.key(rec_type, f"popular:{limit}"))

    def invalidate_user(self, user_id: int) -> None:
        for limit in (4, 6, 8):
            cache.delete(self.key("personalized", f"{user_id}:{limit}"))

    def invalidate_pattern(self, pattern: str) -> None:
        # LocMemCache exposes _cache keys; Redis backends usually provide delete_pattern.
        try:
            if hasattr(cache, "delete_pattern"):
                cache.delete_pattern(pattern)
                return
            if hasattr(cache, "_cache"):
                cache.clear()
            else:
                cache.clear()
        except Exception:
            logger.exception("Recommendation cache pattern invalidation failed")
