/**
 * Order Tracking Service
 * Core service responsible for managing order status and history.
 */

import { randomUUID } from 'crypto';
import {
  MessageQueue,
  OrderDetails,
  OrderStatus,
  StatusHistoryEntry,
  StatusType,
  StatusUpdate,
  StatusUpdateEvent,
} from '../types';
import { InvalidTransitionError, OrderNotFoundError } from '../errors';
import { InMemoryMessageQueue } from './InMemoryMessageQueue';
import { ValidationService } from './ValidationService';

type StoredOrder = OrderDetails & {
  lastUpdated: Date;
  estimatedDelivery?: Date;
  trackingNumber?: string;
};

export class InMemoryOrderStore {
  private readonly orders = new Map<string, StoredOrder>();

  saveOrder(order: OrderDetails): StoredOrder {
    const now = order.lastUpdated ?? order.createdAt ?? new Date();
    const history = [...order.statusHistory].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
    const stored: StoredOrder = {
      ...this.cloneOrder(order),
      statusHistory: history,
      lastUpdated: now,
    };
    this.orders.set(order.orderId, stored);
    return this.cloneOrder(stored) as StoredOrder;
  }

  findById(orderId: string): StoredOrder | null {
    const order = this.orders.get(orderId);
    return order ? (this.cloneOrder(order) as StoredOrder) : null;
  }

  updateOrder(order: StoredOrder): StoredOrder {
    const stored = this.cloneOrder(order) as StoredOrder;
    this.orders.set(order.orderId, stored);
    return this.cloneOrder(stored) as StoredOrder;
  }

  clear(): void {
    this.orders.clear();
  }

  private cloneOrder(order: OrderDetails | StoredOrder): OrderDetails | StoredOrder {
    return {
      ...order,
      items: order.items.map((item) => ({ ...item })),
      deliveryAddress: { ...order.deliveryAddress },
      statusHistory: order.statusHistory.map((entry) => ({ ...entry, timestamp: new Date(entry.timestamp) })),
      createdAt: new Date(order.createdAt),
      lastUpdated: order.lastUpdated ? new Date(order.lastUpdated) : undefined,
      estimatedDelivery: order.estimatedDelivery ? new Date(order.estimatedDelivery) : undefined,
    };
  }
}

export class OrderTrackingService {
  constructor(
    private readonly store: InMemoryOrderStore = new InMemoryOrderStore(),
    private readonly validationService: ValidationService = new ValidationService(),
    private readonly messageQueue: MessageQueue = new InMemoryMessageQueue()
  ) {}

  createOrder(order: OrderDetails): OrderDetails {
    const stored = this.store.saveOrder(order);
    return stored;
  }

  /**
   * Retrieve current order status
   */
  async getOrderStatus(orderId: string): Promise<OrderStatus> {
    const order = this.requireOrder(orderId);
    const latestHistory = order.statusHistory[order.statusHistory.length - 1];
    return {
      orderId: order.orderId,
      currentStatus: order.currentStatus,
      lastUpdated: latestHistory?.timestamp ?? order.lastUpdated,
      estimatedDelivery: order.estimatedDelivery,
      trackingNumber: order.trackingNumber,
    };
  }

  /**
   * Update order status (admin only)
   */
  async updateOrderStatus(
    orderId: string,
    newStatus: StatusType,
    adminId: string,
    notes?: string,
    isPrivileged = false
  ): Promise<StatusUpdate> {
    const order = this.requireOrder(orderId);
    if (!this.validateTransition(order.currentStatus, newStatus, isPrivileged)) {
      throw new InvalidTransitionError(
        order.currentStatus,
        newStatus,
        this.validationService.getAllowedTransitions(order.currentStatus, isPrivileged)
      );
    }

    const latestTimestamp = order.statusHistory.reduce(
      (latest, entry) => Math.max(latest, entry.timestamp.getTime()),
      order.lastUpdated.getTime()
    );
    const now = Date.now();
    const timestamp = new Date(Math.max(now, latestTimestamp + 1));
    const historyEntry: StatusHistoryEntry = {
      id: randomUUID(),
      orderId,
      previousStatus: order.currentStatus,
      newStatus,
      timestamp,
      updatedBy: adminId,
      notes,
    };

    const updatedOrder: StoredOrder = {
      ...order,
      currentStatus: newStatus,
      statusHistory: [...order.statusHistory, historyEntry].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime()),
      lastUpdated: timestamp,
    };
    this.store.updateOrder(updatedOrder);

    const event: StatusUpdateEvent = {
      orderId,
      statusUpdate: historyEntry,
      customerEmail: order.customerEmail,
      orderDetails: {
        items: order.items,
        deliveryAddress: order.deliveryAddress,
      },
    };
    try {
      await this.messageQueue.publish(event);
    } catch (error) {
      // Status updates are authoritative; queue failures are logged but do not roll back history.
      console.error('Failed to publish order status update event', { orderId, error });
    }

    return {
      orderId,
      newStatus,
      adminId,
      notes,
      timestamp,
    };
  }

  /**
   * Get complete status history
   */
  async getStatusHistory(orderId: string): Promise<StatusHistoryEntry[]> {
    const order = this.requireOrder(orderId);
    return [...order.statusHistory].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
  }

  async getTrackingPageData(orderId: string): Promise<OrderDetails> {
    const order = this.requireOrder(orderId);
    return {
      ...order,
      statusHistory: await this.getStatusHistory(orderId),
    };
  }

  /**
   * Validate status transition
   */
  validateTransition(
    currentStatus: StatusType,
    newStatus: StatusType,
    isPrivileged: boolean
  ): boolean {
    return this.validationService.isValidTransition(currentStatus, newStatus, isPrivileged);
  }

  getMessageQueue(): MessageQueue {
    return this.messageQueue;
  }

  getStore(): InMemoryOrderStore {
    return this.store;
  }

  private requireOrder(orderId: string): StoredOrder {
    const order = this.store.findById(orderId);
    if (!order) {
      console.warn('Order lookup failed', { orderId });
      throw new OrderNotFoundError(orderId);
    }
    return order;
  }
}
