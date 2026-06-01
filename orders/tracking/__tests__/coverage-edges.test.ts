import { loadOrderTrackingConfig } from '../config';
import * as publicApi from '../index';
import { BadRequestError, formatError, SystemError } from '../errors';
import { OrderTrackingAPI } from '../api/routes';
import { InMemoryMessageQueue } from '../services/InMemoryMessageQueue';
import { InMemoryOrderStore, OrderTrackingService } from '../services/OrderTrackingService';
import { InMemoryEmailProvider, NotificationService } from '../services/NotificationService';
import { ValidationService } from '../services/ValidationService';
import { WebSocketServer } from '../services/WebSocketServer';
import { OrderDetails, StatusType } from '../types';

function pendingOrder(overrides: Partial<OrderDetails> = {}): OrderDetails {
  const createdAt = new Date('2025-01-01T00:00:00.000Z');
  return {
    orderId: 'order-coverage',
    customerId: 'customer-1',
    customerEmail: 'customer@example.test',
    items: [{ productId: 'product-1', productName: 'Widget', quantity: 1, price: 12.5 }],
    deliveryAddress: {
      street: '1 Main St',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60601',
      country: 'US',
    },
    currentStatus: StatusType.PENDING,
    statusHistory: [
      {
        id: 'history-1',
        orderId: 'order-coverage',
        previousStatus: null,
        newStatus: StatusType.PENDING,
        timestamp: createdAt,
        updatedBy: 'system',
      },
    ],
    createdAt,
    lastUpdated: createdAt,
    ...overrides,
  };
}

describe('coverage edge cases', () => {
  test('loads default and environment-backed configuration', () => {
    expect(loadOrderTrackingConfig({})).toEqual({
      databaseUrl: 'memory://orders',
      messageQueueUrl: 'memory://queue',
      emailFrom: 'orders@example.test',
      websocketPath: '/ws/orders',
      notificationBatchWindowMs: 120000,
    });
    expect(
      loadOrderTrackingConfig({
        ORDER_TRACKING_DATABASE_URL: 'postgres://orders',
        ORDER_TRACKING_QUEUE_URL: 'amqp://queue',
        ORDER_TRACKING_EMAIL_FROM: 'ship@example.test',
        ORDER_TRACKING_WS_PATH: '/custom/ws',
        ORDER_TRACKING_BATCH_WINDOW_MS: '60000',
      })
    ).toMatchObject({
      databaseUrl: 'postgres://orders',
      messageQueueUrl: 'amqp://queue',
      emailFrom: 'ship@example.test',
      websocketPath: '/custom/ws',
      notificationBatchWindowMs: 60000,
    });
  });

  test('public index exports the tracking components', () => {
    expect(publicApi.OrderTrackingService).toBeDefined();
    expect(publicApi.ValidationService).toBeDefined();
    expect(publicApi.NotificationService).toBeDefined();
    expect(publicApi.WebSocketServer).toBeDefined();
    expect(publicApi.OrderTrackingAPI).toBeDefined();
    expect(publicApi.loadOrderTrackingConfig).toBeDefined();
  });

  test('formats tracking and generic errors', () => {
    expect(formatError(new BadRequestError('Bad data')).body.error.details).toBeUndefined();
    expect(formatError(new SystemError()).statusCode).toBe(500);
    expect(formatError('plain failure').body.error.details).toEqual({ message: 'plain failure' });
  });

  test('api covers history, string admin, newStatus alias, and not found branches', async () => {
    const service = new OrderTrackingService();
    service.createOrder(pendingOrder());
    const api = new OrderTrackingAPI(service);

    expect((await api.getHistory('order-coverage')).statusCode).toBe(200);
    expect((await api.getHistory('missing')).statusCode).toBe(404);
    expect((await api.getTrackingPage('missing')).statusCode).toBe(404);
    expect(
      (
        await api.updateStatus(
          'order-coverage',
          { newStatus: StatusType.PROCESSING },
          'admin-string'
        )
      ).statusCode
    ).toBe(200);
    expect(
      (
        await api.updateStatus(
          'order-coverage',
          { status: StatusType.SHIPPED },
          { adminId: 'admin-privileged', isAdmin: true, isPrivileged: true }
        )
      ).statusCode
    ).toBe(200);
  });

  test('order store and tracking service cover clone and accessor branches', async () => {
    const store = new InMemoryOrderStore();
    const service = new OrderTrackingService(store);
    const order = pendingOrder({ estimatedDelivery: undefined, trackingNumber: undefined });
    service.createOrder(order);

    expect(service.getStore()).toBe(store);
    expect(service.getMessageQueue()).toBeDefined();
    expect(await service.getOrderStatus(order.orderId)).toMatchObject({
      estimatedDelivery: undefined,
      trackingNumber: undefined,
    });
    expect(store.findById('missing')).toBeNull();
    store.clear();
    await expect(service.getOrderStatus(order.orderId)).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
  });

  test('notification service covers custom providers and failure branches', async () => {
    const customProvider = {
      sentMessages: [] as unknown[],
      async send(message: unknown) {
        this.sentMessages.push(message);
      },
    };
    const notifications = new NotificationService(customProvider);
    expect(notifications.getSentEmails()).toEqual([]);
    expect(notifications.getPendingBatch('missing')).toEqual([]);
    await expect(notifications.retryFailedNotification('missing')).rejects.toThrow('was not found');

    const emailProvider = new InMemoryEmailProvider();
    const stringFailureProvider = {
      async send() {
        throw 'string failure';
      },
    };
    const failingNotifications = new NotificationService(stringFailureProvider);
    await failingNotifications.sendStatusChangeEmail('order-1', 'customer@example.test', {
      orderId: 'order-1',
      newStatus: StatusType.PROCESSING,
      adminId: 'admin',
      timestamp: new Date(),
    });
    expect(failingNotifications.failures[0].error).toBe('string failure');
    await new NotificationService(emailProvider).sendStatusChangeEmail('order-2', 'customer@example.test', {
      orderId: 'order-2',
      newStatus: StatusType.PROCESSING,
      adminId: 'admin',
      notes: undefined,
      timestamp: new Date(),
    });
    expect(emailProvider.sent[0].body).not.toContain('Notes:');
  });

  test('websocket server covers unsubscribe and empty subscriber paths', () => {
    const server = new WebSocketServer();
    const update = {
      orderId: 'order-1',
      newStatus: StatusType.PROCESSING,
      adminId: 'admin',
      timestamp: new Date(),
    };

    server.pushUpdate('order-without-subscribers', update);
    server.unsubscribe('missing-client');
    server.subscribe('order-1', 'client-1');
    expect(server.getSubscribers('order-1')).toEqual(['client-1']);
    server.unsubscribe('client-1');
    expect(server.getSubscribers('order-1')).toEqual([]);
    expect(server.getReceivedMessages('missing-client')).toEqual([]);
    expect(server.getMissedMessages('missing-client')).toEqual([]);
  });

  test('message queue subscription branch feeds websocket and notification services', async () => {
    const queue = new InMemoryMessageQueue();
    const webSocketServer = new WebSocketServer(queue);
    const emailProvider = new InMemoryEmailProvider();
    new NotificationService(emailProvider, queue);
    const service = new OrderTrackingService(new InMemoryOrderStore(), new ValidationService(), queue);
    service.createOrder(pendingOrder());
    webSocketServer.subscribe('order-coverage', 'client-1');

    await service.updateOrderStatus('order-coverage', StatusType.PROCESSING, 'admin');

    expect(emailProvider.sent).toHaveLength(1);
    expect(webSocketServer.getReceivedMessages('client-1')).toHaveLength(1);
  });
});
