import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gelen e-fatura alanları — expenses tablosuna eklenir.
 *
 * providerExpenseId    — Pennylane supplier_invoice ID (tekrar import önleme)
 * eInvoiceSource       — PDP kaynağı ('pennylane')
 * providerInvoiceNumber — Pennylane fatura numarası (FA-XXXX)
 * senderName           — Faturayı kesen firma adı
 * senderVatNumber      — Faturayı kesen firmanın VKN/SIRET'i
 *
 * Idempotent: sütun zaten varsa sessizce atlar.
 */
export class AddIncomingEInvoiceFieldsToExpenses1770800000000
  implements MigrationInterface
{
  name = 'AddIncomingEInvoiceFieldsToExpenses1770800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'expenses' AND column_name = 'providerExpenseId'
        ) THEN
          ALTER TABLE "expenses" ADD "providerExpenseId" character varying(100);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'expenses' AND column_name = 'eInvoiceSource'
        ) THEN
          ALTER TABLE "expenses" ADD "eInvoiceSource" character varying(50);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'expenses' AND column_name = 'providerInvoiceNumber'
        ) THEN
          ALTER TABLE "expenses" ADD "providerInvoiceNumber" character varying(100);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'expenses' AND column_name = 'senderName'
        ) THEN
          ALTER TABLE "expenses" ADD "senderName" character varying(255);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'expenses' AND column_name = 'senderVatNumber'
        ) THEN
          ALTER TABLE "expenses" ADD "senderVatNumber" character varying(50);
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "expenses"
        DROP COLUMN IF EXISTS "providerExpenseId",
        DROP COLUMN IF EXISTS "eInvoiceSource",
        DROP COLUMN IF EXISTS "providerInvoiceNumber",
        DROP COLUMN IF EXISTS "senderName",
        DROP COLUMN IF EXISTS "senderVatNumber";
    `);
  }
}
