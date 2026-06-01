from decimal import Decimal, ROUND_HALF_UP


TWOPLACES = Decimal("0.01")
DEFAULT_TAX_RATE = Decimal("0.02")


def to_decimal(value):
    """Convert numeric input to Decimal without inheriting float precision noise."""
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value or "0"))


def money(value):
    """Round monetary values to two decimal places using standard checkout rounding."""
    return to_decimal(value).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


class DiscountEngine:
    """
    Calculates coupon discounts and final order totals.

    Percentage formula:
        discount = cart_total * (discount_value / 100)

    Fixed formula:
        discount = min(discount_value, cart_total)

    Tax is calculated after the discount:
        tax = (cart_total - discount) * tax_rate
    """

    @staticmethod
    def _coerce_args(first, second):
        """Accept both calculate_discount(coupon, cart_total) and legacy reversed order."""
        if hasattr(first, "discount_type"):
            return first, money(second)
        return second, money(first)

    @staticmethod
    def calculate_discount(first, second):
        """Return the discount amount for the coupon, capped so totals never go negative."""
        coupon, cart_total = DiscountEngine._coerce_args(first, second)
        if cart_total <= 0 or coupon is None:
            return Decimal("0.00")

        discount_value = to_decimal(coupon.discount_value)

        if coupon.discount_type == "percentage":
            discount = cart_total * (discount_value / Decimal("100"))
        elif coupon.discount_type == "fixed":
            discount = min(discount_value, cart_total)
        else:
            discount = Decimal("0.00")

        return money(min(discount, cart_total))

    @staticmethod
    def calculate_order_total(first, second, tax_rate=DEFAULT_TAX_RATE):
        """
        Calculate subtotal, discount, tax, and final total.

        Accepts both calculate_order_total(coupon, cart_total) and the legacy
        calculate_order_total(cart_total, coupon) call shape.
        """
        coupon, cart_total = DiscountEngine._coerce_args(first, second)
        discount = DiscountEngine.calculate_discount(coupon, cart_total)
        subtotal_after_discount = money(max(cart_total - discount, Decimal("0.00")))
        tax = money(subtotal_after_discount * to_decimal(tax_rate))
        total = money(subtotal_after_discount + tax)

        return {
            "cart_total": money(cart_total),
            "discount": discount,
            "subtotal_after_discount": subtotal_after_discount,
            "tax": tax,
            "total": total,
        }
