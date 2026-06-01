/**
 * Setup test to verify the project structure and type definitions
 */

import { describe, it, expect } from 'vitest';
import {
  AttributeCategory,
  AttributeType,
  ComparisonErrorCode,
  ComparisonError,
  type Product,
  type ProductAttribute,
  type Comparison,
  type ComparisonResult,
  type ValidationResult
} from '../types';

describe('Product Comparison - Setup and Type Definitions', () => {
  describe('Enums', () => {
    it('should define AttributeCategory enum with correct values', () => {
      expect(AttributeCategory.SPECIFICATIONS).toBe('SPECIFICATIONS');
      expect(AttributeCategory.PRICING).toBe('PRICING');
      expect(AttributeCategory.FEATURES).toBe('FEATURES');
      expect(AttributeCategory.SHIPPING).toBe('SHIPPING');
      expect(AttributeCategory.GENERAL).toBe('GENERAL');
    });

    it('should define AttributeType enum with correct values', () => {
      expect(AttributeType.TEXT).toBe('TEXT');
      expect(AttributeType.NUMBER).toBe('NUMBER');
      expect(AttributeType.BOOLEAN).toBe('BOOLEAN');
      expect(AttributeType.CURRENCY).toBe('CURRENCY');
      expect(AttributeType.RATING).toBe('RATING');
    });

    it('should define ComparisonErrorCode enum with correct values', () => {
      expect(ComparisonErrorCode.LIMIT_REACHED).toBe('LIMIT_REACHED');
      expect(ComparisonErrorCode.DUPLICATE_PRODUCT).toBe('DUPLICATE_PRODUCT');
      expect(ComparisonErrorCode.PRODUCT_NOT_FOUND).toBe('PRODUCT_NOT_FOUND');
      expect(ComparisonErrorCode.PERSISTENCE_FAILED).toBe('PERSISTENCE_FAILED');
      expect(ComparisonErrorCode.INVALID_SHARE_ID).toBe('INVALID_SHARE_ID');
      expect(ComparisonErrorCode.SHARE_EXPIRED).toBe('SHARE_EXPIRED');
    });
  });

  describe('Type Definitions', () => {
    it('should create a valid ProductAttribute', () => {
      const attribute: ProductAttribute = {
        name: 'Color',
        value: 'Blue',
        category: AttributeCategory.SPECIFICATIONS,
        type: AttributeType.TEXT
      };

      expect(attribute.name).toBe('Color');
      expect(attribute.value).toBe('Blue');
      expect(attribute.category).toBe(AttributeCategory.SPECIFICATIONS);
      expect(attribute.type).toBe(AttributeType.TEXT);
    });

    it('should create a valid Product', () => {
      const product: Product = {
        id: 'prod-123',
        name: 'Test Product',
        price: 99.99,
        imageUrl: 'https://example.com/image.jpg',
        attributes: [],
        available: true
      };

      expect(product.id).toBe('prod-123');
      expect(product.name).toBe('Test Product');
      expect(product.price).toBe(99.99);
      expect(product.available).toBe(true);
    });

    it('should create a valid Comparison', () => {
      const comparison: Comparison = {
        id: 'comp-123',
        products: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(comparison.id).toBe('comp-123');
      expect(comparison.products).toEqual([]);
      expect(comparison.createdAt).toBeInstanceOf(Date);
      expect(comparison.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a valid ComparisonResult', () => {
      const result: ComparisonResult = {
        success: true,
        comparison: {
          id: 'comp-123',
          products: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      expect(result.success).toBe(true);
      expect(result.comparison).toBeDefined();
    });

    it('should create a valid ValidationResult', () => {
      const validResult: ValidationResult = {
        valid: true
      };

      const invalidResult: ValidationResult = {
        valid: false,
        reason: 'Limit reached'
      };

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.reason).toBe('Limit reached');
    });
  });

  describe('ComparisonError', () => {
    it('should create a ComparisonError with correct properties', () => {
      const error = new ComparisonError(
        ComparisonErrorCode.LIMIT_REACHED,
        'Maximum comparison limit reached',
        true
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(ComparisonErrorCode.LIMIT_REACHED);
      expect(error.message).toBe('Maximum comparison limit reached');
      expect(error.recoverable).toBe(true);
      expect(error.name).toBe('ComparisonError');
    });

    it('should default recoverable to true', () => {
      const error = new ComparisonError(
        ComparisonErrorCode.DUPLICATE_PRODUCT,
        'Product already in comparison'
      );

      expect(error.recoverable).toBe(true);
    });
  });
});
