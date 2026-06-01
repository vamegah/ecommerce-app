import {
    AvailabilityFilter,
    FilterState,
    PartialFilterState,
    PriceRange,
    Product
} from './types';

export const DEFAULT_FILTER_STATE: FilterState = {
    priceRange: {
        min: null,
        max: null
    },
    minRating: null,
    availability: {
        inStock: false,
        outOfStock: false
    }
};

export function cloneFilterState(state: FilterState): FilterState {
    return {
        priceRange: { ...state.priceRange },
        minRating: state.minRating,
        availability: { ...state.availability }
    };
}

function isValidNumber(value: number): boolean {
    return Number.isFinite(value) && !Number.isNaN(value);
}

function normalizeNullableNumber(value: number | null | undefined, fieldName: string): number | null {
    if (value === null || value === undefined) {
        return null;
    }

    if (!isValidNumber(value)) {
        throw new Error(`${fieldName} must be a finite number`);
    }

    return value;
}

export function normalizePriceRange(priceRange?: Partial<PriceRange> | null): PriceRange {
    const min = normalizeNullableNumber(priceRange?.min, 'Price');
    const max = normalizeNullableNumber(priceRange?.max, 'Price');

    if (min !== null && min < 0) {
        throw new Error('Price cannot be negative');
    }

    if (max !== null && max < 0) {
        throw new Error('Price cannot be negative');
    }

    if (min !== null && max !== null && min > max) {
        throw new Error('Minimum price cannot exceed maximum price');
    }

    return { min, max };
}

export function normalizeMinRating(rating: number | null | undefined): number | null {
    const normalized = normalizeNullableNumber(rating, 'Rating');

    if (normalized !== null && (normalized < 1 || normalized > 5)) {
        throw new Error('Rating must be between 1 and 5');
    }

    return normalized;
}

export function normalizeAvailability(availability?: Partial<AvailabilityFilter> | null): AvailabilityFilter {
    return {
        inStock: availability?.inStock === true,
        outOfStock: availability?.outOfStock === true
    };
}

export function normalizeFilterState(state?: PartialFilterState | FilterState | null): FilterState {
    if (!state) {
        return cloneFilterState(DEFAULT_FILTER_STATE);
    }

    return {
        priceRange: normalizePriceRange(state.priceRange),
        minRating: normalizeMinRating(state.minRating),
        availability: normalizeAvailability(state.availability)
    };
}

export function isDefaultFilterState(state: FilterState): boolean {
    return !hasActiveFilters(state);
}

export function hasActiveFilters(state: FilterState): boolean {
    return state.priceRange.min !== null ||
        state.priceRange.max !== null ||
        state.minRating !== null ||
        state.availability.inStock ||
        state.availability.outOfStock;
}

export function statesEqual(left: FilterState, right: FilterState): boolean {
    return left.priceRange.min === right.priceRange.min &&
        left.priceRange.max === right.priceRange.max &&
        left.minRating === right.minRating &&
        left.availability.inStock === right.availability.inStock &&
        left.availability.outOfStock === right.availability.outOfStock;
}

export function getProductInventoryCount(product: Product): number {
    if (typeof product.inventoryCount === 'number') {
        return product.inventoryCount;
    }

    if (typeof product.stock === 'number') {
        return product.stock;
    }

    return 0;
}

export function productMatchesFilters(product: Product, filters: FilterState): boolean {
    if (filters.priceRange.min !== null && product.price < filters.priceRange.min) {
        return false;
    }

    if (filters.priceRange.max !== null && product.price > filters.priceRange.max) {
        return false;
    }

    if (filters.minRating !== null) {
        if (product.rating === null || product.rating < filters.minRating) {
            return false;
        }
    }

    const inventoryCount = getProductInventoryCount(product);

    if (filters.availability.inStock && !filters.availability.outOfStock) {
        return inventoryCount > 0;
    }

    if (!filters.availability.inStock && filters.availability.outOfStock) {
        return inventoryCount === 0;
    }

    return true;
}

export function applyFiltersToProducts(products: Product[], filters: FilterState): Product[] {
    return products.filter((product) => productMatchesFilters(product, filters));
}
