import { ComparisonNotification, MAX_COMPARISON_PRODUCTS, Product } from '../types';

export interface ComparisonIndicatorProps {
  productCount: number;
  maxProducts?: number;
  onClick?: () => void;
}

export interface ComparisonIndicatorView {
  label: string;
  productCount: number;
  maxProducts: number;
  atLimit: boolean;
  disabled: boolean;
}

export class ComparisonIndicator {
  private readonly maxProducts: number;

  constructor(private readonly props: ComparisonIndicatorProps) {
    this.maxProducts = props.maxProducts ?? MAX_COMPARISON_PRODUCTS;
  }

  render(): ComparisonIndicatorView {
    return {
      label: `${this.props.productCount} / ${this.maxProducts}`,
      productCount: this.props.productCount,
      maxProducts: this.maxProducts,
      atLimit: this.props.productCount >= this.maxProducts,
      disabled: this.props.productCount === 0
    };
  }

  triggerClick(): void {
    this.props.onClick?.();
  }

  toHtml(): string {
    const view = this.render();
    return `
      <button type="button" class="comparison-indicator ${view.atLimit ? 'comparison-indicator-full' : ''}" data-compare-indicator>
        <i class="fa fa-balance-scale"></i>
        <span class="comparison-indicator-count">${view.label}</span>
      </button>`;
  }
}

export function createAdditionFeedback(product: Product, productCount: number, maxProducts = MAX_COMPARISON_PRODUCTS): ComparisonNotification {
  return {
    level: 'success',
    message: `${product.name} added to comparison (${productCount}/${maxProducts}).`,
    recoverable: true
  };
}
