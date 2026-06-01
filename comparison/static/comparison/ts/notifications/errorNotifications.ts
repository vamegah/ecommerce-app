import {
  ComparisonError,
  ComparisonErrorCode,
  ComparisonNotification,
  MAX_COMPARISON_PRODUCTS
} from '../types';

export function createLimitReachedError(
  currentCount: number,
  maxProducts = MAX_COMPARISON_PRODUCTS
): ComparisonError {
  return new ComparisonError(
    ComparisonErrorCode.LIMIT_REACHED,
    `Your comparison already has ${currentCount} products. The maximum is ${maxProducts}; remove one before adding another.`,
    true,
    { currentCount, maxProducts }
  );
}

export function notificationFromError(error: ComparisonError): ComparisonNotification {
  const level = error.recoverable ? 'warning' : 'error';
  return {
    level,
    message: error.message,
    recoverable: error.recoverable,
    code: error.code
  };
}

export class NotificationCenter {
  private notifications: ComparisonNotification[] = [];

  add(notification: ComparisonNotification): void {
    this.notifications.push(notification);
  }

  addError(error: ComparisonError): void {
    this.add(notificationFromError(error));
  }

  all(): ComparisonNotification[] {
    return this.notifications.map((notification) => ({ ...notification }));
  }

  clear(): void {
    this.notifications = [];
  }
}

export function imageWithFallback(imageUrl: string | null | undefined, fallbackUrl = '/static/images/items/1.jpg'): string {
  if (!imageUrl || imageUrl.trim() === '') {
    return fallbackUrl;
  }
  return imageUrl;
}
