import { Address } from '../types';
import { AddressDataStore } from './AddressDataStore';

export class InMemoryAddressDataStore implements AddressDataStore {
  private addressesByUser = new Map<string, Map<string, Address>>();
  private locks = new Map<string, Promise<void>>();

  async save(userId: string, address: Address): Promise<Address> {
    return this.withUserLock(userId, async () => {
      const bucket = this.bucket(userId);
      const stored = this.clone({ ...address, userId });
      bucket.set(stored.id, stored);
      return this.clone(stored);
    });
  }

  async findById(userId: string, addressId: string): Promise<Address | null> {
    const address = this.bucket(userId).get(addressId);
    return address ? this.clone(address) : null;
  }

  async findByUserId(userId: string): Promise<Address[]> {
    return Array.from(this.bucket(userId).values())
      .map((address) => this.clone(address))
      .sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id));
  }

  async update(userId: string, addressId: string, address: Address): Promise<Address> {
    return this.withUserLock(userId, async () => {
      const bucket = this.bucket(userId);
      if (!bucket.has(addressId)) {
        throw new Error(`Address ${addressId} was not found.`);
      }
      const stored = this.clone({ ...address, userId, id: addressId, updatedAt: new Date() });
      bucket.set(addressId, stored);
      return this.clone(stored);
    });
  }

  async delete(userId: string, addressId: string): Promise<void> {
    return this.withUserLock(userId, async () => {
      this.bucket(userId).delete(addressId);
    });
  }

  async findDefaultAddress(userId: string): Promise<Address | null> {
    const defaultAddress = Array.from(this.bucket(userId).values()).find((address) => address.isDefault);
    return defaultAddress ? this.clone(defaultAddress) : null;
  }

  private bucket(userId: string): Map<string, Address> {
    let bucket = this.addressesByUser.get(userId);
    if (!bucket) {
      bucket = new Map<string, Address>();
      this.addressesByUser.set(userId, bucket);
    }
    return bucket;
  }

  private clone(address: Address): Address {
    return {
      ...address,
      createdAt: new Date(address.createdAt),
      updatedAt: new Date(address.updatedAt),
    };
  }

  private async withUserLock<T>(userId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(userId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(userId, previous.then(() => current));
    await previous;
    try {
      return await action();
    } finally {
      release();
      if (this.locks.get(userId) === current) {
        this.locks.delete(userId);
      }
    }
  }
}
