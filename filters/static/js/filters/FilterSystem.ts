import FilterStateManager from './FilterStateManager';
import QueryBuilder from './QueryBuilder';
import URLSyncLayer from './URLSyncLayer';
import PersistenceLayer from './PersistenceLayer';
import PriceRangeFilter from './PriceRangeFilter';
import RatingFilter from './RatingFilter';
import AvailabilityFilter from './AvailabilityFilter';
import FilterSummary from './FilterSummary';
import FilterPanel from './FilterPanel';
import { DatabaseQuery, FilteredResults, FilterState, Product } from './types';
import {
    applyFiltersToProducts,
    cloneFilterState,
    DEFAULT_FILTER_STATE,
    hasActiveFilters
} from './filterUtils';

type ResultsChangeHandler = (products: Product[], totalCount: number, query: DatabaseQuery) => void;
type FetchResultsHandler = (query: DatabaseQuery, state: FilterState) => Promise<FilteredResults | Product[]>;

interface FilterSystemOptions {
    renderUI?: boolean;
    syncURL?: boolean;
    persist?: boolean;
    fetchResults?: FetchResultsHandler;
    onLoadingChange?: (isLoading: boolean) => void;
    onError?: (error: Error) => void;
}

class FilterSystem {
    private readonly stateManager: FilterStateManager;
    private readonly queryBuilder: QueryBuilder;
    private readonly urlSync: URLSyncLayer;
    private readonly persistence: PersistenceLayer;
    private readonly onResultsChange: ResultsChangeHandler;
    private readonly options: Required<Pick<FilterSystemOptions, 'renderUI' | 'syncURL' | 'persist'>> &
        Omit<FilterSystemOptions, 'renderUI' | 'syncURL' | 'persist'>;

    private priceFilter?: PriceRangeFilter;
    private ratingFilter?: RatingFilter;
    private availabilityFilter?: AvailabilityFilter;
    private filterSummary?: FilterSummary;
    private filterPanel?: FilterPanel;
    private unsubscribeState?: () => void;
    private unsubscribeURL?: () => void;
    private products: Product[] = [];
    private requestSequence = 0;
    private suppressExternalSync = false;

    constructor(
        onResultsChange: ResultsChangeHandler,
        options: FilterSystemOptions = {}
    ) {
        this.onResultsChange = onResultsChange;
        this.options = {
            renderUI: options.renderUI ?? true,
            syncURL: options.syncURL ?? true,
            persist: options.persist ?? true,
            fetchResults: options.fetchResults,
            onLoadingChange: options.onLoadingChange,
            onError: options.onError
        };

        this.stateManager = new FilterStateManager();
        this.queryBuilder = new QueryBuilder();
        this.urlSync = new URLSyncLayer();
        this.persistence = new PersistenceLayer();

        if (this.options.renderUI) {
            this.mountUI();
        }

        this.initialize();
    }

    setProducts(products: Product[]): void {
        this.products = [...products];
        void this.updateResults();
    }

    getState(): FilterState {
        return this.stateManager.getState();
    }

    getQuery(): DatabaseQuery {
        return this.queryBuilder.buildQuery(this.stateManager.getState());
    }

    getQuerySQL(): string {
        return this.getQuery().sql;
    }

    destroy(): void {
        this.unsubscribeState?.();
        this.unsubscribeURL?.();
        this.filterPanel?.destroy();
    }

    private mountUI(): void {
        this.filterPanel = new FilterPanel('filter-panel');
        this.priceFilter = new PriceRangeFilter('price-filter-container', (min, max) => {
            this.stateManager.setPriceRange(min, max);
        });
        this.ratingFilter = new RatingFilter('rating-filter-container', (rating) => {
            this.stateManager.setMinRating(rating);
        });
        this.availabilityFilter = new AvailabilityFilter('availability-filter-container', (inStock, outOfStock) => {
            this.stateManager.setAvailability(inStock, outOfStock);
        });
        this.filterSummary = new FilterSummary(
            'filter-summary-container',
            (filterType) => this.clearFilter(filterType),
            () => this.clearAll()
        );
    }

    private initialize(): void {
        const initialState = this.getInitialState();
        this.stateManager.initialize(initialState, false);
        this.updateControls(this.stateManager.getState());

        this.unsubscribeState = this.stateManager.subscribe((state) => {
            this.updateControls(state);

            if (!this.suppressExternalSync) {
                if (this.options.syncURL) {
                    this.urlSync.updateURL(state);
                }

                if (this.options.persist) {
                    if (hasActiveFilters(state)) {
                        this.persistence.saveFilters(state);
                    } else {
                        this.persistence.clearFilters();
                    }
                }
            }

            void this.updateResults();
        });

        if (this.options.syncURL) {
            this.unsubscribeURL = this.urlSync.onURLChange((state) => {
                this.suppressExternalSync = true;
                this.stateManager.initialize(state);
                this.suppressExternalSync = false;
            });
        }
    }

    private getInitialState(): FilterState {
        if (this.options.syncURL && this.urlSync.hasFilterParams()) {
            return this.urlSync.decodeFromURL(window.location.search);
        }

        if (this.options.persist) {
            const savedFilters = this.persistence.loadFilters();
            if (savedFilters) {
                return savedFilters;
            }
        }

        return cloneFilterState(DEFAULT_FILTER_STATE);
    }

    private updateControls(state: FilterState): void {
        this.priceFilter?.setValue(state.priceRange);
        this.ratingFilter?.setValue(state.minRating);
        this.availabilityFilter?.setValue(state.availability);
    }

    private async updateResults(): Promise<void> {
        const requestId = ++this.requestSequence;
        const state = this.stateManager.getState();
        const query = this.queryBuilder.buildQuery(state);

        if (this.options.fetchResults) {
            this.filterSummary?.setLoading();
            this.options.onLoadingChange?.(true);

            try {
                const result = await this.options.fetchResults(query, state);

                if (requestId !== this.requestSequence) {
                    return;
                }

                const products = Array.isArray(result) ? result : result.products;
                const totalCount = Array.isArray(result) ? result.length : result.totalCount;

                this.filterSummary?.update(state, totalCount);
                this.onResultsChange(products, totalCount, query);
            } catch (error) {
                if (requestId !== this.requestSequence) {
                    return;
                }

                const normalizedError = error instanceof Error
                    ? error
                    : new Error('Unable to fetch filtered results');
                this.filterSummary?.setError('Unable to load filtered results.');
                this.options.onError?.(normalizedError);
            } finally {
                if (requestId === this.requestSequence) {
                    this.options.onLoadingChange?.(false);
                }
            }

            return;
        }

        const filteredProducts = applyFiltersToProducts(this.products, state);
        this.filterSummary?.update(state, filteredProducts.length);
        this.onResultsChange(filteredProducts, filteredProducts.length, query);
    }

    private clearFilter(filterType: string): void {
        switch (filterType) {
            case 'price':
                this.stateManager.clearPriceRange();
                break;
            case 'rating':
                this.stateManager.clearRating();
                break;
            case 'availability':
                this.stateManager.clearAvailability();
                break;
            default:
                break;
        }
    }

    private clearAll(): void {
        this.stateManager.clearAll();
    }
}

export default FilterSystem;
