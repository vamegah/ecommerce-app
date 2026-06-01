import { FilterState } from './types';
import {
    cloneFilterState,
    DEFAULT_FILTER_STATE,
    normalizeFilterState
} from './filterUtils';

type URLChangeCallback = (filterState: FilterState) => void;

class URLSyncLayer {
    private readonly filterParamNames = [
        'minPrice',
        'maxPrice',
        'minRating',
        'availability',
        'price_min',
        'price_max',
        'rating',
        'in_stock',
        'out_of_stock'
    ];

    encodeToURL(filterState: FilterState): string {
        const state = normalizeFilterState(filterState);
        const params = new URLSearchParams();

        if (state.priceRange.min !== null) {
            params.set('minPrice', this.formatNumber(state.priceRange.min));
        }

        if (state.priceRange.max !== null) {
            params.set('maxPrice', this.formatNumber(state.priceRange.max));
        }

        if (state.minRating !== null) {
            params.set('minRating', this.formatNumber(state.minRating));
        }

        const availability: string[] = [];
        if (state.availability.inStock) {
            availability.push('inStock');
        }
        if (state.availability.outOfStock) {
            availability.push('outOfStock');
        }
        if (availability.length > 0) {
            params.set('availability', availability.join(','));
        }

        return params.toString();
    }

    decodeFromURL(urlParams: string | URLSearchParams): FilterState {
        const params = this.toSearchParams(urlParams);
        const min = this.parseNonNegativeNumber(params.get('minPrice') ?? params.get('price_min'));
        const max = this.parseNonNegativeNumber(params.get('maxPrice') ?? params.get('price_max'));
        const rating = this.parseRating(params.get('minRating') ?? params.get('rating'));

        const priceRange = min !== null && max !== null && min > max
            ? { min: null, max: null }
            : { min, max };

        return normalizeFilterState({
            priceRange,
            minRating: rating,
            availability: this.decodeAvailability(params)
        });
    }

    updateURL(filterState: FilterState, mode: 'push' | 'replace' = 'push'): void {
        if (typeof window === 'undefined' || !window.history) {
            return;
        }

        const currentParams = new URLSearchParams(window.location.search);
        this.filterParamNames.forEach((paramName) => currentParams.delete(paramName));

        const encodedFilters = new URLSearchParams(this.encodeToURL(filterState));
        encodedFilters.forEach((value, key) => currentParams.set(key, value));

        const query = currentParams.toString();
        const nextURL = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash ?? ''}`;

        if (mode === 'replace') {
            window.history.replaceState({}, '', nextURL);
            return;
        }

        window.history.pushState({}, '', nextURL);
    }

    onURLChange(callback: URLChangeCallback): () => void {
        if (typeof window === 'undefined') {
            return () => undefined;
        }

        const handler = () => {
            callback(this.decodeFromURL(window.location.search));
        };

        window.addEventListener('popstate', handler);

        return () => {
            window.removeEventListener('popstate', handler);
        };
    }

    hasFilterParams(urlParams?: string | URLSearchParams): boolean {
        const params = urlParams
            ? this.toSearchParams(urlParams)
            : typeof window !== 'undefined'
                ? new URLSearchParams(window.location.search)
                : new URLSearchParams();

        return this.filterParamNames.some((paramName) => params.has(paramName));
    }

    private toSearchParams(urlParams: string | URLSearchParams): URLSearchParams {
        if (urlParams instanceof URLSearchParams) {
            return urlParams;
        }

        return new URLSearchParams(urlParams.startsWith('?') ? urlParams.substring(1) : urlParams);
    }

    private parseNonNegativeNumber(value: string | null): number | null {
        if (value === null || value.trim() === '') {
            return null;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    }

    private parseRating(value: string | null): number | null {
        const parsed = this.parseNonNegativeNumber(value);
        return parsed !== null && parsed >= 1 && parsed <= 5 ? parsed : null;
    }

    private decodeAvailability(params: URLSearchParams): FilterState['availability'] {
        const availabilityParam = params.get('availability');

        if (availabilityParam !== null) {
            const values = new Set(
                availabilityParam.split(',')
                    .map((value) => value.trim())
                    .filter(Boolean)
            );

            return {
                inStock: values.has('inStock'),
                outOfStock: values.has('outOfStock')
            };
        }

        return {
            inStock: this.parseBoolean(params.get('in_stock')),
            outOfStock: this.parseBoolean(params.get('out_of_stock'))
        };
    }

    private parseBoolean(value: string | null): boolean {
        return value === '1' || value === 'true';
    }

    private formatNumber(value: number): string {
        return Number.isInteger(value) ? value.toString() : value.toString();
    }

    getDefaultState(): FilterState {
        return cloneFilterState(DEFAULT_FILTER_STATE);
    }
}

export default URLSyncLayer;
