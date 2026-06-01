import * as fc from 'fast-check';
import { FilterState, Product } from '../types';
import { DEFAULT_FILTER_STATE } from '../filterUtils';

export const priceArbitrary = fc.integer({ min: 0, max: 1000000 }).map((cents) => cents / 100);
export const ratingArbitrary = fc.integer({ min: 10, max: 50 }).map((value) => value / 10);

export const productArbitrary: fc.Arbitrary<Product> = fc.record({
    id: fc.oneof(fc.integer({ min: 1, max: 1000000 }), fc.uuid()),
    name: fc.string({ minLength: 1, maxLength: 40 }),
    price: priceArbitrary,
    rating: fc.option(ratingArbitrary, { nil: null }),
    inventoryCount: fc.integer({ min: 0, max: 1000 }),
    category: fc.string({ maxLength: 30 }),
    image: fc.string({ maxLength: 50 })
});

export const productListArbitrary = fc.array(productArbitrary, { maxLength: 200 });

export const validPriceRangeArbitrary = fc.tuple(
    fc.option(priceArbitrary, { nil: null }),
    fc.option(priceArbitrary, { nil: null })
).map(([first, second]) => {
    if (first !== null && second !== null && first > second) {
        return { min: second, max: first };
    }

    return { min: first, max: second };
});

export const availabilityArbitrary = fc.record({
    inStock: fc.boolean(),
    outOfStock: fc.boolean()
});

export const filterStateArbitrary: fc.Arbitrary<FilterState> = fc.record({
    priceRange: validPriceRangeArbitrary,
    minRating: fc.option(fc.integer({ min: 1, max: 5 }), { nil: null }),
    availability: availabilityArbitrary
});

export function defaultState(): FilterState {
    return {
        priceRange: { ...DEFAULT_FILTER_STATE.priceRange },
        minRating: DEFAULT_FILTER_STATE.minRating,
        availability: { ...DEFAULT_FILTER_STATE.availability }
    };
}
