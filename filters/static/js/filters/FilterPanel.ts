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
        const panel = document.createElement('aside');
        const header = document.createElement('div');
        const heading = document.createElement('h2');
        const toggleButton = document.createElement('button');
        const content = document.createElement('div');

        panel.className = 'filter-panel';
        panel.setAttribute('aria-label', 'Product filters');

        header.className = 'filter-header';

        heading.textContent = 'Filters';

        toggleButton.type = 'button';
        toggleButton.className = 'toggle-filters';
        toggleButton.setAttribute('aria-label', 'Toggle filters');
        toggleButton.setAttribute('aria-expanded', 'true');
        toggleButton.textContent = '-';

        content.className = 'filter-content';
        content.append(
            this.createContainer('price-filter-container'),
            this.createContainer('rating-filter-container'),
            this.createContainer('availability-filter-container'),
            this.createContainer('filter-summary-container')
        );

        header.append(heading, toggleButton);
        panel.append(header, content);
        this.container.replaceChildren(panel);
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

    private createContainer(id: string): HTMLDivElement {
        const container = document.createElement('div');
        container.id = id;
        return container;
    }
}

export default FilterPanel;
