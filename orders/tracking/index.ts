/**
 * Order Tracking System
 * Main entry point for the order tracking module
 */

// Export types
export * from './types';

// Export services
export { OrderTrackingService } from './services/OrderTrackingService';
export { ValidationService } from './services/ValidationService';
export { NotificationService } from './services/NotificationService';
export { WebSocketServer } from './services/WebSocketServer';
export { InMemoryMessageQueue } from './services/InMemoryMessageQueue';
export { InMemoryOrderStore } from './services/OrderTrackingService';

// Export API
export { OrderTrackingAPI } from './api/routes';

// Export errors
export * from './errors';

// Export config
export * from './config';
