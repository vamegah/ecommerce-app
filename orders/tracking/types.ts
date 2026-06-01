/**
 * Core type definitions for the Order Tracking System
 */

/**
 * Enum representing all valid order statuses
 */
export enum StatusType {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURNED = 'returned'
}

/**
 * Interface representing the current status of an order
 */
export interface OrderStatus {
  orderId: string;
  currentStatus: StatusType;
  lastUpdated: Date;
  estimatedDelivery?: Date;
  trackingNumber?: string;
}

/**
 * Interface representing a single entry in the status history
 */
export interface StatusHistoryEntry {
  id: string;
  orderId: string;
  previousStatus: StatusType | null;
  newStatus: StatusType;
  timestamp: Date;
  updatedBy: string;  // 'system' or admin ID
  notes?: string;
}

/**
 * Interface representing an item in an order
 */
export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

/**
 * Interface representing a delivery address
 */
export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Interface representing complete order details
 */
export interface OrderDetails {
  orderId: string;
  customerId: string;
  customerEmail: string;
  items: OrderItem[];
  deliveryAddress: Address;
  currentStatus: StatusType;
  statusHistory: StatusHistoryEntry[];
  createdAt: Date;
  lastUpdated?: Date;
  estimatedDelivery?: Date;
  trackingNumber?: string;
}

/**
 * Interface representing a status update event published to the message queue
 */
export interface StatusUpdateEvent {
  orderId: string;
  statusUpdate: StatusHistoryEntry;
  customerEmail: string;
  orderDetails: {
    items: OrderItem[];
    deliveryAddress: Address;
  };
}

/**
 * Interface representing a status update request
 */
export interface StatusUpdate {
  orderId: string;
  newStatus: StatusType;
  adminId: string;
  notes?: string;
  timestamp: Date;
}

export interface AdminContext {
  adminId: string;
  isAdmin: boolean;
  isPrivileged?: boolean;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: Date;
  };
}

export interface ApiResponse<T> {
  statusCode: number;
  body: T | ErrorResponse;
}

export interface MessageQueue {
  publish(event: StatusUpdateEvent): Promise<void>;
  subscribe(handler: (event: StatusUpdateEvent) => void | Promise<void>): void;
}
