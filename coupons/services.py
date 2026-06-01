import logging
from decimal import Decimal

from django.db import DatabaseError, transaction

from .models import Coupon
from .tracker import RedemptionTracker
from .utils import DiscountEngine, money
from .validators import CouponValidator

logger = logging.getLogger(__name__)


class CouponSessionService:
    """
    Handles coupon session restoration, validation, discount calculation, and
    redemption recording.
    """

    canonical_key = "applied_coupon_code"
    legacy_key = "coupon_code"
    discount_key = "discount_amount"

    def __init__(self, request):
        self.request = request
        self.session = request.session
        request_user = getattr(request, "user", None)
        self.user = request_user if getattr(request_user, "is_authenticated", False) else None

    def get_coupon_code(self):
        """Return the applied coupon code from canonical or legacy session keys."""
        return self.session.get(self.canonical_key) or self.session.get(self.legacy_key)

    def set_coupon(self, coupon_code, discount_amount):
        """Persist coupon details for the current checkout session."""
        normalized_code = (coupon_code or "").strip().upper()
        self.session[self.canonical_key] = normalized_code
        self.session[self.legacy_key] = normalized_code
        self.session[self.discount_key] = str(money(discount_amount))
        self.session.modified = True

    def clear_coupon(self):
        """Remove all coupon-related session state."""
        for key in (self.canonical_key, self.legacy_key, self.discount_key):
            self.session.pop(key, None)
        self.session.modified = True

    def get_applied_coupon(self, cart_total):
        """
        Validate the coupon stored in session and return
        (coupon, discount_amount, error_message).
        """
        coupon_code = self.get_coupon_code()
        if not coupon_code:
            return None, Decimal("0.00"), None

        try:
            coupon = Coupon.objects.get(code__iexact=coupon_code)
        except Coupon.DoesNotExist:
            self.clear_coupon()
            return None, Decimal("0.00"), "Applied coupon no longer exists."
        except Exception:
            logger.exception("Database error while restoring coupon %s", coupon_code)
            return None, Decimal("0.00"), "Error retrieving coupon."

        validator = CouponValidator()
        try:
            validation_result = validator.validate(coupon_code, money(cart_total), self.user)
        except DatabaseError:
            logger.exception("Database error while validating coupon %s", coupon_code)
            return None, Decimal("0.00"), "Error retrieving coupon."

        if not validation_result.is_valid:
            self.clear_coupon()
            return None, Decimal("0.00"), f"Coupon removed: {validation_result.error_message}"

        try:
            coupon = validation_result.coupon if isinstance(validation_result.coupon, Coupon) else coupon
            engine = DiscountEngine()
            discount_amount = engine.calculate_discount(coupon, cart_total)
            code_to_store = coupon.code if isinstance(getattr(coupon, "code", None), str) else coupon_code
            self.set_coupon(code_to_store, discount_amount)
            return coupon, discount_amount, None
        except Exception:
            logger.exception("Error processing coupon %s", coupon_code)
            self.clear_coupon()
            return None, Decimal("0.00"), "Error processing coupon."

    def record_redemption(self, coupon, order, discount_amount):
        """Record coupon redemption atomically and log failures for diagnosis."""
        try:
            with transaction.atomic():
                tracker = RedemptionTracker()
                return tracker.record_redemption(coupon, order, self.user, discount_amount)
        except Exception:
            logger.exception("Failed to record coupon redemption for order %s", getattr(order, "id", None))
            return None
