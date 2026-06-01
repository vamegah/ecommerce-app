import { AvailabilityFilter as AvailabilityFilterType } from './types';

class AvailabilityFilter {
    private container: HTMLElement;
    private inStockCheckbox!: HTMLInputElement;
    private outOfStockCheckbox!: HTMLInputElement;
    private readonly onChange: (inStock: boolean, outOfStock: boolean) => void;

    constructor(containerId: string, onChange: (inStock: boolean, outOfStock: boolean) => void) {
        this.container = this.getContainer(containerId);
        this.onChange = onChange;
        this.render();
        this.attachElements();
        this.attachEventListeners();
    }

    private render(): void {
        this.container.innerHTML = `
            <fieldset class="filter-group availability-filter">
                <legend>Availability</legend>
                <div class="availability-options">
                    <label class="checkbox-option" for="in-stock">
                        <input type="checkbox" id="in-stock" aria-label="In stock items" />
                        <span>In Stock</span>
                    </label>
                    <label class="checkbox-option" for="out-of-stock">
                        <input type="checkbox" id="out-of-stock" aria-label="Out of stock items" />
                        <span>Out of Stock</span>
                    </label>
                </div>
            </fieldset>
        `;
    }

    private attachElements(): void {
        this.inStockCheckbox = this.requireElement<HTMLInputElement>('#in-stock');
        this.outOfStockCheckbox = this.requireElement<HTMLInputElement>('#out-of-stock');
    }

    private attachEventListeners(): void {
        this.inStockCheckbox.addEventListener('change', () => this.handleChange());
        this.outOfStockCheckbox.addEventListener('change', () => this.handleChange());
    }

    private handleChange(): void {
        this.onChange(this.inStockCheckbox.checked, this.outOfStockCheckbox.checked);
    }

    setValue(availability: AvailabilityFilterType): void {
        this.inStockCheckbox.checked = availability.inStock;
        this.outOfStockCheckbox.checked = availability.outOfStock;
    }

    private getContainer(containerId: string): HTMLElement {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Availability filter container "${containerId}" was not found`);
        }
        return container;
    }

    private requireElement<T extends Element>(selector: string): T {
        const element = this.container.querySelector<T>(selector);
        if (!element) {
            throw new Error(`Availability filter element "${selector}" was not found`);
        }
        return element;
    }
}

export default AvailabilityFilter;
