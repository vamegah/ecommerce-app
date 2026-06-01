/**
 * Product Comparison Feature - Type Definitions
 * 
 * This module defines the core data models and enums for the product comparison system.
 */

/**
 * Enum for attribute categories used to group related attributes
 */
export enum AttributeCategory {
  SPECIFICATIONS = 'SPECIFICATIONS',
  PRICING = 'PRICING',
  FEATURES = 'FEATURES',
  SHIPPING = 'SHIPPING',
  GENERAL = 'GENERAL'
}

/**
 * Enum for attribute types to determine how values should be rendered
 */
export enum AttributeType {
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  CURRENCY = 'CURRENCY',
  RATING = 'RATING'
}

/**
 * Enum for comparison error codes
 */
export enum ComparisonErrorCode {
  LIMIT_REACHED = 'LIMIT_REACHED',
  DUPLICATE_PRODUCT = 'DUPLICATE_PRODUCT',
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  PERSISTENCE_FAILED = 'PERSISTENCE_FAILED',
  INVALID_SHARE_ID = 'INVALID_SHARE_ID',
  SHARE_EXPIRED = 'SHARE_EXPIRED'
}

export const MAX_COMPARISON_PRODUCTS = 4;

/**
 * Represents a product attribute with its value, category, and type
 */
export interface ProductAttribute {
  name: string;
  value: string | number | boolean;
  category: AttributeCategory;
  type: AttributeType;
}

/**
 * Represents a product that can be added to a comparison
 */
export interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  attributes: ProductAttribute[];
  available: boolean;
}

/**
 * Represents a comparison containing multiple products
 */
export interface Comparison {
  id: string;
  products: Product[];
  createdAt: Date;
  updatedAt: Date;
  userId?: string;  // Present for authenticated users
}

/**
 * Result type for comparison operations
 */
export interface ComparisonResult {
  success: boolean;
  comparison: Comparison;
  error?: ComparisonError;
}

/**
 * Validation result for checking if operations are allowed
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  error?: ComparisonError;
}

export interface ComparisonNotification {
  level: 'success' | 'info' | 'warning' | 'error';
  message: string;
  recoverable: boolean;
  code?: ComparisonErrorCode;
}

export interface PersistenceStrategy {
  save(comparison: Comparison): Promise<void>;
  load(): Promise<Comparison | null>;
  saveShared(comparison: Comparison): Promise<string>;
  loadShared(shareId: string): Promise<Comparison | null>;
}

/**
 * Error class for comparison operations
 */
export class ComparisonError extends Error {
  constructor(
    public code: ComparisonErrorCode,
    message: string,
    public recoverable: boolean = true,
    public details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ComparisonError';
  }
}
