from decimal import Decimal
import logging

from django.db import transaction

from accounts.models import Account
from orders.models import Order

from .models import Coupon, Redemption
from .utils import money

logger = logging.getLogger(__name__)


class RedemptionTracker:
    """Creates redemption audit records and reports usage counts."""

    @staticmethod
    def _normalize_record_args(coupon, order=None, user=None, discount_amount=Decimal("0.00")):
        """Accept legacy record_redemption(coupon, user, order) calls safely."""
        if isinstance(order, Account) and isinstance(user, Order):
            order, user = user, order
        return coupon, order, user, money(discount_amount)

    @staticmethod
    def record_redemption(coupon, order=None, user=None, discount_amount=Decimal("0.00")):
        """
        Create a Redemption record atomically.

        The coupon row is locked while recording so validation plus creation can
        be composed safely near usage limits.
        """
        coupon, order, user, discount_amount = RedemptionTracker._normalize_record_args(
            coupon, order, user, discount_amount
        )

        if order is None:
            raise ValueError("order is required to record a coupon redemption")

        with transaction.atomic():
            locked_coupon = Coupon.objects.select_for_update().get(pk=coupon.pk)
            redemption, _created = Redemption.objects.get_or_create(
                order=order,
                defaults={
                    "coupon": locked_coupon,
                    "user": user,
                    "discount_amount": discount_amount,
                },
            )

            if not _created:
                redemption.coupon = locked_coupon
                redemption.user = user
                redemption.discount_amount = discount_amount
                redemption.save(update_fields=["coupon", "user", "discount_amount"])

            return redemption

    @staticmethod
    def get_total_usage(coupon):
        """Return the total number of redemption records for a coupon."""
        return Redemption.objects.filter(coupon=coupon).count()

    @staticmethod
    def get_user_usage(coupon, user):
        """Return the number of redemptions for this coupon by a specific user."""
        if user is None or not getattr(user, "is_authenticated", True):
            return 0
        return Redemption.objects.filter(coupon=coupon, user=user).count()
