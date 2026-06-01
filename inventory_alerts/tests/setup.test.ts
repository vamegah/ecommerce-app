/**
 * Setup Verification Test
 * 
 * This test verifies that the testing infrastructure is properly configured.
 */

import * as fc from 'fast-check';
import { PBT_CONFIG, arbitraries } from './test-config';

describe('Test Infrastructure Setup', () => {
  test('Jest is configured correctly', () => {
    expect(true).toBe(true);
  });

  test('TypeScript compilation works', () => {
    const testValue: string = 'test';
    expect(typeof testValue).toBe('string');
  });

  test('fast-check is available', () => {
    expect(fc).toBeDefined();
    expect(fc.assert).toBeDefined();
  });

  test('Property test runs with minimum 100 iterations', async () => {
    let iterationCount = 0;
    
    await fc.assert(
      fc.property(fc.integer(), (n) => {
        iterationCount++;
        return typeof n === 'number';
      }),
      PBT_CONFIG
    );
    
    expect(iterationCount).toBeGreaterThanOrEqual(100);
  });

  test('Email arbitrary generates valid emails', () => {
    fc.assert(
      fc.property(arbitraries.email, (email) => {
        return email.includes('@') && email.length > 3;
      }),
      { numRuns: 10 }
    );
  });

  test('UUID arbitrary generates valid UUIDs', () => {
    fc.assert(
      fc.property(arbitraries.uuid, (uuid) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
      }),
      { numRuns: 10 }
    );
  });

  test('Stock level arbitrary generates non-negative integers', () => {
    fc.assert(
      fc.property(arbitraries.stockLevel, (stock) => {
        return Number.isInteger(stock) && stock >= 0;
      }),
      { numRuns: 10 }
    );
  });
});
