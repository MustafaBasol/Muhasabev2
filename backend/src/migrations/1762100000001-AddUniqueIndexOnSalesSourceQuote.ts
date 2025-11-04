import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueIndexOnSalesSourceQuote1762100000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL partial unique index: sourceQuoteId NOT NULL
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sales_tenant_quote" ON "sales" ("tenantId", "sourceQuoteId") WHERE "sourceQuoteId" IS NOT NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_sales_tenant_quote";`);
  }
}
