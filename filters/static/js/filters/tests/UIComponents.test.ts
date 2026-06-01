import * as fc from 'fast-check';
import PriceRangeFilter from '../PriceRangeFilter';
import RatingFilter from '../RatingFilter';
import AvailabilityFilter from '../AvailabilityFilter';
import FilterSummary from '../FilterSummary';
import { applyFiltersToProducts } from '../filterUtils';
import { filterStateArbitrary, productListArbitrary } from './helpers';

describe('Filter UI components', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="price"></div>
            <div id="rating"></div>
            <div id="availability"></div>
            <div id="summary"></div>
        `;
    });

    test('Feature: advanced-search-filters, Property 14: Result Count Matches Filtered Results', () => {
        fc.assert(fc.property(
            productListArbitrary,
            filterStateArbitrary,
            (products, state) => {
                const filtered = applyFiltersToProducts(products, state);
                const summary = new FilterSummary('summary', jest.fn(), jest.fn());
                summary.update(state, filtered.length);

                expect(document.querySelector('.result-count')?.textContent).toContain(`${filtered.length}`);
            }
        ));
    });

    test('PriceRangeFilter renders accessible inputs and emits valid changes', () => {
        const onChange = jest.fn();
        new PriceRangeFilter('price', onChange);

        const minInput = document.querySelector<HTMLInputElement>('#price-min')!;
        const maxInput = document.querySelector<HTMLInputElement>('#price-max')!;

        expect(minInput.getAttribute('aria-label')).toBe('Minimum price');
        expect(maxInput.getAttribute('aria-label')).toBe('Maximum price');

        minInput.value = '10';
        maxInput.value = '50';
        maxInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(onChange).toHaveBeenLastCalledWith(10, 50);
    });

    test('PriceRangeFilter displays inline validation feedback', () => {
        const onChange = jest.fn();
        new PriceRangeFilter('price', onChange);

        const minInput = document.querySelector<HTMLInputElement>('#price-min')!;
        const maxInput = document.querySelector<HTMLInputElement>('#price-max')!;
        minInput.value = '100';
        maxInput.value = '50';
        maxInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(document.querySelector('.error-message')?.textContent).toBe('Minimum price cannot exceed maximum price');
        expect(minInput.getAttribute('aria-invalid')).toBe('true');
        expect(onChange).not.toHaveBeenCalled();
    });

    test('RatingFilter renders radio-style buttons and supports keyboard navigation', () => {
        const onChange = jest.fn();
        new RatingFilter('rating', onChange);

        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.rating-option'));
        expect(document.querySelector('[role="radiogroup"]')).not.toBeNull();
        expect(buttons).toHaveLength(6);

        buttons[4].click();
        expect(onChange).toHaveBeenLastCalledWith(4);

        buttons[4].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(onChange).toHaveBeenLastCalledWith(5);
    });

    test('AvailabilityFilter renders checkboxes and emits both flags', () => {
        const onChange = jest.fn();
        new AvailabilityFilter('availability', onChange);

        const inStock = document.querySelector<HTMLInputElement>('#in-stock')!;
        const outOfStock = document.querySelector<HTMLInputElement>('#out-of-stock')!;
        expect(inStock.getAttribute('aria-label')).toBe('In stock items');
        expect(outOfStock.getAttribute('aria-label')).toBe('Out of stock items');

        inStock.checked = true;
        inStock.dispatchEvent(new Event('change', { bubbles: true }));
        expect(onChange).toHaveBeenLastCalledWith(true, false);
    });

    test('FilterSummary renders active filters, no-results feedback, and clear controls', () => {
        const onClearFilter = jest.fn();
        const onClearAll = jest.fn();
        const summary = new FilterSummary('summary', onClearFilter, onClearAll);

        summary.update({
            priceRange: { min: 10, max: 100 },
            minRating: 4,
            availability: { inStock: true, outOfStock: false }
        }, 0);

        expect(document.querySelector('.result-count')?.textContent).toContain('0 results found');
        expect(document.querySelector('.no-results')?.textContent).toContain('No results');
        expect(document.querySelectorAll('.filter-tag')).toHaveLength(3);

        document.querySelector<HTMLButtonElement>('[data-filter="price"]')!.click();
        document.querySelector<HTMLButtonElement>('.clear-all')!.click();

        expect(onClearFilter).toHaveBeenCalledWith('price');
        expect(onClearAll).toHaveBeenCalled();
    });
});
