import { FilterState } from './types';
import { hasActiveFilters } from './filterUtils';

interface FilterTag {
    label: string;
    filterType: string;
    ariaLabel: string;
}

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
        const section = this.createSection();
        const resultCountElement = document.createElement('div');

        resultCountElement.className = 'result-count';
        resultCountElement.setAttribute('role', 'status');
        resultCountElement.setAttribute('aria-live', 'polite');
        resultCountElement.textContent = `${resultCount} ${resultCount === 1 ? 'result' : 'results'} found`;
        section.appendChild(resultCountElement);

        if (resultCount === 0) {
            const noResults = document.createElement('p');
            noResults.className = 'no-results';
            noResults.setAttribute('role', 'status');
            noResults.textContent = 'No results match the selected filters.';
            section.appendChild(noResults);
        }

        if (activeFilters.length > 0) {
            const activeFilterContainer = document.createElement('div');
            const clearAllButton = document.createElement('button');

            activeFilterContainer.className = 'active-filters';
            activeFilterContainer.setAttribute('aria-label', 'Active filters');
            activeFilterContainer.append(...activeFilters.map((tag) => this.renderTag(tag)));

            clearAllButton.type = 'button';
            clearAllButton.className = 'clear-all';
            clearAllButton.setAttribute('aria-label', 'Clear all filters');
            clearAllButton.textContent = 'Clear All';
            activeFilterContainer.appendChild(clearAllButton);

            section.appendChild(activeFilterContainer);
        }

        this.container.replaceChildren(section);

        this.attachEventListeners();
    }

    setLoading(): void {
        const section = this.createSection();
        const resultCount = document.createElement('div');

        resultCount.className = 'result-count';
        resultCount.setAttribute('role', 'status');
        resultCount.setAttribute('aria-live', 'polite');
        resultCount.textContent = 'Loading results...';

        section.appendChild(resultCount);
        this.container.replaceChildren(section);
    }

    setError(message: string): void {
        const section = this.createSection();
        const error = document.createElement('div');

        error.className = 'filter-error';
        error.setAttribute('role', 'alert');
        error.textContent = message;

        section.appendChild(error);
        this.container.replaceChildren(section);
    }

    private getActiveFilterTags(filterState: FilterState): FilterTag[] {
        if (!hasActiveFilters(filterState)) {
            return [];
        }

        const tags: FilterTag[] = [];

        if (filterState.priceRange.min !== null || filterState.priceRange.max !== null) {
            const min = filterState.priceRange.min !== null ? `$${filterState.priceRange.min}` : 'Any';
            const max = filterState.priceRange.max !== null ? `$${filterState.priceRange.max}` : 'Any';
            tags.push({ label: `Price: ${min} - ${max}`, filterType: 'price', ariaLabel: 'Remove price filter' });
        }

        if (filterState.minRating !== null) {
            tags.push({ label: `Rating: ${filterState.minRating}+`, filterType: 'rating', ariaLabel: 'Remove rating filter' });
        }

        if (filterState.availability.inStock && !filterState.availability.outOfStock) {
            tags.push({ label: 'In Stock', filterType: 'availability', ariaLabel: 'Remove availability filter' });
        } else if (!filterState.availability.inStock && filterState.availability.outOfStock) {
            tags.push({ label: 'Out of Stock', filterType: 'availability', ariaLabel: 'Remove availability filter' });
        }

        return tags;
    }

    private renderTag(tag: FilterTag): HTMLSpanElement {
        const wrapper = document.createElement('span');
        const label = document.createTextNode(tag.label);
        const removeButton = document.createElement('button');

        wrapper.className = 'filter-tag';

        removeButton.type = 'button';
        removeButton.className = 'remove-filter';
        removeButton.dataset.filter = tag.filterType;
        removeButton.setAttribute('aria-label', tag.ariaLabel);
        removeButton.textContent = 'x';

        wrapper.append(label, removeButton);
        return wrapper;
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

    private getContainer(containerId: string): HTMLElement {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Filter summary container "${containerId}" was not found`);
        }
        return container;
    }

    private createSection(): HTMLElement {
        const section = document.createElement('section');
        section.className = 'filter-summary';
        section.setAttribute('aria-label', 'Filter summary');
        return section;
    }
}

export default FilterSummary;
