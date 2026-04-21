import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 — integration_logs tablosu
 *
 * Provider API çağrılarının denetim kaydı.
 * retention policy ile eski kayıtlar temizlenir (uygulama seviyesinde).
 */
export class CreateIntegrationLogsTable1770400000000
  implements MigrationInterface
{
  name = 'CreateIntegrationLogsTable1770400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "integration_logs" (
        "id"             uuid          NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"       uuid          NOT NULL,
        "providerKey"    varchar(64)   NOT NULL,
        "outboundJobId"  uuid,
        "invoiceId"      uuid,
        "level"          varchar(16)   NOT NULL DEFAULT 'info',
        "action"         varchar(128)  NOT NULL,
        "httpMethod"     varchar,
        "httpUrl"        text,
        "httpStatus"     integer,
        "requestBody"    text,
        "responseBody"   text,
        "errorMessage"   text,
        "durationMs"     integer,
        "createdAt"      timestamp     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_integration_logs" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_integration_logs_tenant_provider_date"
        ON "integration_logs" ("tenantId", "providerKey", "createdAt");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_integration_logs_outbound_job"
        ON "integration_logs" ("outboundJobId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_integration_logs_outbound_job"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_integration_logs_tenant_provider_date"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "integration_logs"`);
  }
}
