import { describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';
import { ComparisonTable, renderAttributeValue } from '../components/ComparisonTable';
import { ComparisonIndicator, createAdditionFeedback } from '../components/ComparisonIndicator';
import { AttributeCategory, AttributeType, Comparison } from '../types';
import { collectAttributes } from '../attributes/attributeNormalization';
import { comparisonArbitrary, productArbitrary } from './generators';

describe('Comparison UI render models', () => {
  it('Feature: product-comparison, Property 8: Comparison Table Structure is Consistent', () => {
    fc.assert(fc.property(
      comparisonArbitrary.filter((comparison) => comparison.products.length > 0),
      (comparison) => {
        const view = new ComparisonTable({ comparison }).render();

        expect(view.type).toBe('comparison-table');
        expect(view.headers).toHaveLength(comparison.products.length + 1);
        view.rows.forEach((row) => {
          expect(row.values).toHaveLength(comparison.products.length);
        });
      }
    ), { numRuns: 100 });
  });

  it('Feature: product-comparison, Property 10: Essential Product Information is Displayed', () => {
    fc.assert(fc.property(
      comparisonArbitrary.filter((comparison) => comparison.products.length > 0),
      (comparison) => {
        const view = new ComparisonTable({ comparison }).render();

        comparison.products.forEach((product) => {
          const column = view.products.find((candidate) => candidate.productId === product.id);
          expect(column).toMatchObject({
            name: product.name,
            imageUrl: product.imageUrl,
            available: product.available
          });
          expect(column?.price).toContain(String(product.price));
        });
      }
    ), { numRuns: 100 });
  });

  it('renders missing values as N/A and includes all collected attributes', () => {
    const comparison: Comparison = {
      id: 'comparison',
      createdAt: new Date('2026-05-26T12:00:00Z'),
      updatedAt: new Date('2026-05-26T12:00:00Z'),
      products: [
        {
          id: 'a',
          name: 'A',
          price: 20,
          imageUrl: '/a.jpg',
          available: true,
          attributes: [{ name: 'Warranty', value: '1 year', category: AttributeCategory.GENERAL, type: AttributeType.TEXT }]
        },
        {
          id: 'b',
          name: 'B',
          price: 30,
          imageUrl: '/b.jpg',
          available: true,
          attributes: [{ name: 'Battery Life', value: 12, category: AttributeCategory.SPECIFICATIONS, type: AttributeType.NUMBER }]
        }
      ]
    };

    const view = new ComparisonTable({ comparison }).render();
    expect(view.rows.map((row) => row.attributeName)).toEqual(collectAttributes(comparison.products).map((attribute) => attribute.name));
    expect(view.rows.some((row) => row.values.some((value) => value.text === 'N/A'))).toBe(true);
  });

  it('Feature: product-comparison, Property 12: Boolean Attributes Render Consistently', () => {
    fc.assert(fc.property(fc.boolean(), (value) => {
      const rendered = renderAttributeValue({
        name: 'Free Shipping',
        value,
        category: AttributeCategory.SHIPPING,
        type: AttributeType.BOOLEAN
      });

      expect(rendered.icon).toBe(value ? 'check' : 'x');
      expect(rendered.text).toBe(value ? 'Yes' : 'No');
    }), { numRuns: 100 });
  });

  it('Feature: product-comparison, Property 13: Long Text Attributes Are Handled', () => {
    fc.assert(fc.property(fc.string({ minLength: 81, maxLength: 200 }), (longText) => {
      const rendered = renderAttributeValue({
        name: 'Description',
        value: longText,
        category: AttributeCategory.GENERAL,
        type: AttributeType.TEXT
      });

      expect(rendered.truncated).toBe(true);
      expect(rendered.text.length).toBeLessThanOrEqual(80);
      expect(rendered.fullText).toBe(longText);
    }), { numRuns: 100 });
  });

  it('supports remove and share callbacks plus empty comparison display', async () => {
    const comparison = fc.sample(comparisonArbitrary.filter((candidate) => candidate.products.length > 0), 1)[0];
    const onRemoveProduct = vi.fn();
    const onShare = vi.fn();
    const table = new ComparisonTable({ comparison, onRemoveProduct, onShare });

    table.triggerRemoveProduct(comparison.products[0].id);
    await table.triggerShare();

    expect(onRemoveProduct).toHaveBeenCalledWith(comparison.products[0].id);
    expect(onShare).toHaveBeenCalledOnce();

    const emptyView = new ComparisonTable({
      comparison: { ...comparison, products: [] }
    }).render();
    expect(emptyView.type).toBe('empty');
    expect(emptyView.emptyMessage).toContain('Add products');
  });

  it('Feature: product-comparison, Property 22: Comparison Indicator Shows Correct Count', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 4 }), (productCount) => {
      const view = new ComparisonIndicator({ productCount }).render();

      expect(view.productCount).toBe(productCount);
      expect(view.label).toContain(String(productCount));
      expect(view.label).toContain('4');
    }), { numRuns: 100 });
  });

  it('Feature: product-comparison, Property 23: Modification Feedback is Provided', () => {
    fc.assert(fc.property(productArbitrary, fc.integer({ min: 1, max: 4 }), (product, count) => {
      const feedback = createAdditionFeedback(product, count);

      expect(feedback.level).toBe('success');
      expect(feedback.message).toContain(product.name);
      expect(feedback.message).toContain(String(count));
    }), { numRuns: 100 });
  });
});
