/**
 * Notification Service
 * Handles email notifications for status changes.
 */

import { MessageQueue, StatusHistoryEntry, StatusUpdate, StatusUpdateEvent } from '../types';

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export interface NotificationFailure {
  notificationId: string;
  orderId: string;
  customerEmail: string;
  error: string;
  retryCount: number;
  retrySchedule: number[];
  statusUpdate: StatusUpdate;
}

export class InMemoryEmailProvider implements EmailProvider {
  public sent: EmailMessage[] = [];
  public failNext = false;

  async send(message: EmailMessage): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('Email delivery failed');
    }
    this.sent.push(message);
  }
}

export class NotificationService {
  readonly retryPolicySeconds = [60, 300, 900, 3600, 21600];
  readonly failures: NotificationFailure[] = [];
  readonly batchedEmails: EmailMessage[] = [];
  private readonly pendingBatches = new Map<string, StatusUpdate[]>();

  constructor(
    private readonly emailProvider: EmailProvider = new InMemoryEmailProvider(),
    messageQueue?: MessageQueue,
    private readonly batchingWindowMs = 120000
  ) {
    if (messageQueue) {
      messageQueue.subscribe((event) => this.handleStatusUpdateEvent(event));
    }
  }

  async handleStatusUpdateEvent(event: StatusUpdateEvent): Promise<void> {
    await this.sendStatusChangeEmail(event.orderId, event.customerEmail, this.toStatusUpdate(event.statusUpdate));
  }

  /**
   * Send email notification for status change
   */
  async sendStatusChangeEmail(
    orderId: string,
    customerEmail: string,
    statusUpdate: StatusUpdate
  ): Promise<void> {
    const message = this.createEmail(orderId, customerEmail, [statusUpdate]);
    try {
      await this.emailProvider.send(message);
    } catch (error) {
      this.logFailure(orderId, customerEmail, statusUpdate, error);
    }
  }

  /**
   * Batch notifications within time window
   */
  async batchNotifications(
    orderId: string,
    updates: StatusUpdate[],
    customerEmail = 'customer@example.test'
  ): Promise<void> {
    const existing = this.pendingBatches.get(orderId) ?? [];
    const merged = [...existing, ...updates].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
    this.pendingBatches.set(orderId, merged);
    const message = this.createEmail(orderId, customerEmail, merged);
    await this.emailProvider.send(message);
    this.batchedEmails.push(message);
    this.pendingBatches.delete(orderId);
  }

  /**
   * Retry failed notifications
   */
  async retryFailedNotification(
    notificationId: string
  ): Promise<void> {
    const failure = this.failures.find((entry) => entry.notificationId === notificationId);
    if (!failure) {
      throw new Error(`Notification ${notificationId} was not found`);
    }
    failure.retryCount += 1;
    await this.emailProvider.send(this.createEmail(failure.orderId, failure.customerEmail, [failure.statusUpdate]));
  }

  getSentEmails(): EmailMessage[] {
    const provider = this.emailProvider as InMemoryEmailProvider;
    return provider.sent ?? [];
  }

  getPendingBatch(orderId: string): StatusUpdate[] {
    return [...(this.pendingBatches.get(orderId) ?? [])];
  }

  private createEmail(orderId: string, customerEmail: string, updates: StatusUpdate[]): EmailMessage {
    const latest = updates[updates.length - 1];
    const body = updates
      .map((update) => {
        const notes = update.notes ? ` Notes: ${update.notes}` : '';
        return `Order ${orderId} changed to ${update.newStatus} at ${update.timestamp.toISOString()}.${notes}`;
      })
      .join('\n');
    return {
      to: customerEmail,
      subject: updates.length > 1 ? `Order ${orderId} status updates` : `Order ${orderId} is now ${latest.newStatus}`,
      body,
    };
  }

  private logFailure(orderId: string, customerEmail: string, statusUpdate: StatusUpdate, error: unknown): void {
    this.failures.push({
      notificationId: `notification-${this.failures.length + 1}`,
      orderId,
      customerEmail,
      error: error instanceof Error ? error.message : String(error),
      retryCount: 0,
      retrySchedule: [...this.retryPolicySeconds],
      statusUpdate,
    });
    console.error('Email notification failed', { orderId, customerEmail, error });
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
