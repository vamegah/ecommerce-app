# Order Tracking System

Real-time order tracking system with WebSocket support, email notifications, and comprehensive property-based testing.

## Project Structure

```
orders/tracking/
├── types.ts                          # Core type definitions
├── index.ts                          # Main entry point
├── services/                         # Business logic layer
│   ├── OrderTrackingService.ts      # Core tracking service
│   ├── ValidationService.ts         # Status transition validation
│   ├── NotificationService.ts       # Email notification handling
│   └── WebSocketServer.ts           # Real-time update management
├── api/                             # API layer
│   └── routes.ts                    # REST API endpoints
├── __tests__/                       # Test files
│   └── setup.test.ts                # Test framework setup
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript configuration
├── jest.config.js                   # Jest configuration
└── README.md                        # This file
```

## Core Types

### StatusType Enum
- `PENDING` - Order has been placed
- `PROCESSING` - Order is being prepared
- `SHIPPED` - Order has been shipped
- `DELIVERED` - Order has been delivered
- `CANCELLED` - Order has been cancelled
- `RETURNED` - Order has been returned

### Main Interfaces
- `OrderStatus` - Current status of an order
- `StatusHistoryEntry` - Single entry in status history
- `OrderDetails` - Complete order information
- `StatusUpdateEvent` - Event published to message queue
- `OrderItem` - Item in an order
- `Address` - Delivery address

## Setup

Install dependencies:
```bash
npm install
```

## Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Generate coverage report:
```bash
npm run test:coverage
```

## Testing Framework

- **Jest**: Unit testing framework
- **fast-check**: Property-based testing library
- **ts-jest**: TypeScript support for Jest

## Requirements

- Node.js 18+
- TypeScript 5+
- Jest 29+
- fast-check 3+

## Implementation Status

Task 1: ✅ Project structure and core types set up
- Directory structure created
- TypeScript interfaces defined
- StatusType enum defined
- Testing framework configured (Jest + fast-check)

Remaining tasks will be implemented incrementally according to the implementation plan.

## Runtime Integration

- `OrderTrackingService` owns status retrieval, validation, history recording, and status-update event publishing.
- `NotificationService` and `WebSocketServer` can subscribe to the same message queue for email and real-time updates.
- `OrderTrackingAPI` exposes REST-style handlers for status, history, tracking details, and administrator updates.
- `loadOrderTrackingConfig()` reads environment-backed settings with in-memory defaults for local/test usage.
