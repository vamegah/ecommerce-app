const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+(?:\.[^\s@<>()[\]\\,;:"]+)*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PRODUCT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export class InventoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryValidationError';
  }
}

export function sanitizeInput(value: unknown, maxLength = 255): string {
  const text = String(value ?? '').replace(CONTROL_CHARS, '').trim();
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  return escaped.slice(0, maxLength);
}

export function validateEmail(email: unknown): string {
  const normalized = sanitizeInput(email).toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    throw new InventoryValidationError('Enter a valid email address.');
  }
  return normalized;
}

export function validateProductId(productId: unknown): string {
  const cleaned = sanitizeInput(productId, 64);
  if (!PRODUCT_ID_RE.test(cleaned)) {
    throw new InventoryValidationError('Product identifier contains invalid characters.');
  }
  return cleaned;
}

export function validateStockLevel(stockLevel: unknown): number {
  if (typeof stockLevel === 'boolean') {
    throw new InventoryValidationError('Stock level must be a non-negative integer.');
  }
  const numeric = Number(stockLevel);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new InventoryValidationError('Stock level must be a non-negative integer.');
  }
  return numeric;
}
