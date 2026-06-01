export interface PriceRange {
    min: number | null;
    max: number | null;
}

export interface AvailabilityFilter {
    inStock: boolean;
    outOfStock: boolean;
}

export interface FilterState {
    priceRange: PriceRange;
    minRating: number | null;
    availability: AvailabilityFilter;
}

export type PartialFilterState = {
    priceRange?: Partial<PriceRange> | null;
    minRating?: number | null;
    availability?: Partial<AvailabilityFilter> | null;
};

export interface Product {
    id: string | number;
    name: string;
    price: number;
    rating: number | null;
    inventoryCount?: number;
    stock?: number;
    category?: string;
    image?: string;
}

export interface DatabaseQuery {
    sql: string;
    parameters: Record<string, number>;
    useCache: boolean;
    cacheKey: string;
    indexHints: string[];
}

export interface FilteredResults {
    products: Product[];
    totalCount: number;
    appliedFilters: FilterState;
    executionTime: number;
}
