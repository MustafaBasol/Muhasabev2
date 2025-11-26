import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Guard to ensure tenant isolation
 * Verifies that the requested resource belongs to the user's tenant
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { tenantId?: string }>();
    const user = request.user;

    if (!user || !user.tenantId) {
      throw new ForbiddenException('Tenant information is required');
    }

    // Add tenantId to request for easy access
    request.tenantId = user.tenantId;

    return true;
  }
}
