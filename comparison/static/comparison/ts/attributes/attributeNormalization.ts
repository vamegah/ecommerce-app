import {
  AttributeCategory,
  AttributeType,
  Product,
  ProductAttribute
} from '../types';

export interface CollectedAttribute {
  name: string;
  category: AttributeCategory;
  type: AttributeType;
}

export interface HighlightResult {
  attributeName: string;
  highlightedProductIds: Set<string>;
  direction: 'lowest' | 'highest' | 'none';
}

const CATEGORY_ORDER = [
  AttributeCategory.PRICING,
  AttributeCategory.SPECIFICATIONS,
  AttributeCategory.FEATURES,
  AttributeCategory.SHIPPING,
  AttributeCategory.GENERAL
];

function priorityFor(attribute: CollectedAttribute): number {
  const normalizedName = attribute.name.toLowerCase();
  if (normalizedName === 'price') {
    return 0;
  }
  if (normalizedName === 'rating') {
    return 1;
  }
  if (attribute.category === AttributeCategory.SPECIFICATIONS) {
    return 2;
  }
  if (attribute.category === AttributeCategory.FEATURES) {
    return 3;
  }
  if (attribute.category === AttributeCategory.SHIPPING) {
    return 4;
  }
  return 5;
}

export function collectAttributes(products: Product[]): CollectedAttribute[] {
  const attributesByName = new Map<string, CollectedAttribute>();

  products.forEach((product) => {
    product.attributes.forEach((attribute) => {
      if (!attributesByName.has(attribute.name)) {
        attributesByName.set(attribute.name, {
          name: attribute.name,
          category: attribute.category,
          type: attribute.type
        });
      }
    });
  });

  return [...attributesByName.values()].sort((left, right) => {
    const leftCategory = CATEGORY_ORDER.indexOf(left.category);
    const rightCategory = CATEGORY_ORDER.indexOf(right.category);
    if (leftCategory !== rightCategory) {
      return leftCategory - rightCategory;
    }

    const priorityDelta = priorityFor(left) - priorityFor(right);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return left.name.localeCompare(right.name);
  });
}

export function getAttributeValue(product: Product, attributeName: string): ProductAttribute | null {
  return product.attributes.find((attribute) => attribute.name === attributeName) ?? null;
}

export function groupAttributesByCategory(products: Product[]): Map<AttributeCategory, string[]> {
  const grouped = new Map<AttributeCategory, string[]>();

  collectAttributes(products).forEach((attribute) => {
    const names = grouped.get(attribute.category) ?? [];
    names.push(attribute.name);
    grouped.set(attribute.category, names);
  });

  return grouped;
}

function numericValueFor(product: Product, attributeName: string): { value: number; type: AttributeType } | null {
  if (attributeName.toLowerCase() === 'price') {
    return { value: product.price, type: AttributeType.CURRENCY };
  }

  const attribute = getAttributeValue(product, attributeName);
  if (!attribute || typeof attribute.value !== 'number') {
    return null;
  }

  return { value: attribute.value, type: attribute.type };
}

function shouldPreferLowest(attributeName: string, type: AttributeType): boolean {
  const normalizedName = attributeName.toLowerCase();
  return (
    type === AttributeType.CURRENCY ||
    normalizedName.includes('price') ||
    normalizedName.includes('cost') ||
    normalizedName.includes('shipping')
  );
}

export function highlightBestValue(attributeName: string, products: Product[]): HighlightResult {
  const values = products
    .map((product) => ({
      productId: product.id,
      numeric: numericValueFor(product, attributeName)
    }))
    .filter((entry): entry is { productId: string; numeric: { value: number; type: AttributeType } } => entry.numeric !== null);

  if (values.length === 0) {
    return { attributeName, highlightedProductIds: new Set(), direction: 'none' };
  }

  const preferLowest = shouldPreferLowest(attributeName, values[0].numeric.type);
  const bestValue = values.reduce((best, entry) => (
    preferLowest ? Math.min(best, entry.numeric.value) : Math.max(best, entry.numeric.value)
  ), values[0].numeric.value);

  return {
    attributeName,
    highlightedProductIds: new Set(
      values.filter((entry) => entry.numeric.value === bestValue).map((entry) => entry.productId)
    ),
    direction: preferLowest ? 'lowest' : 'highest'
  };
}

export async function checkProductAvailability(
  products: Product[],
  availabilityResolver: (product: Product) => boolean | Promise<boolean> = (product) => product.available
): Promise<Product[]> {
  const checkedProducts: Product[] = [];

  for (const product of products) {
    const available = await availabilityResolver(product);
    checkedProducts.push({ ...product, available });
  }

  return checkedProducts;
}
