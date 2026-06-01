from dataclasses import dataclass
from decimal import Decimal
import logging

from django.db import DatabaseError
from django.utils import timezone

from .models import Coupon
from .tracker import RedemptionTracker
from .utils import money

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Complete result returned by coupon validation."""

    is_valid: bool
    coupon: Coupon | None = None
    error_message: str = ""


class CouponValidator:
    """
    Validates coupon eligibility before checkout application or order placement.

    Rules, in order:
    1. Code exists using case-insensitive matching.
    2. Coupon is active.
    3. Current datetime is inside the validity window.
    4. Cart total meets minimum order value.
    5. Total usage is below max_usage_limit.
    6. User usage is below max_usage_per_user.
    """

    @staticmethod
    def validate(code, cart_total, user=None):
        """Validate a coupon code and return a ValidationResult with details."""
        normalized_code = (code or "").strip().upper()
        if not normalized_code:
            return ValidationResult(False, None, "Invalid coupon code")

        try:
            coupon = Coupon.objects.get(code__iexact=normalized_code)
        except Coupon.DoesNotExist:
            return ValidationResult(False, None, "Invalid coupon code")
        except DatabaseError:
            logger.exception("Database error while looking up coupon %s", normalized_code)
            return ValidationResult(False, None, "Unable to process coupon. Please try again.")

        if not coupon.is_active:
            return ValidationResult(False, coupon, "This coupon is not active")

        now = timezone.now()
        if now < coupon.valid_from or now > coupon.valid_to:
            return ValidationResult(False, coupon, "This coupon has expired")

        cart_total = money(cart_total)
        minimum_order_value = coupon.minimum_order_value
        if minimum_order_value is not None and cart_total < Decimal(minimum_order_value):
            return ValidationResult(
                False,
                coupon,
                f"Minimum order value of ${money(minimum_order_value)} required",
            )

        tracker = RedemptionTracker()

        try:
            if coupon.max_usage_limit is not None:
                total_usage = tracker.get_total_usage(coupon)
                if total_usage >= coupon.max_usage_limit:
                    return ValidationResult(False, coupon, "This coupon has reached its usage limit")

            if user is not None and getattr(user, "is_authenticated", True) and coupon.max_usage_per_user is not None:
                user_usage = tracker.get_user_usage(coupon, user)
                if user_usage >= coupon.max_usage_per_user:
                    return ValidationResult(
                        False,
                        coupon,
                        "You have already used this coupon the maximum number of times",
                    )
        except DatabaseError:
            logger.exception("Database error while counting coupon usage for %s", coupon.code)
            return ValidationResult(False, coupon, "Unable to process coupon. Please try again.")

        return ValidationResult(True, coupon, "")
