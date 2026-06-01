import { AddressInput, ValidationError, ValidationErrorCode, ValidationResult } from '../types';

const COUNTRY_ALIASES: Record<string, 'US' | 'CA' | 'UK'> = {
  US: 'US',
  USA: 'US',
  'UNITED STATES': 'US',
  'UNITED STATES OF AMERICA': 'US',
  CA: 'CA',
  CANADA: 'CA',
  GB: 'UK',
  UK: 'UK',
  'UNITED KINGDOM': 'UK',
  'GREAT BRITAIN': 'UK',
};

const POSTAL_PATTERNS: Record<'US' | 'CA' | 'UK', RegExp> = {
  US: /^\d{5}(-\d{4})?$/,
  CA: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i,
  UK: /^(GIR 0AA|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/i,
};

const FIELD_LIMITS: Partial<Record<keyof AddressInput, number>> = {
  street: 255,
  apartment: 100,
  city: 100,
  state: 100,
  postalCode: 20,
  country: 80,
  companyName: 120,
  phoneNumber: 30,
};

export class AddressValidator {
  validateRequiredFields(address: Partial<AddressInput>): ValidationError[] {
    const requiredFields: Array<keyof AddressInput> = ['street', 'city', 'postalCode', 'country'];
    return requiredFields.flatMap((field) => {
      const value = address[field];
      if (value === null || value === undefined) {
        return [this.error(field, 'This field is required.', ValidationErrorCode.REQUIRED_FIELD_MISSING)];
      }
      if (String(value).trim() === '') {
        return [this.error(field, 'This field must contain non-whitespace content.', ValidationErrorCode.WHITESPACE_ONLY)];
      }
      return [];
    });
  }

  validatePostalCode(postalCode: string, country: string): boolean {
    const normalizedCountry = this.normalizeCountry(country);
    if (!normalizedCountry) {
      return false;
    }
    return POSTAL_PATTERNS[normalizedCountry].test(String(postalCode ?? '').trim());
  }

  validate(address: Partial<AddressInput>): ValidationResult {
    const errors = [...this.validateRequiredFields(address)];
    const normalizedCountry = this.normalizeCountry(address.country);

    for (const [field, limit] of Object.entries(FIELD_LIMITS) as Array<[keyof AddressInput, number]>) {
      const value = address[field];
      if (value !== undefined && value !== null && String(value).length > limit) {
        errors.push(this.error(field, `Must be ${limit} characters or fewer.`, ValidationErrorCode.FIELD_TOO_LONG));
      }
    }

    if (address.country && !normalizedCountry) {
      errors.push(this.error('country', 'Country must be US, Canada, or UK.', ValidationErrorCode.INVALID_COUNTRY));
    }

    if (address.postalCode && address.country && normalizedCountry && !this.validatePostalCode(address.postalCode, address.country)) {
      errors.push(this.error('postalCode', 'Postal code does not match the selected country.', ValidationErrorCode.INVALID_POSTAL_CODE));
    }

    return { isValid: errors.length === 0, errors };
  }

  normalizeCountry(country: unknown): 'US' | 'CA' | 'UK' | null {
    const key = String(country ?? '').trim().toUpperCase();
    return COUNTRY_ALIASES[key] ?? null;
  }

  sanitize(address: AddressInput): AddressInput {
    return {
      street: address.street.trim(),
      apartment: address.apartment?.trim() || undefined,
      city: address.city.trim(),
      state: address.state?.trim() || undefined,
      postalCode: address.postalCode.trim(),
      country: address.country.trim(),
      companyName: address.companyName?.trim() || undefined,
      phoneNumber: address.phoneNumber?.trim() || undefined,
    };
  }

  private error(field: keyof AddressInput, message: string, code: ValidationErrorCode): ValidationError {
    return { field, message, code };
  }
}
