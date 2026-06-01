# Design Document: Product Recommendations

## Overview

The Product Recommendations feature enhances the GreatKart e-commerce platform by providing intelligent product suggestions throughout the user journey. The system implements multiple recommendation strategies:

1. **Related Products**: Category-based recommendations on product detail pages
2. **Frequently Bought Together**: Collaborative filtering based on order history
3. **Cart Recommendations**: Complementary product suggestions during checkout
4. **Personalized Homepage**: User-specific recommendations based on purchase history

The design leverages Django's ORM for data access, Redis for caching, and Celery for asynchronous processing. The recommendation engine uses simple collaborative filtering algorithms that analyze co-purchase patterns in historical order data.

### Key Design Principles

- **Performance First**: All recommendations cached with 1-hour TTL
- **Graceful Degradation**: Pages load without recommendations if generation fails
- **Incremental Complexity**: Start with simple algorithms, optimize based on metrics
- **Admin Control**: Manual overrides for strategic product placement

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Django Application                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────────────────────┐    │
│  │   Views      │─────▶│  Recommendation Engine       │    │
│  │              │      │  - Related Products          │    │
│  │ - Product    │      │  - Frequently Bought         │    │
│  │ - Cart       │      │  - Personalized              │    │
│  │ - Homepage   │      │  - Popular Products          │    │
│  └──────────────┘      └──────────────────────────────┘    │
│         │                         │                          │
│         │                         ▼                          │
│         │              ┌──────────────────────┐             │
│         │              │  Cache Manager       │             │
│         │              │  - Redis Backend     │             │
│         │              │  - Cache Keys        │             │
│         │              │  - Invalidation      │             │
│         │              └──────────────────────┘             │
│         │                         │                          │
│         ▼                         ▼                          │
│  ┌──────────────────────────────────────────────┐          │
│  │           Database Models                     │          │
│  │  - Product                                    │          │
│  │  - Order / OrderProduct                       │          │
│  │  - RelatedProduct (manual overrides)          │          │
│  │  - RecommendationClick (tracking)             │          │
│  └──────────────────────────────────────────────┘          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Celery Workers                            │
│  - Async recommendation pre-computation                      │
│  - Cache warming for popular products                        │
│  - Analytics aggregation                                     │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Product Detail Page Recommendations**:
1. User requests product detail page
2. View checks cache for related products and frequently bought together
3. If cache miss, Recommendation Engine queries database
4. Results cached with 1-hour TTL
5. Template renders recommendations

**Cart Page Recommendations**:
1. User views cart with N products
2. View retrieves cart items
3. Recommendation Engine finds products frequently bought with cart items
4. Results filtered to exclude cart contents
5. Template renders "You May Also Like" section

**Homepage Personalized Recommendations**:
1. Authenticated user visits homepage
2. View checks cache for user-specific recommendations
3. If cache miss, engine analyzes user's order history
4. Collaborative filtering identifies similar users and their purchases
5. Results cached per-user with 1-hour TTL

## Components and Interfaces

### 1. Recommendation Engine (`recommendations/engine.py`)

Core component responsible for generating all recommendation types.

```python
class RecommendationEngine:
    """
    Main recommendation engine with multiple strategies.
    """
    
    def get_related_products(self, product_id: int, limit: int = 6) -> QuerySet:
        """
        Get related products for a given product.
        
        Strategy:
        1. Check for manual admin overrides
        2. Get products from same category
        3. Exclude current product
        4. Filter by availability and stock
        5. Order by rating, then sales
        
        Args:
            product_id: ID of the source product
            limit: Maximum number of recommendations
            
        Returns:
            QuerySet of Product objects
        """
        pass
    
    def get_frequently_bought_together(self, product_id: int, limit: int = 4) -> List[Dict]:
        """
        Get products frequently purchased with the given product.
        
        Strategy:
        1. Query OrderProduct for orders containing product_id
        2. Find other products in those orders
        3. Count co-occurrence frequency
        4. Filter by availability and stock
        5. Return top N by frequency
        
        Args:
            product_id: ID of the source product
            limit: Maximum number of recommendations
            
        Returns:
            List of dicts with product and co-purchase count
        """
        pass
    
    def get_cart_recommendations(self, cart_items: List[int], limit: int = 6) -> QuerySet:
        """
        Get recommendations based on current cart contents.
        
        Strategy:
        1. For each cart item, find frequently bought together products
        2. Aggregate and rank by total co-purchase frequency
        3. Exclude products already in cart
        4. Filter by availability and stock
        5. Return top N
        
        Args:
            cart_items: List of product IDs in cart
            limit: Maximum number of recommendations
            
        Returns:
            QuerySet of Product objects
        """
        pass
    
    def get_personalized_recommendations(self, user_id: int, limit: int = 8) -> QuerySet:
        """
        Get personalized recommendations for a user.
        
        Strategy:
        1. Get user's order history (past 12 months)
        2. Find other users who bought similar products
        3. Identify products those users bought that current user hasn't
        4. Rank by frequency and rating
        5. Fall back to popular products if insufficient data
        
        Args:
            user_id: ID of the user
            limit: Maximum number of recommendations
            
        Returns:
            QuerySet of Product objects
        """
        pass
    
    def get_popular_products(self, limit: int = 8) -> QuerySet:
        """
        Get popular products based on sales volume.
        
        Strategy:
        1. Aggregate order counts per product
        2. Filter by availability and stock
        3. Order by sales count, then rating
        4. Return top N
        
        Args:
            limit: Maximum number of products
            
        Returns:
            QuerySet of Product objects
        """
        pass

    def _filter_available_products(self, queryset: QuerySet) -> QuerySet:
        """
        Filter products to only include available items.
        
        Filters:
        - is_available = True
        - stock > 0
        - rating >= 2.0 (if rated)
        
        Args:
            queryset: Input product queryset
            
        Returns:
            Filtered QuerySet
        """
        pass
```

### 2. Cache Manager (`recommendations/cache.py`)

Handles all caching operations for recommendations.

```python
class RecommendationCache:
    """
    Manages caching for recommendation results.
    """
    
    CACHE_TTL = 3600  # 1 hour
    
    @staticmethod
    def get_cache_key(recommendation_type: str, identifier: str) -> str:
        """
        Generate cache key for recommendation type and identifier.
        
        Format: "rec:{type}:{identifier}"
        Examples:
        - "rec:related:123"
        - "rec:fbt:456"
        - "rec:user:789"
        
        Args:
            recommendation_type: Type of recommendation (related, fbt, cart, user)
            identifier: Unique identifier (product_id, user_id, cart_hash)
            
        Returns:
            Cache key string
        """
        pass
    
    @staticmethod
    def get(cache_key: str) -> Optional[Any]:
        """
        Retrieve cached recommendations.
        
        Args:
            cache_key: Cache key to retrieve
            
        Returns:
            Cached value or None if not found
        """
        pass
    
    @staticmethod
    def set(cache_key: str, value: Any, ttl: int = CACHE_TTL) -> None:
        """
        Store recommendations in cache.
        
        Args:
            cache_key: Cache key to store
            value: Value to cache (will be serialized)
            ttl: Time to live in seconds
        """
        pass
    
    @staticmethod
    def invalidate_product(product_id: int) -> None:
        """
        Invalidate all caches related to a product.
        
        Invalidates:
        - Related products for this product
        - Frequently bought together for this product
        - Any cart recommendations involving this product
        
        Args:
            product_id: ID of product to invalidate
        """
        pass
    
    @staticmethod
    def invalidate_user(user_id: int) -> None:
        """
        Invalidate personalized recommendations for a user.
        
        Args:
            user_id: ID of user to invalidate
        """
        pass
    
    @staticmethod
    def invalidate_pattern(pattern: str) -> None:
        """
        Invalidate all cache keys matching a pattern.
        
        Args:
            pattern: Redis key pattern (e.g., "rec:fbt:*")
        """
        pass
```

### 3. View Mixins (`recommendations/mixins.py`)

Reusable view components for adding recommendations to pages.

```python
class RecommendationMixin:
    """
    Mixin to add recommendation context to views.
    """
    
    def get_recommendations_context(self) -> Dict[str, Any]:
        """
        Get recommendation context for templates.
        
        Returns:
            Dictionary with recommendation data
        """
        pass
    
    def get_related_products_context(self, product: Product) -> Dict[str, Any]:
        """
        Get related products context for product detail page.
        
        Args:
            product: Current product being viewed
            
        Returns:
            Dict with 'related_products' and 'frequently_bought_together'
        """
        pass
    
    def get_cart_recommendations_context(self, cart_items: List[int]) -> Dict[str, Any]:
        """
        Get recommendations context for cart page.
        
        Args:
            cart_items: List of product IDs in cart
            
        Returns:
            Dict with 'cart_recommendations'
        """
        pass
    
    def get_homepage_recommendations_context(self, user) -> Dict[str, Any]:
        """
        Get recommendations context for homepage.
        
        Args:
            user: Current user (may be anonymous)
            
        Returns:
            Dict with 'personalized_recommendations' or 'popular_products'
        """
        pass
```

### 4. Celery Tasks (`recommendations/tasks.py`)

Asynchronous tasks for background processing.

```python
@shared_task
def warm_cache_for_popular_products():
    """
    Pre-compute recommendations for popular products.
    
    Strategy:
    1. Identify top 100 products by recent views/sales
    2. Generate related products and frequently bought together
    3. Store in cache
    
    Scheduled: Every 30 minutes
    """
    pass

@shared_task
def invalidate_recommendations_after_order(order_id: int):
    """
    Invalidate relevant caches after order completion.
    
    Args:
        order_id: ID of completed order
        
    Actions:
    1. Get all products in order
    2. Invalidate frequently bought together for each
    3. Invalidate user's personalized recommendations
    """
    pass

@shared_task
def log_recommendation_click(user_id: Optional[int], source_type: str, 
                            source_product_id: Optional[int], 
                            recommended_product_id: int):
    """
    Asynchronously log recommendation click event.
    
    Args:
        user_id: ID of user (None if anonymous)
        source_type: Type of recommendation (related, fbt, cart, homepage)
        source_product_id: ID of source product (None for homepage)
        recommended_product_id: ID of clicked product
    """
    pass

@shared_task
def aggregate_recommendation_metrics():
    """
    Aggregate recommendation performance metrics.
    
    Computes:
    - Click-through rate by source type
    - Conversion rate (clicks that led to cart adds)
    - Most effective recommendation pairs
    
    Scheduled: Daily at 2 AM
    """
    pass
```

## Data Models

### 1. RelatedProduct Model

Stores manual admin overrides for related products.

```python
from django.db import models
from store.models import Product

class RelatedProduct(models.Model):
    """
    Manual related product associations set by admins.
    """
    product = models.ForeignKey(
        Product, 
        on_delete=models.CASCADE, 
        related_name='manual_related_from'
    )
    related_product = models.ForeignKey(
        Product, 
        on_delete=models.CASCADE, 
        related_name='manual_related_to'
    )
    order = models.PositiveIntegerField(
        default=0,
        help_text="Display order (lower numbers first)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'accounts.Account',
        on_delete=models.SET_NULL,
        null=True
    )
    
    class Meta:
        db_table = 'related_products'
        unique_together = ('product', 'related_product')
        ordering = ['order', '-created_at']
        indexes = [
            models.Index(fields=['product', 'order']),
        ]
    
    def __str__(self):
        return f"{self.product.product_name} -> {self.related_product.product_name}"
```

### 2. RecommendationClick Model

Tracks user interactions with recommendations for analytics.

```python
class RecommendationClick(models.Model):
    """
    Tracks clicks on recommended products.
    """
    SOURCE_TYPES = (
        ('related', 'Related Products'),
        ('fbt', 'Frequently Bought Together'),
        ('cart', 'Cart Recommendations'),
        ('homepage', 'Homepage Recommendations'),
    )
    
    user = models.ForeignKey(
        'accounts.Account',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    session_key = models.CharField(
        max_length=40,
        null=True,
        blank=True,
        help_text="Session key for anonymous users"
    )
    source_type = models.CharField(
        max_length=20,
        choices=SOURCE_TYPES
    )
    source_product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recommendation_source'
    )
    recommended_product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        related_name='recommendation_target'
    )
    clicked_at = models.DateTimeField(auto_now_add=True)
    added_to_cart = models.BooleanField(
        default=False,
        help_text="Whether user added product to cart after click"
    )
    
    class Meta:
        db_table = 'recommendation_clicks'
        indexes = [
            models.Index(fields=['source_type', 'clicked_at']),
            models.Index(fields=['user', 'clicked_at']),
            models.Index(fields=['recommended_product', 'clicked_at']),
        ]
    
    def __str__(self):
        return f"{self.source_type}: {self.recommended_product.product_name}"
```

### 3. Database Indexes

Additional indexes needed on existing models for performance:

```python
# Add to store.models.Product
class Meta:
    indexes = [
        # Existing indexes...
        models.Index(fields=['category', 'is_available', '-created_date']),
        models.Index(fields=['is_available', 'stock', '-created_date']),
    ]

# Add to orders.models.OrderProduct
class Meta:
    indexes = [
        # Existing indexes...
        models.Index(fields=['product', 'order']),
        models.Index(fields=['order', 'product']),
    ]
```

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Recommendation Count Limits

*For any* recommendation request (related products, frequently bought together, cart recommendations, homepage recommendations), the number of returned products should not exceed the specified limit for that recommendation type (6 for related, 4 for FBT, 6 for cart, 8 for homepage).

**Validates: Requirements 1.1, 2.3, 3.1, 3.3, 4.1**

### Property 2: Product Availability Filtering

*For any* recommendation request, all returned products must have is_available=True, stock > 0, and rating >= 2.0 (if the product has been rated).

**Validates: Requirements 9.1, 9.2, 9.5**

### Property 3: Self-Exclusion in Related Products

*For any* product, when requesting related products, the returned list must not contain the source product itself.

**Validates: Requirements 1.2**

### Property 4: Cart Item Exclusion

*For any* cart with N products, cart recommendations must not include any of those N products.

**Validates: Requirements 3.4**

### Property 5: Category Consistency for Related Products

*For any* product in a category, all related products (when no manual overrides exist) must be from the same category as the source product.

**Validates: Requirements 1.1**

### Property 6: Manual Override Prioritization

*For any* product with manual related product associations, those manually associated products must appear before automatically generated recommendations in the results.

**Validates: Requirements 1.5, 7.3**

### Property 7: Manual Override Split

*For any* product with manual associations, the recommendation list should contain up to 3 manual selections followed by up to 3 automatic suggestions, respecting the overall limit of 6.

**Validates: Requirements 7.4**

### Property 8: Co-Purchase Frequency Ranking

*For any* product with order history, frequently bought together recommendations must be ranked by co-purchase frequency in descending order.

**Validates: Requirements 2.3, 6.2**

### Property 9: Order History Relevance

*For any* product, frequently bought together calculations must only consider orders that contain the source product.

**Validates: Requirements 2.2**

### Property 10: Recent Orders Only

*For any* recommendation calculation using order history, only orders from the past 12 months should be considered.

**Validates: Requirements 6.4**

### Property 11: Tie-Breaking Logic

*For any* set of products with equal recommendation scores, they must be ranked first by product rating (descending), then by sales volume (descending).

**Validates: Requirements 6.5**

### Property 12: Fallback to Category Recommendations

*For any* product with insufficient order history (no co-purchases), the frequently bought together section should not be displayed, and related products should fall back to category-based recommendations.

**Validates: Requirements 6.3, 2.4**

### Property 13: Personalized Recommendations Use User History

*For any* authenticated user with order history, personalized homepage recommendations must be based on products purchased by users with similar purchase patterns.

**Validates: Requirements 4.2**

### Property 14: Anonymous User Popular Products

*For any* anonymous user visiting the homepage, recommendations must be popular products based on overall sales data, not personalized recommendations.

**Validates: Requirements 4.4**

### Property 15: Cache Storage and Retrieval

*For any* recommendation request, if the result is cached, subsequent requests within the TTL period should return the cached result without recalculation.

**Validates: Requirements 5.1, 5.2**

### Property 16: Cache Invalidation on Availability Change

*For any* product that becomes unavailable (is_available=False or stock=0), all cached recommendations containing that product must be invalidated.

**Validates: Requirements 5.3**

### Property 17: Cache Invalidation on Order Completion

*For any* completed order, cached frequently bought together recommendations for all products in that order must be invalidated.

**Validates: Requirements 5.4**

### Property 18: Cache Invalidation on Manual Association Change

*For any* product, when manual related product associations are added or removed, cached recommendations for that product must be immediately invalidated.

**Validates: Requirements 7.5**

### Property 19: Manual Association Persistence

*For any* manual related product association created by an admin, the association must be stored in the database and retrievable for future recommendation requests.

**Validates: Requirements 7.2**

### Property 20: Graceful Timeout Handling

*For any* recommendation request that exceeds the timeout threshold, the system must return an empty result set rather than blocking page rendering.

**Validates: Requirements 8.3**

### Property 21: Product Variation Handling

*For any* product with variations, recommendations must include the parent product, not individual variation SKUs.

**Validates: Requirements 9.4**

### Property 22: Recommendation Click Logging

*For any* user click on a recommended product, the system must log the event with source type, source product (if applicable), recommended product, user ID (if authenticated), and timestamp.

**Validates: Requirements 10.1, 10.2**

### Property 23: Conversion Tracking

*For any* recommended product that is added to cart after being clicked, the system must update the recommendation click record to mark it as a conversion.

**Validates: Requirements 10.3**

### Property 24: Analytics Metrics Generation

*For any* time period, the analytics system must be able to generate click-through rates and conversion rates grouped by recommendation source type.

**Validates: Requirements 10.4**

## Error Handling

### Recommendation Generation Failures

**Scenario**: Database query fails during recommendation generation

**Handling**:
1. Log error with full context (product_id, user_id, recommendation_type)
2. Return empty list rather than raising exception
3. Page renders without recommendations
4. Monitor error rates via logging

**Scenario**: Cache service (Redis) unavailable

**Handling**:
1. Fall back to direct database queries
2. Log cache miss with warning level
3. Continue serving recommendations (slower but functional)
4. Alert if cache unavailable for > 5 minutes

### Data Integrity Issues

**Scenario**: Product referenced in order history no longer exists

**Handling**:
1. Filter out null products in queries using LEFT JOIN with null check
2. Log orphaned references for cleanup
3. Continue with remaining valid products

**Scenario**: User has order history but all products are unavailable

**Handling**:
1. Fall back to popular products
2. Log event for analysis (may indicate inventory issues)

### Performance Degradation

**Scenario**: Recommendation query exceeds 200ms timeout

**Handling**:
1. Cancel query using database timeout settings
2. Return empty result set
3. Log slow query with parameters for optimization
4. Trigger async cache warming task for this product

**Scenario**: Too many cache invalidations causing performance issues

**Handling**:
1. Batch invalidation operations
2. Use Redis pipeline for multiple key deletions
3. Rate limit invalidation tasks if queue backs up

### Invalid Input

**Scenario**: Invalid product_id passed to recommendation engine

**Handling**:
1. Validate product exists before generating recommendations
2. Return empty list for non-existent products
3. Log warning with request context

**Scenario**: Empty cart passed to cart recommendations

**Handling**:
1. Detect empty cart early
2. Return popular products instead
3. No error logging (expected scenario)

## Testing Strategy

### Unit Testing

Unit tests will focus on specific examples, edge cases, and error conditions:

**Recommendation Engine Tests**:
- Test related products with empty category
- Test frequently bought together with no order history
- Test cart recommendations with single item
- Test personalized recommendations for new user
- Test popular products calculation
- Test filtering logic for unavailable products
- Test manual override precedence with specific examples

**Cache Manager Tests**:
- Test cache key generation format
- Test cache invalidation for specific product
- Test pattern-based invalidation
- Test cache miss handling
- Test Redis connection failure

**Model Tests**:
- Test RelatedProduct creation and uniqueness constraint
- Test RecommendationClick creation with anonymous user
- Test model string representations
- Test cascade deletion behavior

**View Tests**:
- Test product detail page includes recommendations
- Test cart page includes recommendations
- Test homepage recommendations for authenticated vs anonymous
- Test recommendation sections hidden when empty

### Property-Based Testing

Property tests will verify universal properties across all inputs using **Hypothesis** (Python property-based testing library):

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with: `# Feature: product-recommendations, Property N: [property text]`
- Use Hypothesis strategies for generating test data

**Test Data Generators**:
```python
from hypothesis import strategies as st

# Generate random products
products_strategy = st.builds(
    Product,
    product_name=st.text(min_size=1, max_size=100),
    price=st.decimals(min_value=0.01, max_value=10000, places=2),
    stock=st.integers(min_value=0, max_value=1000),
    is_available=st.booleans(),
    # ... other fields
)

# Generate random orders
orders_strategy = st.builds(
    Order,
    # ... order fields
)

# Generate cart contents
cart_items_strategy = st.lists(
    st.integers(min_value=1, max_value=1000),
    min_size=0,
    max_size=20
)
```

**Property Test Examples**:

```python
from hypothesis import given, settings
import hypothesis.strategies as st

@given(product=products_strategy, limit=st.integers(min_value=1, max_value=10))
@settings(max_examples=100)
def test_property_1_recommendation_count_limits(product, limit):
    """
    Feature: product-recommendations, Property 1: Recommendation Count Limits
    For any recommendation request, the number of returned products should not 
    exceed the specified limit.
    """
    engine = RecommendationEngine()
    related = engine.get_related_products(product.id, limit=limit)
    assert len(related) <= limit

@given(product=products_strategy)
@settings(max_examples=100)
def test_property_2_product_availability_filtering(product):
    """
    Feature: product-recommendations, Property 2: Product Availability Filtering
    For any recommendation request, all returned products must be available.
    """
    engine = RecommendationEngine()
    related = engine.get_related_products(product.id)
    for rec in related:
        assert rec.is_available == True
        assert rec.stock > 0
        if rec.rating is not None:
            assert rec.rating >= 2.0

@given(product=products_strategy)
@settings(max_examples=100)
def test_property_3_self_exclusion(product):
    """
    Feature: product-recommendations, Property 3: Self-Exclusion in Related Products
    For any product, related products must not include the source product.
    """
    engine = RecommendationEngine()
    related = engine.get_related_products(product.id)
    related_ids = [p.id for p in related]
    assert product.id not in related_ids

@given(cart_items=cart_items_strategy)
@settings(max_examples=100)
def test_property_4_cart_item_exclusion(cart_items):
    """
    Feature: product-recommendations, Property 4: Cart Item Exclusion
    For any cart, recommendations must not include cart items.
    """
    engine = RecommendationEngine()
    recommendations = engine.get_cart_recommendations(cart_items)
    rec_ids = [p.id for p in recommendations]
    for cart_item_id in cart_items:
        assert cart_item_id not in rec_ids
```

**Integration Testing**:
- Test full recommendation flow from view to template rendering
- Test cache warming task execution
- Test order completion triggers cache invalidation
- Test recommendation click tracking end-to-end
- Test admin interface for manual associations

**Performance Testing**:
- Measure recommendation generation time with varying data sizes
- Test cache hit rates under load
- Test database query performance with 10,000+ orders
- Verify 200ms timeout enforcement

### Test Coverage Goals

- Unit test coverage: > 90% for recommendation engine and cache manager
- Property test coverage: All 24 properties implemented
- Integration test coverage: All user-facing flows
- Performance benchmarks: All critical paths under 200ms

