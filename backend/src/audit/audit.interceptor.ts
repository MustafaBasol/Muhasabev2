import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AuditService, AuditLogEntry } from './audit.service';
import { AuditAction } from './entities/audit-log.entity';

export interface AuditableEntity {
  id: string;
  tenantId: string;
  [key: string]: any;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();
    const controller = context.getClass();
    
    // Get metadata about the audit configuration
    const auditConfig = this.getAuditConfig(controller, handler);
    
    console.log(`🎯 AuditInterceptor: ${request.method} ${request.url} - auditConfig:`, auditConfig);
    
    if (!auditConfig) {
      console.log('❌ AuditInterceptor: No audit config found, skipping');
      return next.handle();
    }

    const { entity: entityName, action } = auditConfig;
    
    // Store original data for UPDATE operations
    let originalData: any = null;
    
    return next.handle().pipe(
      tap(async (result) => {
        try {
          const user = (request as any).user;
          const tenantId = user?.tenantId;
          const userId = user?.id;
          
          if (!tenantId) {
            console.warn('AuditInterceptor: No tenant ID found, skipping audit log');
            return;
          }

          // Extract IP address
          const ip = this.extractIpAddress(request);
          const userAgent = request.headers['user-agent'];

          let entityId: string | undefined;
          let diff: Record<string, any> | undefined;

          // Handle different actions
          switch (action) {
            case AuditAction.CREATE:
              if (result && result.id) {
                entityId = result.id;
                diff = this.auditService.createDiff(null, result);
              }
              break;

            case AuditAction.UPDATE:
              if (result && result.id) {
                entityId = result.id;
                // For updates, we need the original data
                // This should be set by the controller before the update
                const originalValue = (request as any).originalValue;
                diff = this.auditService.createDiff(originalValue, result);
              }
              break;

            case AuditAction.DELETE:
              // For delete operations, the result might contain the deleted entity
              if (result && result.id) {
                entityId = result.id;
                diff = this.auditService.createDiff(result, null);
              } else {
                // If no result, try to get entity ID from request params
                entityId = request.params?.id;
                diff = { deleted: true };
              }
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

          await this.auditService.log(auditEntry);
        } catch (error) {
          console.error('AuditInterceptor error:', error);
          // Don't throw error to prevent breaking the main operation
        }
      }),
    );
  }

  private getAuditConfig(controller: any, handler: any): { entity: string; action: AuditAction } | null {
    // Check for audit metadata on the handler or controller
    const handlerAudit = Reflect.getMetadata('audit', handler);
    const controllerAudit = Reflect.getMetadata('audit', controller);
    
    const config = handlerAudit || controllerAudit;
    
    if (!config) {
      return null;
    }

    return config;
  }

  private extractIpAddress(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    ) as string;
  }
}

// Decorator to mark methods/controllers for auditing
export function Audit(entity: string, action: AuditAction) {
  return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    const auditConfig = { entity, action };
    
    if (propertyKey) {
      // Method decorator
      Reflect.defineMetadata('audit', auditConfig, descriptor?.value);
    } else {
      // Class decorator
      Reflect.defineMetadata('audit', auditConfig, target);
    }
  };
}