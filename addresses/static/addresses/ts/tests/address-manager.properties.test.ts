import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { AddressInput, ValidationErrorCode } from '../types';
import { AddressValidator } from '../validators/AddressValidator';
import { AddressManager } from '../managers/AddressManager';
import { CheckoutAddressService } from '../checkout/CheckoutAddressService';
import { InMemoryAddressDataStore } from '../storage/InMemoryAddressDataStore';
import {
  addressId,
  canadianPostalCode,
  invalidAddressInput,
  ukPostcode,
  usZipCode,
  userId,
  validAddressInput,
} from './generators';

const propertyConfig = { numRuns: 100 };

async function createValidAddress(manager: AddressManager, uid: string, input: AddressInput = sampleAddress()) {
  const result = await manager.createAddress(uid, input);
  expect(result.success).toBe(true);
  if (!result.success) {
    throw new Error('Expected address creation to succeed.');
  }
  return result.value;
}

function sampleAddress(overrides: Partial<AddressInput> = {}): AddressInput {
  return {
    street: '123 Main Street',
    city: 'Chicago',
    state: 'IL',
    postalCode: '60601',
    country: 'US',
    ...overrides,
  };
}

describe('Feature: multi-address-management, AddressValidator', () => {
  it('Property 2: Invalid Address Rejection', async () => {
    await fc.assert(
      fc.asyncProperty(userId(), invalidAddressInput(), async (uid, invalidInput) => {
        const manager = new AddressManager();
        const result = await manager.createAddress(uid, invalidInput as AddressInput);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.length).toBeGreaterThan(0);
          expect(result.error.every((error) => error.field && error.message && error.code)).toBe(true);
        }
      }),
      propertyConfig
    );
  });

  it('Property 15: Postal Code Format Validation', () => {
    const validator = new AddressValidator();
    fc.assert(
      fc.property(usZipCode(), canadianPostalCode(), ukPostcode(), fc.string({ minLength: 1 }), (us, ca, uk, randomText) => {
        expect(validator.validatePostalCode(us, 'US')).toBe(true);
        expect(validator.validatePostalCode(ca, 'Canada')).toBe(true);
        expect(validator.validatePostalCode(uk, 'United Kingdom')).toBe(true);
        fc.pre(!/^\d{5}(-\d{4})?$/.test(randomText));
        expect(validator.validatePostalCode(randomText, 'US')).toBe(false);
      }),
      propertyConfig
    );
  });

  it('Property 16: Optional Fields Acceptance', async () => {
    await fc.assert(
      fc.asyncProperty(
        userId(),
        fc.record({
          apartment: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
          companyName: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
          phoneNumber: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
        }),
        async (uid, optionalFields) => {
          const manager = new AddressManager();
          const result = await manager.createAddress(uid, sampleAddress(optionalFields));
          expect(result.success).toBe(true);
        }
      ),
      propertyConfig
    );
  });

  it('rejects validation edge cases', () => {
    const validator = new AddressValidator();
    expect(validator.validate(sampleAddress({ street: '' })).errors[0].code).toBe(ValidationErrorCode.WHITESPACE_ONLY);
    expect(validator.validate(sampleAddress({ city: '   ' })).isValid).toBe(false);
    expect(validator.validate(sampleAddress({ postalCode: '12345', country: 'US' })).isValid).toBe(true);
    expect(validator.validate(sampleAddress({ street: '12 #5-B Main St.' })).isValid).toBe(true);
    expect(validator.validate(sampleAddress({ street: 'x'.repeat(256) })).isValid).toBe(false);
  });
});

describe('Feature: multi-address-management, AddressDataStore', () => {
  it('Property 19: User Address Isolation', async () => {
    await fc.assert(
      fc.asyncProperty(userId(), userId(), validAddressInput(), validAddressInput(), async (firstUser, secondUser, firstInput, secondInput) => {
        fc.pre(firstUser !== secondUser);
        const manager = new AddressManager();
        const first = await createValidAddress(manager, firstUser, firstInput);
        const second = await createValidAddress(manager, secondUser, secondInput);
        const firstAddresses = await manager.getAddresses(firstUser);
        const secondAddresses = await manager.getAddresses(secondUser);

        expect(firstAddresses.success && firstAddresses.value.map((address) => address.id)).toContain(first.id);
        expect(firstAddresses.success && firstAddresses.value.map((address) => address.id)).not.toContain(second.id);
        expect(secondAddresses.success && secondAddresses.value.map((address) => address.id)).toContain(second.id);
      }),
      propertyConfig
    );
  });
});

describe('Feature: multi-address-management, AddressManager CRUD', () => {
  it('Property 1: Address Creation and Retrieval', async () => {
    await fc.assert(
      fc.asyncProperty(userId(), validAddressInput(), async (uid, input) => {
        const manager = new AddressManager();
        const created = await createValidAddress(manager, uid, input);
        const addresses = await manager.getAddresses(uid);
        expect(addresses.success).toBe(true);
        if (addresses.success) {
          expect(addresses.value.some((address) => address.id === created.id && address.street === input.street)).toBe(true);
        }
      }),
      propertyConfig
    );
  });

  it('Property 3: First Address is Default', async () => {
    await fc.assert(
      fc.asyncProperty(userId(), validAddressInput(), async (uid, input) => {
        const manager = new AddressManager();
        const address = await createValidAddress(manager, uid, input);
        expect(address.isDefault).toBe(true);
      }),
      propertyConfig
    );
  });

  it('Property 4: Complete Address Retrieval', async () => {
    await fc.assert(
      fc.asyncProperty(userId(), fc.array(validAddressInput(), { minLength: 1, maxLength: 5 }), async (uid, inputs) => {
        const manager = new AddressManager();
        for (const input of inputs) {
          await createValidAddress(manager, uid, input);
        }
        const addresses = await manager.getAddresses(uid);
        expect(addresses.success).toBe(true);
        if (addresses.success) {
          expect(addresses.value).toHaveLength(inputs.length);
          for (const input of inputs) {
            expect(addresses.value.some((address) => address.street === input.street && address.postalCode === input.postalCode)).toBe(true);
          }
        }
      }),
      propertyConfig
    );
  });

  it('Property 5: Empty Address List', async () => {
    await fc.assert(
      fc.asyncProperty(userId(), async (uid) => {
        const addresses = await new AddressManager().getAddresses(uid);
        expect(addresses.success).toBe(true);
        if (addresses.success) {
          expect(addresses.value).toEqual([]);
        }
      }),
      propertyConfig
    );
  });

  it('Property 6: Address Update Persistence', async () => {
    await fc.assert(
      fc.asyncProperty(userId(), validAddressInput(), validAddressInput(), async (uid, original, update) => {
        const manager = new AddressManager();
        const created = await createValidAddress(manager, uid, original);
        const updated = await manager.updateAddress(uid, created.id, update);
        expect(updated.success).toBe(true);
        const fetched = await manager.getAddress(uid, created.id);
        expect(fetched.success && fetched.value.street).toBe(update.street);
        expect(fetched.success && fetched.value.postalCode).toBe(update.postalCode);
      }),
      propertyConfig
    );
  });

  it('Property 7: Default Status Preservation During Update', async () => {
    await fc.assert(
      fc.asyncProperty(userId(), validAddressInput(), validAddressInput(), async (uid, firstInput, update) => {
        const manager = new AddressManager();
        const created = await createValidAddress(manager, uid, firstInput);
        await manager.updateAddress(uid, created.id, update);
        const fetched = await manager.getAddress(uid, created.id);
        expect(fetched.success && fetched.value.isDefault).toBe(created.isDefault);
      }),
      propertyConfig
    );
  });

  it('Property 8: Non-Existent Address Error Handling', async () => {
    await fc.assert(
      fc.asyncProperty(userId(), addressId(), validAddressInput(), async (uid, missingId, input) => {
        const manager = new AddressManager();
        const update = await manager.updateAddress(uid, missingId, input);
        const deletion = await manager.deleteAddress(uid, missingId);
        expect(update.success).toBe(false);
        expect(deletion.success).toBe(false);
        if (!update.success && !Array.isArray(update.error)) {
          expect(update.error.code).toBe('ADDRESS_NOT_FOUND');
        }
      }),
      propertyConfig
    );
  });
});

describe('Feature: multi-address-management, deletion and defaults', () => {
  it('Property 9: Non-Default Address Deletion', async () => {
    await fc.assert(
      fc.asyncProperty(userId(), validAddressInput(), validAddressInput(), async (uid, firstInput, secondInput) => {
        const manager = new AddressManager();
        const first = await createValidAddress(manager, uid, firstInput);
        const second = await createValidAddress(manager, uid, secondInput);
        await manager.deleteAddress(uid, second.id);
        const addresses = await manager.getAddresses(uid);
        expect(addresses.success && addresses.value.map((address) => address.id)).not.toContain(second.id);
        expect(addresses.success && addresses.value.find((address) => address.id === first.id)?.isDefault).toBe(true);
      }),
      propertyConfig
    );
  });

  it('Property 10: Last Address Deletion', async () => {
    const manager = new AddressManager();
    const created = await createValidAddress(manager, 'user-last');
    await manager.deleteAddress('user-last', created.id);
    const addresses = await manager.getAddresses('user-last');
    expect(addresses.success && addresses.value).toEqual([]);
  });

  it('Property 11: Automatic Default Reassignment', async () => {
    await fc.assert(
      fc.asyncProperty(userId(), validAddressInput(), validAddressInput(), async (uid, firstInput, secondInput) => {
        const manager = new AddressManager();
        const first = await createValidAddress(manager, uid, firstInput);
        const second = await createValidAddress(manager, uid, secondInput);
        await manager.deleteAddress(uid, first.id);
        const defaultAddress = await manager.getDefaultAddress(uid);
        expect(defaultAddress.success && defaultAddress.value?.id).toBe(second.id);
      }),
      propertyConfig
    );
  });

  it('Properties 12 and 13: Exclusive Default Status and Invariant', async () => {
    await fc.assert(
      fc.asyncProperty(userId(), fc.array(validAddressInput(), { minLength: 2, maxLength: 6 }), async (uid, inputs) => {
        const manager = new AddressManager();
        const created = [];
        for (const input of inputs) {
          created.push(await createValidAddress(manager, uid, input));
        }
        await manager.setDefaultAddress(uid, created[created.length - 1].id);
        const addresses = await manager.getAddresses(uid);
        expect(addresses.success).toBe(true);
        if (addresses.success) {
          expect(addresses.value.filter((address) => address.isDefault)).toHaveLength(1);
          expect(addresses.value.find((address) => address.isDefault)?.id).toBe(created[created.length - 1].id);
        }
      }),
      propertyConfig
    );
  });
});

describe('Feature: multi-address-management, checkout integration', () => {
  it('Property 14: Checkout Default Pre-Selection', async () => {
    const manager = new AddressManager(new InMemoryAddressDataStore());
    const checkout = new CheckoutAddressService(manager);
    const first = await createValidAddress(manager, 'checkout-user');
    const data = await checkout.getAvailableAddresses('checkout-user');
    expect(data.defaultAddressId).toBe(first.id);
  });

  it('Property 17: Checkout Address Availability', async () => {
    await fc.assert(
      fc.asyncProperty(userId(), fc.array(validAddressInput(), { minLength: 1, maxLength: 5 }), async (uid, inputs) => {
        const manager = new AddressManager();
        const checkout = new CheckoutAddressService(manager);
        for (const input of inputs) {
          await createValidAddress(manager, uid, input);
        }
        const data = await checkout.getAvailableAddresses(uid);
        expect(data.addresses).toHaveLength(inputs.length);
      }),
      propertyConfig
    );
  });

  it('Property 18: Checkout Selection Independence', async () => {
    await fc.assert(
      fc.asyncProperty(userId(), validAddressInput(), validAddressInput(), async (uid, firstInput, secondInput) => {
        const manager = new AddressManager();
        const checkout = new CheckoutAddressService(manager);
        const first = await createValidAddress(manager, uid, firstInput);
        const second = await createValidAddress(manager, uid, secondInput);
        await checkout.selectAddressForOrder(uid, 'order-1', second.id);
        const defaultAddress = await manager.getDefaultAddress(uid);
        expect(defaultAddress.success && defaultAddress.value?.id).toBe(first.id);
      }),
      propertyConfig
    );
  });

  it('handles checkout users with no addresses and optional saving', async () => {
    const manager = new AddressManager();
    const checkout = new CheckoutAddressService(manager);
    expect(await checkout.getAvailableAddresses('empty-user')).toEqual({ addresses: [], defaultAddressId: null });

    const temporary = await checkout.saveNewCheckoutAddress('empty-user', sampleAddress(), false);
    expect(temporary.success).toBe(true);
    const afterTemporary = await manager.getAddresses('empty-user');
    expect(afterTemporary.success && afterTemporary.value).toEqual([]);

    const saved = await checkout.saveNewCheckoutAddress('empty-user', sampleAddress({ postalCode: '60602' }), true);
    expect(saved.success).toBe(true);
    const addresses = await manager.getAddresses('empty-user');
    expect(addresses.success && addresses.value).toHaveLength(1);
  });
});
