import * as fc from 'fast-check';
import { OrderTrackingAPI } from '../api/routes';
import { ErrorResponse, OrderDetails, StatusType } from '../types';
import { InMemoryMessageQueue } from '../services/InMemoryMessageQueue';
import { InMemoryOrderStore, OrderTrackingService } from '../services/OrderTrackingService';
import { InMemoryEmailProvider, NotificationService } from '../services/NotificationService';
import { ValidationService } from '../services/ValidationService';
import { WebSocketServer } from '../services/WebSocketServer';
import {
  addressGenerator,
  orderGenerator,
  orderItemGenerator,
  statusTypeGenerator,
  validTransitionPairs,
} from './generators';

const propertyConfig = { numRuns: 100 };

function serviceWithOrder(order: OrderDetails, queue = new InMemoryMessageQueue()) {
  const store = new InMemoryOrderStore();
  const service = new OrderTrackingService(store, new ValidationService(), queue);
  service.createOrder(order);
  return { service, queue, store };
}

function firstAllowed(status: StatusType): StatusType | null {
  return new ValidationService().getAllowedTransitions(status, false)[0] ?? null;
}

describe('Feature: order-tracking, ValidationService', () => {
  test('Property 12: Status Transitions Are Validated', () => {
    fc.assert(
      fc.property(statusTypeGenerator(), statusTypeGenerator(), (from, to) => {
        const validation = new ValidationService();
        const allowed = validation.getAllowedTransitions(from, false);
        expect(validation.isValidTransition(from, to, false)).toBe(allowed.includes(to));
      }),
      propertyConfig
    );
  });

  test('Property 16: Privileged Administrators Can Make Exceptional Transitions', () => {
    const validation = new ValidationService();
    expect(validation.isValidTransition(StatusType.DELIVERED, StatusType.RETURNED, false)).toBe(false);
    expect(validation.isValidTransition(StatusType.DELIVERED, StatusType.RETURNED, true)).toBe(true);
    expect(validation.isValidTransition(StatusType.CANCELLED, StatusType.PROCESSING, false)).toBe(false);
    expect(validation.isValidTransition(StatusType.CANCELLED, StatusType.PROCESSING, true)).toBe(true);
  });

  test('valid and invalid transition edge cases', () => {
    const validation = new ValidationService();
    for (const [from, to] of validTransitionPairs) {
      expect(validation.isValidTransition(from, to, false)).toBe(true);
    }
    expect(validation.isValidTransition(StatusType.PENDING, StatusType.DELIVERED, false)).toBe(false);
    expect(validation.getAllowedTransitions(StatusType.DELIVERED, false)).toEqual([]);
    expect(validation.getAllowedTransitions(StatusType.DELIVERED, true)).toContain(StatusType.RETURNED);
  });
});

describe('Feature: order-tracking, OrderTrackingService', () => {
  test('Property 1: Order Retrieval Returns Correct Information', () => {
    fc.assert(
      fc.asyncProperty(orderGenerator(), async (order) => {
        const { service } = serviceWithOrder(order);
        const status = await service.getOrderStatus(order.orderId);
        const tracking = await service.getTrackingPageData(order.orderId);

        expect(status.orderId).toBe(order.orderId);
        expect(status.currentStatus).toBe(order.currentStatus);
        expect(status.lastUpdated).toBeInstanceOf(Date);
        expect(tracking.customerEmail).toBe(order.customerEmail);
        expect(tracking.items).toEqual(order.items);
      }),
      propertyConfig
    );
  });

  test('Property 2: Invalid Order IDs Return Errors', () => {
    fc.assert(
      fc.asyncProperty(fc.uuid(), async (missingOrderId) => {
        const service = new OrderTrackingService();
        await expect(service.getOrderStatus(missingOrderId)).rejects.toMatchObject({
          code: 'ORDER_NOT_FOUND',
          statusCode: 404,
        });
      }),
      propertyConfig
    );
  });

  test('Property 3: Status Changes Create Complete History Entries', () => {
    fc.assert(
      fc.asyncProperty(orderGenerator(), fc.string({ maxLength: 200 }), async (order, notes) => {
        const next = firstAllowed(order.currentStatus);
        fc.pre(next !== null);
        const { service } = serviceWithOrder(order);
        await service.updateOrderStatus(order.orderId, next!, 'admin-123', notes);
        const history = await service.getStatusHistory(order.orderId);
        const latest = history[history.length - 1];

        expect(latest.previousStatus).toBe(order.currentStatus);
        expect(latest.newStatus).toBe(next);
        expect(latest.timestamp).toBeInstanceOf(Date);
        expect(latest.updatedBy).toBe('admin-123');
        expect(latest.notes).toBe(notes);
      }),
      propertyConfig
    );
  });

  test('Property 4: Status History Maintains Chronological Order', () => {
    fc.assert(
      fc.asyncProperty(orderGenerator(), async (order) => {
        const { service } = serviceWithOrder({ ...order, currentStatus: StatusType.PENDING });
        await service.updateOrderStatus(order.orderId, StatusType.PROCESSING, 'admin');
        await service.updateOrderStatus(order.orderId, StatusType.SHIPPED, 'admin');
        const history = await service.getStatusHistory(order.orderId);
        const timestamps = history.map((entry) => entry.timestamp.getTime());
        expect(timestamps).toEqual([...timestamps].sort((left, right) => left - right));
      }),
      propertyConfig
    );
  });

  test('Property 14: Administrator Updates Change Status and Create History', () => {
    fc.assert(
      fc.asyncProperty(orderGenerator(), async (order) => {
        const next = firstAllowed(order.currentStatus);
        fc.pre(next !== null);
        const { service } = serviceWithOrder(order);
        await service.updateOrderStatus(order.orderId, next!, 'admin-1');
        const status = await service.getOrderStatus(order.orderId);
        const history = await service.getStatusHistory(order.orderId);
        expect(status.currentStatus).toBe(next);
        expect(history[history.length - 1].updatedBy).toBe('admin-1');
      }),
      propertyConfig
    );
  });

  test('events are published after status updates and queue failures are handled', async () => {
    const order = fc.sample(orderGenerator().filter((candidate) => candidate.currentStatus === StatusType.PENDING), 1)[0];
    const queue = new InMemoryMessageQueue();
    const { service } = serviceWithOrder(order, queue);
    await service.updateOrderStatus(order.orderId, StatusType.PROCESSING, 'admin');

    expect(queue.publishedEvents).toHaveLength(1);
    expect(queue.publishedEvents[0]).toMatchObject({
      orderId: order.orderId,
      customerEmail: order.customerEmail,
    });
    expect(queue.publishedEvents[0].orderDetails.items).toEqual(order.items);

    queue.failNextPublish = true;
    await expect(service.updateOrderStatus(order.orderId, StatusType.SHIPPED, 'admin')).resolves.toMatchObject({
      newStatus: StatusType.SHIPPED,
    });
  });
});

describe('Feature: order-tracking, NotificationService', () => {
  test('Property 5: Status Changes Trigger Email Notifications', () => {
    fc.assert(
      fc.asyncProperty(orderGenerator(), async (order) => {
        const next = firstAllowed(order.currentStatus);
        fc.pre(next !== null);
        const queue = new InMemoryMessageQueue();
        const emailProvider = new InMemoryEmailProvider();
        new NotificationService(emailProvider, queue);
        const { service } = serviceWithOrder(order, queue);
        await service.updateOrderStatus(order.orderId, next!, 'admin', 'Packed and moving');

        expect(emailProvider.sent).toHaveLength(1);
        expect(emailProvider.sent[0].to).toBe(order.customerEmail);
        expect(emailProvider.sent[0].body).toContain(order.orderId);
        expect(emailProvider.sent[0].body).toContain(next!);
        expect(emailProvider.sent[0].body).toContain('Packed and moving');
      }),
      propertyConfig
    );
  });

  test('Property 6: Failed Email Notifications Are Logged and Retried', async () => {
    const emailProvider = new InMemoryEmailProvider();
    emailProvider.failNext = true;
    const notifications = new NotificationService(emailProvider);
    const update = {
      orderId: 'order-1',
      newStatus: StatusType.PROCESSING,
      adminId: 'admin',
      timestamp: new Date(),
    };

    await notifications.sendStatusChangeEmail('order-1', 'customer@example.test', update);
    expect(notifications.failures).toHaveLength(1);
    expect(notifications.failures[0].retrySchedule).toEqual([60, 300, 900, 3600, 21600]);
    await notifications.retryFailedNotification(notifications.failures[0].notificationId);
    expect(emailProvider.sent).toHaveLength(1);
    expect(notifications.failures[0].retryCount).toBe(1);
  });

  test('Property 7: Rapid Status Changes Are Batched', async () => {
    const emailProvider = new InMemoryEmailProvider();
    const notifications = new NotificationService(emailProvider);
    const updates = [
      { orderId: 'order-1', newStatus: StatusType.PROCESSING, adminId: 'admin', timestamp: new Date() },
      { orderId: 'order-1', newStatus: StatusType.SHIPPED, adminId: 'admin', timestamp: new Date() },
    ];

    await notifications.batchNotifications('order-1', updates, 'customer@example.test');
    expect(emailProvider.sent).toHaveLength(1);
    expect(emailProvider.sent[0].body).toContain(StatusType.PROCESSING);
    expect(emailProvider.sent[0].body).toContain(StatusType.SHIPPED);
  });
});

describe('Feature: order-tracking, WebSocketServer', () => {
  test('Property 9: Real-Time Updates Are Pushed to Connected Clients', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }), (orderId, clients) => {
        const server = new WebSocketServer();
        const uniqueClients = Array.from(new Set(clients));
        uniqueClients.forEach((clientId) => server.subscribe(orderId, clientId));
        const update = { orderId, newStatus: StatusType.PROCESSING, adminId: 'admin', timestamp: new Date() };
        server.pushUpdate(orderId, update);

        uniqueClients.forEach((clientId) => {
          expect(server.getReceivedMessages(clientId)).toEqual([{ orderId, update }]);
        });
      }),
      propertyConfig
    );
  });

  test('Property 10: Disconnected Clients Receive Missed Updates on Reconnection', () => {
    const server = new WebSocketServer();
    const update = { orderId: 'order-1', newStatus: StatusType.PROCESSING, adminId: 'admin', timestamp: new Date() };
    server.subscribe('order-1', 'client-1');
    server.onDisconnect('client-1');
    server.pushUpdate('order-1', update);
    expect(server.getMissedMessages('client-1')).toHaveLength(1);
    server.onReconnect('client-1');
    expect(server.getMissedMessages('client-1')).toHaveLength(0);
    expect(server.getReceivedMessages('client-1')).toHaveLength(1);
  });

  test('Property 11: Connection Interruptions Trigger Automatic Reconnection', () => {
    const server = new WebSocketServer();
    server.onConnect('client-1');
    server.onDisconnect('client-1');
    expect(server.shouldAttemptReconnect('client-1')).toBe(true);
  });
});

describe('Feature: order-tracking, REST API and errors', () => {
  test('Property 8: Tracking Page Contains Required Order Details', () => {
    fc.assert(
      fc.asyncProperty(orderGenerator(), async (order) => {
        const { service } = serviceWithOrder(order);
        const api = new OrderTrackingAPI(service);
        const response = await api.getTrackingPage(order.orderId);
        expect(response.statusCode).toBe(200);
        const body = response.body as OrderDetails;
        expect(body.items).toEqual(order.items);
        expect(body.deliveryAddress).toEqual(order.deliveryAddress);
        expect(body.currentStatus).toBe(order.currentStatus);
        expect(body.statusHistory.length).toBeGreaterThan(0);
      }),
      propertyConfig
    );
  });

  test('Property 13: Administrator Permissions Are Validated', async () => {
    const order = fc.sample(orderGenerator().filter((candidate) => candidate.currentStatus === StatusType.PENDING), 1)[0];
    const { service } = serviceWithOrder(order);
    const api = new OrderTrackingAPI(service);
    const denied = await api.updateStatus(order.orderId, { status: StatusType.PROCESSING }, { adminId: 'user-1', isAdmin: false });
    expect(denied.statusCode).toBe(403);
    expect((denied.body as ErrorResponse).error.code).toBe('ADMIN_REQUIRED');
  });

  test('Property 15: Optional Notes Can Be Included in Updates', () => {
    fc.assert(
      fc.asyncProperty(orderGenerator(), fc.option(fc.string({ maxLength: 200 }), { nil: undefined }), async (order, notes) => {
        const next = firstAllowed(order.currentStatus);
        fc.pre(next !== null);
        const { service } = serviceWithOrder(order);
        const api = new OrderTrackingAPI(service);
        const response = await api.updateStatus(order.orderId, { status: next, notes }, { adminId: 'admin', isAdmin: true });
        expect(response.statusCode).toBe(200);
        const history = await service.getStatusHistory(order.orderId);
        expect(history[history.length - 1].notes).toBe(notes);
      }),
      propertyConfig
    );
  });

  test('standardized errors return expected status codes and messages', async () => {
    const api = new OrderTrackingAPI(new OrderTrackingService());
    const missing = await api.getStatus('missing-order');
    const badStatusOrder = fc.sample(orderGenerator().filter((candidate) => candidate.currentStatus === StatusType.PENDING), 1)[0];
    const { service } = serviceWithOrder(badStatusOrder);
    const badStatus = await new OrderTrackingAPI(service).updateStatus(
      badStatusOrder.orderId,
      { status: 'not-real' },
      { adminId: 'admin', isAdmin: true }
    );
    const invalidTransition = await new OrderTrackingAPI(service).updateStatus(
      badStatusOrder.orderId,
      { status: StatusType.DELIVERED },
      { adminId: 'admin', isAdmin: true }
    );

    expect(missing.statusCode).toBe(404);
    expect((missing.body as ErrorResponse).error.message).toBe('Order not found');
    expect(badStatus.statusCode).toBe(400);
    expect(invalidTransition.statusCode).toBe(400);
  });
});

describe('Feature: order-tracking, generators and integration', () => {
  test('generator functions produce valid constrained data', () => {
    fc.assert(
      fc.property(orderGenerator(), orderItemGenerator(), addressGenerator(), statusTypeGenerator(), (order, item, address, status) => {
        expect(order.orderId).toBeTruthy();
        expect(order.items.length).toBeGreaterThan(0);
        expect(item.quantity).toBeGreaterThan(0);
        expect(item.price).toBeGreaterThan(0);
        expect(address.street).toBeTruthy();
        expect(Object.values(StatusType)).toContain(status);
      }),
      propertyConfig
    );
  });

  test('complete flow: status update creates history, email, event, and websocket push', async () => {
    const order = fc.sample(orderGenerator().filter((candidate) => candidate.currentStatus === StatusType.PENDING), 1)[0];
    const queue = new InMemoryMessageQueue();
    const emailProvider = new InMemoryEmailProvider();
    const webSocketServer = new WebSocketServer(queue);
    new NotificationService(emailProvider, queue);
    webSocketServer.subscribe(order.orderId, 'client-1');
    const { service } = serviceWithOrder(order, queue);
    const api = new OrderTrackingAPI(service);

    const response = await api.updateStatus(order.orderId, { status: StatusType.PROCESSING, notes: 'Started' }, { adminId: 'admin', isAdmin: true });
    const history = await service.getStatusHistory(order.orderId);

    expect(response.statusCode).toBe(200);
    expect(history[history.length - 1].newStatus).toBe(StatusType.PROCESSING);
    expect(queue.publishedEvents).toHaveLength(1);
    expect(emailProvider.sent).toHaveLength(1);
    expect(webSocketServer.getReceivedMessages('client-1')).toHaveLength(1);
  });
});
