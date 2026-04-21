import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EN 16931 uyum alanları — invoices tablosuna eklenir.
 *
 * BT-10  buyerReference    — Alıcı fatura referansı
 * BT-12  contractReference — Sözleşme numarası
 * BT-13  orderReference    — Sipariş numarası
 * BT-81  paymentMethodCode — Ödeme yöntemi kodu
 * BT-84  paymentIban       — Tahsilat IBAN
 * BT-86  paymentBic        — Banka BIC/SWIFT
 *
 * Idempotent: sütun zaten varsa sessizce atlar.
 */
export class AddEN16931ComplianceFieldsToInvoices1770700000000
  implements MigrationInterface
{
  name = 'AddEN16931ComplianceFieldsToInvoices1770700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        -- BT-10: Alıcı referansı
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'buyerReference'
        ) THEN
          ALTER TABLE "invoices" ADD "buyerReference" character varying(200);
          COMMENT ON COLUMN "invoices"."buyerReference" IS 'EN 16931 BT-10: Alıcı fatura referansı';
        END IF;

        -- BT-13: Sipariş numarası
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'orderReference'
        ) THEN
          ALTER TABLE "invoices" ADD "orderReference" character varying(200);
          COMMENT ON COLUMN "invoices"."orderReference" IS 'EN 16931 BT-13: Sipariş numarası';
        END IF;

        -- BT-12: Sözleşme numarası
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'contractReference'
        ) THEN
          ALTER TABLE "invoices" ADD "contractReference" character varying(200);
          COMMENT ON COLUMN "invoices"."contractReference" IS 'EN 16931 BT-12: Sözleşme numarası';
        END IF;

        -- BT-81: Ödeme yöntemi kodu
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'paymentMethodCode'
        ) THEN
          ALTER TABLE "invoices" ADD "paymentMethodCode" character varying(64);
          COMMENT ON COLUMN "invoices"."paymentMethodCode" IS 'EN 16931 BT-81: Ödeme yöntemi kodu (bank_transfer, direct_debit vb.)';
        END IF;

        -- BT-84: Tahsilat IBAN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'paymentIban'
        ) THEN
          ALTER TABLE "invoices" ADD "paymentIban" character varying(34);
          COMMENT ON COLUMN "invoices"."paymentIban" IS 'EN 16931 BT-84: Tahsilat IBAN';
        END IF;

        -- BT-86: BIC/SWIFT
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'paymentBic'
        ) THEN
          ALTER TABLE "invoices" ADD "paymentBic" character varying(11);
          COMMENT ON COLUMN "invoices"."paymentBic" IS 'EN 16931 BT-86: Banka BIC/SWIFT kodu';
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
        DROP COLUMN IF EXISTS "buyerReference",
        DROP COLUMN IF EXISTS "orderReference",
        DROP COLUMN IF EXISTS "contractReference",
        DROP COLUMN IF EXISTS "paymentMethodCode",
        DROP COLUMN IF EXISTS "paymentIban",
        DROP COLUMN IF EXISTS "paymentBic";
    `);
  }
}
