import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIopoleReadOnlySyncTables1770960000000
  implements MigrationInterface
{
  name = 'AddIopoleReadOnlySyncTables1770960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "einvoice_external_invoices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NULL,
        "providerKey" character varying(64) NOT NULL,
        "providerInvoiceId" character varying(255) NOT NULL,
        "localInvoiceId" uuid NULL,
        "direction" character varying(32) NULL,
        "way" character varying(32) NULL,
        "streamId" character varying(255) NULL,
        "documentId" character varying(255) NULL,
        "originalFormat" character varying(64) NULL,
        "originalFlavor" character varying(64) NULL,
        "originalNetwork" character varying(64) NULL,
        "lifecycleStatus" character varying(64) NULL,
        "statusCode" character varying(64) NULL,
        "paymentStatus" character varying(64) NULL,
        "documentDate" TIMESTAMP NULL,
        "lastEventAt" TIMESTAMP NULL,
        "rejectionReasonCode" character varying(128) NULL,
        "rejectionReasonLabel" text NULL,
        "errorCode" character varying(128) NULL,
        "errorMessage" text NULL,
        "businessData" jsonb NULL,
        "rawPayload" jsonb NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_einvoice_external_invoices_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_einvoice_external_invoices_unique"
      ON "einvoice_external_invoices" ("tenantId", "providerKey", "providerInvoiceId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_einvoice_external_invoices_provider_last_event"
      ON "einvoice_external_invoices" ("providerKey", "lastEventAt")
    `);

    await queryRunner.query(
      `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eInvoiceProvider" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eInvoiceExternalId" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eInvoiceStatusCode" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eInvoiceLifecycleStatus" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eInvoicePaymentStatus" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eInvoiceLastEventAt" TIMESTAMP NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eInvoiceRejectedAt" TIMESTAMP NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eInvoiceRejectionReasonCode" character varying(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eInvoiceRejectionReasonLabel" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eInvoiceErrorCode" character varying(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eInvoiceErrorMessage" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_einvoice_external_invoices_provider_last_event"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_einvoice_external_invoices_unique"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "einvoice_external_invoices"`,
    );
  }
}