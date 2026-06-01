import { Address, AddressInput, AddressNotFoundError, AddressSelectionData, Result, ValidationError } from '../types';
import { AddressManager } from '../managers/AddressManager';

export class CheckoutAddressService {
  private selectedByOrder = new Map<string, string>();

  constructor(private readonly manager: AddressManager = new AddressManager()) {}

  async getAvailableAddresses(userId: string): Promise<AddressSelectionData> {
    const addresses = await this.manager.getAddresses(userId);
    if (!addresses.success) {
      throw addresses.error;
    }
    const defaultAddress = addresses.value.find((address) => address.isDefault);
    return {
      addresses: addresses.value,
      defaultAddressId: defaultAddress?.id ?? null,
    };
  }

  async selectAddressForOrder(userId: string, orderId: string, addressId: string): Promise<Result<void, Error | AddressNotFoundError>> {
    const address = await this.manager.getAddress(userId, addressId);
    if (!address.success) {
      return { success: false, error: address.error };
    }
    this.selectedByOrder.set(orderId, addressId);
    return { success: true, value: undefined };
  }

  getSelectedAddressId(orderId: string): string | null {
    return this.selectedByOrder.get(orderId) ?? null;
  }

  async saveNewCheckoutAddress(userId: string, input: AddressInput, saveForFuture: boolean): Promise<Result<Address, ValidationError[]>> {
    if (saveForFuture) {
      return this.manager.createAddress(userId, input);
    }
    const created = await this.manager.createAddress(`checkout-only-${userId}`, input);
    if (!created.success) {
      return created;
    }
    return { success: true, value: { ...created.value, userId, isDefault: false } };
  }
}
