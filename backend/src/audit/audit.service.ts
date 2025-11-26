import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from './entities/audit-log.entity';

type DiffRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export interface AuditLogEntry {
  userId?: string;
  tenantId: string;
  entity: string;
  entityId?: string;
  action: AuditAction;
  diff?: DiffRecord;
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

    const logs = await queryBuilder.skip(skip).take(limit).getMany();

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
  private maskPiiData(diff: DiffRecord): DiffRecord | undefined {
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

    const maskObject = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        return value.map((item) => maskObject(item));
      }

      if (!isRecord(value)) {
        return value;
      }

      const result: DiffRecord = { ...value };
      for (const [key, entry] of Object.entries(result)) {
        const lowerKey = key.toLowerCase();
        if (piiFields.some((field) => lowerKey.includes(field))) {
          if (typeof entry === 'string' && entry.length > 0) {
            if (lowerKey.includes('email') && entry.includes('@')) {
              const [local, domain] = entry.split('@');
              result[key] = `${local.substring(0, 2)}***@${domain}`;
            } else {
              result[key] = `${entry.substring(0, 2)}***`;
            }
          }
        } else {
          result[key] = maskObject(entry);
        }
      }
      return result;
    };

    const masked = maskObject(maskedDiff);
    return isRecord(masked) ? masked : maskedDiff;
  }

  /**
   * Create diff between old and new values
   */
  createDiff(oldValue: unknown, newValue: unknown): DiffRecord {
    if (!isRecord(oldValue)) {
      return { created: newValue ?? null };
    }

    if (!isRecord(newValue)) {
      return { deleted: oldValue ?? null };
    }

    const diff: DiffRecord = {};
    const allKeys = new Set([
      ...Object.keys(oldValue),
      ...Object.keys(newValue),
    ]);

    for (const key of allKeys) {
      const oldVal = oldValue[key];
      const newVal = newValue[key];
      if (!this.valuesEqual(oldVal, newVal)) {
        diff[key] = {
          from: oldVal,
          to: newVal,
        };
      }
    }

    return Object.keys(diff).length > 0 ? diff : {};
  }

  private valuesEqual(a: unknown, b: unknown): boolean {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return a === b;
    }
  }
}
