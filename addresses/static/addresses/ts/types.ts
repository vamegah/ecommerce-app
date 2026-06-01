/**
 * Core type definitions for the Multi-Address Management System
 */

/**
 * Address input data structure for creating or updating addresses
 */
export type AddressInput = {
  street: string;
  apartment?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  companyName?: string;
  phoneNumber?: string;
};

/**
 * Complete address model with metadata
 */
export type Address = {
  id: string;
  userId: string;
  street: string;
  apartment?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  companyName?: string;
  phoneNumber?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Validation error for a specific field
 */
export type ValidationError = {
  field: string;
  message: string;
  code: string;
};

/**
 * Result type for operations that can succeed or fail
 */
export type Result<T, E> = 
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Validation result containing validation status and errors
 */
export type ValidationResult = {
  isValid: boolean;
  errors: ValidationError[];
};

/**
 * Error codes for validation failures
 */
export enum ValidationErrorCode {
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
  INVALID_POSTAL_CODE = 'INVALID_POSTAL_CODE',
  WHITESPACE_ONLY = 'WHITESPACE_ONLY',
  INVALID_COUNTRY = 'INVALID_COUNTRY',
  FIELD_TOO_LONG = 'FIELD_TOO_LONG',
}

/**
 * Error types for address operations
 */
export type AddressNotFoundError = {
  code: 'ADDRESS_NOT_FOUND';
  message: string;
  addressId: string;
};

export type StorageError = {
  code: 'STORAGE_ERROR';
  message: string;
  operation: string;
};

export type UnauthorizedError = {
  code: 'UNAUTHORIZED';
  message: string;
};

/**
 * Address selection data for checkout
 */
export type AddressSelectionData = {
  addresses: Address[];
  defaultAddressId: string | null;
};
