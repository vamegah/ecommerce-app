# Coupons App

## Overview

The coupons app implements discount-code creation, validation, checkout application,
session restoration, order persistence, redemption tracking, and Django admin
management for GreatKart.

## Architecture

- `Coupon` stores discount rules: code, type, value, validity window, active flag,
  minimum order value, and usage limits.
- `Redemption` stores immutable usage history linked to a coupon, user, order, and
  applied discount amount.
- `DiscountEngine` calculates percentage and fixed discounts, caps fixed discounts
  at the cart total, and applies tax after discount.
- `CouponValidator` performs case-insensitive lookup and checks active status,
  validity dates, minimum order value, total usage, and per-user usage.
- `CouponSessionService` restores and clears session coupons during checkout and
  records redemptions after payment.
- `RedemptionTracker` creates redemption records atomically and reports usage
  counts for validation and admin reporting.

## Checkout Flow

1. The checkout template posts coupon codes to `POST /checkout/apply-coupon/`.
2. The endpoint rejects empty carts, enforces one coupon per order, validates the
   code, calculates the discount, and stores the coupon in session.
3. Returning checkout sessions restore the coupon, revalidate it, and recalculate
   the discount from the current cart total.
4. Order creation validates the coupon again and stores `coupon_code` and
   `discount_amount` on the `Order`.
5. Payment completion records a `Redemption` and clears coupon session state.

## Admin

`CouponAdmin` supports coupon creation and filtering by active status, discount
type, and creation date. It shows total redemption count and inline read-only
redemption history. `RedemptionAdmin` is read-only audit history.

## Tests

The coupons suite covers all 17 correctness properties from the design document
with Hypothesis where randomized input is useful, plus unit and integration tests
for views, templates, admin, session restoration, and error handling.

Run:

```bash
python manage.py test coupons
```

Run project checks:

```bash
python manage.py check
```

## Migrations

- `coupons/migrations/0001_initial.py` creates `Coupon` and `Redemption`.
- `orders/migrations/0005_order_coupon_fields.py` adds coupon persistence fields
  to `Order`.
