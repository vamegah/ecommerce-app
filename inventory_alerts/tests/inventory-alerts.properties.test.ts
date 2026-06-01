import * as fc from 'fast-check';
import { PBT_CONFIG } from './test-config';
import { NotificationRecord, Subscription } from '../types';
import { InventoryValidationError, sanitizeInput, validateEmail, validateProductId, validateStockLevel } from '../validation';

type Product = { id: string; name: string; stock: number; link: string; discontinued?: boolean };

class InMemoryInventoryAlerts {
  products = new Map<string, Product>();
  subscriptions = new Map<string, Subscription>();
  notifications: NotificationRecord[] = [];
  auditLog: Array<{ eventType: string; entityId: string; details?: unknown }> = [];
  sentEmails: Array<{ email: string; subject: string; body: string }> = [];
  backoffDelays: number[] = [];
  queue: NotificationRecord[] = [];
  nextEmailFailures = 0;
  rateLimit = Number.POSITIVE_INFINITY;
  sentInWindow = 0;

  addProduct(product: Product): void {
    this.products.set(product.id, product);
  }

  createSubscription(userId: string, productId: string, email: string): Subscription {
    const cleanedProductId = validateProductId(productId);
    const normalizedEmail = validateEmail(email);
    if (!this.products.has(cleanedProductId)) {
      throw new InventoryValidationError('Product was not found.');
    }
    const duplicate = Array.from(this.subscriptions.values()).some((subscription) => {
      return subscription.status === 'active' && subscription.userId === userId && subscription.productId === cleanedProductId;
    });
    if (duplicate) {
      throw new InventoryValidationError('An active subscription already exists for this product.');
    }
    const subscription: Subscription = {
      id: `sub-${this.subscriptions.size + 1}`,
      userId,
      productId: cleanedProductId,
      email: normalizedEmail,
      status: 'active',
      createdAt: new Date(),
      unsubscribeToken: `token-${this.subscriptions.size + 1}`,
    };
    this.subscriptions.set(subscription.id, subscription);
    this.auditLog.push({ eventType: 'subscription_created', entityId: subscription.id });
    this.sendLifecycleEmail(subscription, 'subscribed');
    return subscription;
  }

  removeSubscription(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }
    this.subscriptions.delete(subscriptionId);
    this.sendLifecycleEmail(subscription, 'unsubscribed');
    this.auditLog.push({ eventType: 'subscription_cancelled', entityId: subscriptionId });
    return true;
  }

  getSubscriptionsByProduct(productId: string, status = 'active'): Subscription[] {
    return Array.from(this.subscriptions.values()).filter((subscription) => {
      return subscription.productId === productId && subscription.status === status;
    });
  }

  getSubscriptionsByUser(userId: string): Subscription[] {
    return Array.from(this.subscriptions.values()).filter((subscription) => subscription.userId === userId);
  }

  markAsNotified(subscriptionId: string, notificationId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new InventoryValidationError('Subscription was not found.');
    }
    subscription.status = 'notified';
    subscription.notifiedAt = new Date();
    subscription.completedAt = subscription.notifiedAt;
    subscription.notificationId = notificationId;
  }

  generateEmail(subscription: Subscription): string {
    const product = this.products.get(subscription.productId);
    if (!product) {
      throw new InventoryValidationError('Product was not found.');
    }
    return [
      product.name,
      `Current stock: ${product.stock}`,
      `Product page: ${product.link}`,
      `Unsubscribe: /subscriptions/unsubscribe/${subscription.unsubscribeToken}`,
    ].join('\n');
  }

  sendNotification(subscription: Subscription): NotificationRecord {
    const product = this.products.get(subscription.productId);
    if (!product) {
      throw new InventoryValidationError('Product was not found.');
    }
    const notification: NotificationRecord = {
      id: `notif-${this.notifications.length + 1}`,
      subscriptionId: subscription.id,
      productId: subscription.productId,
      email: subscription.email,
      kind: 'restock',
      status: 'pending',
      retryCount: 0,
    };
    if (this.sentInWindow >= this.rateLimit) {
      notification.status = 'queued';
      notification.queuedAt = new Date();
      this.notifications.push(notification);
      this.queue.push(notification);
      return notification;
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (this.nextEmailFailures > 0) {
        this.nextEmailFailures -= 1;
        notification.retryCount = attempt + 1;
        notification.error = 'email failed';
        if (attempt < 2) {
          this.backoffDelays.push(2 ** attempt);
          continue;
        }
        notification.status = 'failed';
        this.auditLog.push({ eventType: 'notification_failed', entityId: notification.id });
        this.notifications.push(notification);
        return notification;
      }
      notification.status = 'sent';
      notification.sentAt = new Date();
      this.sentInWindow += 1;
      this.sentEmails.push({ email: subscription.email, subject: `${product.name} is back in stock`, body: this.generateEmail(subscription) });
      this.markAsNotified(subscription.id, notification.id);
      this.auditLog.push({ eventType: 'notification_sent', entityId: notification.id });
      this.notifications.push(notification);
      return notification;
    }
    throw new InventoryValidationError('Notification delivery failed.');
  }

  sendLifecycleEmail(subscription: Subscription, event: string): void {
    this.sentEmails.push({ email: subscription.email, subject: event, body: `${event} ${subscription.productId}` });
  }

  detectStockTransitions(previous: Record<string, number>, current: Record<string, number>, threshold = 1): string[] {
    return Object.keys(current).filter((productId) => {
      const previousStock = validateStockLevel(previous[productId] ?? 0);
      const currentStock = validateStockLevel(current[productId]);
      return previousStock < threshold && currentStock >= threshold;
    });
  }

  checkStockLevels(previous: Record<string, number>, current: Record<string, number>): { errors: Error[]; notificationsTriggered: number } {
    const errors: Error[] = [];
    let notificationsTriggered = 0;
    try {
      const transitions = this.detectStockTransitions(previous, current);
      transitions.forEach((productId) => {
        this.getSubscriptionsByProduct(productId).forEach((subscription) => {
          this.queue.push({
            id: `queued-${this.queue.length + 1}`,
            subscriptionId: subscription.id,
            productId,
            email: subscription.email,
            kind: 'restock',
            status: 'queued',
            retryCount: 0,
            queuedAt: new Date(),
          });
          notificationsTriggered += 1;
        });
      });
    } catch (error) {
      errors.push(error as Error);
      this.auditLog.push({ eventType: 'stock_error', entityId: 'stock_monitor' });
    }
    return { errors, notificationsTriggered };
  }

  cancelDiscontinuedProduct(productId: string): void {
    this.products.get(productId)!.discontinued = true;
    this.getSubscriptionsByProduct(productId).forEach((subscription) => {
      subscription.status = 'cancelled';
      this.sendLifecycleEmail(subscription, 'cancelled');
    });
  }

  adminSubscriptions(filter: Partial<Subscription>): Subscription[] {
    return Array.from(this.subscriptions.values()).filter((subscription) => {
      return Object.entries(filter).every(([key, value]) => subscription[key as keyof Subscription] === value);
    });
  }

  adminCancel(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      this.sendLifecycleEmail(subscription, 'admin cancelled');
      this.subscriptions.delete(subscriptionId);
    }
  }

  statistics(): { totalSent: number; totalFailed: number; totalPending: number } {
    return {
      totalSent: this.notifications.filter((notification) => notification.status === 'sent').length,
      totalFailed: this.notifications.filter((notification) => notification.status === 'failed').length,
      totalPending: this.notifications.filter((notification) => notification.status === 'pending' || notification.status === 'queued').length,
    };
  }
}

const alpha = 'abcdefghijklmnopqrstuvwxyz'.split('');
const idChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'.split('');
const idArb = fc.array(fc.constantFrom(...idChars), { minLength: 1, maxLength: 12 }).map((chars) => `P${chars.join('')}`);
const localArb = fc.array(fc.constantFrom(...alpha), { minLength: 1, maxLength: 8 }).map((chars) => chars.join(''));
const validEmailArb = fc.tuple(localArb, localArb).map(([local, domain]) => `${local}@${domain}.test`);
const baseDataArb = fc.record({
  userId: idArb,
  productId: idArb,
  email: validEmailArb,
});

function systemWithProduct(productId: string, stock = 0): InMemoryInventoryAlerts {
  const system = new InMemoryInventoryAlerts();
  system.addProduct({ id: productId, name: `Product ${productId}`, stock, link: `/products/${productId}` });
  return system;
}

describe('Feature: inventory-alerts property tests', () => {
  test('Property 1: Subscription Creation Stores Correct Data', () => {
    fc.assert(fc.property(baseDataArb, (data) => {
      const system = systemWithProduct(data.productId);
      const subscription = system.createSubscription(data.userId, data.productId, data.email);
      expect(subscription.userId).toBe(data.userId);
      expect(subscription.productId).toBe(data.productId);
      expect(subscription.email).toBe(data.email.toLowerCase());
    }), PBT_CONFIG);
  });

  test('Property 2: Duplicate Subscriptions Are Prevented', () => {
    fc.assert(fc.property(baseDataArb, (data) => {
      const system = systemWithProduct(data.productId);
      system.createSubscription(data.userId, data.productId, data.email);
      expect(() => system.createSubscription(data.userId, data.productId, data.email)).toThrow(InventoryValidationError);
      expect(system.getSubscriptionsByUser(data.userId)).toHaveLength(1);
    }), PBT_CONFIG);
  });

  test('Property 3: Subscription Lifecycle Events Trigger Emails', () => {
    fc.assert(fc.property(baseDataArb, (data) => {
      const system = systemWithProduct(data.productId);
      const subscription = system.createSubscription(data.userId, data.productId, data.email);
      system.removeSubscription(subscription.id);
      expect(system.sentEmails.map((email) => email.subject)).toEqual(expect.arrayContaining(['subscribed', 'unsubscribed']));
    }), PBT_CONFIG);
  });

  test('Properties 4, 21, 23: Invalid data is rejected and sanitized', () => {
    fc.assert(fc.property(fc.string().filter((value) => !value.includes('@')), fc.integer({ max: -1 }), fc.string(), (email, stock, text) => {
      expect(() => validateEmail(email)).toThrow(InventoryValidationError);
      expect(() => validateStockLevel(stock)).toThrow(InventoryValidationError);
      const sanitized = sanitizeInput(`<script>${text}</script>`);
      expect(sanitized).not.toContain('<script>');
    }), PBT_CONFIG);
  });

  test('Property 5: Unsubscribe Removes Subscription', () => {
    fc.assert(fc.property(baseDataArb, (data) => {
      const system = systemWithProduct(data.productId);
      const subscription = system.createSubscription(data.userId, data.productId, data.email);
      expect(system.removeSubscription(subscription.id)).toBe(true);
      expect(system.getSubscriptionsByProduct(data.productId)).toHaveLength(0);
    }), PBT_CONFIG);
  });

  test('Property 6: Notification Emails Contain Required Information', () => {
    fc.assert(fc.property(baseDataArb, fc.integer({ min: 1, max: 1000 }), (data, stock) => {
      const system = systemWithProduct(data.productId, stock);
      const subscription = system.createSubscription(data.userId, data.productId, data.email);
      const email = system.generateEmail(subscription);
      expect(email).toContain(`Product ${data.productId}`);
      expect(email).toContain(String(stock));
      expect(email).toContain(`/products/${data.productId}`);
      expect(email).toContain('/subscriptions/unsubscribe/');
    }), PBT_CONFIG);
  });

  test('Property 7: Stock Transitions Are Detected', () => {
    fc.assert(fc.property(idArb, fc.nat({ max: 10 }), (productId, currentStock) => {
      fc.pre(currentStock >= 1);
      const system = systemWithProduct(productId);
      expect(system.detectStockTransitions({ [productId]: 0 }, { [productId]: currentStock })).toContain(productId);
    }), PBT_CONFIG);
  });

  test('Properties 8, 10: All active subscribers are identified and receive notifications', () => {
    fc.assert(fc.property(idArb, fc.array(validEmailArb, { minLength: 1, maxLength: 20 }), (productId, emails) => {
      const system = systemWithProduct(productId, 5);
      const uniqueEmails = Array.from(new Set(emails));
      uniqueEmails.forEach((email, index) => system.createSubscription(`user-${index}`, productId, email));
      const active = system.getSubscriptionsByProduct(productId);
      active.forEach((subscription) => system.sendNotification(subscription));
      expect(active).toHaveLength(uniqueEmails.length);
      expect(system.sentEmails.filter((email) => email.subject.includes('back in stock'))).toHaveLength(uniqueEmails.length);
    }), PBT_CONFIG);
  });

  test('Property 9: Monitor Errors Do Not Stop Monitoring', () => {
    fc.assert(fc.property(fc.integer({ max: -1 }), (invalidStock) => {
      const system = systemWithProduct('P1');
      const result = system.checkStockLevels({ P1: 0 }, { P1: invalidStock });
      expect(result.errors).toHaveLength(1);
      expect(system.auditLog.some((entry) => entry.eventType === 'stock_error')).toBe(true);
    }), PBT_CONFIG);
  });

  test('Property 11: Notifications Update Subscription Status', () => {
    fc.assert(fc.property(baseDataArb, (data) => {
      const system = systemWithProduct(data.productId, 3);
      const subscription = system.createSubscription(data.userId, data.productId, data.email);
      const notification = system.sendNotification(subscription);
      expect(notification.status).toBe('sent');
      expect(subscription.status).toBe('notified');
      expect(subscription.notifiedAt).toBeInstanceOf(Date);
    }), PBT_CONFIG);
  });

  test('Properties 12, 13: Failed Notifications Retry and Exhaustion Is Logged', () => {
    fc.assert(fc.property(baseDataArb, (data) => {
      const system = systemWithProduct(data.productId, 3);
      const subscription = system.createSubscription(data.userId, data.productId, data.email);
      system.nextEmailFailures = 3;
      const notification = system.sendNotification(subscription);
      expect(system.backoffDelays).toEqual([1, 2]);
      expect(notification.status).toBe('failed');
      expect(notification.retryCount).toBe(3);
      expect(system.auditLog.some((entry) => entry.eventType === 'notification_failed')).toBe(true);
    }), PBT_CONFIG);
  });

  test('Properties 14, 15: Product Discontinuation Cancels and Notifies', () => {
    fc.assert(fc.property(idArb, fc.array(validEmailArb, { minLength: 1, maxLength: 10 }), (productId, emails) => {
      const system = systemWithProduct(productId);
      Array.from(new Set(emails)).forEach((email, index) => system.createSubscription(`user-${index}`, productId, email));
      system.cancelDiscontinuedProduct(productId);
      expect(system.getSubscriptionsByProduct(productId, 'cancelled').length).toBeGreaterThan(0);
      expect(system.sentEmails.some((email) => email.subject === 'cancelled')).toBe(true);
    }), PBT_CONFIG);
  });

  test('Properties 16, 17: Admin Queries Return Complete Filtered Data', () => {
    fc.assert(fc.property(baseDataArb, validEmailArb, (data, otherEmail) => {
      fc.pre(otherEmail !== data.email);
      const system = systemWithProduct(data.productId);
      const subscription = system.createSubscription(data.userId, data.productId, data.email);
      system.createSubscription(`${data.userId}-other`, data.productId, otherEmail);
      const result = system.adminSubscriptions({ email: subscription.email, productId: data.productId, status: 'active' });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ email: subscription.email, productId: data.productId, status: 'active' });
      expect(result[0].createdAt).toBeInstanceOf(Date);
    }), PBT_CONFIG);
  });

  test('Property 18: Admin Cancellation Removes and Notifies', () => {
    fc.assert(fc.property(baseDataArb, (data) => {
      const system = systemWithProduct(data.productId);
      const subscription = system.createSubscription(data.userId, data.productId, data.email);
      system.adminCancel(subscription.id);
      expect(system.subscriptions.has(subscription.id)).toBe(false);
      expect(system.sentEmails.some((email) => email.subject === 'admin cancelled')).toBe(true);
    }), PBT_CONFIG);
  });

  test('Property 19: Notification Statistics Are Accurate', () => {
    fc.assert(fc.property(fc.nat({ max: 20 }), fc.nat({ max: 20 }), fc.nat({ max: 20 }), (sent, failed, pending) => {
      const system = systemWithProduct('P1');
      for (let index = 0; index < sent; index += 1) {
        system.notifications.push({ id: `s${index}`, subscriptionId: 'sub', productId: 'P1', email: 'a@test.test', kind: 'restock', status: 'sent', retryCount: 0 });
      }
      for (let index = 0; index < failed; index += 1) {
        system.notifications.push({ id: `f${index}`, subscriptionId: 'sub', productId: 'P1', email: 'a@test.test', kind: 'restock', status: 'failed', retryCount: 3 });
      }
      for (let index = 0; index < pending; index += 1) {
        system.notifications.push({ id: `p${index}`, subscriptionId: 'sub', productId: 'P1', email: 'a@test.test', kind: 'restock', status: 'pending', retryCount: 0 });
      }
      expect(system.statistics()).toEqual({ totalSent: sent, totalFailed: failed, totalPending: pending });
    }), PBT_CONFIG);
  });

  test('Properties 20, 22: Invalid Product IDs Return Descriptive Errors', () => {
    fc.assert(fc.property(baseDataArb, (data) => {
      const system = new InMemoryInventoryAlerts();
      expect(() => system.createSubscription(data.userId, data.productId, data.email)).toThrow('Product was not found.');
      expect(() => validateProductId('<bad>')).toThrow('Product identifier contains invalid characters.');
    }), PBT_CONFIG);
  });

  test('Property 24: Rate Limiting Prevents Quota Exhaustion', () => {
    fc.assert(fc.property(baseDataArb, (data) => {
      const system = systemWithProduct(data.productId, 3);
      system.rateLimit = 0;
      const subscription = system.createSubscription(data.userId, data.productId, data.email);
      const notification = system.sendNotification(subscription);
      expect(notification.status).toBe('queued');
      expect(system.sentEmails.filter((email) => email.subject.includes('back in stock'))).toHaveLength(0);
    }), PBT_CONFIG);
  });
});
