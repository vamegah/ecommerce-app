import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { ComparisonApp } from '../app/comparisonApp';
import { ComparisonManager } from '../managers/ComparisonManager';
import { LocalStoragePersistence, MemoryStorage } from '../persistence/PersistenceStrategy';
import { comparisonArbitrary, productArbitrary } from './generators';

describe('Product comparison integration flows', () => {
  it('runs the complete add-view-remove flow', async () => {
    const products = fc.sample(
      fc.uniqueArray(productArbitrary, { minLength: 2, maxLength: 2, selector: (product) => product.id }),
      1
    )[0];
    const app = new ComparisonApp({
      isAuthenticated: false,
      storage: new MemoryStorage()
    });

    await app.addProduct(products[0]);
    await app.addProduct(products[1]);
    expect(app.renderIndicator().productCount).toBe(2);
    expect(app.renderTable().products).toHaveLength(2);

    await app.removeProduct(products[0].id);
    expect(app.renderIndicator().productCount).toBe(1);
    expect(app.renderTable().products[0].productId).toBe(products[1].id);
  });

  it('persists comparison across app reloads', async () => {
    const storage = new MemoryStorage();
    const product = fc.sample(productArbitrary, 1)[0];
    const firstApp = new ComparisonApp({ isAuthenticated: false, storage });

    await firstApp.addProduct(product);

    const secondApp = new ComparisonApp({ isAuthenticated: false, storage });
    await secondApp.manager.loadComparison();

    expect(secondApp.manager.getComparison().products).toHaveLength(1);
    expect(secondApp.manager.getComparison().products[0].id).toBe(product.id);
  });

  it('supports anonymous to authenticated persistence strategy transition', async () => {
    const storage = new MemoryStorage();
    const product = fc.sample(productArbitrary, 1)[0];
    const anonymousPersistence = new LocalStoragePersistence(storage);
    const serverPersistence = new LocalStoragePersistence(new MemoryStorage());
    const manager = new ComparisonManager(undefined, { persistence: anonymousPersistence });

    await manager.addProduct(product);
    manager.setPersistence(serverPersistence);
    await manager.addProduct({ ...product, id: `${product.id}-server-copy` });

    expect((await serverPersistence.load())?.products).toHaveLength(2);
  });

  it('supports share and load shared comparison flow', async () => {
    const persistence = new LocalStoragePersistence(new MemoryStorage());
    const comparison = fc.sample(comparisonArbitrary, 1)[0];
    const manager = new ComparisonManager(comparison, { persistence, baseShareUrl: '/comparison/shared' });

    const shareUrl = await manager.generateShareableUrl();
    const shareId = shareUrl.split('/').filter(Boolean).at(-1)!;
    const loader = new ComparisonManager(undefined, { persistence });

    const loaded = await loader.loadSharedComparison(shareId);

    expect(loaded.products.map((product) => product.id)).toEqual(comparison.products.map((product) => product.id));
  });
});
