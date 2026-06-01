import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { ComparisonManager } from '../managers/ComparisonManager';
import {
  createLimitReachedError,
  imageWithFallback,
  NotificationCenter,
  notificationFromError
} from '../notifications/errorNotifications';
import { ComparisonError, ComparisonErrorCode } from '../types';
import { comparisonArbitrary, productArbitrary } from './generators';

describe('Comparison error handling and notifications', () => {
  it('creates ComparisonError instances with code, message, details, and recoverable flag', () => {
    const error = new ComparisonError(
      ComparisonErrorCode.INVALID_SHARE_ID,
      'Invalid link',
      false,
      { shareId: 'bad' }
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(ComparisonErrorCode.INVALID_SHARE_ID);
    expect(error.recoverable).toBe(false);
    expect(error.details).toEqual({ shareId: 'bad' });
  });

  it('Feature: product-comparison, Property 19: Limit Notification Contains Required Information', () => {
    fc.assert(fc.property(fc.integer({ min: 4, max: 100 }), fc.integer({ min: 4, max: 100 }), (currentCount, maxProducts) => {
      const error = createLimitReachedError(currentCount, maxProducts);
      const notification = notificationFromError(error);

      expect(notification.message).toContain(String(currentCount));
      expect(notification.message).toContain(String(maxProducts));
      expect(notification.code).toBe(ComparisonErrorCode.LIMIT_REACHED);
    }), { numRuns: 100 });
  });

  it('records inline/toast/modal style notifications as renderable entries', () => {
    const center = new NotificationCenter();
    center.add({ level: 'success', message: 'Added', recoverable: true });
    center.addError(new ComparisonError(ComparisonErrorCode.PERSISTENCE_FAILED, 'Retry later', true));

    expect(center.all()).toHaveLength(2);
    expect(center.all()[1]).toMatchObject({ level: 'warning', code: ComparisonErrorCode.PERSISTENCE_FAILED });

    center.clear();
    expect(center.all()).toEqual([]);
  });

  it('gracefully handles duplicate product, limit reached, invalid share ID, and missing image cases', async () => {
    const comparison = fc.sample(comparisonArbitrary.filter((candidate) => candidate.products.length === 4), 1)[0];
    const manager = new ComparisonManager(comparison);
    const duplicate = await manager.addProduct(comparison.products[0]);
    expect(duplicate.error?.code).toBe(ComparisonErrorCode.DUPLICATE_PRODUCT);

    const extraProduct = fc.sample(productArbitrary.filter((product) => !comparison.products.some((existing) => existing.id === product.id)), 1)[0];
    const limit = await manager.addProduct(extraProduct);
    expect(limit.error?.code).toBe(ComparisonErrorCode.LIMIT_REACHED);

    await expect(manager.loadSharedComparison('missing')).rejects.toMatchObject({
      code: ComparisonErrorCode.PERSISTENCE_FAILED
    });

    expect(imageWithFallback('')).toBe('/static/images/items/1.jpg');
  });
});
