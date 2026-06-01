# Implementation Plan: Wishlist/Favorites

## Overview

This implementation plan breaks down the wishlist/favorites feature into discrete, incremental coding tasks. Each task builds on previous work, with testing integrated throughout to validate functionality early. The implementation follows Django best practices and integrates seamlessly with the existing GreatKart application.

## Tasks

- [x] 1. Create wishlist app and configure basic structure
  - Create new Django app called `wishlist` using `python manage.py startapp wishlist`
  - Add `wishlist` to INSTALLED_APPS in settings.py
  - Create `urls.py` in the wishlist app
  - Include wishlist URLs in the main project urls.py with prefix `wishlist/`
  - Create `templates/wishlist/` directory structure
  - _Requirements: 8.1, 8.2, 8.4_

- [x] 2. Implement data models
  - [x] 2.1 Create Wishlist and WishlistItem models in models.py
    - Define Wishlist model with OneToOneField to Account
    - Define WishlistItem model with ForeignKey to Wishlist and Product
    - Add unique_together constraint on (wishlist, product)
    - Add ordering by -added_at
    - Implement __str__ methods for both models
    - Implement get_items_count() and contains_product() helper methods
    - _Requirements: 1.1, 1.2, 7.3, 7.4_
  
  - [x] 2.2 Create and run database migrations
    - Run `python manage.py makemigrations wishlist`
    - Run `python manage.py migrate`
    - _Requirements: 1.1_
  
  - [x] 2.3 Write property test for wishlist item creation
    - **Property 1: Wishlist Item Creation**
    - **Validates: Requirements 1.1**
  
  - [x] 2.4 Write property test for idempotent add operations
    - **Property 2: Idempotent Add Operations**
    - **Validates: Requirements 1.2, 4.3**
  
  - [x] 2.5 Write property test for cascade deletions
    - **Property 13: Product Deletion Cascade**
    - **Property 14: User Deletion Cascade**
    - **Validates: Requirements 7.3, 7.4**

- [x] 3. Configure Django admin interface
  - Register Wishlist and WishlistItem models in admin.py
  - Configure list_display, list_filter, and search_fields for easy management
  - Add inline WishlistItem display in Wishlist admin
  - _Requirements: 7.3, 7.4_

- [x] 4. Implement core wishlist views
  - [x] 4.1 Create add_to_wishlist view
    - Implement @login_required decorator
    - Implement @require_POST decorator
    - Use get_or_create for Wishlist and WishlistItem
    - Return JsonResponse with success status, message, and wishlist_count
    - Handle Product.DoesNotExist exception
    - _Requirements: 1.1, 1.2, 1.3, 1.5_
  
  - [x] 4.2 Create remove_from_wishlist view
    - Implement @login_required decorator
    - Implement @require_POST decorator
    - Delete WishlistItem if exists
    - Return JsonResponse with success status, message, and wishlist_count
    - Handle Wishlist.DoesNotExist and WishlistItem.DoesNotExist exceptions
    - _Requirements: 2.1, 2.2_
  
  - [x] 4.3 Create check_wishlist_status view
    - Implement @login_required decorator
    - Check if product is in user's wishlist
    - Return JsonResponse with in_wishlist boolean and wishlist_count
    - Handle exceptions gracefully
    - _Requirements: 4.1, 4.2_
  
  - [x] 4.4 Write unit tests for view error handling
    - Test unauthenticated access returns 401/redirect
    - Test non-existent product returns 404
    - Test duplicate add returns appropriate message
    - _Requirements: 1.3, 8.1, 8.2_
  
  - [x] 4.5 Write property test for wishlist count accuracy
    - **Property 3: Wishlist Count Accuracy**
    - **Validates: Requirements 1.5, 2.2, 6.1**

- [x] 5. Implement wishlist page view and template
  - [x] 5.1 Create wishlist view function
    - Implement @login_required decorator
    - Use get_or_create for Wishlist
    - Query wishlist items with select_related('product')
    - Pass wishlist_items and wishlist_count to template context
    - _Requirements: 3.1, 3.2, 8.1_
  
  - [x] 5.2 Create wishlist.html template
    - Extend base template
    - Display wishlist items in a grid/list layout
    - Show product image, name, price, and availability status
    - Add remove button for each item
    - Add "Add to Cart" button for each item
    - Display empty state when no items exist
    - Include link to continue shopping in empty state
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [x] 5.3 Write property test for wishlist page completeness
    - **Property 5: Wishlist Page Completeness**
    - **Property 6: Product Availability Display**
    - **Property 7: Remove Button Presence**
    - **Validates: Requirements 3.1, 3.3, 3.5**
  
  - [x] 5.4 Write unit tests for edge cases
    - Test empty wishlist displays empty state
    - Test out-of-stock products show unavailability indicator
    - _Requirements: 3.2, 3.4_

- [x] 6. Configure URL routing
  - Add URL patterns for wishlist views in wishlist/urls.py
  - Map '' to wishlist view (name='wishlist')
  - Map 'add/<int:product_id>/' to add_to_wishlist (name='add_to_wishlist')
  - Map 'remove/<int:product_id>/' to remove_from_wishlist (name='remove_from_wishlist')
  - Map 'check/<int:product_id>/' to check_wishlist_status (name='check_wishlist_status')
  - _Requirements: 1.1, 2.1, 3.1, 4.1_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement context processor for wishlist count
  - [x] 8.1 Create context_processors.py in wishlist app
    - Implement wishlist_count function
    - Check if user is authenticated
    - Query wishlist count for authenticated users
    - Return 0 for unauthenticated users
    - Handle Wishlist.DoesNotExist gracefully
    - _Requirements: 6.1, 6.3, 6.4_
  
  - [x] 8.2 Register context processor in settings.py
    - Add 'wishlist.context_processors.wishlist_count' to TEMPLATES context_processors
    - _Requirements: 6.1_
  
  - [x] 8.3 Write property test for wishlist count in context
    - **Property 3: Wishlist Count Accuracy** (context processor aspect)
    - **Validates: Requirements 6.1**
  
  - [x] 8.4 Write unit test for unauthenticated user count
    - Test that unauthenticated users get count of 0
    - _Requirements: 6.4_

- [x] 9. Add wishlist icon and count to navigation
  - [x] 9.1 Update base template navigation
    - Add wishlist icon/link in navigation bar
    - Display wishlist_count badge next to icon
    - Link to wishlist page
    - Show appropriate state for authenticated vs unauthenticated users
    - _Requirements: 6.1, 6.3, 6.4_
  
  - [x] 9.2 Add CSS styling for wishlist icon and count badge
    - Style wishlist icon to match existing navigation icons
    - Style count badge (circular, positioned on icon)
    - Add hover effects
    - _Requirements: 6.1_

- [x] 10. Integrate wishlist buttons in product templates
  - [x] 10.1 Add wishlist button to product detail page
    - Add wishlist icon button near product title or images
    - Include product_id as data attribute
    - Show filled icon if product is in wishlist, empty if not
    - Add AJAX event handler for click
    - _Requirements: 1.1, 4.1, 4.2, 4.3, 4.4_
  
  - [x] 10.2 Add wishlist button to product listing pages
    - Add wishlist icon button to each product card
    - Include product_id as data attribute
    - Show appropriate icon state based on wishlist membership
    - Add AJAX event handler for click
    - _Requirements: 1.1, 4.1, 4.2, 4.3, 4.4_
  
  - [x] 10.3 Write property test for wishlist icon state
    - **Property 8: Wishlist Icon State Reflects Membership**
    - **Validates: Requirements 4.1, 4.2**
  
  - [x] 10.4 Write property test for toggle behavior
    - **Property 9: Toggle Add/Remove Behavior**
    - **Validates: Requirements 4.3, 4.4**

- [x] 11. Implement AJAX functionality for wishlist operations
  - [x] 11.1 Create JavaScript file for wishlist interactions
    - Create static/js/wishlist.js
    - Implement addToWishlist(productId) function
    - Implement removeFromWishlist(productId) function
    - Implement updateWishlistCount(count) function
    - Implement updateWishlistIcon(productId, inWishlist) function
    - Handle AJAX success and error responses
    - Display toast/alert messages for user feedback
    - _Requirements: 1.4, 1.5, 2.2, 2.3, 4.3, 4.4, 6.2_
  
  - [x] 11.2 Include wishlist.js in templates
    - Add script tag in base template or relevant pages
    - Ensure jQuery or fetch API is available
    - _Requirements: 1.1, 2.1_
  
  - [x] 11.3 Write integration tests for AJAX flows
    - Test add-to-wishlist AJAX request and response
    - Test remove-from-wishlist AJAX request and response
    - Test count update after operations
    - _Requirements: 1.5, 2.2, 6.2_

- [x] 12. Implement add-to-cart from wishlist functionality
  - [x] 12.1 Add "Add to Cart" buttons in wishlist template
    - Add button for each wishlist item
    - Include product_id and has_variations as data attributes
    - Style buttons to match existing cart buttons
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 12.2 Implement JavaScript handler for add-to-cart
    - Check if product has variations
    - If has variations: redirect to product detail page
    - If no variations: make AJAX call to add to cart with quantity=1
    - Display success message
    - Update cart count in navigation
    - Keep item in wishlist (do not remove)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 12.3 Write property test for add to cart from wishlist
    - **Property 10: Add to Cart from Wishlist**
    - **Property 11: Wishlist Persistence After Cart Addition**
    - **Validates: Requirements 5.1, 5.3, 5.5**
  
  - [x] 12.4 Write unit test for products with variations
    - Test that products with variations redirect to detail page
    - _Requirements: 5.2_

- [x] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement wishlist persistence and security
  - [x] 14.1 Write property test for session persistence
    - **Property 12: Wishlist Persistence Across Sessions**
    - **Validates: Requirements 7.1, 7.2**
  
  - [x] 14.2 Write property test for wishlist isolation
    - **Property 15: Wishlist Isolation**
    - **Validates: Requirements 8.4**
  
  - [x] 14.3 Write unit tests for authentication requirements
    - Test unauthenticated access to wishlist page redirects to login
    - Test unauthenticated API calls return 401
    - Test users cannot access other users' wishlists
    - _Requirements: 8.1, 8.2, 8.4_

- [x] 15. Add login redirect handling
  - [x] 15.1 Configure login redirect for wishlist actions
    - Ensure @login_required uses next parameter
    - Update login view to handle next parameter
    - Redirect to originally requested page after login
    - _Requirements: 1.3, 8.1, 8.3_
  
  - [x] 15.2 Update wishlist buttons for unauthenticated users
    - Show wishlist buttons to all users
    - Clicking when unauthenticated redirects to login
    - After login, complete the add-to-wishlist action
    - _Requirements: 1.3, 8.3_

- [x] 16. Final integration and polish
  - [x] 16.1 Add responsive design for mobile devices
    - Ensure wishlist page is mobile-friendly
    - Test wishlist icon and count on mobile navigation
    - Adjust button sizes and layouts for touch interfaces
    - _Requirements: 3.1, 6.1_
  
  - [x] 16.2 Add loading states and animations
    - Show loading spinner during AJAX operations
    - Add smooth transitions for icon state changes
    - Add fade-in/fade-out for toast messages
    - _Requirements: 1.4, 2.3_
  
  - [x] 16.3 Optimize database queries
    - Review and add select_related/prefetch_related where needed
    - Add database indexes on frequently queried fields
    - Test query performance with large wishlists
    - _Requirements: 3.1, 6.1_

- [x] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- AJAX functionality provides smooth user experience without page refreshes
- All wishlist operations require authentication for security
- Cascade deletions are handled at the database level via foreign key constraints
