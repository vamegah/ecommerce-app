export interface OrderTrackingConfig {
  databaseUrl: string;
  messageQueueUrl: string;
  emailFrom: string;
  websocketPath: string;
  notificationBatchWindowMs: number;
}

export function loadOrderTrackingConfig(env: NodeJS.ProcessEnv = process.env): OrderTrackingConfig {
  return {
    databaseUrl: env.ORDER_TRACKING_DATABASE_URL ?? 'memory://orders',
    messageQueueUrl: env.ORDER_TRACKING_QUEUE_URL ?? 'memory://queue',
    emailFrom: env.ORDER_TRACKING_EMAIL_FROM ?? 'orders@example.test',
    websocketPath: env.ORDER_TRACKING_WS_PATH ?? '/ws/orders',
    notificationBatchWindowMs: Number(env.ORDER_TRACKING_BATCH_WINDOW_MS ?? 120000),
  };
}
