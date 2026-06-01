import {
  Comparison,
  ComparisonError,
  ComparisonErrorCode,
  ComparisonNotification,
  ComparisonResult,
  MAX_COMPARISON_PRODUCTS,
  PersistenceStrategy,
  Product,
  ValidationResult
} from '../types';
import { checkProductAvailability } from '../attributes/attributeNormalization';

export interface ComparisonManagerOptions {
  maxProducts?: number;
  persistence?: PersistenceStrategy;
  idFactory?: () => string;
  now?: () => Date;
  baseShareUrl?: string;
  onNotification?: (notification: ComparisonNotification) => void;
  availabilityResolver?: (product: Product) => boolean | Promise<boolean>;
}

function defaultIdFactory(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `comparison_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function cloneComparison(comparison: Comparison): Comparison {
  return {
    ...comparison,
    products: comparison.products.map((product) => ({
      ...product,
      attributes: product.attributes.map((attribute) => ({ ...attribute }))
    })),
    createdAt: new Date(comparison.createdAt),
    updatedAt: new Date(comparison.updatedAt)
  };
}

export function createEmptyComparison(
  idFactory: () => string = defaultIdFactory,
  now: () => Date = () => new Date()
): Comparison {
  const timestamp = now();
  return {
    id: idFactory(),
    products: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export class ComparisonManager {
  private comparison: Comparison;
  private readonly maxProducts: number;
  private readonly idFactory: () => string;
  private readonly now: () => Date;
  private readonly baseShareUrl: string;
  private persistence?: PersistenceStrategy;
  private readonly onNotification?: (notification: ComparisonNotification) => void;
  private readonly availabilityResolver?: (product: Product) => boolean | Promise<boolean>;

  constructor(initialComparison?: Comparison, options: ComparisonManagerOptions = {}) {
    this.maxProducts = options.maxProducts ?? MAX_COMPARISON_PRODUCTS;
    this.idFactory = options.idFactory ?? defaultIdFactory;
    this.now = options.now ?? (() => new Date());
    this.baseShareUrl = options.baseShareUrl ?? '/comparison/shared';
    this.persistence = options.persistence;
    this.onNotification = options.onNotification;
    this.availabilityResolver = options.availabilityResolver;
    this.comparison = initialComparison ? cloneComparison(initialComparison) : createEmptyComparison(this.idFactory, this.now);
  }

  setPersistence(persistence: PersistenceStrategy): void {
    this.persistence = persistence;
  }

  setComparison(comparison: Comparison): void {
    this.comparison = cloneComparison(comparison);
  }

  canAddProduct(productId: string): ValidationResult {
    if (!productId) {
      const error = new ComparisonError(
        ComparisonErrorCode.PRODUCT_NOT_FOUND,
        'Select a valid product before adding it to comparison.',
        true
      );
      return { valid: false, reason: error.message, error };
    }

    if (this.comparison.products.some((product) => product.id === productId)) {
      const error = new ComparisonError(
        ComparisonErrorCode.DUPLICATE_PRODUCT,
        'This product is already in your comparison.',
        true
      );
      return { valid: false, reason: error.message, error };
    }

    if (this.isAtLimit()) {
      const error = new ComparisonError(
        ComparisonErrorCode.LIMIT_REACHED,
        `Your comparison already has ${this.comparison.products.length} products. Remove one before adding another; the maximum is ${this.maxProducts}.`,
        true,
        {
          currentCount: this.comparison.products.length,
          maxProducts: this.maxProducts
        }
      );
      return { valid: false, reason: error.message, error };
    }

    return { valid: true };
  }

  isAtLimit(): boolean {
    return this.comparison.products.length >= this.maxProducts;
  }

  async addProduct(product: Product): Promise<ComparisonResult> {
    const validation = this.canAddProduct(product.id);
    if (!validation.valid) {
      this.notify({
        level: validation.error?.code === ComparisonErrorCode.LIMIT_REACHED ? 'warning' : 'info',
        message: validation.reason ?? 'Unable to add product to comparison.',
        recoverable: validation.error?.recoverable ?? true,
        code: validation.error?.code
      });
      return {
        success: false,
        comparison: this.getComparison(),
        error: validation.error
      };
    }

    this.comparison = {
      ...this.comparison,
      products: [...this.comparison.products, { ...product, attributes: product.attributes.map((attribute) => ({ ...attribute })) }],
      updatedAt: this.now()
    };

    const persistenceError = await this.persist();
    this.notify({
      level: persistenceError ? 'warning' : 'success',
      message: persistenceError ? persistenceError.message : `${product.name} added to comparison.`,
      recoverable: persistenceError?.recoverable ?? true,
      code: persistenceError?.code
    });

    return {
      success: true,
      comparison: this.getComparison(),
      error: persistenceError
    };
  }

  async removeProduct(productId: string): Promise<ComparisonResult> {
    const nextProducts = this.comparison.products.filter((product) => product.id !== productId);
    const productWasPresent = nextProducts.length !== this.comparison.products.length;

    if (!productWasPresent) {
      const error = new ComparisonError(
        ComparisonErrorCode.PRODUCT_NOT_FOUND,
        'That product is not in the current comparison.',
        true
      );
      return {
        success: false,
        comparison: this.getComparison(),
        error
      };
    }

    this.comparison = {
      ...this.comparison,
      products: nextProducts,
      updatedAt: this.now()
    };

    const persistenceError = await this.persist();
    return {
      success: true,
      comparison: this.getComparison(),
      error: persistenceError
    };
  }

  getComparison(): Comparison {
    return cloneComparison(this.comparison);
  }

  async clearComparison(): Promise<void> {
    this.comparison = createEmptyComparison(this.idFactory, this.now);
    await this.persist();
  }

  async loadComparison(): Promise<Comparison | null> {
    if (!this.persistence) {
      return this.getComparison();
    }

    const loaded = await this.persistence.load();
    if (!loaded) {
      return null;
    }

    const products = this.availabilityResolver
      ? await checkProductAvailability(loaded.products, this.availabilityResolver)
      : loaded.products;

    this.comparison = {
      ...loaded,
      products
    };
    return this.getComparison();
  }

  async generateShareableUrl(): Promise<string> {
    if (!this.persistence) {
      throw new ComparisonError(
        ComparisonErrorCode.PERSISTENCE_FAILED,
        'Sharing is not available until comparison persistence is configured.',
        true
      );
    }

    const shareId = await this.persistence.saveShared(this.getComparison());
    return `${this.baseShareUrl.replace(/\/$/, '')}/${encodeURIComponent(shareId)}/`;
  }

  async loadSharedComparison(shareId: string): Promise<Comparison> {
    if (!shareId) {
      throw new ComparisonError(
        ComparisonErrorCode.INVALID_SHARE_ID,
        'The shared comparison link is missing an ID.',
        false
      );
    }

    if (!this.persistence) {
      throw new ComparisonError(
        ComparisonErrorCode.PERSISTENCE_FAILED,
        'Shared comparison loading is unavailable until persistence is configured.',
        true
      );
    }

    const loaded = await this.persistence.loadShared(shareId);
    if (!loaded) {
      throw new ComparisonError(
        ComparisonErrorCode.INVALID_SHARE_ID,
        'This shared comparison link is invalid.',
        false
      );
    }

    this.comparison = loaded;
    return this.getComparison();
  }

  private async persist(): Promise<ComparisonError | undefined> {
    if (!this.persistence) {
      return undefined;
    }

    try {
      await this.persistence.save(this.getComparison());
      return undefined;
    } catch (error) {
      if (error instanceof ComparisonError) {
        return error;
      }
      return new ComparisonError(
        ComparisonErrorCode.PERSISTENCE_FAILED,
        'Unable to save comparison. Your current comparison will stay in memory.',
        true,
        { cause: String(error) }
      );
    }
  }

  private notify(notification: ComparisonNotification): void {
    this.onNotification?.(notification);
  }
}
