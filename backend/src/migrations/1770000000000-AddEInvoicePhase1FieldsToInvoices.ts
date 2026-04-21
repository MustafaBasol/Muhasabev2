import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 — Invoice compliance alanları
 *
 * Eklenenler:
 *   - eInvoiceStatus         : e-fatura iletim durumu (ticari status'tan bağımsız)
 *   - eInvoiceStatusReason   : provider'dan gelen red/hata açıklaması
 *   - documentType           : invoice / credit_note / debit_note
 *   - invoiceCurrency        : fatura para birimi (ISO 4217)
 *   - invoiceLanguage        : fatura dili (BCP 47)
 *   - servicePeriodStart     : hizmet dönemi başlangıcı
 *   - servicePeriodEnd       : hizmet dönemi bitişi
 *   - providerInvoiceId      : external provider referans ID
 *   - lastProviderSyncAt     : son provider senkronizasyon zamanı
 *   - providerError          : provider hata mesajı
 *   - sellerSnapshot         : satıcı yasal bilgi anlık görüntüsü (jsonb)
 *   - buyerSnapshot          : alıcı yasal bilgi anlık görüntüsü (jsonb)
 *
 * Mevcut `status` ve `items` kolonları dokunulmadan korunur.
 */
export class AddEInvoicePhase1FieldsToInvoices1770000000000
  implements MigrationInterface
{
  name = 'AddEInvoicePhase1FieldsToInvoices1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN

        -- eInvoiceStatus
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'eInvoiceStatus'
        ) THEN
          ALTER TABLE "invoices" ADD "eInvoiceStatus" character varying DEFAULT 'not_applicable';
          COMMENT ON COLUMN "invoices"."eInvoiceStatus" IS 'E-fatura iletim durumu: not_applicable|pending|submitted|accepted|rejected|cancelled';
        END IF;

        -- eInvoiceStatusReason
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'eInvoiceStatusReason'
        ) THEN
          ALTER TABLE "invoices" ADD "eInvoiceStatusReason" text;
          COMMENT ON COLUMN "invoices"."eInvoiceStatusReason" IS 'Provider red/hata açıklaması';
        END IF;

        -- documentType
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'documentType'
        ) THEN
          ALTER TABLE "invoices" ADD "documentType" character varying;
          COMMENT ON COLUMN "invoices"."documentType" IS 'invoice|credit_note|debit_note';
        END IF;

        -- invoiceCurrency
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'invoiceCurrency'
        ) THEN
          ALTER TABLE "invoices" ADD "invoiceCurrency" character varying(3);
          COMMENT ON COLUMN "invoices"."invoiceCurrency" IS 'ISO 4217 para birimi kodu';
        END IF;

        -- invoiceLanguage
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'invoiceLanguage'
        ) THEN
          ALTER TABLE "invoices" ADD "invoiceLanguage" character varying(8);
          COMMENT ON COLUMN "invoices"."invoiceLanguage" IS 'BCP 47 dil kodu, örn: fr, en';
        END IF;

        -- servicePeriodStart
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'servicePeriodStart'
        ) THEN
          ALTER TABLE "invoices" ADD "servicePeriodStart" date;
          COMMENT ON COLUMN "invoices"."servicePeriodStart" IS 'Hizmet/teslimat dönemi başlangıcı';
        END IF;

        -- servicePeriodEnd
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'servicePeriodEnd'
        ) THEN
          ALTER TABLE "invoices" ADD "servicePeriodEnd" date;
          COMMENT ON COLUMN "invoices"."servicePeriodEnd" IS 'Hizmet/teslimat dönemi bitişi';
        END IF;

        -- providerInvoiceId
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'providerInvoiceId'
        ) THEN
          ALTER TABLE "invoices" ADD "providerInvoiceId" character varying;
          COMMENT ON COLUMN "invoices"."providerInvoiceId" IS 'External provider invoice referans ID (Pennylane vb.)';
        END IF;

        -- lastProviderSyncAt
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'lastProviderSyncAt'
        ) THEN
          ALTER TABLE "invoices" ADD "lastProviderSyncAt" timestamp;
          COMMENT ON COLUMN "invoices"."lastProviderSyncAt" IS 'Son provider senkronizasyon zamanı';
        END IF;

        -- providerError
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'providerError'
        ) THEN
          ALTER TABLE "invoices" ADD "providerError" text;
          COMMENT ON COLUMN "invoices"."providerError" IS 'Provider hata mesajı (düz metin veya JSON string)';
        END IF;

        -- sellerSnapshot
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'sellerSnapshot'
        ) THEN
          ALTER TABLE "invoices" ADD "sellerSnapshot" jsonb;
          COMMENT ON COLUMN "invoices"."sellerSnapshot" IS 'Satıcı yasal bilgi anlık görüntüsü (fatura kesildiğinde kaydedilir, immutable)';
        END IF;

        -- buyerSnapshot
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'buyerSnapshot'
        ) THEN
          ALTER TABLE "invoices" ADD "buyerSnapshot" jsonb;
          COMMENT ON COLUMN "invoices"."buyerSnapshot" IS 'Alıcı yasal bilgi anlık görüntüsü (fatura kesildiğinde kaydedilir, immutable)';
        END IF;

      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const columns = [
      'buyerSnapshot',
      'sellerSnapshot',
      'providerError',
      'lastProviderSyncAt',
      'providerInvoiceId',
      'servicePeriodEnd',
      'servicePeriodStart',
      'invoiceLanguage',
      'invoiceCurrency',
      'documentType',
      'eInvoiceStatusReason',
      'eInvoiceStatus',
    ];

    for (const col of columns) {
      await queryRunner.query(
        `ALTER TABLE "invoices" DROP COLUMN IF EXISTS "${col}"`,
      );
    }
  }
}
