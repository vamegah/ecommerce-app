/**
 * Validation Service
 * Enforces business rules for status transitions
 */

import { StatusType } from '../types';

export class ValidationService {
  private readonly standardTransitions: Record<StatusType, StatusType[]> = {
    [StatusType.PENDING]: [StatusType.PROCESSING, StatusType.CANCELLED],
    [StatusType.PROCESSING]: [StatusType.SHIPPED, StatusType.CANCELLED],
    [StatusType.SHIPPED]: [StatusType.DELIVERED, StatusType.RETURNED],
    [StatusType.DELIVERED]: [],
    [StatusType.CANCELLED]: [],
    [StatusType.RETURNED]: [],
  };

  private readonly privilegedTransitions: Partial<Record<StatusType, StatusType[]>> = {
    [StatusType.DELIVERED]: [StatusType.RETURNED],
    [StatusType.CANCELLED]: [StatusType.PROCESSING],
  };

  /**
   * Check if transition is valid
   */
  isValidTransition(
    from: StatusType,
    to: StatusType,
    isPrivileged: boolean
  ): boolean {
    return this.getAllowedTransitions(from, isPrivileged).includes(to);
  }

  /**
   * Get allowed next statuses
   */
  getAllowedTransitions(
    currentStatus: StatusType,
    isPrivileged: boolean
  ): StatusType[] {
    const allowed = new Set(this.standardTransitions[currentStatus] ?? []);
    if (isPrivileged) {
      for (const status of this.privilegedTransitions[currentStatus] ?? []) {
        allowed.add(status);
      }
    }
    return Array.from(allowed);
  }
}
