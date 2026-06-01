/**
 * Test Configuration for Property-Based Testing
 * 
 * This file contains shared configuration for property-based tests using fast-check.
 * All property tests should use these settings to ensure consistency.
 */

import * as fc from 'fast-check';

/**
 * Default configuration for property-based tests
 * Minimum 100 iterations as specified in requirements
 */
export const PBT_CONFIG = {
  numRuns: 100,
  verbose: true,
  seed: Date.now(), // Use timestamp for reproducibility
};

/**
 * Extended configuration for complex property tests
 * Use for tests that require more iterations
 */
export const PBT_CONFIG_EXTENDED = {
  numRuns: 500,
  verbose: true,
  seed: Date.now(),
};

/**
 * Arbitraries for common data types
 */
export const arbitraries = {
  // Email address generator (RFC 5322 compliant)
  email: fc.emailAddress(),
  
  // UUID generator for IDs
  uuid: fc.uuid(),
  
  // Product ID (alphanumeric string)
  productId: fc.stringMatching(/^[A-Z0-9]{8,12}$/),
  
  // Stock level (non-negative integer)
  stockLevel: fc.nat({ max: 10000 }),
  
  // Timestamp
  timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  
  // Subscription status
  subscriptionStatus: fc.constantFrom('active', 'notified', 'cancelled', 'failed'),
  
  // Notification status
  notificationStatus: fc.constantFrom('pending', 'sent', 'failed'),
};

/**
 * Helper function to create a property test with default configuration
 */
export function createPropertyTest<T>(
  name: string,
  arbitrary: fc.Arbitrary<T>,
  predicate: (value: T) => Promise<boolean | void>,
  config = PBT_CONFIG
): void {
  test(name, async () => {
    await fc.assert(
      fc.asyncProperty(arbitrary, predicate),
      config
    );
  });
}
