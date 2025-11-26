import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService, AuditLogEntry } from './audit.service';
import { AuditAction } from './entities/audit-log.entity';
import { AttributionService } from './attribution.service';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import type { KnownEntity } from './attribution.service';

type AuditMetadata = { entity: string; action: AuditAction };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly attribution: AttributionService,
  ) {}

  private readonly logger = new Logger(AuditInterceptor.name);

  private isTestEnv(): boolean {
    return process.env.NODE_ENV === 'test';
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<
      AuthenticatedRequest & {
        originalValue?: Record<string, unknown> | null;
      }
    >();
    const handler = context.getHandler() as (...args: unknown[]) => unknown;
    const controller = context.getClass() as Type<unknown>;

    // Get metadata about the audit configuration
    const auditConfig = this.getAuditConfig(controller, handler);

    if (!this.isTestEnv()) {
      this.logger.debug(
        `AuditInterceptor: ${request.method} ${request.url} - auditConfig: ${JSON.stringify(
          auditConfig,
        )}`,
      );
    }

    if (!auditConfig) {
      if (!this.isTestEnv()) {
        this.logger.debug('AuditInterceptor: No audit config found, skipping');
      }
      return next.handle();
    }

    const { entity: entityName, action } = auditConfig;

    return next.handle().pipe(
      tap((result: unknown) => {
        try {
          const user = request.user;
          const tenantId = user?.tenantId;
          const userId = user?.id;
          // Görünen ad: Ad Soyad birleşimi, yoksa e‑posta
          const displayName = this.buildDisplayName(user);

          if (!tenantId) {
            if (!this.isTestEnv()) {
              this.logger.warn(
                'AuditInterceptor: No tenant ID found, skipping audit log',
              );
            }
            return;
          }

          // Extract IP address
          const ip = this.extractIpAddress(request);
          const userAgent = this.extractUserAgent(request);

          let entityId: string | undefined;
          let diff: AuditLogEntry['diff'];

          // Handle different actions
          switch (action) {
            case AuditAction.CREATE:
              entityId = this.extractEntityId(result);
              diff = this.auditService.createDiff(null, result);
              break;

            case AuditAction.UPDATE:
              entityId = this.extractEntityId(result);
              diff = this.auditService.createDiff(
                request.originalValue ?? null,
                result,
              );
              break;

            case AuditAction.DELETE:
              // For delete operations, the result might contain the deleted entity
              entityId = this.extractEntityId(result);
              if (!entityId) {
                entityId = this.extractRouteEntityId(request);
              }
              diff = this.auditService.createDiff(result, null);
              break;
          }

          const auditEntry: AuditLogEntry = {
            userId,
            tenantId,
            entity: entityName,
            entityId,
            action,
            diff,
            ip,
            userAgent,
          };

          // Response enrich: dönen nesne üzerinde de alanları doldur
          const mutableResult = isRecord(result) ? result : null;
          if (mutableResult) {
            try {
              if (action === AuditAction.CREATE) {
                mutableResult['createdById'] = userId;
                mutableResult['createdByName'] = displayName ?? null;
                mutableResult['updatedById'] = userId;
                mutableResult['updatedByName'] = displayName ?? null;
              } else if (action === AuditAction.UPDATE) {
                mutableResult['updatedById'] = userId;
                mutableResult['updatedByName'] = displayName ?? null;
              }
            } catch (error) {
              this.logger.warn(
                `AuditInterceptor response enrichment failed: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }

          // Fire and forget; don't return a Promise from tap callback
          void this.auditService
            .log(auditEntry)
            .catch((error) =>
              this.logger.error(
                'AuditInterceptor log error',
                error instanceof Error ? error.stack : String(error),
              ),
            );

          // Ayrıca entity üzerinde createdBy/updatedBy alanlarını güncelle
          const actionStr = action as 'CREATE' | 'UPDATE' | 'DELETE';
          if (this.isKnownEntity(entityName)) {
            void this.attribution
              .setAttribution(entityName, entityId, actionStr, {
                id: userId,
                name: displayName,
              })
              .catch((error) =>
                this.logger.warn(
                  `AttributionService error: ${error instanceof Error ? error.message : String(error)}`,
                ),
              );
          }
        } catch (error) {
          this.logger.error(
            'AuditInterceptor error',
            error instanceof Error ? error.stack : String(error),
          );
          // Don't throw error to prevent breaking the main operation
        }
      }),
    );
  }

  private getAuditConfig(
    controller: Type<unknown>,
    handler: (...args: unknown[]) => unknown,
  ): AuditMetadata | null {
    const handlerAudit = Reflect.getMetadata('audit', handler);
    if (this.isAuditMetadata(handlerAudit)) {
      return handlerAudit;
    }

    const controllerAudit = Reflect.getMetadata('audit', controller);
    if (this.isAuditMetadata(controllerAudit)) {
      return controllerAudit;
    }

    return null;
  }

  private isAuditMetadata(value: unknown): value is AuditMetadata {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as AuditMetadata).entity === 'string' &&
      Object.values(AuditAction).includes((value as AuditMetadata).action)
    );
  }

  private isKnownEntity(value: unknown): value is KnownEntity {
    return (
      typeof value === 'string' &&
      ['Quote', 'Sale', 'Invoice', 'Expense', 'Product', 'Customer', 'Supplier'].includes(
        value,
      )
    );
  }

  private extractIpAddress(request: AuthenticatedRequest): string {
    const forwarded = this.normalizeHeaderValue(
      request.headers['x-forwarded-for'],
    );
    if (forwarded) {
      return forwarded.split(',')[0]?.trim() || forwarded;
    }

    const realIp = this.normalizeHeaderValue(request.headers['x-real-ip']);
    if (realIp) {
      return realIp;
    }

    return (
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }

  private extractUserAgent(request: AuthenticatedRequest): string | undefined {
    return this.normalizeHeaderValue(request.headers['user-agent']);
  }

  private normalizeHeaderValue(
    value: string | string[] | undefined,
  ): string | undefined {
    if (Array.isArray(value)) {
      return value[0];
    }
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private extractEntityId(source: unknown): string | undefined {
    if (!isRecord(source)) {
      return undefined;
    }
    return this.coerceEntityId(source.id);
  }

  private extractRouteEntityId(
    request: AuthenticatedRequest,
  ): string | undefined {
    const routeId = request.params?.id;
    return typeof routeId === 'string' && routeId.length > 0
      ? routeId
      : undefined;
  }

  private coerceEntityId(value: unknown): string | undefined {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    return undefined;
  }

  private buildDisplayName(
    user?: AuthenticatedRequest['user'],
  ): string | undefined {
    if (!user) {
      return undefined;
    }
    const parts = [user.firstName, user.lastName]
      .map((part) => (typeof part === 'string' ? part.trim() : ''))
      .filter((part) => part.length > 0);
    if (parts.length > 0) {
      return parts.join(' ');
    }
    return typeof user.email === 'string' ? user.email : undefined;
  }
}

// Decorator to mark methods/controllers for auditing
export function Audit(entity: string, action: AuditAction) {
  return function (
    target: object,
    propertyKey?: string | symbol,
    descriptor?: TypedPropertyDescriptor<unknown>,
  ) {
    const auditConfig = { entity, action };

    if (propertyKey) {
      // Method decorator
      if (descriptor?.value) {
        Reflect.defineMetadata('audit', auditConfig, descriptor.value);
      }
    } else {
      // Class decorator
      Reflect.defineMetadata('audit', auditConfig, target);
    }
  };
}
