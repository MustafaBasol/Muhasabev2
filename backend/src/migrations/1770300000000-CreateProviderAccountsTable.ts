import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 — provider_accounts tablosu
 *
 * Tenant ↔ e-fatura provider bağlantısı.
 * accessToken ve refreshToken select:false — doğrudan ORM üzerinden okunmaz.
 */
export class CreateProviderAccountsTable1770300000000
  implements MigrationInterface
{
  name = 'CreateProviderAccountsTable1770300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "provider_accounts" (
        "id"                uuid          NOT NULL DEFAULT gen_random_uuid(),
        "tenantId"          uuid          NOT NULL,
        "providerKey"       varchar(64)   NOT NULL,
        "connectionStatus"  varchar(32)   NOT NULL DEFAULT 'disconnected',
        "accessToken"       text,
        "refreshToken"      text,
        "tokenExpiresAt"    timestamp,
        "providerAccountId" varchar,
        "lastConnectedAt"   timestamp,
        "lastError"         text,
        "metadata"          text,
        "createdAt"         timestamp     NOT NULL DEFAULT now(),
        "updatedAt"         timestamp     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_provider_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_provider_accounts_tenant"
          FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_provider_accounts_tenant_provider"
        ON "provider_accounts" ("tenantId", "providerKey");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_provider_accounts_tenant_provider"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "provider_accounts"`);
  }
}
