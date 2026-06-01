/**
 * Fast-check generators for property-based testing
 * These generators create random test data for addresses
 */

import * as fc from 'fast-check';
import { AddressInput, Address } from '../types';

/**
 * Generate a random valid US ZIP code
 */
export const usZipCode = (): fc.Arbitrary<string> =>
  fc.oneof(
    // 5-digit format
    fc.integer({ min: 10000, max: 99999 }).map(String),
    // 5+4 format
    fc
      .tuple(
        fc.integer({ min: 10000, max: 99999 }),
        fc.integer({ min: 1000, max: 9999 })
      )
      .map(([zip, plus4]) => `${zip}-${plus4}`)
  );

/**
 * Generate a random valid Canadian postal code
 */
export const canadianPostalCode = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.constantFrom('A', 'B', 'C', 'E', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'X', 'Y'),
      fc.integer({ min: 0, max: 9 }),
      fc.constantFrom('A', 'B', 'C', 'E', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'W', 'X', 'Y', 'Z'),
      fc.integer({ min: 0, max: 9 }),
      fc.constantFrom('A', 'B', 'C', 'E', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'W', 'X', 'Y', 'Z'),
      fc.integer({ min: 0, max: 9 })
    )
    .map(([l1, n1, l2, n2, l3, n3]) => `${l1}${n1}${l2} ${n2}${l3}${n3}`);

/**
 * Generate a random valid UK postcode
 */
export const ukPostcode = (): fc.Arbitrary<string> =>
  fc.oneof(
    // Format: A9 9AA
    fc
      .tuple(
        fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'),
        fc.integer({ min: 0, max: 9 }),
        fc.integer({ min: 0, max: 9 }),
        fc.constantFrom('A', 'B', 'D', 'E', 'F', 'G', 'H', 'J', 'L', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'W', 'X', 'Y', 'Z'),
        fc.constantFrom('A', 'B', 'D', 'E', 'F', 'G', 'H', 'J', 'L', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'W', 'X', 'Y', 'Z')
      )
      .map(([l1, n1, n2, l2, l3]) => `${l1}${n1} ${n2}${l2}${l3}`),
    // Format: A99 9AA
    fc
      .tuple(
        fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'),
        fc.integer({ min: 10, max: 99 }),
        fc.integer({ min: 0, max: 9 }),
        fc.constantFrom('A', 'B', 'D', 'E', 'F', 'G', 'H', 'J', 'L', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'W', 'X', 'Y', 'Z'),
        fc.constantFrom('A', 'B', 'D', 'E', 'F', 'G', 'H', 'J', 'L', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'W', 'X', 'Y', 'Z')
      )
      .map(([l1, n1, n2, l2, l3]) => `${l1}${n1} ${n2}${l2}${l3}`)
  );

/**
 * Generate a postal code for a given country
 */
export const postalCodeForCountry = (country: string): fc.Arbitrary<string> => {
  switch (country.toUpperCase()) {
    case 'US':
    case 'USA':
    case 'UNITED STATES':
      return usZipCode();
    case 'CA':
    case 'CANADA':
      return canadianPostalCode();
    case 'GB':
    case 'UK':
    case 'UNITED KINGDOM':
      return ukPostcode();
    default:
      return fc.string({ minLength: 3, maxLength: 10 });
  }
};

/**
 * Generate a random valid street address
 */
export const streetAddress = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.integer({ min: 1, max: 9999 }),
      fc.constantFrom('Main', 'Oak', 'Maple', 'Cedar', 'Elm', 'Washington', 'Park', 'Lake', 'Hill', 'Forest'),
      fc.constantFrom('Street', 'Avenue', 'Boulevard', 'Road', 'Lane', 'Drive', 'Court', 'Way')
    )
    .map(([num, name, type]) => `${num} ${name} ${type}`);

/**
 * Generate a random city name
 */
export const cityName = (): fc.Arbitrary<string> =>
  fc.constantFrom(
    'New York',
    'Los Angeles',
    'Chicago',
    'Houston',
    'Phoenix',
    'Philadelphia',
    'San Antonio',
    'San Diego',
    'Dallas',
    'San Jose',
    'Toronto',
    'Vancouver',
    'Montreal',
    'London',
    'Manchester',
    'Birmingham'
  );

/**
 * Generate a random country
 */
export const country = (): fc.Arbitrary<string> =>
  fc.constantFrom('US', 'USA', 'United States', 'CA', 'Canada', 'GB', 'UK', 'United Kingdom');

/**
 * Generate a random valid AddressInput
 */
export const validAddressInput = (): fc.Arbitrary<AddressInput> =>
  fc
    .tuple(country(), streetAddress(), cityName())
    .chain(([countryVal, street, city]) =>
      fc.record({
        street: fc.constant(street),
        apartment: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
        city: fc.constant(city),
        state: fc.option(fc.string({ minLength: 2, maxLength: 20 }), { nil: undefined }),
        postalCode: postalCodeForCountry(countryVal),
        country: fc.constant(countryVal),
        companyName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
        phoneNumber: fc.option(
          fc
            .tuple(
              fc.integer({ min: 100, max: 999 }),
              fc.integer({ min: 100, max: 999 }),
              fc.integer({ min: 1000, max: 9999 })
            )
            .map(([a, b, c]) => `${a}-${b}-${c}`),
          { nil: undefined }
        ),
      })
    );

/**
 * Generate an invalid AddressInput (missing required fields or invalid data)
 */
export const invalidAddressInput = (): fc.Arbitrary<Partial<AddressInput>> =>
  fc.oneof(
    // Missing street
    fc.record({
      street: fc.constant(''),
      city: cityName(),
      postalCode: fc.constant('12345'),
      country: fc.constant('US'),
    }),
    // Missing city
    fc.record({
      street: streetAddress(),
      city: fc.constant(''),
      postalCode: fc.constant('12345'),
      country: fc.constant('US'),
    }),
    // Missing postal code
    fc.record({
      street: streetAddress(),
      city: cityName(),
      postalCode: fc.constant(''),
      country: fc.constant('US'),
    }),
    // Missing country
    fc.record({
      street: streetAddress(),
      city: cityName(),
      postalCode: fc.constant('12345'),
      country: fc.constant(''),
    }),
    // Whitespace-only street
    fc.record({
      street: fc.constant('   '),
      city: cityName(),
      postalCode: fc.constant('12345'),
      country: fc.constant('US'),
    }),
    // Invalid postal code format
    fc.record({
      street: streetAddress(),
      city: cityName(),
      postalCode: fc.constant('INVALID'),
      country: fc.constant('US'),
    })
  );

/**
 * Generate a random user ID
 */
export const userId = (): fc.Arbitrary<string> =>
  fc.uuid();

/**
 * Generate a random address ID
 */
export const addressId = (): fc.Arbitrary<string> =>
  fc.uuid();

/**
 * Generate a complete Address object
 */
export const address = (): fc.Arbitrary<Address> =>
  fc
    .tuple(userId(), addressId(), validAddressInput(), fc.boolean(), fc.date(), fc.date())
    .map(([uid, aid, input, isDefault, createdAt, updatedAt]) => ({
      id: aid,
      userId: uid,
      ...input,
      isDefault,
      createdAt,
      updatedAt,
    }));
