import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Decorator to get the current tenant ID from the authenticated user
 * Usage: @CurrentTenant() tenantId: string
 */
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx
      .switchToHttp()
      .getRequest<AuthenticatedRequest | undefined>();
    const user = request?.user;

    if (!user || !user.tenantId) {
      throw new Error('Tenant ID not found in user context');
    }

    return user.tenantId;
  },
);
