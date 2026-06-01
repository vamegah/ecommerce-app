import QueryBuilder from '../QueryBuilder';
import { applyFiltersToProducts } from '../filterUtils';
import { Product } from '../types';

describe('Filter performance checks', () => {
    test('filters 100,000 in-memory products within the 500ms target', () => {
        const products: Product[] = Array.from({ length: 100000 }, (_, index) => ({
            id: index,
            name: `Product ${index}`,
            price: index % 1000,
            rating: index % 7 === 0 ? null : (index % 5) + 1,
            inventoryCount: index % 3
        }));
        const startedAt = performance.now();

        const filtered = applyFiltersToProducts(products, {
            priceRange: { min: 100, max: 700 },
            minRating: 4,
            availability: { inStock: true, outOfStock: false }
        });
        const elapsed = performance.now() - startedAt;

        expect(filtered.every((product) => product.price >= 100 && product.price <= 700)).toBe(true);
        expect(elapsed).toBeLessThan(500);
    });

    test('cache keys are effective for repeated common filter combinations', () => {
        const builder = new QueryBuilder();
        const state = {
            priceRange: { min: 100, max: 500 },
            minRating: 4,
            availability: { inStock: true, outOfStock: false }
        };

        expect(builder.getCacheKey(state)).toBe(builder.getCacheKey(state));
        expect(builder.buildQuery(state).useCache).toBe(true);
    });
});
