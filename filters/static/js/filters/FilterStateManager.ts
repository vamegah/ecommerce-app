import { FilterState, PartialFilterState } from './types';
import {
    cloneFilterState,
    DEFAULT_FILTER_STATE,
    normalizeAvailability,
    normalizeFilterState,
    normalizeMinRating,
    normalizePriceRange,
    statesEqual
} from './filterUtils';

type StateChangeListener = (state: FilterState) => void;

class FilterStateManager {
    private state: FilterState;
    private listeners: Set<StateChangeListener> = new Set();

    constructor(initialState?: PartialFilterState) {
        this.state = initialState
            ? normalizeFilterState(initialState)
            : cloneFilterState(DEFAULT_FILTER_STATE);
    }

    getState(): FilterState {
        return cloneFilterState(this.state);
    }

    setPriceRange(min: number | null, max: number | null): void {
        this.commit({
            ...this.state,
            priceRange: normalizePriceRange({ min, max })
        });
    }

    setMinRating(rating: number | null): void {
        this.commit({
            ...this.state,
            minRating: normalizeMinRating(rating)
        });
    }

    setAvailability(inStock: boolean, outOfStock: boolean): void {
        this.commit({
            ...this.state,
            availability: normalizeAvailability({ inStock, outOfStock })
        });
    }

    clearPriceRange(): void {
        this.setPriceRange(null, null);
    }

    clearRating(): void {
        this.setMinRating(null);
    }

    clearAvailability(): void {
        this.setAvailability(false, false);
    }

    clearAll(): void {
        this.commit(cloneFilterState(DEFAULT_FILTER_STATE));
    }

    initialize(state: PartialFilterState, notify: boolean = true): void {
        const nextState = normalizeFilterState(state);
        this.state = nextState;

        if (notify) {
            this.notifyListeners();
        }
    }

    subscribe(listener: StateChangeListener): () => void {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    private commit(nextState: FilterState): void {
        if (statesEqual(this.state, nextState)) {
            return;
        }

        this.state = cloneFilterState(nextState);
        this.notifyListeners();
    }

    private notifyListeners(): void {
        const state = this.getState();
        this.listeners.forEach((listener) => listener(state));
    }
}

export default FilterStateManager;
