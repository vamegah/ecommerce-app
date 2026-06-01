import { Address } from '../types';

export interface AddressDataStore {
  save(userId: string, address: Address): Promise<Address>;
  findById(userId: string, addressId: string): Promise<Address | null>;
  findByUserId(userId: string): Promise<Address[]>;
  update(userId: string, addressId: string, address: Address): Promise<Address>;
  delete(userId: string, addressId: string): Promise<void>;
  findDefaultAddress(userId: string): Promise<Address | null>;
}
