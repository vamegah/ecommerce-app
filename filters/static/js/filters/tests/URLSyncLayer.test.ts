import * as fc from 'fast-check';
import URLSyncLayer from '../URLSyncLayer';
import { DEFAULT_FILTER_STATE } from '../filterUtils';
import { filterStateArbitrary } from './helpers';

describe('URLSyncLayer', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/store');
    });

    test('Feature: advanced-search-filters, Property 11: URL Encoding Round-Trip Consistency', () => {
        fc.assert(fc.property(filterStateArbitrary, (state) => {
            const urlSync = new URLSyncLayer();
            const encoded = urlSync.encodeToURL(state);
            const decoded = urlSync.decodeFromURL(encoded);

            expect(decoded).toEqual(state);
        }));
    });

    test('Feature: advanced-search-filters, Property 16: Clearing Filters Removes URL Parameters', () => {
        fc.assert(fc.property(filterStateArbitrary, (state) => {
            const urlSync = new URLSyncLayer();
            window.history.replaceState({}, '', `/store?${urlSync.encodeToURL(state)}&page=2`);
            urlSync.updateURL(DEFAULT_FILTER_STATE);

            expect(window.location.search).toBe('?page=2');
        }));
    });

    test('encodes filter combinations in human-readable parameters', () => {
        const urlSync = new URLSyncLayer();

        expect(urlSync.encodeToURL({
            priceRange: { min: 10, max: 100 },
            minRating: 4,
            availability: { inStock: true, outOfStock: false }
        })).toBe('minPrice=10&maxPrice=100&minRating=4&availability=inStock');
    });

    test('missing parameters decode to default values', () => {
        const urlSync = new URLSyncLayer();

        expect(urlSync.decodeFromURL('')).toEqual(DEFAULT_FILTER_STATE);
    });

    test('invalid parameter values are ignored gracefully', () => {
        const urlSync = new URLSyncLayer();
        const decoded = urlSync.decodeFromURL('minPrice=abc&maxPrice=-3&minRating=8&availability=unknown');

        expect(decoded).toEqual(DEFAULT_FILTER_STATE);
    });

    test('invalid price ranges are ignored', () => {
        const urlSync = new URLSyncLayer();

        expect(urlSync.decodeFromURL('minPrice=50&maxPrice=10')).toEqual(DEFAULT_FILTER_STATE);
    });

    test('decodes legacy parameter names for compatibility', () => {
        const urlSync = new URLSyncLayer();

        expect(urlSync.decodeFromURL('price_min=10&price_max=20&rating=3&in_stock=1')).toEqual({
            priceRange: { min: 10, max: 20 },
            minRating: 3,
            availability: { inStock: true, outOfStock: false }
        });
    });

    test('updates browser history without a page reload and preserves unrelated parameters', () => {
        const urlSync = new URLSyncLayer();
        const pushState = jest.spyOn(window.history, 'pushState');
        window.history.replaceState({}, '', '/store?page=2#items');

        urlSync.updateURL({
            priceRange: { min: 25, max: null },
            minRating: null,
            availability: { inStock: false, outOfStock: true }
        });

        expect(pushState).toHaveBeenCalled();
        expect(window.location.pathname).toBe('/store');
        expect(window.location.search).toContain('page=2');
        expect(window.location.search).toContain('minPrice=25');
        expect(window.location.search).toContain('availability=outOfStock');
        expect(window.location.hash).toBe('#items');
    });

    test('onURLChange listens for browser navigation events', () => {
        const urlSync = new URLSyncLayer();
        const callback = jest.fn();
        const unsubscribe = urlSync.onURLChange(callback);

        window.history.pushState({}, '', '/store?minRating=5');
        window.dispatchEvent(new PopStateEvent('popstate'));

        expect(callback).toHaveBeenCalledWith({
            priceRange: { min: null, max: null },
            minRating: 5,
            availability: { inStock: false, outOfStock: false }
        });

        unsubscribe();
    });
});
