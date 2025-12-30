import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsSalesTaxPermitToTenant1769400000000
  implements MigrationInterface
{
  name = 'AddUsSalesTaxPermitToTenant1769400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // === USA: Sales tax permit / reseller permit field ===
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'salesTaxPermitNumber'
        ) THEN
          ALTER TABLE "tenants" ADD "salesTaxPermitNumber" character varying;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'salesTaxPermitNumber'
        ) THEN
          EXECUTE 'COMMENT ON COLUMN "tenants"."salesTaxPermitNumber" IS ''Sales Tax Permit / Reseller Permit / State Tax Registration No''';
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "salesTaxPermitNumber"`,
    );
  }
}
