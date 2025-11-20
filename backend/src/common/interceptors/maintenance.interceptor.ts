import { CallHandler, ExecutionContext, Injectable, NestInterceptor, HttpException, HttpStatus } from '@nestjs/common';
import { Observable } from 'rxjs';
import { SiteSettingsService } from '../../site-settings/site-settings.service';
import { AdminService } from '../../admin/admin.service';

@Injectable()
export class MaintenanceInterceptor implements NestInterceptor {
  constructor(
    private readonly siteSettingsService: SiteSettingsService,
    private readonly adminService: AdminService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<any>();

    // If not HTTP (e.g., WS), continue
    if (!req) return next.handle();

    const method = (req.method || '').toUpperCase();
    const path: string = (req.path || req.originalUrl || '').toString();

    // Only intercept mutating requests
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (!isMutating) {
      return next.handle();
    }

    // Allow auth, health, and public endpoints during maintenance
    const allowList = [
      /^\/auth(\/|$)/,
      /^\/health(\/|$)/,
      /^\/public(\/|$)/,
    ];
    if (allowList.some((re) => re.test(path))) {
      return next.handle();
    }

    // Allow admin endpoints and any request with valid admin token header
    const adminToken = (req.headers && (req.headers['admin-token'] || req.headers['Admin-Token'])) as string | undefined;
    if (typeof path === 'string' && path.startsWith('/admin')) {
      return next.handle();
    }
    // Special-case: site-settings PUT allowed with admin token to turn off maintenance
    const isSiteSettings = typeof path === 'string' && path.startsWith('/site-settings');

    // Fast path: if no maintenance, continue
    const settings = await this.siteSettingsService.getSettings();
    if (!settings?.maintenanceModeEnabled) {
      return next.handle();
    }

    // Maintenance ON: allow only admin and site-settings with admin token
    const envToken = process.env.ADMIN_TOKEN || 'admin123';
    const isAdmin = !!adminToken && (this.adminService.isValidAdminToken(adminToken as string) || adminToken === envToken);
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
        message: settings.maintenanceMessage || 'The system is currently in maintenance (read-only) mode.',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
