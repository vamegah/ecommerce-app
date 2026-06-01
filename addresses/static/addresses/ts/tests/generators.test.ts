/**
 * Tests for property-based testing generators
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  usZipCode,
  canadianPostalCode,
  ukPostcode,
  validAddressInput,
  invalidAddressInput,
  userId,
  addressId,
  address,
} from './generators';

describe('Test Data Generators', () => {
  it('should generate valid US ZIP codes', () => {
    fc.assert(
      fc.property(usZipCode(), (zip) => {
        // Should match either 5-digit or 5+4 format
        return /^\d{5}(-\d{4})?$/.test(zip);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate valid Canadian postal codes', () => {
    fc.assert(
      fc.property(canadianPostalCode(), (postal) => {
        // Should match A1A 1A1 format
        return /^[A-Z]\d[A-Z] \d[A-Z]\d$/.test(postal);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate valid UK postcodes', () => {
    fc.assert(
      fc.property(ukPostcode(), (postcode) => {
        // Should match UK postcode patterns
        return /^[A-Z]\d{1,2} \d[A-Z]{2}$/.test(postcode);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate valid address inputs with all required fields', () => {
    fc.assert(
      fc.property(validAddressInput(), (input) => {
        return (
          input.street.length > 0 &&
          input.city.length > 0 &&
          input.postalCode.length > 0 &&
          input.country.length > 0
        );
      }),
      { numRuns: 100 }
    );
  });

  it('should generate invalid address inputs', () => {
    fc.assert(
      fc.property(invalidAddressInput(), (input) => {
        // At least one required field should be missing, empty, or whitespace-only
        const hasEmptyOrMissingField =
          !input.street ||
          input.street.trim() === '' ||
          !input.city ||
          input.city.trim() === '' ||
          !input.postalCode ||
          input.postalCode.trim() === '' ||
          !input.country ||
          input.country.trim() === '';
        
        // Or postal code is invalid format (not matching any country pattern)
        const hasInvalidPostalCode = 
          input.postalCode === 'INVALID' ||
          Boolean(input.postalCode && !/^\d{5}(-\d{4})?$|^[A-Z]\d[A-Z] \d[A-Z]\d$|^[A-Z]\d{1,2} \d[A-Z]{2}$/.test(input.postalCode));
        
        return hasEmptyOrMissingField || hasInvalidPostalCode;
      }),
      { numRuns: 100 }
    );
  });

  it('should generate valid user IDs', () => {
    fc.assert(
      fc.property(userId(), (id) => {
        // Should be a valid UUID format
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate valid address IDs', () => {
    fc.assert(
      fc.property(addressId(), (id) => {
        // Should be a valid UUID format
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate complete address objects', () => {
    fc.assert(
      fc.property(address(), (addr) => {
        return (
          addr.id.length > 0 &&
          addr.userId.length > 0 &&
          addr.street.length > 0 &&
          addr.city.length > 0 &&
          addr.postalCode.length > 0 &&
          addr.country.length > 0 &&
          typeof addr.isDefault === 'boolean' &&
          addr.createdAt instanceof Date &&
          addr.updatedAt instanceof Date
        );
      }),
      { numRuns: 100 }
    );
  });
});
