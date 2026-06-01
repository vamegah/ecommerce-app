/**
 * WebSocket Server
 * Manages real-time connections and pushes updates to clients.
 */

import { MessageQueue, StatusHistoryEntry, StatusUpdate, StatusUpdateEvent } from '../types';

export interface ClientMessage {
  orderId: string;
  update: StatusUpdate;
}

interface ClientConnection {
  id: string;
  connected: boolean;
  subscribedOrders: Set<string>;
  received: ClientMessage[];
  missed: ClientMessage[];
  reconnectAttempts: number;
}

export class WebSocketServer {
  private readonly clients = new Map<string, ClientConnection>();
  private readonly orderSubscribers = new Map<string, Set<string>>();

  constructor(messageQueue?: MessageQueue) {
    if (messageQueue) {
      messageQueue.subscribe((event) => this.handleStatusUpdateEvent(event));
    }
  }

  /**
   * Register client connection for order
   */
  subscribe(orderId: string, connectionId: string): void {
    const client = this.ensureClient(connectionId);
    client.subscribedOrders.add(orderId);
    const subscribers = this.orderSubscribers.get(orderId) ?? new Set<string>();
    subscribers.add(connectionId);
    this.orderSubscribers.set(orderId, subscribers);
  }

  /**
   * Remove client connection
   */
  unsubscribe(connectionId: string): void {
    const client = this.clients.get(connectionId);
    if (!client) {
      return;
    }
    for (const orderId of client.subscribedOrders) {
      this.orderSubscribers.get(orderId)?.delete(connectionId);
    }
    this.clients.delete(connectionId);
  }

  /**
   * Push update to all subscribers of an order
   */
  pushUpdate(orderId: string, update: StatusUpdate): void {
    const subscribers = this.orderSubscribers.get(orderId) ?? new Set<string>();
    for (const connectionId of subscribers) {
      const client = this.clients.get(connectionId);
      if (!client) {
        continue;
      }
      const message = { orderId, update };
      if (client.connected) {
        client.received.push(message);
      } else {
        client.missed.push(message);
      }
    }
  }

  /**
   * Handle connection lifecycle
   */
  onConnect(connectionId: string): void {
    const client = this.ensureClient(connectionId);
    client.connected = true;
  }

  onDisconnect(connectionId: string): void {
    const client = this.ensureClient(connectionId);
    client.connected = false;
    client.reconnectAttempts += 1;
  }

  onReconnect(connectionId: string): void {
    const client = this.ensureClient(connectionId);
    client.connected = true;
    client.received.push(...client.missed);
    client.missed = [];
  }

  shouldAttemptReconnect(connectionId: string): boolean {
    const client = this.ensureClient(connectionId);
    return !client.connected && client.reconnectAttempts <= 10;
  }

  getReceivedMessages(connectionId: string): ClientMessage[] {
    return [...(this.clients.get(connectionId)?.received ?? [])];
  }

  getMissedMessages(connectionId: string): ClientMessage[] {
    return [...(this.clients.get(connectionId)?.missed ?? [])];
  }

  getSubscribers(orderId: string): string[] {
    return Array.from(this.orderSubscribers.get(orderId) ?? []);
  }

  handleStatusUpdateEvent(event: StatusUpdateEvent): void {
    this.pushUpdate(event.orderId, this.toStatusUpdate(event.statusUpdate));
  }

  private ensureClient(connectionId: string): ClientConnection {
    let client = this.clients.get(connectionId);
    if (!client) {
      client = {
        id: connectionId,
        connected: true,
        subscribedOrders: new Set<string>(),
        received: [],
        missed: [],
        reconnectAttempts: 0,
      };
      this.clients.set(connectionId, client);
    }
    return client;
  }

  private toStatusUpdate(entry: StatusHistoryEntry): StatusUpdate {
    return {
      orderId: entry.orderId,
      newStatus: entry.newStatus,
      adminId: entry.updatedBy,
      notes: entry.notes,
      timestamp: entry.timestamp,
    };
  }
}
