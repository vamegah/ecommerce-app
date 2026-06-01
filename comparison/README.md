# Product Comparison Feature

This module implements the product comparison feature for GreatKart e-commerce platform.

## Directory Structure

```
comparison/
├── static/
│   └── comparison/
│       └── ts/
│           ├── tests/          # Test files
│           │   └── setup.test.ts
│           └── types.ts        # Core type definitions
├── package.json                # Node dependencies
├── tsconfig.json              # TypeScript configuration
├── vitest.config.ts           # Vitest test configuration
├── apps.py                    # Django app configuration
├── models.py                  # Django models (for server persistence)
├── views.py                   # Django views
├── urls.py                    # URL routing
└── README.md                  # This file
```

## Setup

1. Install dependencies:
   ```bash
   cd comparison
   npm install
   ```

2. Run tests:
   ```bash
   npm test
   ```

3. Build TypeScript:
   ```bash
   npm run build
   ```

## Type Definitions

### Enums

- **AttributeCategory**: Groups related attributes (SPECIFICATIONS, PRICING, FEATURES, SHIPPING, GENERAL)
- **AttributeType**: Defines how attribute values should be rendered (TEXT, NUMBER, BOOLEAN, CURRENCY, RATING)
- **ComparisonErrorCode**: Error codes for comparison operations

### Interfaces

- **ProductAttribute**: Represents a product attribute with name, value, category, and type
- **Product**: Represents a product with id, name, price, image, attributes, and availability
- **Comparison**: Represents a comparison session with products and metadata
- **ComparisonResult**: Result type for comparison operations
- **ValidationResult**: Result type for validation checks

### Classes

- **ComparisonError**: Custom error class for comparison operations

## Testing

The project uses Vitest for testing with fast-check for property-based testing.

Run tests with:
```bash
npm test
```

Watch mode:
```bash
npm run test:watch
```

## Requirements

This implementation satisfies requirements:
- 1.1: Add products to comparison
- 1.2: Display product attributes
- 3.1: Display comparison table structure
- 3.2: Show attributes in rows
- 4.4: Group attributes by category
