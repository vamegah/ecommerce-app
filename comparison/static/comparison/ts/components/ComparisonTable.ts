import {
  AttributeType,
  Comparison,
  Product,
  ProductAttribute
} from '../types';
import {
  collectAttributes,
  getAttributeValue,
  highlightBestValue
} from '../attributes/attributeNormalization';

export interface ComparisonTableProps {
  comparison: Comparison;
  onRemoveProduct?: (productId: string) => void;
  onShare?: () => void | Promise<void>;
}

export interface RenderedAttributeValue {
  text: string;
  type: AttributeType | 'missing';
  missing: boolean;
  highlighted: boolean;
  truncated: boolean;
  icon?: 'check' | 'x';
  fullText?: string;
}

export interface ProductColumn {
  productId: string;
  imageUrl: string;
  name: string;
  price: string;
  available: boolean;
}

export interface ComparisonTableRow {
  attributeName: string;
  values: RenderedAttributeValue[];
}

export interface ComparisonTableView {
  type: 'comparison-table' | 'empty';
  headers: string[];
  products: ProductColumn[];
  rows: ComparisonTableRow[];
  emptyMessage?: string;
  canShare: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function renderAttributeValue(
  attribute: ProductAttribute | null,
  highlighted = false,
  maxTextLength = 80
): RenderedAttributeValue {
  if (!attribute) {
    return {
      text: 'N/A',
      type: 'missing',
      missing: true,
      highlighted: false,
      truncated: false
    };
  }

  if (attribute.type === AttributeType.BOOLEAN || typeof attribute.value === 'boolean') {
    const value = Boolean(attribute.value);
    return {
      text: value ? 'Yes' : 'No',
      type: AttributeType.BOOLEAN,
      missing: false,
      highlighted,
      truncated: false,
      icon: value ? 'check' : 'x'
    };
  }

  if (attribute.type === AttributeType.CURRENCY && typeof attribute.value === 'number') {
    return {
      text: formatPrice(attribute.value),
      type: AttributeType.CURRENCY,
      missing: false,
      highlighted,
      truncated: false
    };
  }

  if (attribute.type === AttributeType.RATING && typeof attribute.value === 'number') {
    return {
      text: `${attribute.value.toFixed(1)} / 5`,
      type: AttributeType.RATING,
      missing: false,
      highlighted,
      truncated: false
    };
  }

  const rawText = String(attribute.value);
  const truncated = rawText.length > maxTextLength;
  return {
    text: truncated ? `${rawText.slice(0, maxTextLength - 3)}...` : rawText,
    type: attribute.type,
    missing: false,
    highlighted,
    truncated,
    fullText: truncated ? rawText : undefined
  };
}

export class ComparisonTable {
  constructor(private readonly props: ComparisonTableProps) {}

  render(): ComparisonTableView {
    const products = this.props.comparison.products;

    if (products.length === 0) {
      return {
        type: 'empty',
        headers: [],
        products: [],
        rows: [],
        emptyMessage: 'Add products to compare side by side.',
        canShare: false
      };
    }

    const attributes = collectAttributes(products);
    return {
      type: 'comparison-table',
      headers: ['Attribute', ...products.map((product) => product.name)],
      products: products.map((product) => this.renderProductColumn(product)),
      rows: attributes.map((attribute) => this.renderAttributeRow(attribute.name)),
      canShare: true
    };
  }

  renderProductColumn(product: Product): ProductColumn {
    return {
      productId: product.id,
      imageUrl: product.imageUrl || '/static/images/items/1.jpg',
      name: product.name,
      price: formatPrice(product.price),
      available: product.available
    };
  }

  renderAttributeRow(attributeName: string): ComparisonTableRow {
    const products = this.props.comparison.products;
    const highlights = highlightBestValue(attributeName, products).highlightedProductIds;

    return {
      attributeName,
      values: products.map((product) => renderAttributeValue(
        getAttributeValue(product, attributeName),
        highlights.has(product.id)
      ))
    };
  }

  triggerRemoveProduct(productId: string): void {
    this.props.onRemoveProduct?.(productId);
  }

  async triggerShare(): Promise<void> {
    await this.props.onShare?.();
  }

  toHtml(): string {
    const view = this.render();
    if (view.type === 'empty') {
      return `<div class="comparison-empty">${escapeHtml(view.emptyMessage ?? '')}</div>`;
    }

    const productHeader = view.products.map((product) => `
      <th scope="col" class="comparison-product ${product.available ? '' : 'comparison-product-unavailable'}">
        <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" class="comparison-product-image">
        <strong>${escapeHtml(product.name)}</strong>
        <span>${escapeHtml(product.price)}</span>
        ${product.available ? '' : '<span class="comparison-unavailable">Unavailable</span>'}
        <button type="button" class="btn btn-sm btn-outline-danger" data-compare-remove="${escapeHtml(product.productId)}">Remove</button>
      </th>`).join('');

    const body = view.rows.map((row) => `
      <tr>
        <th scope="row">${escapeHtml(row.attributeName)}</th>
        ${row.values.map((value) => `
          <td class="${value.highlighted ? 'comparison-best-value' : ''} ${value.missing ? 'comparison-missing-value' : ''}" title="${escapeHtml(value.fullText ?? value.text)}">
            ${escapeHtml(value.text)}
          </td>`).join('')}
      </tr>`).join('');

    return `
      <div class="comparison-actions">
        <button type="button" class="btn btn-primary" data-compare-share>Share comparison</button>
      </div>
      <div class="table-responsive comparison-table-wrap">
        <table class="table table-bordered comparison-table">
          <thead><tr><th scope="col">Attribute</th>${productHeader}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }
}
