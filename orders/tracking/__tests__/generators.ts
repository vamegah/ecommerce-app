import * as fc from 'fast-check';
import { Address, OrderDetails, OrderItem, StatusHistoryEntry, StatusType } from '../types';

export const statusTypeGenerator = (): fc.Arbitrary<StatusType> =>
  fc.constantFrom(
    StatusType.PENDING,
    StatusType.PROCESSING,
    StatusType.SHIPPED,
    StatusType.DELIVERED,
    StatusType.CANCELLED,
    StatusType.RETURNED
  );

export const nonTerminalStatusGenerator = (): fc.Arbitrary<StatusType> =>
  fc.constantFrom(StatusType.PENDING, StatusType.PROCESSING, StatusType.SHIPPED);

export const orderItemGenerator = (): fc.Arbitrary<OrderItem> =>
  fc.record({
    productId: fc.uuid(),
    productName: fc.string({ minLength: 1, maxLength: 100 }),
    quantity: fc.integer({ min: 1, max: 100 }),
    price: fc.integer({ min: 1, max: 1000000 }).map((cents) => cents / 100),
  });

export const addressGenerator = (): fc.Arbitrary<Address> =>
  fc.record({
    street: fc.string({ minLength: 1, maxLength: 100 }),
    city: fc.string({ minLength: 1, maxLength: 80 }),
    state: fc.string({ minLength: 1, maxLength: 80 }),
    postalCode: fc.string({ minLength: 3, maxLength: 20 }),
    country: fc.constantFrom('US', 'CA', 'UK'),
  });

export const statusHistoryEntryGenerator = (orderId?: string): fc.Arbitrary<StatusHistoryEntry> =>
  fc.record({
    id: fc.uuid(),
    orderId: orderId ? fc.constant(orderId) : fc.uuid(),
    previousStatus: fc.option(statusTypeGenerator(), { nil: null }),
    newStatus: statusTypeGenerator(),
    timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2027-01-01') }),
    updatedBy: fc.oneof(fc.constant('system'), fc.uuid()),
    notes: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  });

export const orderGenerator = (): fc.Arbitrary<OrderDetails> =>
  fc
    .record({
      orderId: fc.uuid(),
      customerId: fc.uuid(),
      customerEmail: fc.emailAddress(),
      items: fc.array(orderItemGenerator(), { minLength: 1, maxLength: 10 }),
      deliveryAddress: addressGenerator(),
      currentStatus: statusTypeGenerator(),
      createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
      trackingNumber: fc.option(fc.string({ minLength: 4, maxLength: 30 }), { nil: undefined }),
      estimatedDelivery: fc.option(fc.date({ min: new Date('2024-01-01'), max: new Date('2027-12-31') }), { nil: undefined }),
    })
    .map((order) => ({
      ...order,
      statusHistory: [
        {
          id: `initial-${order.orderId}`,
          orderId: order.orderId,
          previousStatus: null,
          newStatus: order.currentStatus,
          timestamp: order.createdAt,
          updatedBy: 'system',
        },
      ],
      lastUpdated: order.createdAt,
    }));

export const validTransitionPairs: Array<[StatusType, StatusType]> = [
  [StatusType.PENDING, StatusType.PROCESSING],
  [StatusType.PENDING, StatusType.CANCELLED],
  [StatusType.PROCESSING, StatusType.SHIPPED],
  [StatusType.PROCESSING, StatusType.CANCELLED],
  [StatusType.SHIPPED, StatusType.DELIVERED],
  [StatusType.SHIPPED, StatusType.RETURNED],
];
