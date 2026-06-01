# Inventory Alerts

A notification system that monitors product inventory levels and alerts subscribed users when out-of-stock items become available.

## Project Structure

```
inventory_alerts/
├── subscription/          # Subscription management component
├── monitoring/           # Stock monitoring component
├── notification/         # Email notification service
├── admin_interface/      # Admin tools and analytics
├── migrations/           # Django database migrations
├── tests/               # Test suite (unit + property-based)
├── models.py            # Django models
├── views.py             # Django views
├── urls.py              # URL routing
├── admin.py             # Django admin configuration
└── apps.py              # Django app configuration
```

## Dependencies

### Python Dependencies
- Django (web framework)
- Django REST Framework (API endpoints)
- Celery (background task processing)
- Email service SDK (to be determined)

### TypeScript/JavaScript Dependencies
- TypeScript 5.0+ (type safety)
- Jest 29.5+ (testing framework)
- ts-jest (TypeScript support for Jest)
- fast-check 3.15+ (property-based testing)

## Setup

### Install Node.js Dependencies

```bash
cd inventory_alerts
npm install
```

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Type check without building
npm run type-check
```

### Build TypeScript

```bash
npm run build
```

## Testing Strategy

This project uses a dual testing approach:

1. **Unit Tests**: Verify specific examples, edge cases, and error conditions
2. **Property-Based Tests**: Verify universal properties across all inputs using fast-check

All property-based tests run with a minimum of 100 iterations to ensure comprehensive coverage.

## Configuration

### TypeScript Configuration
- Strict mode enabled
- ES2020 target
- CommonJS modules
- Source maps enabled
- Declaration files generated

### Jest Configuration
- ts-jest preset
- Node test environment
- 80% minimum code coverage
- 30-second timeout for property tests

## Development Guidelines

1. Write both unit tests and property tests for new features
2. Reference design document properties in test names
3. Use the shared test configuration from `tests/test-config.ts`
4. Maintain 80% minimum code coverage
5. Run type checking before committing code

## Runtime Integration

- Django routes are mounted under `/inventory-alerts/`.
- Run `python manage.py process_inventory_alerts` from a scheduler to check stock, process queued notifications, and archive completed subscriptions.
- Run `python manage.py test inventory_alerts`, `npm test`, and `npm run build` before changing alert behavior.
