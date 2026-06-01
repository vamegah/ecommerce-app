import { FilterState } from './types';
import { hasActiveFilters } from './filterUtils';

class FilterSummary {
    private container: HTMLElement;
    private readonly onClearFilter: (filterType: string) => void;
    private readonly onClearAll: () => void;

    constructor(
        containerId: string,
        onClearFilter: (filterType: string) => void,
        onClearAll: () => void
    ) {
        this.container = this.getContainer(containerId);
        this.onClearFilter = onClearFilter;
        this.onClearAll = onClearAll;
    }

    update(filterState: FilterState, resultCount: number): void {
        const activeFilters = this.getActiveFilterTags(filterState);
        const noResultsMessage = resultCount === 0
            ? '<p class="no-results" role="status">No results match the selected filters.</p>'
            : '';

        this.container.innerHTML = `
            <section class="filter-summary" aria-label="Filter summary">
                <div class="result-count" role="status" aria-live="polite">
                    ${resultCount} ${resultCount === 1 ? 'result' : 'results'} found
                </div>
                ${noResultsMessage}
                ${activeFilters.length > 0 ? `
                    <div class="active-filters" aria-label="Active filters">
                        ${activeFilters.join('')}
                        <button type="button" class="clear-all" aria-label="Clear all filters">Clear All</button>
                    </div>
                ` : ''}
            </section>
        `;

        this.attachEventListeners();
    }

    setLoading(): void {
        this.container.innerHTML = `
            <section class="filter-summary" aria-label="Filter summary">
                <div class="result-count" role="status" aria-live="polite">Loading results...</div>
            </section>
        `;
    }

    setError(message: string): void {
        this.container.innerHTML = `
            <section class="filter-summary" aria-label="Filter summary">
                <div class="filter-error" role="alert">${this.escapeHtml(message)}</div>
            </section>
        `;
    }

    private getActiveFilterTags(filterState: FilterState): string[] {
        if (!hasActiveFilters(filterState)) {
            return [];
        }

        const tags: string[] = [];

        if (filterState.priceRange.min !== null || filterState.priceRange.max !== null) {
            const min = filterState.priceRange.min !== null ? `$${filterState.priceRange.min}` : 'Any';
            const max = filterState.priceRange.max !== null ? `$${filterState.priceRange.max}` : 'Any';
            tags.push(this.renderTag(`Price: ${min} - ${max}`, 'price', 'Remove price filter'));
        }

        if (filterState.minRating !== null) {
            tags.push(this.renderTag(`Rating: ${filterState.minRating}+`, 'rating', 'Remove rating filter'));
        }

        if (filterState.availability.inStock && !filterState.availability.outOfStock) {
            tags.push(this.renderTag('In Stock', 'availability', 'Remove availability filter'));
        } else if (!filterState.availability.inStock && filterState.availability.outOfStock) {
            tags.push(this.renderTag('Out of Stock', 'availability', 'Remove availability filter'));
        }

        return tags;
    }

    private renderTag(label: string, filterType: string, ariaLabel: string): string {
        return `
            <span class="filter-tag">
                ${this.escapeHtml(label)}
                <button type="button" class="remove-filter" data-filter="${filterType}"
                    aria-label="${ariaLabel}">x</button>
            </span>
        `;
    }

    private attachEventListeners(): void {
        this.container.querySelectorAll<HTMLButtonElement>('.remove-filter').forEach((button) => {
            button.addEventListener('click', () => {
                const filterType = button.dataset.filter;
                if (filterType) {
                    this.onClearFilter(filterType);
                }
            });
        });

        const clearAllButton = this.container.querySelector<HTMLButtonElement>('.clear-all');
        clearAllButton?.addEventListener('click', () => this.onClearAll());
    }

    private escapeHtml(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    private getContainer(containerId: string): HTMLElement {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Filter summary container "${containerId}" was not found`);
        }
        return container;
    }
}

export default FilterSummary;
