import { ComparisonTable } from '../components/ComparisonTable';
import { ComparisonIndicator } from '../components/ComparisonIndicator';
import { ComparisonManager } from '../managers/ComparisonManager';
import {
  selectPersistenceStrategy,
  ServerPersistenceOptions,
  StorageLike
} from '../persistence/PersistenceStrategy';
import { Comparison, ComparisonNotification, Product } from '../types';

export interface ComparisonAppOptions extends ServerPersistenceOptions {
  isAuthenticated: boolean;
  storage?: StorageLike;
  initialComparison?: Comparison;
  notifications?: ComparisonNotification[];
}

export class ComparisonApp {
  readonly manager: ComparisonManager;
  private notifications: ComparisonNotification[];

  constructor(private readonly options: ComparisonAppOptions) {
    this.notifications = options.notifications ?? [];
    const persistence = selectPersistenceStrategy(options.isAuthenticated, options);
    this.manager = new ComparisonManager(options.initialComparison, {
      persistence,
      onNotification: (notification) => this.notifications.push(notification)
    });
  }

  async addProduct(product: Product): Promise<void> {
    await this.manager.addProduct(product);
  }

  async removeProduct(productId: string): Promise<void> {
    await this.manager.removeProduct(productId);
  }

  renderTable(): ReturnType<ComparisonTable['render']> {
    return new ComparisonTable({
      comparison: this.manager.getComparison(),
      onRemoveProduct: (productId) => {
        void this.removeProduct(productId);
      },
      onShare: async () => {
        await this.manager.generateShareableUrl();
      }
    }).render();
  }

  renderIndicator(): ReturnType<ComparisonIndicator['render']> {
    return new ComparisonIndicator({
      productCount: this.manager.getComparison().products.length,
      onClick: () => undefined
    }).render();
  }

  getNotifications(): ComparisonNotification[] {
    return this.notifications.map((notification) => ({ ...notification }));
  }
}
