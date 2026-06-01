# Discount Codes System - Testing Guide

This guide outlines the testing procedures for the Discount Codes/Coupons system, covering automated unit tests, property-based tests, and manual verification flows.

## 1. Automated Testing

### Running the Test Suite
To run all tests for the coupons app:
```bash
python manage.py test coupons
```

### Property-Based Tests
We use `hypothesis` for property-based testing to verify correctness across a wide range of inputs. These tests cover:
- Unique coupon codes
- Order total calculations
- Discount capping
- Tax calculations
- Validation rules

To run these specifically (if tagged):
```bash
python manage.py test coupons.tests
```
*Note: Ensure `hypothesis` is installed (`pip install hypothesis`).*

### Service Layer Tests
To test the session management and error handling logic:
```bash
python manage.py test coupons.tests.test_services
```

## 2. Manual Verification Checklist

### User Flow
1.  **Browse & Cart**: Add items to the cart.
2.  **Apply Coupon**:
    -   Go to checkout.
    -   Enter a valid coupon code (e.g., `SAVE10`).
    -   Verify the discount is applied and the total is updated.
    -   Verify the coupon code is displayed.
3.  **Session Persistence**:
    -   Refresh the page. Verify the coupon remains applied.
    -   Navigate away and return. Verify the coupon remains applied.
4.  **Remove Coupon**:
    -   Click "Remove". Verify the discount is removed and the total reverts.
5.  **Order Placement**:
    -   Apply coupon and place an order.
    -   Verify the order is created successfully.
    -   Verify the coupon is cleared from the session after the order.

### Admin Flow
1.  **Create Coupon**: Create a new coupon in the Django Admin.
2.  **View Redemptions**: After placing an order, check the "Redemptions" section in Admin.
3.  **Deactivate**: Uncheck "Is active" for a coupon and try to apply it at checkout (should fail).

### Error Handling
1.  **Invalid Code**: Enter a non-existent code. Verify error message.
2.  **Expired Coupon**: Try to apply an expired coupon. Verify error message.
3.  **Minimum Order**: Try to apply a coupon where `cart_total < min_order_value`. Verify error message.
4.  **Zero Cart**: Empty cart or zero value. Verify coupon cannot be applied.

## 3. Troubleshooting
- **Logs**: Check Django logs for `coupons.services` errors if coupon application fails silently.
- **Database**: Ensure migrations are applied (`python manage.py migrate`).