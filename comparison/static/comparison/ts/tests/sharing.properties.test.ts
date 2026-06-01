import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { ComparisonManager } from '../managers/ComparisonManager';
import { LocalStoragePersistence, MemoryStorage } from '../persistence/PersistenceStrategy';
import { ComparisonErrorCode } from '../types';
import { comparisonArbitrary, normalizeComparison } from './generators';

describe('Sharing functionality', () => {
  it('Feature: product-comparison, Property 20: Share URLs Are Unique', async () => {
    await fc.assert(fc.asyncProperty(
      comparisonArbitrary,
      comparisonArbitrary,
      async (leftComparison, rightComparison) => {
        fc.pre(leftComparison.id !== rightComparison.id);
        const persistence = new LocalStoragePersistence(new MemoryStorage());
        const left = new ComparisonManager(leftComparison, { persistence, baseShareUrl: '/compare/shared' });
        const right = new ComparisonManager(rightComparison, { persistence, baseShareUrl: '/compare/shared' });

        const leftUrl = await left.generateShareableUrl();
        const rightUrl = await right.generateShareableUrl();

        expect(leftUrl).not.toBe(rightUrl);
      }
    ), { numRuns: 100 });
  });

  it('Feature: product-comparison, Property 21: Shared Comparisons Round-Trip Correctly', async () => {
    await fc.assert(fc.asyncProperty(comparisonArbitrary, async (comparison) => {
      const persistence = new LocalStoragePersistence(new MemoryStorage());
      const manager = new ComparisonManager(comparison, { persistence, baseShareUrl: '/comparison/shared' });
      const url = await manager.generateShareableUrl();
      const shareId = url.split('/').filter(Boolean).at(-1)!;

      const loader = new ComparisonManager(undefined, { persistence });
      const loaded = await loader.loadSharedComparison(shareId);

      expect(normalizeComparison(loaded)).toEqual(normalizeComparison(comparison));
    }), { numRuns: 100 });
  });

  it('handles expired, invalid, and empty shared comparisons', async () => {
    const storage = new MemoryStorage();
    const now = new Date('2026-05-26T12:00:00Z');
    const persistence = new LocalStoragePersistence(storage, () => now);
    const emptyComparison = { ...fc.sample(comparisonArbitrary, 1)[0], products: [] };
    const manager = new ComparisonManager(emptyComparison, { persistence });

    const url = await manager.generateShareableUrl();
    const shareId = url.split('/').filter(Boolean).at(-1)!;
    await expect(manager.loadSharedComparison(shareId)).resolves.toMatchObject({ products: [] });

    await expect(manager.loadSharedComparison('not-a-real-share')).rejects.toMatchObject({
      code: ComparisonErrorCode.INVALID_SHARE_ID
    });

    const expiredPersistence = new LocalStoragePersistence(storage, () => new Date('2026-06-26T12:00:01Z'));
    const expiredLoader = new ComparisonManager(undefined, { persistence: expiredPersistence });
    await expect(expiredLoader.loadSharedComparison(shareId)).rejects.toMatchObject({
      code: ComparisonErrorCode.SHARE_EXPIRED
    });
  });
});
