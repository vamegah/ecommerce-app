from __future__ import annotations

from decouple import config


class CSPMiddleware:
    """Attach a baseline CSP header for production hardening."""

    def __init__(self, get_response):
        self.get_response = get_response
        self.policy = config(
            "CSP_POLICY",
            default=(
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "font-src 'self' data:; "
                "connect-src 'self'; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self'"
            ),
        )

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault("Content-Security-Policy", self.policy)
        return response
