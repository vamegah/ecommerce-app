import * as fc from 'fast-check';
import QueryBuilder from '../QueryBuilder';
import FilterStateManager from '../FilterStateManager';
import { applyFiltersToProducts } from '../filterUtils';
import {
    availabilityArbitrary,
    filterStateArbitrary,
    productListArbitrary,
    validPriceRangeArbitrary
} from './helpers';

describe('QueryBuilder', () => {
    test('Feature: advanced-search-filters, Property 5: In-Stock Filter Correctness', () => {
        fc.assert(fc.property(productListArbitrary, (products) => {
            const manager = new FilterStateManager();
            manager.setAvailability(true, false);

            return applyFiltersToProducts(products, manager.getState())
                .every((product) => (product.inventoryCount ?? product.stock ?? 0) > 0);
        }));
    });

    test('Feature: advanced-search-filters, Property 6: Out-of-Stock Filter Correctness', () => {
        fc.assert(fc.property(productListArbitrary, (products) => {
            const manager = new FilterStateManager();
            manager.setAvailability(false, true);

            return applyFiltersToProducts(products, manager.getState())
                .every((product) => (product.inventoryCount ?? product.stock ?? 0) === 0);
        }));
    });

    test('Feature: advanced-search-filters, Property 7: Both Availability Options Equivalent to No Filter', () => {
        fc.assert(fc.property(productListArbitrary, (products) => {
            const filteredWithBoth = applyFiltersToProducts(products, {
                priceRange: { min: null, max: null },
                minRating: null,
                availability: { inStock: true, outOfStock: true }
            });
            const filteredWithoutAvailability = applyFiltersToProducts(products, {
                priceRange: { min: null, max: null },
                minRating: null,
                availability: { inStock: false, outOfStock: false }
            });

            return filteredWithBoth.length === filteredWithoutAvailability.length;
        }));
    });

    test('Feature: advanced-search-filters, Property 8: Multiple Filters Use AND Logic', () => {
        fc.assert(fc.property(
            productListArbitrary,
            validPriceRangeArbitrary,
            fc.option(fc.integer({ min: 1, max: 5 }), { nil: null }),
            availabilityArbitrary,
            (products, priceRange, minRating, availability) => {
                const state = { priceRange, minRating, availability };
                const filtered = applyFiltersToProducts(products, state);

                return filtered.every((product) => {
                    if (priceRange.min !== null && product.price < priceRange.min) {
                        return false;
                    }
                    if (priceRange.max !== null && product.price > priceRange.max) {
                        return false;
                    }
                    if (minRating !== null && (product.rating === null || product.rating < minRating)) {
                        return false;
                    }
                    if (availability.inStock && !availability.outOfStock) {
                        return (product.inventoryCount ?? product.stock ?? 0) > 0;
                    }
                    if (!availability.inStock && availability.outOfStock) {
                        return (product.inventoryCount ?? product.stock ?? 0) === 0;
                    }
                    return true;
                });
            }
        ));
    });

    test('generates a query without WHERE when all filters are null', () => {
        const builder = new QueryBuilder();
        const query = builder.buildQuery({
            priceRange: { min: null, max: null },
            minRating: null,
            availability: { inStock: false, outOfStock: false }
        });

        expect(query.sql).toBe('SELECT * FROM store_product');
        expect(query.parameters).toEqual({});
    });

    test('generates parameterized SQL for each individual filter', () => {
        const builder = new QueryBuilder();

        expect(builder.buildQuery({
            priceRange: { min: 10, max: 50 },
            minRating: null,
            availability: { inStock: false, outOfStock: false }
        })).toMatchObject({
            sql: 'SELECT * FROM store_product WHERE price >= :minPrice AND price <= :maxPrice',
            parameters: { minPrice: 10, maxPrice: 50 }
        });

        expect(builder.buildQuery({
            priceRange: { min: null, max: null },
            minRating: 4,
            availability: { inStock: false, outOfStock: false }
        }).sql).toContain('rating >= :minRating AND rating IS NOT NULL');

        expect(builder.buildQuery({
            priceRange: { min: null, max: null },
            minRating: null,
            availability: { inStock: true, outOfStock: false }
        }).sql).toContain('inventory_count > 0');
    });

    test('generates combined filter SQL with AND clauses', () => {
        const builder = new QueryBuilder();
        const query = builder.buildQuery({
            priceRange: { min: 10, max: 100 },
            minRating: 4,
            availability: { inStock: true, outOfStock: false }
        });

        expect(query.sql).toBe(
            'SELECT * FROM store_product WHERE price >= :minPrice AND price <= :maxPrice AND rating >= :minRating AND rating IS NOT NULL AND inventory_count > 0'
        );
    });

    test('prevents SQL injection with named parameters', () => {
        const builder = new QueryBuilder();
        const query = builder.buildQuery({
            priceRange: { min: 100, max: 500 },
            minRating: null,
            availability: { inStock: false, outOfStock: false }
        });

        expect(query.sql).toContain(':minPrice');
        expect(query.sql).toContain(':maxPrice');
        expect(query.sql).not.toContain('100');
        expect(query.sql).not.toContain('500');
        expect(query.parameters).toEqual({ minPrice: 100, maxPrice: 500 });
    });

    test('builds count queries and appends to existing WHERE clauses', () => {
        const builder = new QueryBuilder();
        const countQuery = builder.buildCountQuery({
            priceRange: { min: 10, max: null },
            minRating: null,
            availability: { inStock: false, outOfStock: false }
        });
        const existingWhere = builder.buildQuery(
            {
                priceRange: { min: null, max: 99 },
                minRating: null,
                availability: { inStock: false, outOfStock: false }
            },
            'SELECT * FROM store_product WHERE is_available = 1'
        );

        expect(countQuery.sql).toBe('SELECT COUNT(*) AS count FROM store_product WHERE price >= :minPrice');
        expect(existingWhere.sql).toBe('SELECT * FROM store_product WHERE is_available = 1 AND price <= :maxPrice');
    });

    test('generates stable cache keys and index hints', () => {
        const builder = new QueryBuilder();

        fc.assert(fc.property(filterStateArbitrary, (state) => {
            const first = builder.buildQuery(state);
            const second = builder.buildQuery(state);

            expect(first.cacheKey).toBe(second.cacheKey);
            expect(first.useCache).toBe(true);
            expect(new Set(first.indexHints).size).toBe(first.indexHints.length);
        }));
    });
});
