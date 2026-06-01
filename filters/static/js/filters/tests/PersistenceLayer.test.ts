import * as fc from 'fast-check';
import PersistenceLayer from '../PersistenceLayer';
import { filterStateArbitrary } from './helpers';

class LocalStorageMock implements Storage {
    private store: Record<string, string> = {};
    readonly length = 0;

    clear(): void {
        this.store = {};
    }

    getItem(key: string): string | null {
        return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
    }

    key(index: number): string | null {
        return Object.keys(this.store)[index] ?? null;
    }

    removeItem(key: string): void {
        delete this.store[key];
    }

    setItem(key: string, value: string): void {
        this.store[key] = value;
    }
}

describe('PersistenceLayer', () => {
    let storage: LocalStorageMock;

    beforeEach(() => {
        storage = new LocalStorageMock();
    });

    test('Feature: advanced-search-filters, Property 12: Persistence Round-Trip Consistency', () => {
        fc.assert(fc.property(filterStateArbitrary, (state) => {
            const persistence = new PersistenceLayer(storage);

            persistence.saveFilters(state);
            expect(persistence.loadFilters()).toEqual(state);
        }));
    });

    test('Feature: advanced-search-filters, Property 13: Clearing Filters Removes Persisted State', () => {
        fc.assert(fc.property(filterStateArbitrary, (state) => {
            const persistence = new PersistenceLayer(storage);

            persistence.saveFilters(state);
            persistence.clearFilters();

            return !persistence.hasFilters() && persistence.loadFilters() === null;
        }));
    });

    test('uses the versioned storage key and includes a timestamp', () => {
        const persistence = new PersistenceLayer(storage);
        persistence.saveFilters({
            priceRange: { min: 10, max: 20 },
            minRating: 4,
            availability: { inStock: true, outOfStock: false }
        });

        const raw = storage.getItem('search_filters_v1');
        expect(raw).not.toBeNull();
        expect(JSON.parse(raw as string)).toMatchObject({
            version: 1,
            filters: {
                priceRange: { min: 10, max: 20 },
                minRating: 4,
                availability: { inStock: true, outOfStock: false }
            }
        });
        expect(typeof JSON.parse(raw as string).timestamp).toBe('number');
    });

    test('localStorage unavailable degrades gracefully', () => {
        const persistence = new PersistenceLayer(null);

        expect(() => persistence.saveFilters({
            priceRange: { min: null, max: null },
            minRating: null,
            availability: { inStock: false, outOfStock: false }
        })).not.toThrow();
        expect(persistence.loadFilters()).toBeNull();
        expect(persistence.hasFilters()).toBe(false);
    });

    test('corrupted data is cleared and ignored', () => {
        storage.setItem('search_filters_v1', 'invalid json');
        const persistence = new PersistenceLayer(storage);

        expect(persistence.loadFilters()).toBeNull();
        expect(storage.getItem('search_filters_v1')).toBeNull();
    });

    test('invalid loaded data is cleared and ignored', () => {
        storage.setItem('search_filters_v1', JSON.stringify({
            version: 1,
            filters: {
                priceRange: { min: 50, max: 10 },
                minRating: 9,
                availability: { inStock: true }
            },
            timestamp: Date.now()
        }));
        const persistence = new PersistenceLayer(storage);

        expect(persistence.loadFilters()).toBeNull();
        expect(storage.getItem('search_filters_v1')).toBeNull();
    });

    test('storage quota errors are swallowed', () => {
        const failingStorage = new LocalStorageMock();
        jest.spyOn(failingStorage, 'setItem').mockImplementation(() => {
            throw new Error('quota exceeded');
        });
        const persistence = new PersistenceLayer(failingStorage);

        expect(() => persistence.saveFilters({
            priceRange: { min: 1, max: 2 },
            minRating: null,
            availability: { inStock: false, outOfStock: false }
        })).not.toThrow();
    });
});
