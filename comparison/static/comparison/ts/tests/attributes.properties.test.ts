import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  checkProductAvailability,
  collectAttributes,
  getAttributeValue,
  groupAttributesByCategory,
  highlightBestValue
} from '../attributes/attributeNormalization';
import { AttributeCategory, AttributeType, Product } from '../types';
import { productArbitrary } from './generators';

describe('Attribute normalization and comparison logic', () => {
  it('Feature: product-comparison, Property 9: All Unique Attributes Are Displayed', () => {
    fc.assert(fc.property(
      fc.uniqueArray(productArbitrary, { minLength: 1, maxLength: 4, selector: (product) => product.id }),
      (products) => {
        const expectedNames = new Set(products.flatMap((product) => product.attributes.map((attribute) => attribute.name)));
        const collectedNames = new Set(collectAttributes(products).map((attribute) => attribute.name));

        expect(collectedNames).toEqual(expectedNames);
        products.forEach((product) => {
          expectedNames.forEach((name) => {
            const value = getAttributeValue(product, name);
            expect(value === null || value.name === name).toBe(true);
          });
        });
      }
    ), { numRuns: 100 });
  });

  it('Feature: product-comparison, Property 14: Attributes Are Grouped by Category', () => {
    fc.assert(fc.property(
      fc.uniqueArray(productArbitrary, { minLength: 1, maxLength: 4, selector: (product) => product.id }),
      (products) => {
        const grouped = groupAttributesByCategory(products);

        for (const [category, names] of grouped.entries()) {
          names.forEach((name) => {
            const collected = collectAttributes(products).find((attribute) => attribute.name === name);
            expect(collected?.category).toBe(category);
          });
        }
      }
    ), { numRuns: 100 });
  });

  it('Feature: product-comparison, Property 11: Best Numeric Values Are Highlighted', () => {
    fc.assert(fc.property(
      fc.uniqueArray(productArbitrary, { minLength: 2, maxLength: 4, selector: (product) => product.id }),
      (generatedProducts) => {
        const products: Product[] = generatedProducts.map((product, index) => ({
          ...product,
          attributes: [
            ...product.attributes.filter((attribute) => attribute.name !== 'Rating'),
            {
              name: 'Rating',
              value: index + 1,
              category: AttributeCategory.GENERAL,
              type: AttributeType.RATING
            }
          ]
        }));
        const result = highlightBestValue('Rating', products);
        const expectedBestId = products.at(-1)!.id;

        expect(result.direction).toBe('highest');
        expect(result.highlightedProductIds.has(expectedBestId)).toBe(true);
      }
    ), { numRuns: 100 });
  });

  it('highlights the lowest price when comparing prices', () => {
    const products = fc.sample(
      fc.uniqueArray(productArbitrary, { minLength: 2, maxLength: 4, selector: (product) => product.id }),
      1
    )[0].map((product, index) => ({ ...product, price: index + 10 }));

    const result = highlightBestValue('Price', products);

    expect(result.direction).toBe('lowest');
    expect(result.highlightedProductIds).toEqual(new Set([products[0].id]));
  });

  it('Feature: product-comparison, Property 17: Unavailable Products Are Marked', async () => {
    await fc.assert(fc.asyncProperty(
      fc.uniqueArray(productArbitrary, { minLength: 1, maxLength: 4, selector: (product) => product.id }),
      async (products) => {
        const checked = await checkProductAvailability(products, (product) => product.id !== products[0].id);

        expect(checked[0].available).toBe(false);
        expect(checked.slice(1).every((product) => product.available)).toBe(true);
        expect(checked.map((product) => product.id)).toEqual(products.map((product) => product.id));
      }
    ), { numRuns: 100 });
  });
});
