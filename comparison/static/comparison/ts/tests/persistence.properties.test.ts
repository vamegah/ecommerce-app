import { describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';
import { ComparisonManager } from '../managers/ComparisonManager';
import {
  LocalStoragePersistence,
  MemoryStorage,
  selectPersistenceStrategy,
  serializeComparison,
  ServerPersistence
} from '../persistence/PersistenceStrategy';
import { ComparisonError, ComparisonErrorCode } from '../types';
import { comparisonArbitrary, normalizeComparison, productArbitrary } from './generators';

function response(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => payload
  } as Response;
}

describe('Persistence layer properties', () => {
  it('Feature: product-comparison, Property 15: Comparison State Round-Trips Through Persistence', async () => {
    await fc.assert(fc.asyncProperty(comparisonArbitrary, async (comparison) => {
      const persistence = new LocalStoragePersistence(new MemoryStorage());

      await persistence.save(comparison);
      const loaded = await persistence.load();

      expect(normalizeComparison(loaded!)).toEqual(normalizeComparison(comparison));
    }), { numRuns: 100 });
  });

  it('Feature: product-comparison, Property 16: Correct Persistence Strategy is Selected', () => {
    fc.assert(fc.property(fc.boolean(), (isAuthenticated) => {
      const strategy = selectPersistenceStrategy(isAuthenticated, {
        storage: new MemoryStorage(),
        fetcher: vi.fn()
      });

      expect(strategy).toBeInstanceOf(isAuthenticated ? ServerPersistence : LocalStoragePersistence);
    }), { numRuns: 100 });
  });

  it('Feature: product-comparison, Property 5: Modifications Persist Correctly', async () => {
    await fc.assert(fc.asyncProperty(
      comparisonArbitrary.filter((comparison) => comparison.products.length < 4),
      productArbitrary,
      async (comparison, product) => {
        fc.pre(!comparison.products.some((existing) => existing.id === product.id));
        const persistence = new LocalStoragePersistence(new MemoryStorage());
        await persistence.save(comparison);
        const manager = new ComparisonManager(comparison, { persistence });

        const result = await manager.addProduct(product);
        const loaded = await persistence.load();

        expect(result.success).toBe(true);
        expect(normalizeComparison(loaded!)).toEqual(normalizeComparison(result.comparison));
      }
    ), { numRuns: 100 });
  });

  it('retries server persistence failures and then succeeds', async () => {
    const comparison = fc.sample(comparisonArbitrary, 1)[0];
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(response({ ok: true }));
    const persistence = new ServerPersistence({ fetcher, retryDelayMs: 1 });

    await persistence.save(comparison);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('surfaces local storage quota errors as recoverable persistence errors', async () => {
    const comparison = fc.sample(comparisonArbitrary, 1)[0];
    const storage = {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
    };
    const persistence = new LocalStoragePersistence(storage);

    await expect(persistence.save(comparison)).rejects.toMatchObject({
      code: ComparisonErrorCode.PERSISTENCE_FAILED,
      recoverable: true
    });
  });

  it('loads serialized server comparisons and maps shared save responses', async () => {
    const comparison = fc.sample(comparisonArbitrary, 1)[0];
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ comparison: serializeComparison(comparison) }))
      .mockResolvedValueOnce(response({ shareId: 'abc123' }));
    const persistence = new ServerPersistence({ fetcher });

    await expect(persistence.load()).resolves.toMatchObject({ id: comparison.id });
    await expect(persistence.saveShared(comparison)).resolves.toBe('abc123');
  });

  it('keeps manager state in memory when persistence fails', async () => {
    const persistence = {
      save: async () => {
        throw new ComparisonError(ComparisonErrorCode.PERSISTENCE_FAILED, 'No disk', true);
      },
      load: async () => null,
      saveShared: async () => 'share',
      loadShared: async () => null
    };
    const manager = new ComparisonManager(undefined, { persistence });
    const product = fc.sample(productArbitrary, 1)[0];

    const result = await manager.addProduct(product);

    expect(result.success).toBe(true);
    expect(result.error?.code).toBe(ComparisonErrorCode.PERSISTENCE_FAILED);
    expect(manager.getComparison().products).toHaveLength(1);
  });
});
