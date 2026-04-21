import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 — outbound_jobs tablosu
 *
 * Provider'a gönderilecek işlerin idempotent kuyruğu.
 * lockedAt alanı optimistic locking için kullanılır.
 */
export class CreateOutboundJobsTable1770500000000
  implements MigrationInterface
{
  name = 'CreateOutboundJobsTable1770500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "outbound_jobs" (
        "id"                uuid          NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"          uuid          NOT NULL,
        "providerKey"       varchar(64)   NOT NULL,
        "jobType"           varchar(64)   NOT NULL,
        "status"            varchar(32)   NOT NULL DEFAULT 'pending',
        "idempotencyKey"    varchar(255)  NOT NULL,
        "invoiceId"         uuid,
        "customerId"        uuid,
        "payload"           text,
        "retryCount"        integer       NOT NULL DEFAULT 0,
        "maxRetries"        integer       NOT NULL DEFAULT 5,
        "nextRetryAt"       timestamp,
        "lockedAt"          timestamp,
        "finishedAt"        timestamp,
        "lastError"         text,
        "providerReference" varchar,
        "createdAt"         timestamp     NOT NULL DEFAULT now(),
        "updatedAt"         timestamp     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_outbound_jobs" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_outbound_jobs_idempotency_key"
        ON "outbound_jobs" ("idempotencyKey");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_outbound_jobs_tenant_status_retry"
        ON "outbound_jobs" ("tenantId", "status", "nextRetryAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_outbound_jobs_tenant_status_retry"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_outbound_jobs_idempotency_key"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "outbound_jobs"`);
  }
}
