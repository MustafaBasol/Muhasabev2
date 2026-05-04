import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EInvoiceStatus,
  Invoice,
} from '../../../invoices/entities/invoice.entity';
import { EInvoiceEvent } from '../../common/entities/einvoice-event.entity';
import { EInvoiceExternalInvoice } from '../../common/entities/einvoice-external-invoice.entity';
import { EInvoicingProvider } from '../../common/types/integration.types';
import { IopoleApiClient } from './iopole-api.client';
import {
  IOPOLE_EINVOICE_STATUS_MAP,
  IopoleInvoiceSearchParams,
} from '../types/iopole.types';

type IopoleDirection = 'INBOUND' | 'OUTBOUND';

interface IopoleRejectionDetail {
  message: string | null;
  reason: string | null;
  networkReason: string | null;
}

interface SyncInvoiceDetailResult {
  invoiceId: string;
  snapshotId: string;
  localInvoiceUpdated: boolean;
  direction: IopoleDirection | null;
  hasBusinessData: boolean;
}

interface SyncHistoryResult {
  invoiceId: string;
  createdEvents: number;
  duplicateEvents: number;
  lastStatusCode: string | null;
  localInvoiceUpdated: boolean;
}

interface SyncSearchResult {
  syncedCount: number;
  invoiceIds: string[];
}

@Injectable()
export class IopoleSyncService {
  private readonly logger = new Logger(IopoleSyncService.name);

  constructor(
    private readonly apiClient: IopoleApiClient,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(EInvoiceEvent)
    private readonly eventRepository: Repository<EInvoiceEvent>,
    @InjectRepository(EInvoiceExternalInvoice)
    private readonly externalInvoiceRepository: Repository<EInvoiceExternalInvoice>,
  ) {}

  async syncInvoiceByExternalId(
    invoiceId: string,
    tenantId?: string,
  ): Promise<SyncInvoiceDetailResult> {
    const payload = await this.apiClient.getInvoice(invoiceId);
    const detail = this.normalizeInvoiceDetail(payload, invoiceId);
    const direction = this.mapWayToDirection(this.readString(detail, 'way'));
    const localInvoice = await this.findLocalInvoice(invoiceId, tenantId);

    const snapshot = await this.upsertExternalSnapshot({
      invoiceId,
      tenantId: tenantId ?? localInvoice?.tenantId ?? null,
      localInvoiceId: localInvoice?.id ?? null,
      detail,
      rawPayload: payload,
      direction,
    });

    if (localInvoice) {
      await this.applyInvoiceUpdate(localInvoice, {
        invoiceId,
        statusCode: null,
        lifecycleStatus: null,
        paymentStatus: null,
        eventDate: this.parseDate(this.readString(detail, 'date')),
        rejectionDetail: null,
        errorCode: null,
        errorMessage: null,
      });
    }

    this.logger.log(
      `Iopole detail sync tenant=${tenantId ?? 'unknown'} invoiceId=${invoiceId}`,
    );

    return {
      invoiceId,
      snapshotId: snapshot.id,
      localInvoiceUpdated: !!localInvoice,
      direction,
      hasBusinessData: this.isRecord(detail.businessData),
    };
  }

  async syncInvoiceStatusHistory(
    invoiceId: string,
    tenantId?: string,
  ): Promise<SyncHistoryResult> {
    const payload = await this.apiClient.getInvoiceStatusHistory(invoiceId);
    const entries = this.normalizeStatusHistory(payload);
    const localInvoice = await this.findLocalInvoice(invoiceId, tenantId);
    const effectiveTenantId = tenantId ?? localInvoice?.tenantId ?? null;

    let createdEvents = 0;
    let duplicateEvents = 0;
    let lastStatusCode: string | null = null;
    let lastEventAt: Date | null = null;
    let lastRejection: IopoleRejectionDetail | null = null;

    for (const entry of entries) {
      const providerEventId = this.readString(entry, 'statusId');
      if (!providerEventId) {
        continue;
      }

      const existing = await this.eventRepository.findOne({
        where: {
          providerKey: EInvoicingProvider.IOPOLE,
          providerEventId,
        },
      });

      if (existing) {
        duplicateEvents += 1;
      } else {
        const statusCode = this.extractStatusCode(entry);
        const eventDate = this.parseDate(this.readString(entry, 'date'));

        await this.eventRepository.save(
          this.eventRepository.create({
            tenantId: effectiveTenantId,
            providerKey: EInvoicingProvider.IOPOLE,
            invoiceId: localInvoice?.id ?? null,
            providerInvoiceId: invoiceId,
            providerEventId,
            eventType: 'status-history',
            status: statusCode,
            payload: entry,
            processedAt: eventDate,
          }),
        );
        createdEvents += 1;
      }

      const statusCode = this.extractStatusCode(entry);
      const eventDate = this.parseDate(this.readString(entry, 'date'));
      if (!lastEventAt || (eventDate && eventDate >= lastEventAt)) {
        lastEventAt = eventDate;
        lastStatusCode = statusCode;
        lastRejection = this.extractRejectionDetail(entry);
      }
    }

    const snapshotWhere = effectiveTenantId
      ? {
          tenantId: effectiveTenantId,
          providerKey: EInvoicingProvider.IOPOLE,
          providerInvoiceId: invoiceId,
        }
      : {
          providerKey: EInvoicingProvider.IOPOLE,
          providerInvoiceId: invoiceId,
        };

    const snapshot = await this.externalInvoiceRepository.findOne({
      where: snapshotWhere,
    });

    if (snapshot) {
      snapshot.statusCode = lastStatusCode;
      snapshot.lifecycleStatus = lastStatusCode;
      snapshot.lastEventAt = lastEventAt;
      snapshot.rejectionReasonCode = lastRejection?.reason ?? null;
      snapshot.rejectionReasonLabel = lastRejection?.message ?? null;
      snapshot.errorCode = lastRejection?.networkReason ?? null;
      snapshot.errorMessage = lastRejection?.message ?? null;
      await this.externalInvoiceRepository.save(snapshot);
    }

    if (localInvoice) {
      await this.applyInvoiceUpdate(localInvoice, {
        invoiceId,
        statusCode: lastStatusCode,
        lifecycleStatus: lastStatusCode,
        paymentStatus: null,
        eventDate: lastEventAt,
        rejectionDetail: lastRejection,
        errorCode: lastRejection?.networkReason ?? null,
        errorMessage: lastRejection?.message ?? null,
      });
    }

    this.logger.log(
      `Iopole history sync tenant=${effectiveTenantId ?? 'unknown'} invoiceId=${invoiceId} created=${createdEvents} duplicates=${duplicateEvents}`,
    );

    return {
      invoiceId,
      createdEvents,
      duplicateEvents,
      lastStatusCode,
      localInvoiceUpdated: !!localInvoice,
    };
  }

  async syncSearchResults(
    params: IopoleInvoiceSearchParams,
    tenantId?: string,
  ): Promise<SyncSearchResult> {
    const payload = await this.apiClient.searchInvoices(params);
    const data = Array.isArray(payload?.data) ? payload.data : [];
    const invoiceIds: string[] = [];

    for (const item of data) {
      if (!this.isRecord(item)) {
        continue;
      }

      const metadata = this.readRecord(item, 'metadata');
      const invoiceId = this.readString(metadata, 'invoiceId');
      if (!invoiceId) {
        continue;
      }

      const direction = this.readString(metadata, 'direction') as IopoleDirection | null;
      const localInvoice = await this.findLocalInvoice(invoiceId, tenantId);

      await this.upsertExternalSnapshot({
        invoiceId,
        tenantId: tenantId ?? localInvoice?.tenantId ?? null,
        localInvoiceId: localInvoice?.id ?? null,
        detail: metadata ?? {},
        rawPayload: item,
        direction,
        lifecycleStatus: this.readString(metadata, 'state'),
        statusCode: this.readString(metadata, 'state'),
        documentDate: this.parseDate(this.readString(metadata, 'createDate')),
      });

      invoiceIds.push(invoiceId);
    }

    return { syncedCount: invoiceIds.length, invoiceIds };
  }

  async syncInboundSearchResults(tenantId?: string): Promise<SyncSearchResult> {
    return this.syncSearchResults(
      { q: 'invoice.direction:"INBOUND"', offset: 0, limit: 50 },
      tenantId,
    );
  }

  async syncOutboundSearchResults(tenantId?: string): Promise<SyncSearchResult> {
    return this.syncSearchResults(
      { q: 'invoice.direction:"OUTBOUND"', offset: 0, limit: 50 },
      tenantId,
    );
  }

  normalizeInvoiceDetail(
    payload: Record<string, unknown>,
    invoiceId: string,
  ): Record<string, unknown> {
    const normalized = Array.isArray(payload)
      ? payload[0]
      : Array.isArray(payload?.data)
        ? payload.data[0]
        : payload;

    if (!this.isRecord(normalized)) {
      throw new BadRequestException(`Iopole invoice detail bulunamadı: ${invoiceId}`);
    }

    return normalized;
  }

  mapWayToDirection(value: string | null): IopoleDirection | null {
    switch ((value ?? '').trim().toUpperCase()) {
      case 'RECEIVED':
        return 'INBOUND';
      case 'SENT':
      case 'OUTBOUND':
        return 'OUTBOUND';
      default:
        return null;
    }
  }

  private normalizeStatusHistory(payload: Record<string, unknown>): Record<string, unknown>[] {
    if (Array.isArray(payload)) {
      return payload.filter((entry): entry is Record<string, unknown> => this.isRecord(entry));
    }

    const possibleArrays = [payload?.data, payload?.statuses, payload?.history];
    for (const value of possibleArrays) {
      if (Array.isArray(value)) {
        return value.filter((entry): entry is Record<string, unknown> => this.isRecord(entry));
      }
    }

    return [];
  }

  private extractStatusCode(entry: Record<string, unknown>): string | null {
    const status = this.readRecord(entry, 'status');
    const code = this.readString(status, 'code');
    if (code) {
      return code.toLowerCase();
    }

    const json = this.readRecord(entry, 'json');
    const responses = Array.isArray(json?.responses) ? json.responses : [];
    const firstResponse = responses.find((item) => this.isRecord(item));
    const documentStatus = this.isRecord(firstResponse)
      ? this.readRecord(firstResponse, 'documentStatus')
      : null;
    return this.readString(documentStatus, 'code')?.toLowerCase() ?? null;
  }

  private extractRejectionDetail(
    entry: Record<string, unknown>,
  ): IopoleRejectionDetail | null {
    const json = this.readRecord(entry, 'json');
    const responses = Array.isArray(json?.responses) ? json.responses : [];
    const firstResponse = responses.find((item) => this.isRecord(item));
    const rejectionDetail = this.isRecord(firstResponse)
      ? this.readRecord(firstResponse, 'rejectionDetail')
      : null;

    if (!rejectionDetail) {
      return null;
    }

    return {
      message: this.readString(rejectionDetail, 'message'),
      reason: this.readString(rejectionDetail, 'reason'),
      networkReason: this.readString(rejectionDetail, 'networkReason'),
    };
  }

  private async findLocalInvoice(
    invoiceId: string,
    tenantId?: string,
  ): Promise<Invoice | null> {
    const where = tenantId
      ? [
          { tenantId, eInvoiceExternalId: invoiceId },
          { tenantId, providerInvoiceId: invoiceId },
        ]
      : [
          { eInvoiceExternalId: invoiceId },
          { providerInvoiceId: invoiceId },
        ];

    return this.invoiceRepository.findOne({ where });
  }

  private async upsertExternalSnapshot(input: {
    invoiceId: string;
    tenantId: string | null;
    localInvoiceId: string | null;
    detail: Record<string, unknown>;
    rawPayload: Record<string, unknown> | unknown[];
    direction: IopoleDirection | null;
    lifecycleStatus?: string | null;
    statusCode?: string | null;
    documentDate?: Date | null;
  }): Promise<EInvoiceExternalInvoice> {
    const where = input.tenantId
      ? {
          tenantId: input.tenantId,
          providerKey: EInvoicingProvider.IOPOLE,
          providerInvoiceId: input.invoiceId,
        }
      : {
          providerKey: EInvoicingProvider.IOPOLE,
          providerInvoiceId: input.invoiceId,
        };

    let snapshot = await this.externalInvoiceRepository.findOne({ where });

    if (!snapshot) {
      snapshot = this.externalInvoiceRepository.create({
        tenantId: input.tenantId,
        providerKey: EInvoicingProvider.IOPOLE,
        providerInvoiceId: input.invoiceId,
      });
    }

    snapshot.localInvoiceId = input.localInvoiceId;
    snapshot.direction = input.direction;
    snapshot.way = this.readString(input.detail, 'way');
    snapshot.streamId = this.readString(input.detail, 'streamId');
    snapshot.documentId = this.readString(input.detail, 'documentId');
    snapshot.originalFormat = this.readString(input.detail, 'originalFormat');
    snapshot.originalFlavor = this.readString(input.detail, 'originalFlavor');
    snapshot.originalNetwork = this.readString(input.detail, 'originalNetwork');
    snapshot.documentDate =
      input.documentDate ?? this.parseDate(this.readString(input.detail, 'date'));
    snapshot.businessData = this.readRecord(input.detail, 'businessData');
    snapshot.rawPayload = input.rawPayload;
    snapshot.lifecycleStatus = input.lifecycleStatus ?? snapshot.lifecycleStatus;
    snapshot.statusCode = input.statusCode ?? snapshot.statusCode;

    return this.externalInvoiceRepository.save(snapshot);
  }

  private async applyInvoiceUpdate(
    invoice: Invoice,
    input: {
      invoiceId: string;
      statusCode: string | null;
      lifecycleStatus: string | null;
      paymentStatus: string | null;
      eventDate: Date | null;
      rejectionDetail: IopoleRejectionDetail | null;
      errorCode: string | null;
      errorMessage: string | null;
    },
  ): Promise<void> {
    const mappedStatus = input.statusCode
      ? IOPOLE_EINVOICE_STATUS_MAP[input.statusCode] ?? EInvoiceStatus.PENDING
      : invoice.eInvoiceStatus;

    invoice.eInvoiceProvider = EInvoicingProvider.IOPOLE;
    invoice.eInvoiceExternalId = input.invoiceId;
    invoice.providerInvoiceId = input.invoiceId;
    invoice.eInvoiceStatus = mappedStatus;
    invoice.eInvoiceStatusCode = input.statusCode;
    invoice.eInvoiceLifecycleStatus = input.lifecycleStatus;
    invoice.eInvoicePaymentStatus = input.paymentStatus;
    invoice.eInvoiceLastEventAt = input.eventDate;
    invoice.lastProviderSyncAt = new Date();
    invoice.eInvoiceErrorCode = input.errorCode;
    invoice.eInvoiceErrorMessage = input.errorMessage;
    invoice.providerError = input.errorMessage;
    invoice.eInvoiceStatusReason = input.rejectionDetail?.message ?? input.errorMessage;

    if (input.statusCode === 'refused') {
      invoice.eInvoiceRejectedAt = input.eventDate;
      invoice.eInvoiceRejectionReasonCode = input.rejectionDetail?.reason ?? null;
      invoice.eInvoiceRejectionReasonLabel = input.rejectionDetail?.message ?? null;
    }

    await this.invoiceRepository.save(invoice);
  }

  private parseDate(value: string | null): Date | null {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private readString(
    value: Record<string, unknown> | null,
    key: string,
  ): string | null {
    const candidate = value?.[key];
    return typeof candidate === 'string' && candidate.trim() ? candidate : null;
  }

  private readRecord(
    value: Record<string, unknown> | null,
    key: string,
  ): Record<string, unknown> | null {
    const candidate = value?.[key];
    return this.isRecord(candidate) ? candidate : null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }
}