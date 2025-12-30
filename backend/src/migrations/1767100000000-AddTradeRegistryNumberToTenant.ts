import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTradeRegistryNumberToTenant1767100000000
  implements MigrationInterface
{
  name = 'AddTradeRegistryNumberToTenant1767100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // === Türkiye Yasal Alanları (ek) ===
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'tradeRegistryNumber'
        ) THEN
          ALTER TABLE "tenants" ADD "tradeRegistryNumber" character varying;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'tradeRegistryNumber'
        ) THEN
          EXECUTE 'COMMENT ON COLUMN "tenants"."tradeRegistryNumber" IS ''Ticaret Sicil No''';
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "tradeRegistryNumber"`);
  }
}
