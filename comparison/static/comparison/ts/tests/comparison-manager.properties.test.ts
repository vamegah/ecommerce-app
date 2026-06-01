import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { ComparisonManager } from '../managers/ComparisonManager';
import { MemoryStorage, LocalStoragePersistence } from '../persistence/PersistenceStrategy';
import { ComparisonErrorCode } from '../types';
import { comparisonArbitrary, productArbitrary } from './generators';

describe('ComparisonManager properties and edge cases', () => {
  it('Feature: product-comparison, Property 1: Product Addition Increases Comparison Size', async () => {
    await fc.assert(fc.asyncProperty(
      comparisonArbitrary.filter((comparison) => comparison.products.length < 4),
      productArbitrary,
      async (comparison, product) => {
        fc.pre(!comparison.products.some((existing) => existing.id === product.id));
        const manager = new ComparisonManager(comparison);

        const result = await manager.addProduct(product);

        expect(result.success).toBe(true);
        expect(result.comparison.products).toHaveLength(comparison.products.length + 1);
        expect(result.comparison.products.at(-1)).toMatchObject({ id: product.id });
      }
    ), { numRuns: 100 });
  });

  it('Feature: product-comparison, Property 3: Adding Duplicate Products is Idempotent', async () => {
    await fc.assert(fc.asyncProperty(
      comparisonArbitrary.filter((comparison) => comparison.products.length > 0),
      async (comparison) => {
        const manager = new ComparisonManager(comparison);
        const before = manager.getComparison();

        const result = await manager.addProduct(before.products[0]);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(ComparisonErrorCode.DUPLICATE_PRODUCT);
        expect(result.comparison.products.map((product) => product.id)).toEqual(before.products.map((product) => product.id));
      }
    ), { numRuns: 100 });
  });

  it('Feature: product-comparison, Property 4: Adding at Limit Fails Gracefully', async () => {
    await fc.assert(fc.asyncProperty(
      comparisonArbitrary.filter((comparison) => comparison.products.length === 4),
      productArbitrary,
      async (comparison, product) => {
        fc.pre(!comparison.products.some((existing) => existing.id === product.id));
        const manager = new ComparisonManager(comparison);

        const result = await manager.addProduct(product);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(ComparisonErrorCode.LIMIT_REACHED);
        expect(result.comparison.products.map((existing) => existing.id)).toEqual(comparison.products.map((existing) => existing.id));
      }
    ), { numRuns: 100 });
  });

  it('Feature: product-comparison, Property 18: Comparison Size Never Exceeds Limit', async () => {
    await fc.assert(fc.asyncProperty(
      fc.uniqueArray(productArbitrary, { minLength: 4, maxLength: 12, selector: (product) => product.id }),
      async (products) => {
        const manager = new ComparisonManager();

        for (const product of products) {
          await manager.addProduct(product);
          expect(manager.getComparison().products.length).toBeLessThanOrEqual(4);
        }
      }
    ), { numRuns: 100 });
  });

  it('Feature: product-comparison, Property 6: Product Removal Decreases Comparison Size', async () => {
    await fc.assert(fc.asyncProperty(
      comparisonArbitrary.filter((comparison) => comparison.products.length > 0),
      async (comparison) => {
        const manager = new ComparisonManager(comparison);
        const productToRemove = comparison.products[Math.floor(comparison.products.length / 2)];

        const result = await manager.removeProduct(productToRemove.id);

        expect(result.success).toBe(true);
        expect(result.comparison.products).toHaveLength(comparison.products.length - 1);
        expect(result.comparison.products.some((product) => product.id === productToRemove.id)).toBe(false);
      }
    ), { numRuns: 100 });
  });

  it('Feature: product-comparison, Property 7: Removal Preserves Order of Remaining Products', async () => {
    await fc.assert(fc.asyncProperty(
      comparisonArbitrary.filter((comparison) => comparison.products.length > 1),
      fc.nat(3),
      async (comparison, index) => {
        const manager = new ComparisonManager(comparison);
        const removeIndex = index % comparison.products.length;
        const productToRemove = comparison.products[removeIndex];
        const expectedOrder = comparison.products
          .filter((product) => product.id !== productToRemove.id)
          .map((product) => product.id);

        const result = await manager.removeProduct(productToRemove.id);

        expect(result.comparison.products.map((product) => product.id)).toEqual(expectedOrder);
      }
    ), { numRuns: 100 });
  });

  it('handles empty, single-product, clear, and last-product removal edge cases', async () => {
    const manager = new ComparisonManager();
    expect(manager.getComparison().products).toEqual([]);

    const product = fc.sample(productArbitrary, 1)[0];
    await manager.addProduct(product);
    expect(manager.getComparison().products).toHaveLength(1);

    const result = await manager.removeProduct(product.id);
    expect(result.comparison.products).toHaveLength(0);

    await manager.addProduct(product);
    await manager.clearComparison();
    expect(manager.getComparison().products).toHaveLength(0);
  });

  it('persists successful add and remove operations', async () => {
    const storage = new MemoryStorage();
    const persistence = new LocalStoragePersistence(storage);
    const manager = new ComparisonManager(undefined, { persistence });
    const product = fc.sample(productArbitrary, 1)[0];

    await manager.addProduct(product);
    expect((await persistence.load())?.products).toHaveLength(1);

    await manager.removeProduct(product.id);
    expect((await persistence.load())?.products).toHaveLength(0);
  });
});
