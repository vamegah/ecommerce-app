export type SubscriptionStatus = 'active' | 'notified' | 'completed' | 'cancelled' | 'failed' | 'archived';
export type NotificationStatus = 'pending' | 'queued' | 'sent' | 'failed';
export type NotificationKind = 'restock' | 'subscribe_confirmation' | 'unsubscribe_confirmation' | 'cancellation';

export interface Subscription {
  id: string;
  userId: string;
  productId: string;
  email: string;
  status: SubscriptionStatus;
  createdAt: Date;
  notifiedAt?: Date;
  completedAt?: Date;
  notificationId?: string;
  unsubscribeToken: string;
}

export interface NotificationRecord {
  id: string;
  subscriptionId: string;
  productId: string;
  email: string;
  kind: NotificationKind;
  status: NotificationStatus;
  sentAt?: Date;
  error?: string;
  retryCount: number;
  queuedAt?: Date;
}

export interface StockTransition {
  productId: string;
  previousStock: number;
  currentStock: number;
  timestamp: Date;
}

export interface SubscriptionFilters {
  productId?: string;
  email?: string;
  status?: SubscriptionStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface NotificationStatistics {
  totalSent: number;
  totalFailed: number;
  totalPending: number;
  averageDeliveryTime: number;
  successRate: number;
}
