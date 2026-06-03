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
        const fieldset = document.createElement('fieldset');
        const legend = document.createElement('legend');
        const options = document.createElement('div');

        fieldset.className = 'filter-group availability-filter';
        legend.textContent = 'Availability';
        options.className = 'availability-options';
        options.append(
            this.createOption('in-stock', 'In stock items', 'In Stock'),
            this.createOption('out-of-stock', 'Out of stock items', 'Out of Stock')
        );

        fieldset.append(legend, options);
        this.container.replaceChildren(fieldset);
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

    private createOption(id: string, ariaLabel: string, label: string): HTMLLabelElement {
        const option = document.createElement('label');
        const checkbox = document.createElement('input');
        const text = document.createElement('span');

        option.className = 'checkbox-option';
        option.htmlFor = id;

        checkbox.type = 'checkbox';
        checkbox.id = id;
        checkbox.setAttribute('aria-label', ariaLabel);

        text.textContent = label;

        option.append(checkbox, text);
        return option;
    }
}

export default AvailabilityFilter;
