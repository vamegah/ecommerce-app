import * as fc from 'fast-check';
import {
  AttributeCategory,
  AttributeType,
  Comparison,
  Product,
  ProductAttribute
} from '../types';

const attributeNames = [
  'Price',
  'Rating',
  'Weight',
  'Color',
  'Warranty',
  'Free Shipping',
  'Material',
  'Battery Life'
];

export const attributeArbitrary: fc.Arbitrary<ProductAttribute> = fc.record({
  name: fc.constantFrom(...attributeNames),
  value: fc.oneof(
    fc.string({ minLength: 1, maxLength: 140 }),
    fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
    fc.boolean()
  ),
  category: fc.constantFrom(...Object.values(AttributeCategory)),
  type: fc.constantFrom(...Object.values(AttributeType))
}).map((attribute) => {
  if (typeof attribute.value === 'boolean') {
    return { ...attribute, type: AttributeType.BOOLEAN };
  }
  if (typeof attribute.value === 'number') {
    const type = attribute.name === 'Price' ? AttributeType.CURRENCY : AttributeType.NUMBER;
    return { ...attribute, type };
  }
  return { ...attribute, type: AttributeType.TEXT };
});

export const productArbitrary: fc.Arbitrary<Product> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 80 }),
  price: fc.integer({ min: 1, max: 10000 }),
  imageUrl: fc.webUrl(),
  attributes: fc.uniqueArray(attributeArbitrary, {
    minLength: 1,
    maxLength: 8,
    selector: (attribute) => attribute.name
  }),
  available: fc.boolean()
});

export const comparisonArbitrary: fc.Arbitrary<Comparison> = fc.record({
  id: fc.uuid(),
  products: fc.uniqueArray(productArbitrary, {
    minLength: 0,
    maxLength: 4,
    selector: (product) => product.id
  }),
  createdAt: fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-01-01T00:00:00Z') }),
  updatedAt: fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-01-01T00:00:00Z') }),
  userId: fc.option(fc.uuid(), { nil: undefined })
});

export function withoutProductId(existingIds: Set<string>): fc.Arbitrary<Product> {
  return productArbitrary.filter((product) => !existingIds.has(product.id));
}

export function normalizeComparison(comparison: Comparison): unknown {
  return {
    ...comparison,
    createdAt: comparison.createdAt.toISOString(),
    updatedAt: comparison.updatedAt.toISOString(),
    products: comparison.products.map((product) => ({
      ...product,
      attributes: [...product.attributes].sort((left, right) => left.name.localeCompare(right.name))
    }))
  };
}
