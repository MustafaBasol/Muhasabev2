import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationLog } from '../entities/integration-log.entity';
import { IntegrationLogLevel } from '../types/integration.types';

export interface LogEntryOptions {
  tenantId: string;
  providerKey: string;
  action: string;
  level?: IntegrationLogLevel;
  outboundJobId?: string | null;
  invoiceId?: string | null;
  httpMethod?: string | null;
  httpUrl?: string | null;
  httpStatus?: number | null;
  requestBody?: Record<string, unknown> | null;
  responseBody?: Record<string, unknown> | null;
  errorMessage?: string | null;
  durationMs?: number | null;
}

/**
 * Provider API çağrılarını denetim tablosuna yazan yardımcı servis.
 * Tüm provider connector'ları bu servisi kullanır.
 */
@Injectable()
export class IntegrationLogService {
  constructor(
    @InjectRepository(IntegrationLog)
    private readonly logRepository: Repository<IntegrationLog>,
  ) {}

  async log(options: LogEntryOptions): Promise<void> {
    const entry = this.logRepository.create({
      tenantId: options.tenantId,
      providerKey: options.providerKey,
      action: options.action,
      level: options.level ?? IntegrationLogLevel.INFO,
      outboundJobId: options.outboundJobId ?? null,
      invoiceId: options.invoiceId ?? null,
      httpMethod: options.httpMethod ?? null,
      httpUrl: options.httpUrl ?? null,
      httpStatus: options.httpStatus ?? null,
      requestBody: options.requestBody ?? null,
      responseBody: options.responseBody ?? null,
      errorMessage: options.errorMessage ?? null,
      durationMs: options.durationMs ?? null,
    });
    await this.logRepository.save(entry);
  }

  async info(options: Omit<LogEntryOptions, 'level'>): Promise<void> {
    return this.log({ ...options, level: IntegrationLogLevel.INFO });
  }

  async warn(options: Omit<LogEntryOptions, 'level'>): Promise<void> {
    return this.log({ ...options, level: IntegrationLogLevel.WARN });
  }

  async error(options: Omit<LogEntryOptions, 'level'>): Promise<void> {
    return this.log({ ...options, level: IntegrationLogLevel.ERROR });
  }
}
