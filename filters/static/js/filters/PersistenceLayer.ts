import { FilterState } from './types';
import { normalizeFilterState } from './filterUtils';

interface StoredFilterState {
    version: 1;
    filters: FilterState;
    timestamp: number;
}

class PersistenceLayer {
    private readonly storageKey: string;
    private readonly version = 1;
    private readonly storageOverride?: Storage | null;

    constructor(storage?: Storage | null, storageKey: string = 'search_filters_v1') {
        this.storageOverride = storage;
        this.storageKey = storageKey;
    }

    saveFilters(filterState: FilterState): void {
        const storage = this.getStorage();
        if (!storage) {
            return;
        }

        try {
            const payload: StoredFilterState = {
                version: this.version,
                filters: normalizeFilterState(filterState),
                timestamp: Date.now()
            };

            storage.setItem(this.storageKey, JSON.stringify(payload));
        } catch (error) {
            this.logStorageError('save filters', error);
        }
    }

    loadFilters(): FilterState | null {
        const storage = this.getStorage();
        if (!storage) {
            return null;
        }

        try {
            const serialized = storage.getItem(this.storageKey);
            if (!serialized) {
                return null;
            }

            const parsed = JSON.parse(serialized);
            const filters = this.extractFilters(parsed);
            return normalizeFilterState(filters);
        } catch (error) {
            this.logStorageError('load filters', error);
            this.clearFilters();
            return null;
        }
    }

    clearFilters(): void {
        const storage = this.getStorage();
        if (!storage) {
            return;
        }

        try {
            storage.removeItem(this.storageKey);
        } catch (error) {
            this.logStorageError('clear filters', error);
        }
    }

    hasFilters(): boolean {
        const storage = this.getStorage();
        if (!storage) {
            return false;
        }

        try {
            return storage.getItem(this.storageKey) !== null;
        } catch (error) {
            this.logStorageError('check filters', error);
            return false;
        }
    }

    private extractFilters(parsed: unknown): FilterState {
        if (this.isStoredFilterState(parsed)) {
            return parsed.filters;
        }

        if (this.looksLikeLegacyFilterState(parsed)) {
            return parsed as FilterState;
        }

        throw new Error('Saved filters have an invalid structure');
    }

    private isStoredFilterState(value: unknown): value is StoredFilterState {
        const candidate = value as StoredFilterState;
        return Boolean(candidate) &&
            candidate.version === this.version &&
            typeof candidate.timestamp === 'number' &&
            Boolean(candidate.filters);
    }

    private looksLikeLegacyFilterState(value: unknown): boolean {
        const candidate = value as Partial<FilterState>;
        return Boolean(candidate) &&
            Boolean(candidate.priceRange) &&
            Boolean(candidate.availability);
    }

    private getStorage(): Storage | null {
        if (this.storageOverride !== undefined) {
            return this.storageOverride;
        }

        try {
            return typeof localStorage === 'undefined' ? null : localStorage;
        } catch (error) {
            return null;
        }
    }

    private logStorageError(action: string, error: unknown): void {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn(`Failed to ${action}:`, error);
        }
    }
}

export default PersistenceLayer;
