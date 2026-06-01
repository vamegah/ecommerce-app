# Requirements Document: Discount Codes/Coupons

## Introduction

This document specifies the requirements for a discount code/coupon system for the GreatKart e-commerce application. The system enables administrators to create promotional codes that customers can apply at checkout to receive discounts on their orders. The feature supports various discount types, usage restrictions, and validity periods to enable flexible promotional campaigns.

## Glossary

- **Coupon_System**: The complete discount code management and application system
- **Coupon**: A promotional code entity with associated discount rules and restrictions
- **Discount_Engine**: The component responsible for calculating discount amounts
- **Redemption**: A record of a coupon being applied to an order
- **Cart_Total**: The sum of all cart items before tax and discounts
- **Order_Total**: The final amount after applying discounts and tax
- **Admin_Panel**: Django admin interface for managing coupons
- **Checkout_Page**: The page where users review their order and apply coupons
- **Valid_Coupon**: A coupon that meets all validation criteria (active, within date range, usage limits not exceeded)

## Requirements

### Requirement 1: Coupon Creation and Management

**User Story:** As an administrator, I want to create and manage discount coupons in the admin panel, so that I can run promotional campaigns.

#### Acceptance Criteria

1. THE Admin_Panel SHALL provide an interface to create new coupons
2. WHEN creating a coupon, THE Admin_Panel SHALL require a unique coupon code
3. WHEN creating a coupon, THE Admin_Panel SHALL require a discount type (percentage or fixed amount)
4. WHEN creating a coupon, THE Admin_Panel SHALL require a discount value
5. THE Admin_Panel SHALL allow setting an optional minimum order value requirement
6. THE Admin_Panel SHALL allow setting an optional maximum usage limit
7. THE Admin_Panel SHALL allow setting an optional per-user usage limit
8. THE Admin_Panel SHALL allow setting validity start and end dates
9. THE Admin_Panel SHALL allow activating or deactivating coupons
10. THE Admin_Panel SHALL display all existing coupons with their key attributes

### Requirement 2: Discount Calculation

**User Story:** As a customer, I want my discount to be calculated correctly based on the coupon type, so that I receive the appropriate price reduction.

#### Acceptance Criteria

1. WHEN a percentage coupon is applied, THE Discount_Engine SHALL calculate the discount as (cart_total × percentage / 100)
2. WHEN a fixed amount coupon is applied, THE Discount_Engine SHALL deduct the fixed amount from the cart total
3. WHEN a fixed amount exceeds the cart total, THE Discount_Engine SHALL set the discount equal to the cart total
4. THE Discount_Engine SHALL apply discounts before tax calculation
5. THE Discount_Engine SHALL recalculate the order total as (cart_total - discount + tax)

### Requirement 3: Coupon Validation

**User Story:** As a system, I want to validate coupons before applying them, so that only eligible discounts are granted.

#### Acceptance Criteria

1. WHEN a coupon code is submitted, THE Coupon_System SHALL verify the code exists
2. WHEN validating a coupon, THE Coupon_System SHALL verify it is active
3. WHEN validating a coupon, THE Coupon_System SHALL verify the current date is within the validity period
4. WHEN a coupon has a minimum order value, THE Coupon_System SHALL verify the cart total meets this requirement
5. WHEN a coupon has a maximum usage limit, THE Coupon_System SHALL verify total redemptions are below this limit
6. WHEN a coupon has a per-user limit, THE Coupon_System SHALL verify the user's redemptions are below this limit
7. IF validation fails, THEN THE Coupon_System SHALL return a descriptive error message
8. IF validation succeeds, THEN THE Coupon_System SHALL mark the coupon as applicable

### Requirement 4: Coupon Application at Checkout

**User Story:** As a customer, I want to apply a coupon code at checkout, so that I can receive a discount on my order.

#### Acceptance Criteria

1. THE Checkout_Page SHALL display an input field for entering coupon codes
2. THE Checkout_Page SHALL display an "Apply" button next to the coupon input field
3. WHEN a user clicks the Apply button, THE Coupon_System SHALL validate the entered code
4. WHEN a coupon is successfully applied, THE Checkout_Page SHALL display the discount amount in the order summary
5. WHEN a coupon is successfully applied, THE Checkout_Page SHALL display the coupon code being used
6. WHEN a coupon is successfully applied, THE Checkout_Page SHALL update the order total
7. WHEN coupon validation fails, THE Checkout_Page SHALL display the error message to the user
8. WHEN a coupon is already applied, THE Checkout_Page SHALL display a "Remove" option

### Requirement 5: Single Coupon Restriction

**User Story:** As a business owner, I want to prevent customers from stacking multiple coupons, so that discounts remain within acceptable margins.

#### Acceptance Criteria

1. WHEN a coupon is already applied to a cart, THE Coupon_System SHALL reject attempts to apply additional coupons
2. WHEN a user attempts to apply a second coupon, THE Coupon_System SHALL return an error message indicating only one coupon is allowed
3. WHEN a user removes an applied coupon, THE Coupon_System SHALL allow applying a different coupon

### Requirement 6: Coupon Redemption Tracking

**User Story:** As an administrator, I want to track coupon usage and redemptions, so that I can analyze promotional campaign effectiveness.

#### Acceptance Criteria

1. WHEN a coupon is successfully applied to an order, THE Coupon_System SHALL create a redemption record
2. THE Redemption SHALL store the coupon code, user, order, and timestamp
3. THE Coupon_System SHALL increment the total usage count for the coupon
4. THE Coupon_System SHALL increment the per-user usage count for the coupon and user
5. THE Admin_Panel SHALL display redemption statistics for each coupon
6. THE Admin_Panel SHALL allow viewing detailed redemption history

### Requirement 7: Order Summary Display

**User Story:** As a customer, I want to see the discount clearly displayed in my order summary, so that I understand the final price breakdown.

#### Acceptance Criteria

1. WHEN a coupon is applied, THE Checkout_Page SHALL display a "Discount" line item in the order summary
2. THE Checkout_Page SHALL display the discount amount with a negative sign or "minus" indicator
3. THE Checkout_Page SHALL display the coupon code next to the discount amount
4. THE Checkout_Page SHALL display the subtotal, discount, tax, and grand total in sequence
5. THE Checkout_Page SHALL update all amounts dynamically when a coupon is applied or removed

### Requirement 8: Session Persistence

**User Story:** As a customer, I want my applied coupon to persist during my checkout session, so that I don't have to re-enter it.

#### Acceptance Criteria

1. WHEN a coupon is applied, THE Coupon_System SHALL store the coupon code in the user's session
2. WHEN a user navigates away from checkout and returns, THE Coupon_System SHALL restore the applied coupon
3. WHEN a user completes an order, THE Coupon_System SHALL clear the coupon from the session
4. WHEN a user removes a coupon, THE Coupon_System SHALL clear it from the session immediately

### Requirement 9: Order Record Integration

**User Story:** As a business, I want coupon information stored with completed orders, so that I have accurate records for accounting and analysis.

#### Acceptance Criteria

1. WHEN an order is placed with a coupon, THE Order SHALL store the coupon code
2. WHEN an order is placed with a coupon, THE Order SHALL store the discount amount
3. THE Admin_Panel SHALL display coupon information in order details
4. THE Order SHALL maintain the discount amount even if the coupon is later modified or deleted

### Requirement 10: Case-Insensitive Code Matching

**User Story:** As a customer, I want coupon codes to work regardless of capitalization, so that I don't have to worry about typing them exactly.

#### Acceptance Criteria

1. WHEN a user enters a coupon code, THE Coupon_System SHALL convert it to uppercase before validation
2. WHEN storing coupon codes, THE Coupon_System SHALL store them in uppercase
3. THE Coupon_System SHALL match codes case-insensitively during lookup
