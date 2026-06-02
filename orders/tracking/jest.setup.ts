const expectedWarnings = new Set([
  'Order lookup failed',
]);

const expectedErrors = new Set([
  'Email notification failed',
  'Failed to publish order status update event',
]);

const originalWarn = console.warn.bind(console);
const originalError = console.error.bind(console);

console.warn = ((message?: unknown, ...args: unknown[]) => {
  if (typeof message === 'string' && expectedWarnings.has(message)) {
    return;
  }
  originalWarn(message, ...args);
}) as typeof console.warn;

console.error = ((message?: unknown, ...args: unknown[]) => {
  if (typeof message === 'string' && expectedErrors.has(message)) {
    return;
  }
  originalError(message, ...args);
}) as typeof console.error;
