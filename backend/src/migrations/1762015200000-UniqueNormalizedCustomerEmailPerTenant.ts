import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueNormalizedCustomerEmailPerTenant1762015200000
  implements MigrationInterface
{
  name = 'UniqueNormalizedCustomerEmailPerTenant1762015200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Clean duplicates by normalized email per tenant: keep earliest created, null others
    await queryRunner.query(`
      WITH dup AS (
        SELECT "tenantId", lower(trim("email")) AS norm_email, min("createdAt") AS keep_created
        FROM "customers"
        WHERE "email" IS NOT NULL
        GROUP BY "tenantId", lower(trim("email"))
        HAVING COUNT(*) > 1
      ),
      to_null AS (
        SELECT c.id
        FROM "customers" c
        JOIN dup d ON d."tenantId" = c."tenantId" AND lower(trim(c."email")) = d.norm_email
        WHERE c."createdAt" <> d.keep_created
      )
      UPDATE "customers" SET "email" = NULL WHERE id IN (SELECT id FROM to_null);
    `);

    // 2) Create unique index on (tenantId, lower(trim(email))) for non-null emails
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_customers_tenant_email_norm"
      ON "customers" ("tenantId", lower(trim("email")))
      WHERE "email" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_customers_tenant_email_norm"`,
    );
  }
}
