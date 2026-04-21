import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 1770600000000
 *
 * Phase 1/2 Pennylane API Gap Fixes:
 *  1. invoices.providerInvoiceNumber — provider'ın insan-okunur fatura numarasını saklar
 *     (Pennylane: invoice_number, örn. "FA-2024-0001")
 *  2. PG enum eInvoicestatus_enum'a yeni değerler eklenir:
 *     sent, approved, refused, in_dispute, collected, partially_collected
 *     (Pennylane CustomerInvoicePDPStatus hizalaması)
 *
 * Idempotent: DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END $$;
 * SQLite'ta (dev/test) synchronize:true ile otomatik hizalanır.
 */
export class AddProviderInvoiceNumberAndExtendEInvoiceStatus1770600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const isSQLite = queryRunner.connection.options.type === 'sqlite';

    if (isSQLite) {
      // SQLite: synchronize:true zaten entity'den otomatik ekler, manüel bir şey yapmaya gerek yok.
      return;
    }

    // ── 1. providerInvoiceNumber sütununu ekle ──────────────────────────────
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'providerInvoiceNumber'
        ) THEN
          ALTER TABLE "invoices"
            ADD "providerInvoiceNumber" character varying;
          COMMENT ON COLUMN "invoices"."providerInvoiceNumber"
            IS 'Provider tarafından atanan insan-okunur fatura numarası (Pennylane: invoice_number, örn. FA-2024-0001)';
        END IF;
      END $$;
    `);

    // ── 2. eInvoiceStatus enum'a yeni değerler ekle (idempotent) ───────────
    // PostgreSQL ALTER TYPE ... ADD VALUE IF NOT EXISTS (PG >= 9.1)
    const newValues = [
      'sent',
      'approved',
      'refused',
      'in_dispute',
      'collected',
      'partially_collected',
    ];

    for (const val of newValues) {
      await queryRunner.query(`
        DO $$
        BEGIN
          ALTER TYPE "eInvoicestatus_enum" ADD VALUE IF NOT EXISTS '${val}';
        EXCEPTION
          WHEN undefined_object THEN
            -- Enum type doesn't exist (ilk kurulum vb.) — sessizce geç
            NULL;
          WHEN duplicate_object THEN
            NULL;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isSQLite = queryRunner.connection.options.type === 'sqlite';
    if (isSQLite) return;

    // providerInvoiceNumber sütununu kaldır
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'providerInvoiceNumber'
        ) THEN
          ALTER TABLE "invoices" DROP COLUMN "providerInvoiceNumber";
        END IF;
      END $$;
    `);

    // Not: PostgreSQL'de enum değerlerini kaldırmak çok yıkıcı (type'ı drop/recreate ister).
    // Down migration enum'a dokunmuyor — gerekirse manuel müdahale yapılır.
  }
}
