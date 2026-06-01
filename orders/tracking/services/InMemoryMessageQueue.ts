import { MessageQueue, StatusUpdateEvent } from '../types';

export class InMemoryMessageQueue implements MessageQueue {
  private handlers: Array<(event: StatusUpdateEvent) => void | Promise<void>> = [];
  public readonly publishedEvents: StatusUpdateEvent[] = [];
  public failNextPublish = false;

  async publish(event: StatusUpdateEvent): Promise<void> {
    if (this.failNextPublish) {
      this.failNextPublish = false;
      throw new Error('Message queue publish failed');
    }
    this.publishedEvents.push(event);
    await Promise.all(this.handlers.map((handler) => handler(event)));
  }

  subscribe(handler: (event: StatusUpdateEvent) => void | Promise<void>): void {
    this.handlers.push(handler);
  }
}
