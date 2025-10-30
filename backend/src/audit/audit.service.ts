import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from './entities/audit-log.entity';

export interface AuditLogEntry {
  userId?: string;
  tenantId: string;
  entity: string;
  entityId?: string;
  action: AuditAction;
  diff?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

export interface AuditLogFilter {
  tenantId: string;
  userId?: string;
  entity?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
  ) {}

  /**
   * Record an audit log entry
   */
  async log(entry: AuditLogEntry): Promise<AuditLog> {
    // Mask PII data in diff
    const maskedDiff = entry.diff ? this.maskPiiData(entry.diff) : undefined;
    
    const auditLog = this.auditRepository.create({
      ...entry,
      diff: maskedDiff,
    });

    return await this.auditRepository.save(auditLog);
  }

  /**
   * Get audit logs with filtering and pagination
   */
  async findAll(filter: AuditLogFilter) {
    const {
      tenantId,
      userId,
      entity,
      action,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = filter;

    const queryBuilder = this.auditRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user')
      .where('audit.tenantId = :tenantId', { tenantId })
      .orderBy('audit.createdAt', 'DESC');

    if (userId) {
      queryBuilder.andWhere('audit.userId = :userId', { userId });
    }

    if (entity) {
      queryBuilder.andWhere('audit.entity = :entity', { entity });
    }

    if (action) {
      queryBuilder.andWhere('audit.action = :action', { action });
    }

    if (startDate) {
      queryBuilder.andWhere('audit.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('audit.createdAt <= :endDate', { endDate });
    }

    const total = await queryBuilder.getCount();
    const skip = (page - 1) * limit;
    
    const logs = await queryBuilder
      .skip(skip)
      .take(limit)
      .getMany();

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get audit logs for a specific entity
   */
  async findByEntity(
    tenantId: string,
    entity: string,
    entityId: string,
  ): Promise<AuditLog[]> {
    return await this.auditRepository.find({
      where: {
        tenantId,
        entity,
        entityId,
      },
      relations: ['user'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Mask PII data in diff object
   */
  private maskPiiData(diff: Record<string, any>): Record<string, any> | undefined {
    if (!diff) return diff;

    const piiFields = [
      'email',
      'password',
      'phone',
      'ssn',
      'taxId',
      'bankAccount',
      'creditCard',
    ];

    const maskedDiff = { ...diff };

    // Recursively mask PII fields
    const maskObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;

      if (Array.isArray(obj)) {
        return obj.map(maskObject);
      }

      const result = { ...obj };
      for (const [key, value] of Object.entries(result)) {
        const lowerKey = key.toLowerCase();
        
        if (piiFields.some(field => lowerKey.includes(field))) {
          if (typeof value === 'string' && value.length > 0) {
            // Mask email format
            if (lowerKey.includes('email') && value.includes('@')) {
              const [local, domain] = value.split('@');
              result[key] = `${local.substring(0, 2)}***@${domain}`;
            } else {
              // Mask other PII fields
              result[key] = `${value.substring(0, 2)}***`;
            }
          }
        } else if (typeof value === 'object') {
          result[key] = maskObject(value);
        }
      }
      
      return result;
    };

    return maskObject(maskedDiff);
  }

  /**
   * Create diff between old and new values
   */
  createDiff(oldValue: any, newValue: any): Record<string, any> {
    const diff: Record<string, any> = {};

    // Handle creation (no old value)
    if (!oldValue) {
      return { created: newValue };
    }

    // Handle deletion (no new value)
    if (!newValue) {
      return { deleted: oldValue };
    }

    // Compare objects and create diff
    const allKeys = new Set([
      ...Object.keys(oldValue || {}),
      ...Object.keys(newValue || {}),
    ]);

    for (const key of allKeys) {
      const oldVal = oldValue[key];
      const newVal = newValue[key];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diff[key] = {
          from: oldVal,
          to: newVal,
        };
      }
    }

    return Object.keys(diff).length > 0 ? diff : {};
  }
}