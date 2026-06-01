# Recommendations App

This Django app provides product recommendation functionality for the GreatKart e-commerce platform.

## Setup

The app has been created with the following components:

1. **Models**:
   - `RelatedProduct`: Stores manual product associations set by admins
   - `RecommendationClick`: Tracks user interactions with recommendations

2. **Admin Interface**: Both models are registered in the Django admin

3. **Migration**: Initial migration file created at `migrations/0001_initial.py`

4. **Property Tests**: Property-based tests using Hypothesis in `test_properties.py`

## Installation Steps

### 1. Install Dependencies

```bash
pip install hypothesis
```

### 2. Run Migrations

To apply the database migrations and create the tables:

```bash
python manage.py migrate recommendations
```

This will create the following tables:
- `related_products`
- `recommendation_clicks`

### 3. Run Tests

To verify the installation:

```bash
python manage.py test recommendations.test_properties --keepdb
```

Or use the setup scripts:

**Windows**:
```bash
setup.bat
```

**Unix/Linux/Mac**:
```bash
chmod +x setup.sh
./setup.sh
```

## What's Been Implemented

### Task 1: Set up recommendations app structure and core models ✓

- [x] Created Django app `recommendations`
- [x] Added app to INSTALLED_APPS in settings
- [x] Created RelatedProduct model with admin interface
- [x] Created RecommendationClick model for tracking
- [x] Generated migration file (0001_initial.py)
- [x] Registered models in admin interface

### Task 1.1: Write property test for RelatedProduct model ✓

- [x] Implemented Property 19: Manual Association Persistence
- [x] Test validates Requirements 7.2
- [x] Uses Hypothesis for property-based testing
- [x] Runs 100 examples per test

## Models

### RelatedProduct

Stores manual product associations set by administrators.

**Fields**:
- `product`: Source product (ForeignKey to Product)
- `related_product`: Related product (ForeignKey to Product)
- `order`: Display order (PositiveIntegerField)
- `created_at`: Timestamp (DateTimeField)
- `created_by`: Admin user who created the association (ForeignKey to Account)

**Constraints**:
- Unique together: (product, related_product)
- Indexed: (product, order)

### RecommendationClick

Tracks user interactions with recommendations for analytics.

**Fields**:
- `user`: User who clicked (ForeignKey to Account, nullable)
- `session_key`: Session key for anonymous users (CharField, nullable)
- `source_type`: Type of recommendation (CharField with choices)
- `source_product`: Product that generated the recommendation (ForeignKey, nullable)
- `recommended_product`: Product that was recommended (ForeignKey, nullable)
- `clicked_at`: Timestamp (DateTimeField)
- `added_to_cart`: Whether product was added to cart (BooleanField)

**Indexes**:
- (source_type, clicked_at)
- (user, clicked_at)
- (recommended_product, clicked_at)

## Admin Interface

Both models are accessible via Django admin:

1. **RelatedProduct Admin**:
   - List display: product, related_product, order, created_at, created_by
   - Search: product name, related product name
   - Filters: created_at
   - Auto-sets created_by to current admin user

2. **RecommendationClick Admin**:
   - List display: source_type, recommended_product, user, session_key, clicked_at, added_to_cart
   - Search: user email, session_key, product name
   - Filters: source_type, added_to_cart, clicked_at
   - Read-only: clicked_at

## Testing

See [TESTING.md](TESTING.md) for detailed testing instructions.

## Next Steps

After running migrations and tests, you can:
1. Access the admin interface to manage related products
2. Implement the recommendation engine (Task 2+)
3. Add caching layer (Task 3)
4. Integrate with views and templates (Task 11+)
5. Implement click tracking (Task 13)
6. Add Celery tasks for async operations (Task 14)
