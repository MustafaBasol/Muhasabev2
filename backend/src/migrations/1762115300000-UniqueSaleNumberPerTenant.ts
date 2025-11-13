import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueSaleNumberPerTenant1762115300000 implements MigrationInterface {
  name = 'UniqueSaleNumberPerTenant1762115300000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove old global unique constraint on saleNumber if exists
    // SQLite skips as it doesn't support easy constraint dropping
    const driver = queryRunner.connection.options.type;
    if (driver === 'postgres') {
      await queryRunner.query(`ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "UQ_sales_saleNumber"`);
      await queryRunner.query(`ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "UQ_2e1f8c3a6b0_saleNumber"`);
      // Add composite unique (tenantId, saleNumber)
      await queryRunner.query(
        `ALTER TABLE "sales" ADD CONSTRAINT "UQ_sales_tenant_saleNumber" UNIQUE ("tenantId", "saleNumber")`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.options.type;
    if (driver === 'postgres') {
      await queryRunner.query(`ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "UQ_sales_tenant_saleNumber"`);
      await queryRunner.query(
        `ALTER TABLE "sales" ADD CONSTRAINT "UQ_sales_saleNumber" UNIQUE ("saleNumber")`
      );
    }
  }
}
