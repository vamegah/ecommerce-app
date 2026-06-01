import * as fs from 'fs';
import * as path from 'path';
import FilterPanel from '../FilterPanel';

describe('FilterPanel responsive behavior', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="filter-panel"></div>';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('renders a desktop sidebar/panel above the breakpoint', () => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
        new FilterPanel('filter-panel');

        expect(document.querySelector('.filter-panel')).not.toBeNull();
        expect((document.querySelector('.filter-content') as HTMLElement).style.display).toBe('block');
        expect(document.querySelector('.toggle-filters')?.getAttribute('aria-expanded')).toBe('true');
    });

    test('collapses by default at mobile widths and toggles open', () => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 320 });
        new FilterPanel('filter-panel');

        const content = document.querySelector('.filter-content') as HTMLElement;
        const toggle = document.querySelector('.toggle-filters') as HTMLButtonElement;

        expect(content.style.display).toBe('none');
        expect(toggle.getAttribute('aria-expanded')).toBe('false');

        toggle.click();

        expect(content.style.display).toBe('block');
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
    });

    test('responds to the 768px breakpoint', () => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 2560 });
        new FilterPanel('filter-panel');
        const content = document.querySelector('.filter-content') as HTMLElement;

        expect(content.style.display).toBe('block');

        window.innerWidth = 768;
        window.dispatchEvent(new Event('resize'));

        expect(content.style.display).toBe('none');
    });

    test('stylesheet keeps touch targets at least 44px', () => {
        const cssPath = path.join(process.cwd(), 'static', 'css', 'filters.css');
        const css = fs.readFileSync(cssPath, 'utf8');

        expect(css).toContain('min-width: 44px');
        expect(css).toContain('min-height: 44px');
    });
});
