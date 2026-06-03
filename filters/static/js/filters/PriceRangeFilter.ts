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
        const fieldset = document.createElement('fieldset');
        const legend = document.createElement('legend');
        const priceInputs = document.createElement('div');
        const separator = document.createElement('span');
        const error = document.createElement('div');

        fieldset.className = 'filter-group price-range-filter';

        legend.textContent = 'Price Range';

        priceInputs.className = 'price-inputs';
        separator.className = 'price-separator';
        separator.setAttribute('aria-hidden', 'true');
        separator.textContent = '-';
        priceInputs.append(
            this.createPriceInput('price-min', 'Minimum price'),
            separator,
            this.createPriceInput('price-max', 'Maximum price')
        );

        error.className = 'error-message';
        error.setAttribute('role', 'alert');
        error.setAttribute('aria-live', 'polite');

        fieldset.append(legend, priceInputs, error);
        this.container.replaceChildren(fieldset);
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

    private createPriceInput(id: string, ariaLabel: string): HTMLLabelElement {
        const label = document.createElement('label');
        const prefix = document.createElement('span');
        const input = document.createElement('input');

        label.className = 'price-input-label';
        label.htmlFor = id;

        prefix.className = 'currency-prefix';
        prefix.textContent = this.currencySymbol;

        input.type = 'number';
        input.id = id;
        input.min = '0';
        input.step = '0.01';
        input.inputMode = 'decimal';
        input.setAttribute('aria-label', ariaLabel);

        label.append(prefix, input);
        return label;
    }
}

export default PriceRangeFilter;
