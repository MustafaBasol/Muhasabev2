import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { SiteSettingsService } from '../../site-settings/site-settings.service';
import { AdminService } from '../../admin/admin.service';

@Injectable()
export class MaintenanceInterceptor implements NestInterceptor {
  constructor(
    private readonly siteSettingsService: SiteSettingsService,
    private readonly adminService: AdminService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<Request | undefined>();

    // If not HTTP (e.g., WS), continue
    if (!req) {
      return next.handle();
    }

    const method =
      typeof req.method === 'string' ? req.method.toUpperCase() : '';
    const path = this.resolvePath(req);

    // Only intercept mutating requests
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (!isMutating) {
      return next.handle();
    }

    // Allow auth, health, and public endpoints during maintenance
    const allowList = [/^\/auth(\/|$)/, /^\/health(\/|$)/, /^\/public(\/|$)/];
    if (allowList.some((re) => re.test(path))) {
      return next.handle();
    }

    // Allow admin endpoints and any request with valid admin token header
    const adminToken = this.getAdminToken(req);
    if (path.startsWith('/admin')) {
      return next.handle();
    }
    // Special-case: site-settings PUT allowed with admin token to turn off maintenance
    const isSiteSettings = path.startsWith('/site-settings');

    // Fast path: if no maintenance, continue
    const settings = await this.siteSettingsService.getSettings();
    if (!settings?.maintenanceModeEnabled) {
      return next.handle();
    }

    // Maintenance ON: allow only admin and site-settings with admin token
    const envToken = process.env.ADMIN_TOKEN || 'admin123';
    const isAdmin =
      !!adminToken &&
      (this.adminService.isValidAdminToken(adminToken) ||
        adminToken === envToken);
    if (isAdmin) {
      return next.handle();
    }
    if (isSiteSettings && isAdmin) {
      return next.handle();
    }

    // Block with 503 JSON
    // Throwing an HttpException will be formatted by Nest's default filter
    throw new HttpException(
      {
        error: 'MAINTENANCE_MODE',
        message:
          settings.maintenanceMessage ||
          'The system is currently in maintenance (read-only) mode.',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private resolvePath(req: Request): string {
    if (typeof req.path === 'string' && req.path.length > 0) {
      return req.path;
    }
    if (typeof req.originalUrl === 'string') {
      return req.originalUrl;
    }
    return '';
  }

  private getAdminToken(req: Request): string | undefined {
    const candidate =
      this.getHeaderValue(req, 'admin-token') ||
      this.getHeaderValue(req, 'Admin-Token');
    return candidate;
  }

  private getHeaderValue(req: Request, key: string): string | undefined {
    const normalizedKey = key.toLowerCase();
    const headerValue = req.headers?.[normalizedKey];
    if (typeof headerValue === 'string') {
      return headerValue;
    }
    if (Array.isArray(headerValue)) {
      return headerValue[0];
    }
    return undefined;
  }
}
