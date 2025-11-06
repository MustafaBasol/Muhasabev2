import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Quote, QuoteStatus } from './entities/quote.entity';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { Tenant } from '../tenants/entities/tenant.entity';
import { BankAccount } from '../bank-accounts/entities/bank-account.entity';

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(Quote)
    private readonly repo: Repository<Quote>,
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
    @InjectRepository(BankAccount)
    private readonly bankAccountsRepo: Repository<BankAccount>,
  ) {}

  private isUuid(val?: string | null) {
    if (!val) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      val,
    );
  }

  private async ensureCustomerExistsOrNull(
    customerId?: string | null,
  ): Promise<string | null> {
    const id = this.isUuid(customerId || '') ? (customerId as string) : null;
    if (!id) return null;
    try {
      const rowsUnknown: unknown = await this.repo.query(
        'SELECT 1 FROM customers WHERE id = $1 LIMIT 1',
        [id],
      );
      const hasRow = Array.isArray(rowsUnknown) && rowsUnknown.length > 0;
      return hasRow ? id : null;
    } catch {
      // Herhangi bir DB hatasında güvenli tarafta kal ve null'a düş
      return null;
    }
  }

  private async generateQuoteNumber(tenantId: string, dateStr: string) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const prefix = `Q-${year}-`;

    const existing = await this.repo.find({
      where: {
        tenantId,
        quoteNumber: Like(`${prefix}%`),
      },
      select: { quoteNumber: true },
    });

    let next = 1;
    if (existing.length > 0) {
      const seqs = existing
        .map((q) => Number((q.quoteNumber || '').split('-').pop() || 0))
        .filter((n) => Number.isFinite(n));
      if (seqs.length > 0) next = Math.max(...seqs) + 1;
    }
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  async create(tenantId: string, dto: CreateQuoteDto) {
    const safeCustomerId = await this.ensureCustomerExistsOrNull(
      dto.customerId ?? null,
    );
    const safeCustomerName = (dto.customerName || '').trim() || null;

    // Benzersiz teklif numarası üretimi: olası yarış koşullarına karşı birkaç kez dene
    let attempts = 0;
    // publicId'yi her denemede yeniden üretmek yerine tek sefer üretelim
    let generatedPublicId: string | undefined;
    try {
      const uuidRowsUnknown: unknown = await this.repo.query(
        'SELECT gen_random_uuid() as id',
      );
      if (Array.isArray(uuidRowsUnknown)) {
        const first = uuidRowsUnknown[0] as { id?: unknown } | undefined;
        if (first && typeof first.id === 'string') {
          generatedPublicId = first.id;
        }
      }
    } catch {
      // publicId üretilemezse TypeORM save sırasında DB default/trigger yoksa undefined kalır
      generatedPublicId = undefined;
    }
    while (attempts < 5) {
      attempts++;
      const quoteNumber =
        dto.quoteNumber ||
        (await this.generateQuoteNumber(tenantId, dto.issueDate));
      const q = this.repo.create({
        tenantId,
        publicId: generatedPublicId,
        quoteNumber,
        customerId: safeCustomerId,
        customerName: safeCustomerName,
        issueDate: new Date(dto.issueDate),
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        currency: dto.currency,
        total: Number(dto.total) || 0,
        status: dto.status || QuoteStatus.DRAFT,
        items: dto.items || [],
        scopeOfWorkHtml: dto.scopeOfWorkHtml || null,
        version: 1,
        revisions: [],
      });
      try {
        return await this.repo.save(q);
      } catch (err: unknown) {
        // 23505: unique_violation (PostgreSQL) — muhtemelen teklif numarası çakıştı; tekrar dene
        const isUniqueViolation = (() => {
          if (typeof err !== 'object' || err === null) return false;
          const e = err as { code?: unknown; message?: unknown };
          return (
            e.code === '23505' ||
            (typeof e.message === 'string' &&
              /unique constraint/i.test(e.message))
          );
        })();
        if (!isUniqueViolation) throw err;
        // Döngü başına yeniden dene — bir sonraki turda yeni numara üretilecek
      }
    }
    // Buraya düştüyse 5 deneme başarısız olmuştur
    throw new Error(
      'Teklif numarası üretimi tekrarlı denemelerde başarısız oldu',
    );
  }

  async findAll(tenantId: string) {
    return this.repo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const q = await this.repo.findOne({ where: { id, tenantId } });
    if (!q) throw new NotFoundException('Quote not found');
    return q;
  }

  async update(tenantId: string, id: string, dto: UpdateQuoteDto) {
    const q = await this.findOne(tenantId, id);
    // Basit alan ataması
    if (dto.issueDate) q.issueDate = new Date(dto.issueDate);
    if (typeof dto.validUntil !== 'undefined')
      q.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    if (typeof dto.customerId !== 'undefined') {
      q.customerId = await this.ensureCustomerExistsOrNull(
        dto.customerId ?? null,
      );
    }
    if (typeof dto.customerName !== 'undefined')
      q.customerName = (dto.customerName || '').trim() || null;
    if (typeof dto.currency !== 'undefined') q.currency = dto.currency;
    if (typeof dto.total !== 'undefined') q.total = Number(dto.total) || 0;
    if (typeof dto.items !== 'undefined')
      q.items = Array.isArray(dto.items) ? dto.items : null;
    if (typeof dto.scopeOfWorkHtml !== 'undefined')
      q.scopeOfWorkHtml = dto.scopeOfWorkHtml || null;
    if (typeof dto.status !== 'undefined') q.status = dto.status;
    // Not: version ve revisions alanları sunucu tarafından yönetilir; DTO üzerinden güncellenmez

    return this.repo.save(q);
  }

  async remove(tenantId: string, id: string) {
    const q = await this.findOne(tenantId, id);
    await this.repo.remove(q);
  }

  // Public operations via publicId
  async findByPublicId(publicId: string) {
    const q = await this.repo.findOne({ where: { publicId } });
    if (!q) throw new NotFoundException('Quote not found');
    // Enrich with tenant public profile for display on public page
    try {
      const tenant = await this.tenantsRepo.findOne({
        where: { id: q.tenantId },
      });
      if (!tenant) return q;

      // Logo & preferences from tenant.settings.brand
      const brand = ((tenant.settings || {}) as any)?.brand || {};
      let resolvedIban: string | undefined = undefined;
      let resolvedBankName: string | undefined = undefined;
      const defaultBankId: string | undefined =
        brand.bankAccountId || brand.defaultBankAccountId;
      if (defaultBankId) {
        try {
          const ba = await this.bankAccountsRepo.findOne({
            where: { id: defaultBankId, tenantId: tenant.id },
          });
          if (ba) {
            resolvedIban = ba.iban;
            resolvedBankName = ba.bankName || undefined;
          }
        } catch {}
      }

      return {
        ...q,
        tenantPublicProfile: {
          name: tenant.companyName || tenant.name,
          address: tenant.address || '',
          taxNumber: tenant.taxNumber || '',
          taxOffice: tenant.taxOffice || '',
          phone: tenant.phone || '',
          email: tenant.email || '',
          website: tenant.website || '',
          // Legal fields
          mersisNumber: (tenant as any).mersisNumber || '',
          kepAddress: (tenant as any).kepAddress || '',
          siretNumber: (tenant as any).siretNumber || '',
          sirenNumber: (tenant as any).sirenNumber || '',
          apeCode: (tenant as any).apeCode || '',
          tvaNumber: (tenant as any).tvaNumber || '',
          rcsNumber: (tenant as any).rcsNumber || '',
          steuernummer: (tenant as any).steuernummer || '',
          umsatzsteuerID: (tenant as any).umsatzsteuerID || '',
          handelsregisternummer: (tenant as any).handelsregisternummer || '',
          geschaeftsfuehrer: (tenant as any).geschaeftsfuehrer || '',
          einNumber: (tenant as any).einNumber || '',
          taxId: (tenant as any).taxId || '',
          businessLicenseNumber: (tenant as any).businessLicenseNumber || '',
          stateOfIncorporation: (tenant as any).stateOfIncorporation || '',
          // Branding
          logoDataUrl: brand.logoDataUrl || '',
          bankAccountId: defaultBankId,
          iban: resolvedIban,
          bankName: resolvedBankName,
          country: brand.country || '',
        },
      } as any;
    } catch {
      return q;
    }
  }

  async markViewed(publicId: string) {
    const q = await this.findByPublicId(publicId);
    if (q.status === QuoteStatus.DRAFT || q.status === QuoteStatus.SENT) {
      q.status = QuoteStatus.VIEWED;
      await this.repo.save(q);
    }
    return q;
  }

  async accept(publicId: string) {
    const q = await this.findByPublicId(publicId);
    q.status = QuoteStatus.ACCEPTED;
    return this.repo.save(q);
  }

  async decline(publicId: string) {
    const q = await this.findByPublicId(publicId);
    q.status = QuoteStatus.DECLINED;
    return this.repo.save(q);
  }
}
