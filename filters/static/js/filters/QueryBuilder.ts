import { DatabaseQuery, FilterState } from './types';
import { normalizeFilterState } from './filterUtils';

interface QueryBuilderOptions {
    tableName?: string;
    priceColumn?: string;
    ratingColumn?: string;
    inventoryColumn?: string;
}

class QueryBuilder {
    private readonly tableName: string;
    private readonly priceColumn: string;
    private readonly ratingColumn: string;
    private readonly inventoryColumn: string;

    constructor(options: QueryBuilderOptions = {}) {
        this.tableName = options.tableName ?? 'store_product';
        this.priceColumn = options.priceColumn ?? 'price';
        this.ratingColumn = options.ratingColumn ?? 'rating';
        this.inventoryColumn = options.inventoryColumn ?? 'inventory_count';
    }

    buildQuery(filterState: FilterState, baseQuery: string = `SELECT * FROM ${this.tableName}`): DatabaseQuery {
        return this.buildDatabaseQuery(filterState, baseQuery);
    }

    buildCountQuery(filterState: FilterState): DatabaseQuery {
        return this.buildDatabaseQuery(
            filterState,
            `SELECT COUNT(*) AS count FROM ${this.tableName}`
        );
    }

    optimize(query: DatabaseQuery): DatabaseQuery {
        return {
            ...query,
            useCache: true,
            indexHints: [...new Set(query.indexHints)]
        };
    }

    getCacheKey(filterState: FilterState): string {
        const state = normalizeFilterState(filterState);
        const availability = state.availability.inStock && state.availability.outOfStock
            ? 'all'
            : state.availability.inStock
                ? 'in'
                : state.availability.outOfStock
                    ? 'out'
                    : 'any';

        return [
            `min:${state.priceRange.min ?? 'any'}`,
            `max:${state.priceRange.max ?? 'any'}`,
            `rating:${state.minRating ?? 'any'}`,
            `availability:${availability}`
        ].join('|');
    }

    getParams(filterState: FilterState): Record<string, number> {
        return this.buildQuery(filterState).parameters;
    }

    private buildDatabaseQuery(filterState: FilterState, baseQuery: string): DatabaseQuery {
        const state = normalizeFilterState(filterState);
        const conditions: string[] = [];
        const parameters: Record<string, number> = {};
        const indexHints: string[] = [];

        if (state.priceRange.min !== null) {
            conditions.push(`${this.priceColumn} >= :minPrice`);
            parameters.minPrice = state.priceRange.min;
            indexHints.push(this.priceColumn);
        }

        if (state.priceRange.max !== null) {
            conditions.push(`${this.priceColumn} <= :maxPrice`);
            parameters.maxPrice = state.priceRange.max;
            indexHints.push(this.priceColumn);
        }

        if (state.minRating !== null) {
            conditions.push(`${this.ratingColumn} >= :minRating`);
            conditions.push(`${this.ratingColumn} IS NOT NULL`);
            parameters.minRating = state.minRating;
            indexHints.push(this.ratingColumn);
        }

        if (state.availability.inStock && !state.availability.outOfStock) {
            conditions.push(`${this.inventoryColumn} > 0`);
            indexHints.push(this.inventoryColumn);
        } else if (!state.availability.inStock && state.availability.outOfStock) {
            conditions.push(`${this.inventoryColumn} = 0`);
            indexHints.push(this.inventoryColumn);
        }

        const sql = conditions.length === 0
            ? baseQuery
            : `${baseQuery}${this.whereJoiner(baseQuery)}${conditions.join(' AND ')}`;

        return this.optimize({
            sql,
            parameters,
            useCache: false,
            cacheKey: this.getCacheKey(state),
            indexHints
        });
    }

    private whereJoiner(baseQuery: string): string {
        return /\bwhere\b/i.test(baseQuery) ? ' AND ' : ' WHERE ';
    }
}

export default QueryBuilder;
