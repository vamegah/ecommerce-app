import * as fc from 'fast-check';
import FilterStateManager from '../FilterStateManager';
import { applyFiltersToProducts, DEFAULT_FILTER_STATE } from '../filterUtils';
import {
    filterStateArbitrary,
    productListArbitrary,
    ratingArbitrary,
    validPriceRangeArbitrary
} from './helpers';

describe('FilterStateManager', () => {
    test('Feature: advanced-search-filters, Property 1: Price Range Filtering Correctness', () => {
        fc.assert(fc.property(
            productListArbitrary,
            validPriceRangeArbitrary,
            (products, priceRange) => {
                const manager = new FilterStateManager();
                manager.setPriceRange(priceRange.min, priceRange.max);
                const filtered = applyFiltersToProducts(products, manager.getState());
                const expected = products.filter((product) => {
                    if (priceRange.min !== null && product.price < priceRange.min) {
                        return false;
                    }
                    if (priceRange.max !== null && product.price > priceRange.max) {
                        return false;
                    }
                    return true;
                });

                return filtered.length === expected.length &&
                    filtered.every((product) => expected.includes(product));
            }
        ));
    });

    test('Feature: advanced-search-filters, Property 2: Price Filter Clearing Restores Unfiltered State', () => {
        fc.assert(fc.property(
            productListArbitrary,
            validPriceRangeArbitrary,
            (products, priceRange) => {
                const manager = new FilterStateManager();
                manager.setPriceRange(priceRange.min, priceRange.max);
                manager.clearPriceRange();

                return applyFiltersToProducts(products, manager.getState()).length === products.length;
            }
        ));
    });

    test('Feature: advanced-search-filters, Property 3: Rating Filter Correctness', () => {
        fc.assert(fc.property(
            productListArbitrary,
            fc.integer({ min: 1, max: 5 }),
            (products, minRating) => {
                const manager = new FilterStateManager();
                manager.setMinRating(minRating);
                const filtered = applyFiltersToProducts(products, manager.getState());
                const expected = products.filter((product) => product.rating !== null && product.rating >= minRating);

                return filtered.length === expected.length &&
                    filtered.every((product) => product.rating !== null && product.rating >= minRating);
            }
        ));
    });

    test('Feature: advanced-search-filters, Property 4: Rating Filter Clearing Restores Unfiltered State', () => {
        fc.assert(fc.property(
            productListArbitrary,
            ratingArbitrary,
            (products, rating) => {
                const manager = new FilterStateManager();
                manager.setMinRating(rating);
                manager.clearRating();

                return applyFiltersToProducts(products, manager.getState()).length === products.length;
            }
        ));
    });

    test('Feature: advanced-search-filters, Property 15: Clear All Returns to Default State', () => {
        fc.assert(fc.property(filterStateArbitrary, (state) => {
            const manager = new FilterStateManager(state);
            manager.clearAll();
            expect(manager.getState()).toEqual(DEFAULT_FILTER_STATE);
        }));
    });

    test('initializes with default values', () => {
        const manager = new FilterStateManager();

        expect(manager.getState()).toEqual(DEFAULT_FILTER_STATE);
    });

    test('throws validation errors for invalid price ranges and ratings', () => {
        const manager = new FilterStateManager();

        expect(() => manager.setPriceRange(100, 50)).toThrow('Minimum price cannot exceed maximum price');
        expect(() => manager.setPriceRange(-1, 50)).toThrow('Price cannot be negative');
        expect(() => manager.setMinRating(0)).toThrow('Rating must be between 1 and 5');
        expect(() => manager.setMinRating(6)).toThrow('Rating must be between 1 and 5');
    });

    test('notifies subscribers once per state change and supports unsubscribe', () => {
        const manager = new FilterStateManager();
        const listener = jest.fn();
        const unsubscribe = manager.subscribe(listener);

        manager.setPriceRange(10, 20);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenLastCalledWith({
            priceRange: { min: 10, max: 20 },
            minRating: null,
            availability: { inStock: false, outOfStock: false }
        });

        unsubscribe();
        manager.setMinRating(4);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('initialize loads external state and emits a single notification by default', () => {
        const manager = new FilterStateManager();
        const listener = jest.fn();
        manager.subscribe(listener);

        manager.initialize({
            priceRange: { min: 25 },
            minRating: 4,
            availability: { inStock: true }
        });

        expect(manager.getState()).toEqual({
            priceRange: { min: 25, max: null },
            minRating: 4,
            availability: { inStock: true, outOfStock: false }
        });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('getState returns an immutable snapshot', () => {
        const manager = new FilterStateManager();
        const state = manager.getState();
        state.priceRange.min = 999;

        expect(manager.getState().priceRange.min).toBeNull();
    });
});
