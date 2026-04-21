import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1.5 — Normalize invoice_lines tablosu
 *
 * - invoice_lines tablosunu oluşturur
 * - invoices.items (jsonb) kolonunu kaldırır
 *
 * Sistem yeni olduğu için mevcut fatura verisi korunmuyor;
 * down() items kolonu boş olarak geri ekler.
 */
export class NormalizeInvoiceLines1770200000000 implements MigrationInterface {
  name = 'NormalizeInvoiceLines1770200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) invoice_lines tablosunu oluştur
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoice_lines" (
        "id"             uuid              NOT NULL DEFAULT gen_random_uuid(),
        "invoiceId"      uuid              NOT NULL,
        "position"       integer           NOT NULL DEFAULT 0,
        "productId"      uuid,
        "productName"    character varying,
        "description"    text,
        "quantity"       numeric(12,4)     NOT NULL,
        "unitPrice"      numeric(12,4)     NOT NULL,
        "taxRate"        numeric(6,2)      NOT NULL DEFAULT 0,
        "discountAmount" numeric(12,4)     NOT NULL DEFAULT 0,
        "lineNet"        numeric(14,4)     NOT NULL DEFAULT 0,
        "lineTax"        numeric(14,4)     NOT NULL DEFAULT 0,
        "lineGross"      numeric(14,4)     NOT NULL DEFAULT 0,
        "unit"           character varying(16),
        CONSTRAINT "PK_invoice_lines" PRIMARY KEY ("id"),
        CONSTRAINT "FK_invoice_lines_invoice"
          FOREIGN KEY ("invoiceId")
          REFERENCES "invoices"("id")
          ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoice_lines_invoiceId"
        ON "invoice_lines" ("invoiceId");
    `);

    // 2) invoices.items jsonb kolonunu kaldır
    await queryRunner.query(`
      ALTER TABLE "invoices" DROP COLUMN IF EXISTS "items";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // items kolonunu (boş olarak) geri ekle
    await queryRunner.query(`
      ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "items" jsonb;
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoice_lines_invoiceId";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_lines";`);
  }
}
