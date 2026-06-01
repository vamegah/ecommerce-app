import { ErrorResponse } from './types';

export class TrackingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'TrackingError';
  }
}

export class OrderNotFoundError extends TrackingError {
  constructor(orderId: string) {
    super('ORDER_NOT_FOUND', 'Order not found', 404, { orderId });
  }
}

export class InvalidTransitionError extends TrackingError {
  constructor(from: string, to: string, allowedTransitions: string[]) {
    super('INVALID_STATUS_TRANSITION', `Invalid status transition from ${from} to ${to}`, 400, {
      from,
      to,
      allowedTransitions,
    });
  }
}

export class UnauthorizedError extends TrackingError {
  constructor() {
    super('ADMIN_REQUIRED', 'Administrator privileges required', 403);
  }
}

export class BadRequestError extends TrackingError {
  constructor(message: string, details: Record<string, any> = {}) {
    super('BAD_REQUEST', message, 400, details);
  }
}

export class SystemError extends TrackingError {
  constructor(message = 'Internal server error', details: Record<string, any> = {}) {
    super('SYSTEM_ERROR', message, 500, details);
  }
}

export function formatError(error: unknown): { statusCode: number; body: ErrorResponse } {
  if (error instanceof TrackingError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: Object.keys(error.details).length > 0 ? error.details : undefined,
          timestamp: new Date(),
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: 'SYSTEM_ERROR',
        message: 'Internal server error',
        details: { message: error instanceof Error ? error.message : String(error) },
        timestamp: new Date(),
      },
    },
  };
}
