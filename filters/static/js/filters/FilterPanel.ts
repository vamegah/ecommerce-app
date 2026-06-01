class FilterPanel {
    private container: HTMLElement;
    private isCollapsed: boolean = false;
    private readonly breakpoint: number;
    private readonly resizeHandler: () => void;

    constructor(containerId: string, breakpoint: number = 768) {
        this.container = this.getContainer(containerId);
        this.breakpoint = breakpoint;
        this.resizeHandler = () => this.handleResize();
        this.render();
        this.attachEventListeners();
    }

    private render(): void {
        this.container.innerHTML = `
            <aside class="filter-panel" aria-label="Product filters">
                <div class="filter-header">
                    <h2>Filters</h2>
                    <button type="button" class="toggle-filters"
                        aria-label="Toggle filters" aria-expanded="true">-</button>
                </div>
                <div class="filter-content">
                    <div id="price-filter-container"></div>
                    <div id="rating-filter-container"></div>
                    <div id="availability-filter-container"></div>
                    <div id="filter-summary-container"></div>
                </div>
            </aside>
        `;
    }

    private attachEventListeners(): void {
        this.getToggleButton().addEventListener('click', () => {
            this.setCollapsed(!this.isCollapsed);
        });

        this.handleResize();

        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this.resizeHandler);
        }
    }

    private handleResize(): void {
        if (typeof window === 'undefined') {
            return;
        }

        const isMobile = window.innerWidth <= this.breakpoint;
        this.setCollapsed(isMobile, true);
    }

    private setCollapsed(collapsed: boolean, fromResize: boolean = false): void {
        const isMobile = typeof window !== 'undefined' ? window.innerWidth <= this.breakpoint : false;
        this.isCollapsed = isMobile ? collapsed : false;

        const filterContent = this.getFilterContent();
        const toggleButton = this.getToggleButton();

        filterContent.style.display = this.isCollapsed ? 'none' : 'block';
        toggleButton.textContent = this.isCollapsed ? '+' : '-';
        toggleButton.setAttribute('aria-expanded', (!this.isCollapsed).toString());

        if (!fromResize && !isMobile) {
            this.isCollapsed = false;
        }
    }

    destroy(): void {
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this.resizeHandler);
        }
    }

    private getToggleButton(): HTMLButtonElement {
        const button = this.container.querySelector<HTMLButtonElement>('.toggle-filters');
        if (!button) {
            throw new Error('Filter panel toggle button was not found');
        }
        return button;
    }

    private getFilterContent(): HTMLElement {
        const content = this.container.querySelector<HTMLElement>('.filter-content');
        if (!content) {
            throw new Error('Filter panel content was not found');
        }
        return content;
    }

    private getContainer(containerId: string): HTMLElement {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Filter panel container "${containerId}" was not found`);
        }
        return container;
    }
}

export default FilterPanel;
