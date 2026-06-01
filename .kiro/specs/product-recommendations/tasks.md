# Implementation Plan: Product Recommendations

## Overview

This implementation plan breaks down the Product Recommendations feature into discrete, incremental coding tasks. The approach follows a bottom-up strategy: build core models and utilities first, then the recommendation engine, followed by view integration, and finally caching and analytics.

## Tasks

- [x] 1. Set up recommendations app structure and core models
  - Create new Django app `recommendations`
  - Add app to INSTALLED_APPS in settings
  - Create RelatedProduct model with admin interface
  - Create RecommendationClick model for tracking
  - Generate and run migrations
  - _Requirements: 7.1, 7.2, 10.1, 10.2_

- [x] 1.1 Write property test for RelatedProduct model
  - **Property 19: Manual Association Persistence**
  - **Validates: Requirements 7.2**

- [x] 2. Implement database indexes for performance
  - Add indexes to Product model (category + availability, availability + stock)
  - Add indexes to OrderProduct model (product + order, order + product)
  - Generate and run migrations for index additions
  - _Requirements: 8.2_

- [x] 3. Implement cache manager
  - [x] 3.1 Create RecommendationCache class in recommendations/cache.py
    - Implement cache key generation with consistent format
    - Implement get/set methods with Redis backend
    - Implement invalidation methods (by product, by user, by pattern)
    - Configure 1-hour TTL as default
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 3.2 Write property test for cache round-trip
    - **Property 15: Cache Storage and Retrieval**
    - **Validates: Requirements 5.1, 5.2**

  - [x] 3.3 Write unit tests for cache manager
    - Test cache key format generation
    - Test cache miss returns None
    - Test pattern-based invalidation
    - Test Redis connection failure handling
    - _Requirements: 5.1, 5.2_

- [x] 4. Implement core recommendation engine
  - [x] 4.1 Create RecommendationEngine class in recommendations/engine.py
    - Implement _filter_available_products helper method
    - Set up basic class structure with configuration
    - _Requirements: 9.1, 9.2, 9.5_

  - [x] 4.2 Write property test for availability filtering
    - **Property 2: Product Availability Filtering**
    - **Validates: Requirements 9.1, 9.2, 9.5**

  - [x] 4.3 Implement get_related_products method
    - Query manual overrides from RelatedProduct model
    - Query category-based products
    - Exclude current product
    - Apply availability filters
    - Limit results to 6 products
    - Prioritize manual overrides
    - _Requirements: 1.1, 1.2, 1.5_

  - [x] 4.4 Write property tests for related products
    - **Property 1: Recommendation Count Limits** (related products portion)
    - **Property 3: Self-Exclusion in Related Products**
    - **Property 5: Category Consistency for Related Products**
    - **Property 6: Manual Override Prioritization**
    - **Property 7: Manual Override Split**
    - **Validates: Requirements 1.1, 1.2, 1.5, 7.3, 7.4**

  - [x] 4.5 Write unit tests for related products edge cases
    - Test with empty category
    - Test with category having fewer than 6 products
    - Test with no manual overrides
    - Test with only manual overrides
    - _Requirements: 1.3_

- [x] 5. Implement frequently bought together recommendations
  - [x] 5.1 Implement get_frequently_bought_together method
    - Query OrderProduct for orders containing source product
    - Aggregate co-purchased products with frequency count
    - Filter by availability and stock
    - Rank by co-purchase frequency
    - Limit to 4 products
    - Return empty if fewer than 3 co-purchases
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 5.2 Write property tests for frequently bought together
    - **Property 8: Co-Purchase Frequency Ranking**
    - **Property 9: Order History Relevance**
    - **Property 10: Recent Orders Only**
    - **Property 12: Fallback to Category Recommendations**
    - **Validates: Requirements 2.2, 2.3, 2.4, 6.3, 6.4**

  - [x] 5.3 Write unit tests for FBT edge cases
    - Test with no order history
    - Test with orders but no co-purchases
    - Test with exactly 2 co-purchases (below threshold)
    - Test with old orders (> 12 months)
    - _Requirements: 2.4, 6.4_

- [x] 6. Checkpoint - Ensure core engine tests pass
  - Run all tests for recommendation engine
  - Verify database queries are optimized
  - Ensure all tests pass, ask the user if questions arise

- [x] 7. Implement cart and personalized recommendations
  - [x] 7.1 Implement get_cart_recommendations method
    - For each cart item, find frequently bought together products
    - Aggregate and rank by total co-purchase frequency
    - Exclude products already in cart
    - Apply availability filters
    - Limit to 6 products
    - Fall back to popular products if cart is empty
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

  - [x] 7.2 Write property tests for cart recommendations
    - **Property 1: Recommendation Count Limits** (cart portion)
    - **Property 4: Cart Item Exclusion**
    - **Validates: Requirements 3.1, 3.4**

  - [x] 7.3 Write unit test for empty cart edge case
    - Test that empty cart returns popular products
    - _Requirements: 3.5_

  - [x] 7.4 Implement get_personalized_recommendations method
    - Query user's order history (past 12 months)
    - Find other users who bought similar products
    - Identify products those users bought that current user hasn't
    - Rank by frequency and rating
    - Apply availability filters
    - Limit to 8 products
    - Fall back to popular products if no history
    - _Requirements: 4.1, 4.2, 4.3, 6.4_

  - [x] 7.5 Write property tests for personalized recommendations
    - **Property 1: Recommendation Count Limits** (homepage portion)
    - **Property 13: Personalized Recommendations Use User History**
    - **Property 14: Anonymous User Popular Products**
    - **Validates: Requirements 4.1, 4.2, 4.4**

  - [x] 7.6 Write unit test for new user edge case
    - Test user with no order history gets popular products
    - _Requirements: 4.3_

  - [x] 7.7 Implement get_popular_products method
    - Aggregate order counts per product
    - Filter by availability and stock
    - Order by sales count, then rating
    - Limit to specified count
    - _Requirements: 3.5, 4.3, 4.4_

  - [x] 7.8 Write property test for tie-breaking logic
    - **Property 11: Tie-Breaking Logic**
    - **Validates: Requirements 6.5**

- [x] 8. Implement product variation handling
  - [x] 8.1 Add logic to recommend parent products for variations
    - Modify all recommendation methods to return parent products
    - Ensure variation SKUs are not recommended directly
    - _Requirements: 9.4_

  - [x] 8.2 Write property test for variation handling
    - **Property 21: Product Variation Handling**
    - **Validates: Requirements 9.4**

- [x] 9. Integrate caching with recommendation engine
  - [x] 9.1 Add cache checks to all recommendation methods
    - Check cache before generating recommendations
    - Store results in cache after generation
    - Use appropriate cache keys for each recommendation type
    - _Requirements: 5.1, 5.2_

  - [x] 9.2 Implement cache invalidation logic
    - Add signal handlers for product availability changes
    - Add signal handlers for order completion
    - Add signal handlers for manual association changes
    - Call appropriate cache invalidation methods
    - _Requirements: 5.3, 5.4, 7.5_

  - [x] 9.3 Write property tests for cache invalidation
    - **Property 16: Cache Invalidation on Availability Change**
    - **Property 17: Cache Invalidation on Order Completion**
    - **Property 18: Cache Invalidation on Manual Association Change**
    - **Validates: Requirements 5.3, 5.4, 7.5**

  - [x] 9.4 Write integration tests for caching
    - Test cache hit after first request
    - Test cache invalidation triggers
    - Test cache miss handling
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 10. Checkpoint - Ensure caching works correctly
  - Run all caching tests
  - Verify Redis integration
  - Test cache invalidation scenarios
  - Ensure all tests pass, ask the user if questions arise

- [x] 11. Implement view mixins and integrate with existing views
  - [x] 11.1 Create RecommendationMixin in recommendations/mixins.py
    - Implement get_related_products_context method
    - Implement get_cart_recommendations_context method
    - Implement get_homepage_recommendations_context method
    - Add timeout handling (200ms limit)
    - _Requirements: 8.1, 8.3_

  - [x] 11.2 Write property test for timeout handling
    - **Property 20: Graceful Timeout Handling**
    - **Validates: Requirements 8.3**

  - [x] 11.3 Update ProductDetailView in store app
    - Add RecommendationMixin to view
    - Add related products and FBT to context
    - Handle recommendation generation failures gracefully
    - _Requirements: 1.1, 1.4, 2.1, 2.5_

  - [x] 11.4 Update cart view
    - Add RecommendationMixin to cart view
    - Add cart recommendations to context
    - _Requirements: 3.1, 3.2_

  - [x] 11.5 Update checkout view
    - Add RecommendationMixin to checkout view
    - Add recommendations with limit of 4
    - _Requirements: 3.3_

  - [x] 11.6 Update homepage view
    - Add RecommendationMixin to homepage view
    - Add personalized or popular products based on user authentication
    - _Requirements: 4.1, 4.4, 4.5_

  - [x] 11.7 Write integration tests for view integration
    - Test product detail page includes recommendations
    - Test cart page includes recommendations
    - Test homepage shows correct recommendations for auth/anon users
    - Test views handle recommendation failures gracefully
    - _Requirements: 1.1, 3.1, 4.1_

- [x] 12. Create templates for recommendation display
  - [x] 12.1 Create recommendations/related_products.html template
    - Display up to 6 related products in grid
    - Show product image, name, price, rating
    - Add "Related Products" heading
    - _Requirements: 1.4_

  - [x] 12.2 Create recommendations/frequently_bought_together.html template
    - Display up to 4 FBT products
    - Show combined price calculation
    - Show individual product details
    - Add "Frequently Bought Together" heading
    - _Requirements: 2.5_

  - [x] 12.3 Create recommendations/cart_recommendations.html template
    - Display "You May Also Like" section
    - Show up to 6 products in grid
    - Show product image, name, price, rating
    - _Requirements: 3.1_

  - [x] 12.4 Create recommendations/homepage_recommendations.html template
    - Display personalized or popular products section
    - Show up to 8 products in grid
    - Show product image, name, price, rating, availability
    - Add appropriate heading based on user type
    - _Requirements: 4.5_

  - [x] 12.5 Include recommendation templates in existing pages
    - Include related_products.html in product detail template
    - Include frequently_bought_together.html in product detail template
    - Include cart_recommendations.html in cart template
    - Include cart_recommendations.html in checkout template (limit 4)
    - Include homepage_recommendations.html in homepage template
    - _Requirements: 1.1, 2.1, 3.1, 3.3, 4.1_

- [x] 13. Implement recommendation click tracking
  - [x] 13.1 Create tracking view and URL endpoint
    - Create track_recommendation_click view
    - Accept POST with recommendation metadata
    - Create RecommendationClick record
    - Return success response
    - _Requirements: 10.1, 10.2_

  - [x] 13.2 Add JavaScript for click tracking
    - Add event listeners to recommendation links
    - Send tracking data via AJAX on click
    - Include source type, source product, recommended product
    - Handle authenticated and anonymous users
    - _Requirements: 10.1, 10.2_

  - [x] 13.3 Implement conversion tracking
    - Update add-to-cart functionality
    - Check if product was recently clicked from recommendations
    - Update RecommendationClick record with conversion flag
    - _Requirements: 10.3_

  - [x] 13.4 Write property tests for tracking
    - **Property 22: Recommendation Click Logging**
    - **Property 23: Conversion Tracking**
    - **Validates: Requirements 10.1, 10.2, 10.3**

  - [x] 13.5 Write unit tests for tracking
    - Test click logging for authenticated users
    - Test click logging for anonymous users
    - Test conversion tracking
    - Test tracking with missing data
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 14. Implement Celery tasks for async operations
  - [x] 14.1 Create warm_cache_for_popular_products task
    - Identify top 100 products by views/sales
    - Pre-generate recommendations for each
    - Store in cache
    - Schedule to run every 30 minutes
    - _Requirements: 5.1, 8.4_

  - [x] 14.2 Create invalidate_recommendations_after_order task
    - Accept order_id parameter
    - Get all products in order
    - Invalidate FBT cache for each product
    - Invalidate user's personalized recommendations
    - Trigger from order completion signal
    - _Requirements: 5.4_

  - [x] 14.3 Create log_recommendation_click task
    - Accept click metadata parameters
    - Create RecommendationClick record asynchronously
    - Handle errors gracefully
    - _Requirements: 10.5_

  - [x] 14.4 Create aggregate_recommendation_metrics task
    - Calculate CTR by source type
    - Calculate conversion rate by source type
    - Identify most effective recommendation pairs
    - Store aggregated metrics
    - Schedule to run daily at 2 AM
    - _Requirements: 10.4_

  - [x] 14.5 Write property test for analytics metrics
    - **Property 24: Analytics Metrics Generation**
    - **Validates: Requirements 10.4**

  - [x] 14.6 Write unit tests for Celery tasks
    - Test cache warming task
    - Test order invalidation task
    - Test async click logging
    - Test metrics aggregation
    - _Requirements: 5.1, 5.4, 10.4, 10.5_

- [x] 15. Implement admin interface for manual associations
  - [x] 15.1 Create RelatedProductInline for Product admin
    - Add inline admin for RelatedProduct model
    - Allow selecting related products
    - Show order field for prioritization
    - _Requirements: 7.1_

  - [x] 15.2 Add admin actions for bulk operations
    - Add action to clear all manual associations for selected products
    - Add action to copy associations from one product to another
    - _Requirements: 7.1_

  - [x] 15.3 Add signal handler for admin saves
    - Trigger cache invalidation when associations are saved
    - Trigger cache invalidation when associations are deleted
    - _Requirements: 7.5_

  - [x] 15.4 Write unit tests for admin interface
    - Test inline admin displays correctly
    - Test saving manual associations
    - Test deleting manual associations
    - Test cache invalidation on admin changes
    - _Requirements: 7.1, 7.2, 7.5_

- [x] 16. Add error handling and logging
  - [x] 16.1 Add comprehensive error handling to recommendation engine
    - Handle database query failures
    - Handle cache service unavailability
    - Handle invalid product IDs
    - Handle timeout scenarios
    - Log all errors with context
    - _Requirements: 8.3_

  - [x] 16.2 Add error handling to views
    - Catch recommendation generation exceptions
    - Return empty recommendations on failure
    - Log errors for monitoring
    - Ensure pages render without recommendations
    - _Requirements: 8.3_

  - [x] 16.3 Write unit tests for error scenarios
    - Test database failure handling
    - Test cache unavailability handling
    - Test invalid input handling
    - Test timeout handling
    - Test graceful degradation
    - _Requirements: 8.3_

- [x] 17. Final checkpoint and integration testing
  - Run full test suite (unit + property + integration)
  - Test all recommendation types on actual pages
  - Verify caching works correctly
  - Verify tracking works correctly
  - Test admin interface functionality
  - Verify Celery tasks execute correctly
  - Check performance meets 200ms requirement
  - Ensure all tests pass, ask the user if questions arise

- [x] 18. Create analytics dashboard view (optional)
  - [x] 18.1 Create analytics view for recommendation metrics
    - Display CTR by source type
    - Display conversion rates
    - Display top performing recommendation pairs
    - Add date range filtering
    - _Requirements: 10.4_

  - [x] 18.2 Create analytics template
    - Display metrics in charts/tables
    - Add filtering controls
    - Make accessible to admin users only
    - _Requirements: 10.4_

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties using Hypothesis
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end functionality
- The implementation follows a bottom-up approach: models → engine → caching → views → templates → tracking → async tasks
- All recommendation methods include timeout handling and graceful degradation
- Cache invalidation is triggered automatically via Django signals
- Analytics tracking is asynchronous to avoid impacting user experience
