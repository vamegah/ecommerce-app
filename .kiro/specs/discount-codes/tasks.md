# Implementation Plan: Discount Codes/Coupons

## Overview

This implementation plan breaks down the discount code system into incremental coding steps. Each task builds on previous work, starting with the data models, then validation logic, checkout integration, and finally admin interface enhancements. The plan includes property-based tests using Hypothesis to verify correctness properties from the design document.

## Tasks

- [x] 1. Set up coupons app and create data models
  - Create new Django app named `coupons`
  - Add `coupons` to INSTALLED_APPS in settings
  - Create Coupon model with all fields (code, discount_type, discount_value, minimum_order_value, max_usage_limit, max_usage_per_user, valid_from, valid_to, is_active, timestamps)
  - Create Redemption model with relationships to Coupon, Account, and Order
  - Implement Coupon.clean() method to validate discount_value based on discount_type
  - Implement Coupon.save() method to convert code to uppercase
  - Add database indexes on Redemption model for performance
  - Create and run migrations
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.8, 10.2_

- [x] 1.1 Write property test for unique coupon codes
  - **Property 1: Unique Coupon Codes**
  - **Validates: Requirements 1.2**

- [x] 1.2 Write unit tests for Coupon model validation
  - Test discount_value constraints for percentage (0-100) and fixed (>0)
  - Test code uppercase conversion
  - Test date range validation (valid_from < valid_to)
  - _Requirements: 1.2, 1.3, 1.4, 10.2_

- [x] 2. Implement discount calculation engine
  - Create DiscountEngine class in coupons/utils.py
  - Implement calculate_discount() method for percentage discounts
  - Implement calculate_discount() method for fixed amount discounts
  - Handle edge case where fixed amount exceeds cart total
  - Implement calculate_order_total() method that applies discount before tax
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2.1 Write property test for order total calculation
  - **Property 2: Order Total Calculation Correctness**
  - **Validates: Requirements 2.1, 2.2, 2.5**

- [x] 2.2 Write property test for fixed discount capping
  - **Property 3: Fixed Discount Capping**
  - **Validates: Requirements 2.3**

- [x] 2.3 Write property test for tax applied after discount
  - **Property 4: Tax Applied After Discount**
  - **Validates: Requirements 2.4**

- [x] 3. Implement coupon validation logic
  - Create CouponValidator class in coupons/validators.py
  - Create ValidationResult dataclass with is_valid, coupon, and error_message fields
  - Implement validate() method with all validation checks:
    - Coupon exists (case-insensitive lookup)
    - Coupon is active
    - Current date within validity period
    - Cart total meets minimum order value
    - Total usage below max_usage_limit
    - Per-user usage below max_usage_per_user
  - Return appropriate error messages for each validation failure
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 10.1, 10.3_

- [x] 3.1 Write property tests for validation rules
  - **Property 5: Invalid Code Rejection**
  - **Property 6: Inactive Coupon Rejection**
  - **Property 7: Date Range Validation**
  - **Property 8: Minimum Order Value Enforcement**
  - **Property 9: Maximum Usage Limit Enforcement**
  - **Property 10: Per-User Usage Limit Enforcement**
  - **Property 11: Validation Result Completeness**
  - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

- [x] 3.2 Write unit tests for validation error messages
  - Test each error message matches expected text
  - Test error messages include relevant details (e.g., minimum order amount)
  - _Requirements: 3.7_

- [x] 4. Modify Order model to store coupon information
  - Add coupon_code field (CharField, max_length=50, nullable)
  - Add discount_amount field (DecimalField, default=0)
  - Update order total calculation to include discount
  - Create and run migration
  - _Requirements: 9.1, 9.2_

- [x] 4.1 Write property test for order record persistence
  - **Property 16: Order Record Persistence**
  - **Validates: Requirements 9.1, 9.2, 9.4**

- [x] 5. Create redemption tracking system
  - Create RedemptionTracker class in coupons/tracker.py
  - Implement record_redemption() method to create Redemption records
  - Implement get_total_usage() method to count total redemptions
  - Implement get_user_usage() method to count per-user redemptions
  - Use select_for_update() for atomic usage counting to prevent race conditions
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 5.1 Write property tests for redemption tracking
  - **Property 13: Redemption Record Creation**
  - **Property 14: Usage Count Accuracy**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 5.2 Write unit tests for concurrent redemption handling
  - Test that usage limits are enforced under concurrent access
  - Test select_for_update() prevents over-redemption
  - _Requirements: 6.3, 6.4_

- [x] 6. Checkpoint - Ensure all tests pass
  - Run all unit tests and property tests
  - Verify models, validation, and calculation logic work correctly
  - Ask the user if questions arise

- [x] 7. Create checkout view endpoints for coupon application
  - Create apply_coupon view in coupons/views.py (POST /checkout/apply-coupon/)
  - Implement logic to:
    - Get coupon code from POST data and convert to uppercase
    - Calculate cart total from cart items
    - Check if coupon already applied (single coupon enforcement)
    - Validate coupon using CouponValidator
    - Calculate discount using DiscountEngine
    - Store coupon code in session
    - Return JSON response with discount amount or error
  - Create remove_coupon view (POST /checkout/remove-coupon/)
  - Implement logic to:
    - Clear coupon code from session
    - Return JSON response confirming removal
  - Add URL patterns for both endpoints
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.2, 8.1, 8.4, 10.1_

- [x] 7.1 Write property test for single coupon enforcement
  - **Property 12: Single Coupon Enforcement**
  - **Validates: Requirements 5.1**

- [x] 7.2 Write property test for session persistence

  - **Property 15: Session Persistence**
  - **Validates: Requirements 8.1**

- [x] 7.3 Write property test for case-insensitive matching

  - **Property 17: Case-Insensitive Code Matching**
  - **Validates: Requirements 10.1, 10.2, 10.3**

- [x] 7.4 Write unit tests for checkout view endpoints

  - Test apply_coupon success response
  - Test apply_coupon error responses for each validation failure
  - Test remove_coupon clears session
  - Test single coupon enforcement error message
  - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 5.2, 8.4_

- [x] 8. Update checkout template with coupon UI
  - Add coupon input field to checkout page template
  - Add "Apply" button next to input field
  - Add JavaScript to handle apply button click (AJAX POST to apply_coupon endpoint)
  - Display discount line item in order summary when coupon applied
  - Display coupon code next to discount amount
  - Add "Remove" button/link when coupon is applied
  - Add JavaScript to handle remove button click (AJAX POST to remove_coupon endpoint)
  - Display error messages from validation failures
  - Update order summary amounts dynamically (subtotal, discount, tax, grand total)
  - _Requirements: 4.1, 4.2, 4.8, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 8.1 Write unit tests for checkout template rendering

  - Test coupon input field and apply button are present
  - Test discount line appears when coupon in session
  - Test remove option appears when coupon in session
  - _Requirements: 4.1, 4.2, 4.8, 7.1_

- [x] 9. Integrate coupon with order placement flow
  - Modify order creation view to:
    - Retrieve applied coupon from session
    - Validate coupon again before order placement
    - Calculate final discount amount
    - Store coupon_code and discount_amount in Order model
    - Call RedemptionTracker.record_redemption() after order creation
    - Clear coupon from session after successful order
  - Handle edge case where coupon becomes invalid between application and order placement
  - _Requirements: 6.1, 6.2, 8.3, 9.1, 9.2_

- [x] 9.1 Write integration tests for order placement with coupon

  - Test order created with correct coupon_code and discount_amount
  - Test redemption record created
  - Test usage counts incremented
  - Test session cleared after order
  - Test error handling when coupon becomes invalid
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 8.3, 9.1, 9.2_

- [x] 10. Checkpoint - Test complete checkout flow
  - Manually test applying coupon at checkout
  - Verify discount calculation and display
  - Verify order placement with coupon
  - Verify redemption tracking
  - Ask the user if questions arise

- [x] 11. Configure Django admin for coupon management
  - Register Coupon model in admin.py
  - Customize CouponAdmin with:
    - List display: code, discount_type, discount_value, is_active, valid_from, valid_to
    - List filters: is_active, discount_type, created_at
    - Search fields: code
    - Fieldsets for organized form layout
    - Read-only fields: created_at, updated_at
    - Custom method to display total redemption count
  - Register Redemption model in admin.py
  - Customize RedemptionAdmin with:
    - List display: coupon, user, order, discount_amount, redeemed_at
    - List filters: coupon, redeemed_at
    - Search fields: coupon__code, order__order_number
    - Read-only fields: all (redemptions should not be edited)
  - Add inline display of redemptions in CouponAdmin
  - _Requirements: 1.1, 1.5, 1.6, 1.7, 1.9, 1.10, 6.5, 6.6, 9.3_

- [x] 11.1 Write unit tests for admin interface

  - Test Coupon admin displays all required fields
  - Test Redemption admin displays all required fields
  - Test redemption count display in coupon admin
  - Test inline redemptions display
  - _Requirements: 1.10, 6.5, 6.6, 9.3_

- [x] 12. Add session restoration for returning users
  - Modify checkout view to check for coupon in session on page load
  - If coupon exists in session:
    - Validate it's still valid
    - Calculate and display discount
    - Show remove option
  - If coupon invalid, clear from session and show message
  - _Requirements: 8.2_

- [x] 12.1 Write unit tests for session restoration

  - Test valid coupon restored from session
  - Test invalid coupon cleared from session
  - Test discount displayed on page load with session coupon
  - _Requirements: 8.2_

- [x] 13. Implement error handling and edge cases
  - Add try-except blocks for database errors in validation and redemption
  - Add logging for all error conditions
  - Handle zero cart total edge case (reject coupon application)
  - Handle coupon deleted during checkout (validation fails gracefully)
  - Add transaction handling for redemption recording to ensure atomicity
  - _Requirements: 3.7_

- [x] 13.1 Write unit tests for error handling

  - Test zero cart total rejection
  - Test deleted coupon handling
  - Test database error handling
  - Test transaction rollback on redemption failure
  - _Requirements: 3.7_

- [x] 14. Final checkpoint - Complete system testing
  - Run full test suite (unit tests and property tests)
  - Verify all 17 correctness properties pass with 100+ iterations
  - Test complete user flow: browse → add to cart → apply coupon → checkout → order
  - Test admin flow: create coupon → view redemptions → deactivate coupon
  - Verify error handling for all validation failures
  - Ask the user if questions arise

- [x] 15. Add documentation and code comments
  - Add docstrings to all classes and methods
  - Document validation rules in CouponValidator
  - Document calculation formulas in DiscountEngine
  - Add inline comments for complex logic (e.g., concurrent redemption handling)
  - Create README in coupons app explaining the system architecture
  - _Requirements: All_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties with 100+ iterations each
- Unit tests validate specific examples, edge cases, and integration points
- The implementation follows Django best practices with proper separation of concerns
- Session management ensures coupon persistence during checkout flow
- Atomic operations prevent race conditions in usage counting
- Admin interface provides comprehensive coupon management and analytics
