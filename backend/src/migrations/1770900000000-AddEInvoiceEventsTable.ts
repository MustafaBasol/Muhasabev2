import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEInvoiceEventsTable1770900000000
  implements MigrationInterface
{
  name = 'AddEInvoiceEventsTable1770900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "einvoice_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid,
        "providerKey" character varying(64) NOT NULL,
        "invoiceId" uuid,
        "providerInvoiceId" character varying(255),
        "providerEventId" character varying(255),
        "eventType" character varying(128) NOT NULL,
        "status" character varying(64),
        "payload" text,
        "processedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_einvoice_events_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_einvoice_events_provider_created" ON "einvoice_events" ("providerKey", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_einvoice_events_tenant_provider_event" ON "einvoice_events" ("tenantId", "providerKey", "eventType")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_einvoice_events_tenant_provider_event"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_einvoice_events_provider_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "einvoice_events"`);
  }
}