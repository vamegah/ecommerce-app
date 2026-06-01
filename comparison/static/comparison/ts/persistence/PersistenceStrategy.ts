import {
  Comparison,
  ComparisonError,
  ComparisonErrorCode,
  PersistenceStrategy
} from '../types';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SerializedComparison extends Omit<Comparison, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

export class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.has(key) ? this.values.get(key) ?? null : null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

export function serializeComparison(comparison: Comparison): SerializedComparison {
  return {
    ...comparison,
    products: comparison.products.map((product) => ({
      ...product,
      attributes: product.attributes.map((attribute) => ({ ...attribute }))
    })),
    createdAt: comparison.createdAt.toISOString(),
    updatedAt: comparison.updatedAt.toISOString()
  };
}

export function deserializeComparison(value: SerializedComparison): Comparison {
  return {
    ...value,
    products: value.products.map((product) => ({
      ...product,
      attributes: product.attributes.map((attribute) => ({ ...attribute }))
    })),
    createdAt: new Date(value.createdAt),
    updatedAt: new Date(value.updatedAt)
  };
}

function getDefaultStorage(): StorageLike {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return new MemoryStorage();
}

function createShareId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 18)}`.slice(0, 32);
}

function parseComparison(rawValue: string | null): Comparison | null {
  if (!rawValue) {
    return null;
  }

  try {
    return deserializeComparison(JSON.parse(rawValue) as SerializedComparison);
  } catch (error) {
    throw new ComparisonError(
      ComparisonErrorCode.PERSISTENCE_FAILED,
      'Saved comparison data is malformed.',
      true,
      { cause: String(error) }
    );
  }
}

export class LocalStoragePersistence implements PersistenceStrategy {
  static readonly STORAGE_KEY = 'product_comparison';
  private readonly sharedPrefix = 'product_comparison_shared_';

  constructor(
    private readonly storage: StorageLike = getDefaultStorage(),
    private readonly now: () => Date = () => new Date()
  ) {}

  async save(comparison: Comparison): Promise<void> {
    try {
      this.storage.setItem(LocalStoragePersistence.STORAGE_KEY, JSON.stringify(serializeComparison(comparison)));
    } catch (error) {
      throw new ComparisonError(
        ComparisonErrorCode.PERSISTENCE_FAILED,
        'Unable to save comparison locally. Your current comparison will remain available until you leave this page.',
        true,
        { cause: String(error) }
      );
    }
  }

  async load(): Promise<Comparison | null> {
    return parseComparison(this.storage.getItem(LocalStoragePersistence.STORAGE_KEY));
  }

  async saveShared(comparison: Comparison): Promise<string> {
    const shareId = createShareId();
    const expiresAt = new Date(this.now().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
      this.storage.setItem(
        `${this.sharedPrefix}${shareId}`,
        JSON.stringify({
          comparison: serializeComparison(comparison),
          expiresAt
        })
      );
      return shareId;
    } catch (error) {
      throw new ComparisonError(
        ComparisonErrorCode.PERSISTENCE_FAILED,
        'Unable to create a shareable comparison link.',
        true,
        { cause: String(error) }
      );
    }
  }

  async loadShared(shareId: string): Promise<Comparison | null> {
    const rawValue = this.storage.getItem(`${this.sharedPrefix}${shareId}`);

    if (!rawValue) {
      return null;
    }

    try {
      const payload = JSON.parse(rawValue) as { comparison: SerializedComparison; expiresAt: string };
      if (new Date(payload.expiresAt).getTime() < this.now().getTime()) {
        throw new ComparisonError(
          ComparisonErrorCode.SHARE_EXPIRED,
          'This shared comparison link has expired.',
          false
        );
      }
      return deserializeComparison(payload.comparison);
    } catch (error) {
      if (error instanceof ComparisonError) {
        throw error;
      }
      throw new ComparisonError(
        ComparisonErrorCode.INVALID_SHARE_ID,
        'This shared comparison link is invalid.',
        false,
        { cause: String(error) }
      );
    }
  }
}

export interface ServerPersistenceOptions {
  baseUrl?: string;
  fetcher?: FetchLike;
  csrfToken?: string;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export class ServerPersistence implements PersistenceStrategy {
  private readonly baseUrl: string;
  private readonly fetcher: FetchLike;
  private readonly csrfToken?: string;
  private readonly retryAttempts: number;
  private readonly retryDelayMs: number;

  constructor(options: ServerPersistenceOptions = {}) {
    this.baseUrl = options.baseUrl ?? '/comparison/api/';
    this.fetcher = options.fetcher ?? fetch;
    this.csrfToken = options.csrfToken;
    this.retryAttempts = options.retryAttempts ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 25;
  }

  async save(comparison: Comparison): Promise<void> {
    await this.request('', {
      method: 'POST',
      body: { comparison: serializeComparison(comparison) }
    });
  }

  async load(): Promise<Comparison | null> {
    const payload = await this.request<{ comparison: SerializedComparison | null }>('', { method: 'GET' });
    return payload.comparison ? deserializeComparison(payload.comparison) : null;
  }

  async saveShared(comparison: Comparison): Promise<string> {
    const payload = await this.request<{ shareId: string }>('/shared/', {
      method: 'POST',
      body: { comparison: serializeComparison(comparison) }
    });
    return payload.shareId;
  }

  async loadShared(shareId: string): Promise<Comparison | null> {
    const payload = await this.request<{ comparison: SerializedComparison | null }>(`/shared/${encodeURIComponent(shareId)}/`, {
      method: 'GET'
    });
    return payload.comparison ? deserializeComparison(payload.comparison) : null;
  }

  private async request<T>(
    path: string,
    options: { method: 'GET' | 'POST'; body?: unknown }
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt += 1) {
      try {
        const response = await this.fetcher(this.urlFor(path), {
          method: options.method,
          headers: {
            'Content-Type': 'application/json',
            ...(this.csrfToken ? { 'X-CSRFToken': this.csrfToken } : {})
          },
          body: options.body === undefined ? undefined : JSON.stringify(options.body)
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const code = payload.code as ComparisonErrorCode | undefined;
          throw new ComparisonError(
            code ?? ComparisonErrorCode.PERSISTENCE_FAILED,
            payload.error ?? 'Comparison server request failed.',
            response.status >= 500,
            { status: response.status }
          );
        }

        return payload as T;
      } catch (error) {
        lastError = error;
        if (error instanceof ComparisonError && !error.recoverable) {
          throw error;
        }
        if (attempt < this.retryAttempts) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * attempt));
        }
      }
    }

    if (lastError instanceof ComparisonError) {
      throw lastError;
    }

    throw new ComparisonError(
      ComparisonErrorCode.PERSISTENCE_FAILED,
      'Comparison server is unavailable. Your current comparison will stay in memory.',
      true,
      { cause: String(lastError) }
    );
  }

  private urlFor(path: string): string {
    const base = this.baseUrl.replace(/\/$/, '');
    return path === '' ? `${base}/` : `${base}${path}`;
  }
}

export function selectPersistenceStrategy(
  isAuthenticated: boolean,
  options: ServerPersistenceOptions & { storage?: StorageLike } = {}
): PersistenceStrategy {
  if (isAuthenticated) {
    return new ServerPersistence(options);
  }
  return new LocalStoragePersistence(options.storage);
}
