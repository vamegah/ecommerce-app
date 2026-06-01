/**
 * REST API Routes
 * Provides HTTP endpoints for order tracking operations.
 */

import { AdminContext, ApiResponse, OrderDetails, OrderStatus, StatusHistoryEntry, StatusType } from '../types';
import { BadRequestError, formatError, UnauthorizedError } from '../errors';
import { OrderTrackingService } from '../services/OrderTrackingService';

export class OrderTrackingAPI {
  constructor(private readonly trackingService: OrderTrackingService) {}

  /**
   * GET /api/orders/:orderId/status
   * Returns current order status
   */
  async getStatus(orderId: string): Promise<ApiResponse<OrderStatus>> {
    try {
      return { statusCode: 200, body: await this.trackingService.getOrderStatus(orderId) };
    } catch (error) {
      return formatError(error);
    }
  }

  /**
   * GET /api/orders/:orderId/history
   * Returns complete status history
   */
  async getHistory(orderId: string): Promise<ApiResponse<StatusHistoryEntry[]>> {
    try {
      return { statusCode: 200, body: await this.trackingService.getStatusHistory(orderId) };
    } catch (error) {
      return formatError(error);
    }
  }

  /**
   * POST /api/orders/:orderId/status
   * Updates order status (admin only)
   */
  async updateStatus(orderId: string, body: any, admin: AdminContext | string): Promise<ApiResponse<any>> {
    try {
      const adminContext = this.normalizeAdmin(admin);
      if (!adminContext.isAdmin) {
        throw new UnauthorizedError();
      }
      const status = this.parseStatus(body?.status ?? body?.newStatus);
      const update = await this.trackingService.updateOrderStatus(
        orderId,
        status,
        adminContext.adminId,
        body?.notes,
        Boolean(adminContext.isPrivileged)
      );
      return { statusCode: 200, body: update };
    } catch (error) {
      return formatError(error);
    }
  }

  /**
   * GET /api/orders/:orderId/tracking
   * Returns full tracking page data
   */
  async getTrackingPage(orderId: string): Promise<ApiResponse<OrderDetails>> {
    try {
      return { statusCode: 200, body: await this.trackingService.getTrackingPageData(orderId) };
    } catch (error) {
      return formatError(error);
    }
  }

  private normalizeAdmin(admin: AdminContext | string): AdminContext {
    if (typeof admin === 'string') {
      return { adminId: admin, isAdmin: Boolean(admin) };
    }
    return admin;
  }

  private parseStatus(value: unknown): StatusType {
    if (Object.values(StatusType).includes(value as StatusType)) {
      return value as StatusType;
    }
    throw new BadRequestError('Invalid order status.', { status: value });
  }
}
