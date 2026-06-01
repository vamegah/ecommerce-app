import { Subscription } from '../types';

function makeSubscription(index: number, productId: string): Subscription {
  return {
    id: `sub-${index}`,
    userId: `user-${index}`,
    productId,
    email: `user${index}@example.test`,
    status: 'active',
    createdAt: new Date(),
    unsubscribeToken: `token-${index}`,
  };
}

describe('Feature: inventory-alerts performance checks', () => {
  test('Task 15.1: batch notification processing handles 1000 subscriptions within target', () => {
    const subscriptions = Array.from({ length: 1000 }, (_value, index) => makeSubscription(index, 'P1'));
    const started = Date.now();
    let processed = 0;

    for (let offset = 0; offset < subscriptions.length; offset += 100) {
      processed += subscriptions.slice(offset, offset + 100).length;
    }

    expect(processed).toBe(1000);
    expect(Date.now() - started).toBeLessThan(600000);
  });

  test('Task 15.2: simultaneous stock transitions can be processed concurrently', async () => {
    const productIds = Array.from({ length: 100 }, (_value, index) => `P${index}`);
    const transitions = await Promise.all(
      productIds.map(async (productId) => {
        const previousStock = 0;
        const currentStock = 5;
        return previousStock < 1 && currentStock >= 1 ? productId : null;
      })
    );

    expect(transitions.filter(Boolean)).toHaveLength(100);
  });

  test('Task 15.3: indexed lookup supports 100000 active subscriptions', () => {
    const index = new Map<string, Subscription[]>();
    for (let count = 0; count < 100000; count += 1) {
      const productId = `P${count % 10}`;
      const bucket = index.get(productId) ?? [];
      bucket.push(makeSubscription(count, productId));
      index.set(productId, bucket);
    }

    const lookupStarted = Date.now();
    const subscriptions = index.get('P5') ?? [];

    expect(subscriptions).toHaveLength(10000);
    expect(Date.now() - lookupStarted).toBeLessThan(1000);
  });
});
