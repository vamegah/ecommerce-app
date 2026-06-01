import { PriceRange } from './types';

class PriceRangeFilter {
    private container: HTMLElement;
    private minInput!: HTMLInputElement;
    private maxInput!: HTMLInputElement;
    private errorDiv!: HTMLElement;
    private readonly onChange: (min: number | null, max: number | null) => void;
    private readonly currencySymbol: string;

    constructor(
        containerId: string,
        onChange: (min: number | null, max: number | null) => void,
        currencySymbol: string = '$'
    ) {
        this.container = this.getContainer(containerId);
        this.onChange = onChange;
        this.currencySymbol = currencySymbol;
        this.render();
        this.attachElements();
        this.attachEventListeners();
    }

    private render(): void {
        this.container.innerHTML = `
            <fieldset class="filter-group price-range-filter">
                <legend>Price Range</legend>
                <div class="price-inputs">
                    <label class="price-input-label" for="price-min">
                        <span class="currency-prefix">${this.currencySymbol}</span>
                        <input type="number" id="price-min" min="0" step="0.01"
                            inputmode="decimal" aria-label="Minimum price" />
                    </label>
                    <span class="price-separator" aria-hidden="true">-</span>
                    <label class="price-input-label" for="price-max">
                        <span class="currency-prefix">${this.currencySymbol}</span>
                        <input type="number" id="price-max" min="0" step="0.01"
                            inputmode="decimal" aria-label="Maximum price" />
                    </label>
                </div>
                <div class="error-message" role="alert" aria-live="polite"></div>
            </fieldset>
        `;
    }

    private attachElements(): void {
        this.minInput = this.requireElement<HTMLInputElement>('#price-min');
        this.maxInput = this.requireElement<HTMLInputElement>('#price-max');
        this.errorDiv = this.requireElement<HTMLElement>('.error-message');
    }

    private attachEventListeners(): void {
        this.minInput.addEventListener('input', () => this.handleChange());
        this.maxInput.addEventListener('input', () => this.handleChange());
    }

    private handleChange(): void {
        const min = this.parsePrice(this.minInput.value);
        const max = this.parsePrice(this.maxInput.value);

        if (min === undefined || max === undefined) {
            this.showError('Enter a valid price');
            return;
        }

        if (min !== null && min < 0) {
            this.showError('Price cannot be negative');
            return;
        }

        if (max !== null && max < 0) {
            this.showError('Price cannot be negative');
            return;
        }

        if (min !== null && max !== null && min > max) {
            this.showError('Minimum price cannot exceed maximum price');
            return;
        }

        this.clearError();
        this.onChange(min, max);
    }

    private parsePrice(value: string): number | null | undefined {
        if (value.trim() === '') {
            return null;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    private showError(message: string): void {
        this.errorDiv.textContent = message;
        this.errorDiv.style.display = 'block';
        this.minInput.setAttribute('aria-invalid', 'true');
        this.maxInput.setAttribute('aria-invalid', 'true');
    }

    private clearError(): void {
        this.errorDiv.textContent = '';
        this.errorDiv.style.display = 'none';
        this.minInput.setAttribute('aria-invalid', 'false');
        this.maxInput.setAttribute('aria-invalid', 'false');
    }

    setValue(priceRange: PriceRange): void {
        this.minInput.value = priceRange.min !== null ? priceRange.min.toString() : '';
        this.maxInput.value = priceRange.max !== null ? priceRange.max.toString() : '';
        this.clearError();
    }

    private getContainer(containerId: string): HTMLElement {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Price range filter container "${containerId}" was not found`);
        }
        return container;
    }

    private requireElement<T extends Element>(selector: string): T {
        const element = this.container.querySelector<T>(selector);
        if (!element) {
            throw new Error(`Price range filter element "${selector}" was not found`);
        }
        return element;
    }
}

export default PriceRangeFilter;
