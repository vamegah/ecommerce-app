from decimal import Decimal
import logging

from django.http import JsonResponse
from django.views.decorators.http import require_POST

from carts.models import Cart, CartItem
from carts.views import _cart_id

from .services import CouponSessionService
from .utils import DiscountEngine, money
from .validators import CouponValidator

logger = logging.getLogger(__name__)


def _get_cart_items(request):
    """Return active cart items for authenticated or anonymous checkout sessions."""
    if request.user.is_authenticated:
        return CartItem.objects.filter(user=request.user, is_active=True).select_related("product")

    try:
        cart = Cart.objects.get(cart_id=_cart_id(request))
    except Cart.DoesNotExist:
        return CartItem.objects.none()
    return CartItem.objects.filter(cart=cart, is_active=True).select_related("product")


def get_cart_total(request):
    """Calculate the current cart subtotal before discount and tax."""
    total = Decimal("0.00")
    for item in _get_cart_items(request):
        total += Decimal(str(item.product.price)) * Decimal(item.quantity)
    return money(total)


def _totals_payload(cart_total, coupon=None):
    """Build a consistent subtotal/discount/tax/grand-total response payload."""
    if coupon is None:
        subtotal_after_discount = cart_total
        discount = Decimal("0.00")
        tax = money(subtotal_after_discount * Decimal("0.02"))
        grand_total = money(subtotal_after_discount + tax)
    else:
        order_total = DiscountEngine.calculate_order_total(coupon, cart_total)
        discount = order_total["discount"]
        tax = order_total["tax"]
        grand_total = order_total["total"]

    return {
        "subtotal": str(money(cart_total)),
        "discount": str(money(discount)),
        "tax": str(money(tax)),
        "grand_total": str(money(grand_total)),
    }


@require_POST
def apply_coupon(request):
    """Apply a single coupon to the current checkout session."""
    service = CouponSessionService(request)
    requested_code = (request.POST.get("code") or request.POST.get("coupon_code") or "").strip().upper()

    if not requested_code:
        return JsonResponse({"success": False, "error": "Invalid coupon code"}, status=400)

    applied_code = service.get_coupon_code()
    if applied_code and applied_code.upper() != requested_code:
        return JsonResponse(
            {
                "success": False,
                "error": "Only one coupon can be applied per order. Please remove the current coupon first.",
            },
            status=400,
        )

    cart_total = get_cart_total(request)
    if cart_total <= 0:
        return JsonResponse(
            {
                "success": False,
                "error": "Coupon cannot be applied to orders with zero value",
            },
            status=400,
        )

    validation_result = CouponValidator.validate(requested_code, cart_total, request.user)
    if not validation_result.is_valid:
        return JsonResponse({"success": False, "error": validation_result.error_message}, status=400)

    try:
        coupon = validation_result.coupon
        discount = DiscountEngine.calculate_discount(coupon, cart_total)
        service.set_coupon(coupon.code, discount)
    except Exception:
        logger.exception("Unable to calculate discount for coupon %s", requested_code)
        return JsonResponse(
            {"success": False, "error": "Unable to calculate discount"},
            status=500,
        )

    return JsonResponse({
        "success": True,
        "message": "Coupon applied successfully",
        "code": coupon.code,
        **_totals_payload(cart_total, coupon),
    })


@require_POST
def remove_coupon(request):
    """Remove the applied coupon from the checkout session."""
    CouponSessionService(request).clear_coupon()
    cart_total = get_cart_total(request)
    return JsonResponse({
        "success": True,
        "message": "Coupon removed",
        **_totals_payload(cart_total),
    })
