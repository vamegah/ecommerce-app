from __future__ import annotations

import time

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse


class RateLimitMiddleware:
    """Simple cache-backed IP rate limiter for API and auth paths."""

    def __init__(self, get_response):
        self.get_response = get_response
        self.enabled = getattr(settings, "RATE_LIMIT_ENABLED", False)
        self.window = int(getattr(settings, "RATE_LIMIT_WINDOW_SECONDS", 60))
        self.limit = int(getattr(settings, "RATE_LIMIT_MAX_REQUESTS", 120))
        self.protected_prefixes = tuple(
            getattr(
                settings,
                "RATE_LIMIT_PROTECTED_PREFIXES",
                ("/accounts/", "/orders/", "/cart/", "/checkout/", "/api/"),
            )
        )

    def __call__(self, request):
        if not self.enabled or not request.path.startswith(self.protected_prefixes):
            return self.get_response(request)

        ip = self._get_ip(request)
        bucket = int(time.time() // self.window)
        key = f"ratelimit:{ip}:{bucket}"
        count = cache.get(key, 0) + 1
        cache.set(key, count, timeout=self.window + 5)

        if count > self.limit:
            return JsonResponse({"detail": "Too many requests"}, status=429)

        return self.get_response(request)

    @staticmethod
    def _get_ip(request):
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "unknown")
