import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFranceInvoiceFieldsToTenant1769200000000
  implements MigrationInterface
{
  name = 'AddFranceInvoiceFieldsToTenant1769200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // === Fransa: Fatura için ek yasal/ödeme alanları ===
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'companyType'
        ) THEN
          ALTER TABLE "tenants" ADD "companyType" character varying;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'capitalSocial'
        ) THEN
          ALTER TABLE "tenants" ADD "capitalSocial" character varying;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'latePaymentInterest'
        ) THEN
          ALTER TABLE "tenants" ADD "latePaymentInterest" character varying;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'fixedRecoveryFee'
        ) THEN
          ALTER TABLE "tenants" ADD "fixedRecoveryFee" character varying;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'companyType'
        ) THEN
          EXECUTE 'COMMENT ON COLUMN "tenants"."companyType" IS ''Forme juridique / Şirket türü (SAS/SARL/EI vb.)''';
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'capitalSocial'
        ) THEN
          EXECUTE 'COMMENT ON COLUMN "tenants"."capitalSocial" IS ''Capital social''';
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'latePaymentInterest'
        ) THEN
          EXECUTE 'COMMENT ON COLUMN "tenants"."latePaymentInterest" IS ''Gecikme faizi/cezası (FR payment terms)''';
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'fixedRecoveryFee'
        ) THEN
          EXECUTE 'COMMENT ON COLUMN "tenants"."fixedRecoveryFee" IS ''Tahsilat masrafı sabiti (FR fixed recovery fee)''';
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "fixedRecoveryFee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "latePaymentInterest"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "capitalSocial"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "companyType"`,
    );
  }
}
