# Multi-Address Management System

This module provides comprehensive address management functionality for the e-commerce platform, allowing users to save, manage, and select from multiple shipping addresses.

## Directory Structure

```
addresses/
├── static/
│   └── addresses/
│       └── ts/
│           ├── types.ts              # Core TypeScript type definitions
│           ├── validators/           # Address validation logic
│           ├── managers/             # Address manager implementation
│           ├── storage/              # Data store interfaces and implementations
│           ├── checkout/             # Checkout integration
│           └── tests/                # Test files
├── migrations/                       # Django database migrations
├── __init__.py                       # Python package initialization
├── admin.py                          # Django admin configuration
├── apps.py                           # Django app configuration
├── models.py                         # Django models
├── views.py                          # Django views
├── urls.py                           # URL routing
├── tests.py                          # Django tests
├── package.json                      # Node.js dependencies
├── tsconfig.json                     # TypeScript configuration
├── vitest.config.ts                  # Vitest test configuration
└── README.md                         # This file
```

## Setup

### Install Dependencies

```bash
cd addresses
npm install
```

### Run Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Type Checking

```bash
npm run type-check
```

### Build

```bash
npm run build
```

## Testing Strategy

This module uses a comprehensive testing approach:

- **Property-Based Testing**: Using fast-check with minimum 100 iterations per property
- **Unit Testing**: Focused tests for specific scenarios and edge cases
- **Integration Testing**: End-to-end testing with database and API

## Requirements

- Node.js 18+
- TypeScript 5.3+
- Vitest 1.2+
- fast-check 3.15+

## Runtime Integration

- API routes are mounted at `/api/addresses/` and require an authenticated user.
- Checkout receives saved addresses through `CheckoutAddressService` and pre-selects the default address without changing it when a different address is selected for an order.
- Run `python manage.py test addresses`, `npm test`, and `npm run build` before changing address behavior.
