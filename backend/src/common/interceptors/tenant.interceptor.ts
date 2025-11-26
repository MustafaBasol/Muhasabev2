import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Interceptor to log tenant-specific requests and ensure tenant isolation
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { tenantId?: string }>();
    const user = request.user;

    if (user && user.tenantId) {
      // Add tenant context to the request
      request.tenantId = user.tenantId;

      // Log tenant-specific requests (only in development)
      if (process.env.NODE_ENV === 'development') {
        this.logger.debug(
          `Tenant ${user.tenantId}: ${request.method} ${request.url}`,
        );
      }
    }

    return next.handle().pipe(
      tap(() => {
        // Additional logging or processing can be added here
      }),
    );
  }
}
