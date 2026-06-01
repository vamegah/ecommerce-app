import FilterSystem from '../FilterSystem';
import PersistenceLayer from '../PersistenceLayer';
import { Product } from '../types';

const products: Product[] = [
    { id: 1, name: 'Budget Phone', price: 100, rating: 4.5, inventoryCount: 10, image: '' },
    { id: 2, name: 'Desk Lamp', price: 200, rating: 3.5, inventoryCount: 0, image: '' },
    { id: 3, name: 'Laptop', price: 300, rating: 5, inventoryCount: 5, image: '' },
    { id: 4, name: 'Unrated Cable', price: 20, rating: null, inventoryCount: 12, image: '' }
];

describe('FilterSystem integration', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="filter-panel"></div>';
        localStorage.clear();
        window.history.replaceState({}, '', '/store');
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('end-to-end user journey: select filters, view results, share URL, restore from URL', () => {
        let resultProducts: Product[] = [];
        const firstSystem = new FilterSystem((nextProducts) => {
            resultProducts = nextProducts;
        });
        firstSystem.setProducts(products);

        const minInput = document.querySelector<HTMLInputElement>('#price-min')!;
        const maxInput = document.querySelector<HTMLInputElement>('#price-max')!;
        minInput.value = '150';
        maxInput.value = '350';
        maxInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(resultProducts.map((product) => product.id)).toEqual([2, 3]);
        expect(window.location.search).toContain('minPrice=150');
        expect(window.location.search).toContain('maxPrice=350');

        firstSystem.destroy();
        document.body.innerHTML = '<div id="filter-panel"></div>';

        let restoredProducts: Product[] = [];
        const restoredSystem = new FilterSystem((nextProducts) => {
            restoredProducts = nextProducts;
        });
        restoredSystem.setProducts(products);

        expect(restoredProducts.map((product) => product.id)).toEqual([2, 3]);
        restoredSystem.destroy();
    });

    test('restores persisted filters across page reloads', () => {
        const persistence = new PersistenceLayer();
        persistence.saveFilters({
            priceRange: { min: 100, max: 250 },
            minRating: 4,
            availability: { inStock: true, outOfStock: false }
        });

        let resultProducts: Product[] = [];
        const filterSystem = new FilterSystem((nextProducts) => {
            resultProducts = nextProducts;
        });
        filterSystem.setProducts(products);

        expect(resultProducts.map((product) => product.id)).toEqual([1]);
        filterSystem.destroy();
    });

    test('URL parameters take precedence over saved filters', () => {
        const persistence = new PersistenceLayer();
        persistence.saveFilters({
            priceRange: { min: 0, max: 150 },
            minRating: null,
            availability: { inStock: false, outOfStock: false }
        });
        window.history.replaceState({}, '', '/store?minPrice=200&maxPrice=300');

        let resultProducts: Product[] = [];
        const filterSystem = new FilterSystem((nextProducts) => {
            resultProducts = nextProducts;
        });
        filterSystem.setProducts(products);

        expect(resultProducts.map((product) => product.id)).toEqual([2, 3]);
        filterSystem.destroy();
    });

    test('browser back and forward navigation applies URL filters', () => {
        let resultProducts: Product[] = [];
        const filterSystem = new FilterSystem((nextProducts) => {
            resultProducts = nextProducts;
        });
        filterSystem.setProducts(products);

        window.history.pushState({}, '', '/store?availability=outOfStock');
        window.dispatchEvent(new PopStateEvent('popstate'));

        expect(resultProducts.map((product) => product.id)).toEqual([2]);
        filterSystem.destroy();
    });

    test('clear all resets results, URL parameters, and persisted state', () => {
        let resultProducts: Product[] = [];
        const filterSystem = new FilterSystem((nextProducts) => {
            resultProducts = nextProducts;
        });
        filterSystem.setProducts(products);

        const minInput = document.querySelector<HTMLInputElement>('#price-min')!;
        minInput.value = '150';
        minInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(resultProducts.length).toBe(2);

        document.querySelector<HTMLButtonElement>('.clear-all')!.click();

        expect(resultProducts.length).toBe(products.length);
        expect(window.location.search).toBe('');
        expect(localStorage.getItem('search_filters_v1')).toBeNull();
        filterSystem.destroy();
    });

    test('handles fetch failures without crashing', async () => {
        const onError = jest.fn();
        const filterSystem = new FilterSystem(jest.fn(), {
            fetchResults: jest.fn().mockRejectedValue(new Error('database unavailable')),
            onError
        });

        filterSystem.setProducts(products);
        await Promise.resolve();

        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'database unavailable' }));
        expect(document.querySelector('.filter-error')?.textContent).toContain('Unable to load');
        filterSystem.destroy();
    });
});
