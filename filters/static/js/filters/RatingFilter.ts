class RatingFilter {
    private container: HTMLElement;
    private readonly onChange: (rating: number | null) => void;
    private readonly ratings = [1, 2, 3, 4, 5];

    constructor(containerId: string, onChange: (rating: number | null) => void) {
        this.container = this.getContainer(containerId);
        this.onChange = onChange;
        this.render();
        this.attachEventListeners();
    }

    private render(): void {
        const fieldset = document.createElement('fieldset');
        const legend = document.createElement('legend');
        const options = document.createElement('div');

        fieldset.className = 'filter-group rating-filter';
        legend.textContent = 'Minimum Rating';

        options.className = 'rating-options';
        options.setAttribute('role', 'radiogroup');
        options.setAttribute('aria-label', 'Minimum rating filter');
        options.append(
            this.createRatingButton(null),
            ...this.ratings.map((rating) => this.createRatingButton(rating))
        );

        fieldset.append(legend, options);
        this.container.replaceChildren(fieldset);
    }

    private attachEventListeners(): void {
        this.getButtons().forEach((button) => {
            button.addEventListener('click', () => {
                this.onChange(this.getRatingFromButton(button));
            });

            button.addEventListener('keydown', (event) => this.handleKeyboard(event));
        });
    }

    setValue(rating: number | null): void {
        this.getButtons().forEach((button) => {
            const buttonRating = this.getRatingFromButton(button);
            const selected = buttonRating === rating;
            button.classList.toggle('selected', selected);
            button.setAttribute('aria-checked', selected.toString());
            button.tabIndex = selected ? 0 : -1;
        });
    }

    private handleKeyboard(event: KeyboardEvent): void {
        const buttons = this.getButtons();
        const currentIndex = buttons.indexOf(event.currentTarget as HTMLButtonElement);
        let nextIndex = currentIndex;

        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            nextIndex = (currentIndex + 1) % buttons.length;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
        } else if (event.key === 'Home') {
            nextIndex = 0;
        } else if (event.key === 'End') {
            nextIndex = buttons.length - 1;
        } else {
            return;
        }

        event.preventDefault();
        const nextButton = buttons[nextIndex];
        nextButton.focus();
        this.onChange(this.getRatingFromButton(nextButton));
    }

    private getButtons(): HTMLButtonElement[] {
        return Array.from(this.container.querySelectorAll<HTMLButtonElement>('.rating-option'));
    }

    private getRatingFromButton(button: HTMLButtonElement): number | null {
        const value = button.dataset.rating ?? '';
        return value === '' ? null : Number(value);
    }

    private getContainer(containerId: string): HTMLElement {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Rating filter container "${containerId}" was not found`);
        }
        return container;
    }

    private createRatingButton(rating: number | null): HTMLButtonElement {
        const button = document.createElement('button');
        const selected = rating === null;

        button.type = 'button';
        button.className = selected ? 'rating-option selected' : 'rating-option';
        button.dataset.rating = rating === null ? '' : rating.toString();
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-checked', selected.toString());
        button.setAttribute('aria-label', rating === null ? 'All ratings' : `${rating} stars and up`);
        button.textContent = rating === null ? 'All' : `${rating}+`;

        return button;
    }
}

export default RatingFilter;
