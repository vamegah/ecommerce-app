import { randomUUID } from 'crypto';

import {
  Address,
  AddressInput,
  AddressNotFoundError,
  Result,
  ValidationError,
} from '../types';
import { AddressDataStore } from '../storage/AddressDataStore';
import { InMemoryAddressDataStore } from '../storage/InMemoryAddressDataStore';
import { AddressValidator } from '../validators/AddressValidator';

type OperationError = AddressNotFoundError | Error;

export class AddressManager {
  constructor(
    private readonly store: AddressDataStore = new InMemoryAddressDataStore(),
    private readonly validator: AddressValidator = new AddressValidator()
  ) {}

  async createAddress(userId: string, input: AddressInput & { isDefault?: boolean }): Promise<Result<Address, ValidationError[]>> {
    const validation = this.validator.validate(input);
    if (!validation.isValid) {
      return { success: false, error: validation.errors };
    }

    const existingAddresses = await this.store.findByUserId(userId);
    const shouldBeDefault = input.isDefault === true || existingAddresses.length === 0;
    if (shouldBeDefault) {
      await this.clearDefault(userId);
    }

    const now = new Date();
    const address: Address = {
      id: this.nextId(),
      userId,
      ...this.validator.sanitize(input),
      isDefault: shouldBeDefault,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.store.save(userId, address);
    await this.repairDefaultInvariant(userId);
    return { success: true, value: saved };
  }

  async getAddresses(userId: string): Promise<Result<Address[], OperationError>> {
    return { success: true, value: await this.store.findByUserId(userId) };
  }

  async getAddress(userId: string, addressId: string): Promise<Result<Address, OperationError>> {
    const address = await this.store.findById(userId, addressId);
    if (!address) {
      return { success: false, error: this.notFound(addressId) };
    }
    return { success: true, value: address };
  }

  async updateAddress(userId: string, addressId: string, updates: Partial<AddressInput> & { isDefault?: boolean }): Promise<Result<Address, ValidationError[] | AddressNotFoundError>> {
    const current = await this.store.findById(userId, addressId);
    if (!current) {
      return { success: false, error: this.notFound(addressId) };
    }

    const merged: AddressInput = {
      street: updates.street ?? current.street,
      apartment: updates.apartment ?? current.apartment,
      city: updates.city ?? current.city,
      state: updates.state ?? current.state,
      postalCode: updates.postalCode ?? current.postalCode,
      country: updates.country ?? current.country,
      companyName: updates.companyName ?? current.companyName,
      phoneNumber: updates.phoneNumber ?? current.phoneNumber,
    };
    const validation = this.validator.validate(merged);
    if (!validation.isValid) {
      return { success: false, error: validation.errors };
    }

    if (updates.isDefault === true) {
      await this.clearDefault(userId);
    }

    const updated: Address = {
      ...current,
      ...this.validator.sanitize(merged),
      isDefault: updates.isDefault === true ? true : current.isDefault,
      updatedAt: new Date(),
    };
    const saved = await this.store.update(userId, addressId, updated);
    await this.repairDefaultInvariant(userId);
    return { success: true, value: saved };
  }

  async deleteAddress(userId: string, addressId: string): Promise<Result<void, AddressNotFoundError>> {
    const current = await this.store.findById(userId, addressId);
    if (!current) {
      return { success: false, error: this.notFound(addressId) };
    }
    await this.store.delete(userId, addressId);
    if (current.isDefault) {
      await this.assignReplacementDefault(userId);
    }
    await this.repairDefaultInvariant(userId);
    return { success: true, value: undefined };
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<Result<void, AddressNotFoundError>> {
    const target = await this.store.findById(userId, addressId);
    if (!target) {
      return { success: false, error: this.notFound(addressId) };
    }
    await this.clearDefault(userId);
    await this.store.update(userId, addressId, { ...target, isDefault: true, updatedAt: new Date() });
    return { success: true, value: undefined };
  }

  async getDefaultAddress(userId: string): Promise<Result<Address | null, OperationError>> {
    return { success: true, value: await this.store.findDefaultAddress(userId) };
  }

  private async clearDefault(userId: string): Promise<void> {
    const addresses = await this.store.findByUserId(userId);
    await Promise.all(
      addresses
        .filter((address) => address.isDefault)
        .map((address) => this.store.update(userId, address.id, { ...address, isDefault: false, updatedAt: new Date() }))
    );
  }

  private async assignReplacementDefault(userId: string): Promise<void> {
    const addresses = await this.store.findByUserId(userId);
    const replacement = [...addresses].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id))[0];
    if (replacement) {
      await this.store.update(userId, replacement.id, { ...replacement, isDefault: true, updatedAt: new Date() });
    }
  }

  private async repairDefaultInvariant(userId: string): Promise<void> {
    const addresses = await this.store.findByUserId(userId);
    if (addresses.length === 0) {
      return;
    }
    const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];
    await Promise.all(
      addresses.map((address) => this.store.update(userId, address.id, { ...address, isDefault: address.id === defaultAddress.id, updatedAt: new Date() }))
    );
  }

  private notFound(addressId: string): AddressNotFoundError {
    return { code: 'ADDRESS_NOT_FOUND', message: 'Address was not found.', addressId };
  }

  private nextId(): string {
    return randomUUID();
  }
}
