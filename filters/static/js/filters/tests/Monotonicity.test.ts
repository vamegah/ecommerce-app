import * as fc from 'fast-check';
import { applyFiltersToProducts } from '../filterUtils';
import { productListArbitrary, validPriceRangeArbitrary } from './helpers';

describe('Filter monotonicity properties', () => {
    test('Feature: advanced-search-filters, Property 9: Adding Filters Never Increases Results', () => {
        fc.assert(fc.property(
            productListArbitrary,
            validPriceRangeArbitrary,
            fc.integer({ min: 1, max: 5 }),
            fc.boolean(),
            (products, priceRange, minRating, inStockOnly) => {
                const unfiltered = applyFiltersToProducts(products, {
                    priceRange: { min: null, max: null },
                    minRating: null,
                    availability: { inStock: false, outOfStock: false }
                });
                const priceFiltered = applyFiltersToProducts(products, {
                    priceRange,
                    minRating: null,
                    availability: { inStock: false, outOfStock: false }
                });
                const priceAndRatingFiltered = applyFiltersToProducts(products, {
                    priceRange,
                    minRating,
                    availability: { inStock: false, outOfStock: false }
                });
                const allFilters = applyFiltersToProducts(products, {
                    priceRange,
                    minRating,
                    availability: { inStock: inStockOnly, outOfStock: !inStockOnly }
                });

                return priceFiltered.length <= unfiltered.length &&
                    priceAndRatingFiltered.length <= priceFiltered.length &&
                    allFilters.length <= priceAndRatingFiltered.length;
            }
        ));
    });

    test('Feature: advanced-search-filters, Property 10: Removing Filters Never Decreases Results', () => {
        fc.assert(fc.property(
            productListArbitrary,
            validPriceRangeArbitrary,
            fc.integer({ min: 1, max: 5 }),
            fc.boolean(),
            (products, priceRange, minRating, inStockOnly) => {
                const allFilters = applyFiltersToProducts(products, {
                    priceRange,
                    minRating,
                    availability: { inStock: inStockOnly, outOfStock: !inStockOnly }
                });
                const withoutAvailability = applyFiltersToProducts(products, {
                    priceRange,
                    minRating,
                    availability: { inStock: false, outOfStock: false }
                });
                const withoutRating = applyFiltersToProducts(products, {
                    priceRange,
                    minRating: null,
                    availability: { inStock: false, outOfStock: false }
                });
                const withoutPrice = applyFiltersToProducts(products, {
                    priceRange: { min: null, max: null },
                    minRating: null,
                    availability: { inStock: false, outOfStock: false }
                });

                return withoutAvailability.length >= allFilters.length &&
                    withoutRating.length >= withoutAvailability.length &&
                    withoutPrice.length >= withoutRating.length;
            }
        ));
    });
});
