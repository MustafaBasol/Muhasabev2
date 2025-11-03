import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLegalComplianceFieldsToTenant1730475000000
  implements MigrationInterface
{
  name = 'AddLegalComplianceFieldsToTenant1730475000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Website URL (idempotent)
    await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'website'
                    ) THEN
                        ALTER TABLE "tenants" ADD "website" character varying;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'website'
                    ) THEN
                        EXECUTE 'COMMENT ON COLUMN "tenants"."website" IS ''Website URL''';
                    END IF;
                END$$;`);

    // === Türkiye Yasal Alanları ===
    await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'taxOffice'
                    ) THEN
                        ALTER TABLE "tenants" ADD "taxOffice" character varying;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'taxOffice'
                    ) THEN
                        EXECUTE 'COMMENT ON COLUMN "tenants"."taxOffice" IS ''Vergi Dairesi''';
                    END IF;
                END$$;`);

    await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'mersisNumber'
                    ) THEN
                        ALTER TABLE "tenants" ADD "mersisNumber" character varying;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'mersisNumber'
                    ) THEN
                        EXECUTE 'COMMENT ON COLUMN "tenants"."mersisNumber" IS ''Mersis Numarası''';
                    END IF;
                END$$;`);

    await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'kepAddress'
                    ) THEN
                        ALTER TABLE "tenants" ADD "kepAddress" character varying;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'kepAddress'
                    ) THEN
                        EXECUTE 'COMMENT ON COLUMN "tenants"."kepAddress" IS ''KEP Adresi (e-fatura)''';
                    END IF;
                END$$;`);

    // === Fransa Yasal Alanları ===
    await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'siretNumber'
                    ) THEN
                        ALTER TABLE "tenants" ADD "siretNumber" character varying;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'siretNumber'
                    ) THEN
                        EXECUTE 'COMMENT ON COLUMN "tenants"."siretNumber" IS ''SIRET Numarası (14 haneli)''';
                    END IF;
                END$$;`);

    await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'sirenNumber'
                    ) THEN
                        ALTER TABLE "tenants" ADD "sirenNumber" character varying;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'sirenNumber'
                    ) THEN
                        EXECUTE 'COMMENT ON COLUMN "tenants"."sirenNumber" IS ''SIREN Numarası (9 haneli)''';
                    END IF;
                END$$;`);

    await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'apeCode'
                    ) THEN
                        ALTER TABLE "tenants" ADD "apeCode" character varying;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'apeCode'
                    ) THEN
                        EXECUTE 'COMMENT ON COLUMN "tenants"."apeCode" IS ''APE/NAF Kodu (ana faaliyet)''';
                    END IF;
                END$$;`);

    await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'tvaNumber'
                    ) THEN
                        ALTER TABLE "tenants" ADD "tvaNumber" character varying;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'tvaNumber'
                    ) THEN
                        EXECUTE 'COMMENT ON COLUMN "tenants"."tvaNumber" IS ''TVA Numarası (FR + 11 hane)''';
                    END IF;
                END$$;`);

    await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'rcsNumber'
                    ) THEN
                        ALTER TABLE "tenants" ADD "rcsNumber" character varying;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'rcsNumber'
                    ) THEN
                        EXECUTE 'COMMENT ON COLUMN "tenants"."rcsNumber" IS ''RCS Numarası (Ticaret Sicil)''';
                    END IF;
                END$$;`);

    // === Almanya Yasal Alanları ===
    await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'steuernummer'
                    ) THEN
                        ALTER TABLE "tenants" ADD "steuernummer" character varying;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'steuernummer'
                    ) THEN
                        EXECUTE 'COMMENT ON COLUMN "tenants"."steuernummer" IS ''Steuernummer (Vergi Numarası)''';
                    END IF;
                END$$;`);

    await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'umsatzsteuerID'
                    ) THEN
                        ALTER TABLE "tenants" ADD "umsatzsteuerID" character varying;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'umsatzsteuerID'
                    ) THEN
                        EXECUTE 'COMMENT ON COLUMN "tenants"."umsatzsteuerID" IS ''Umsatzsteuer-ID (DE + 9 hane)''';
                    END IF;
                END$$;`);

    await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'handelsregisternummer'
                    ) THEN
                        ALTER TABLE "tenants" ADD "handelsregisternummer" character varying;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'handelsregisternummer'
                    ) THEN
                        EXECUTE 'COMMENT ON COLUMN "tenants"."handelsregisternummer" IS ''Handelsregisternummer (Ticaret Sicil No)''';
                    END IF;
                END$$;`);

    await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'finanzamt'
                    ) THEN
                        ALTER TABLE "tenants" ADD "finanzamt" character varying;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'finanzamt'
                    ) THEN
                        EXECUTE 'COMMENT ON COLUMN "tenants"."finanzamt" IS ''Finanzamt (Vergi Dairesi)''';
                    END IF;
                END$$;`);

    // === Amerika Yasal Alanları ===
    await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'einNumber'
                    ) THEN
                        ALTER TABLE "tenants" ADD "einNumber" character varying;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'einNumber'
                    ) THEN
                        EXECUTE 'COMMENT ON COLUMN "tenants"."einNumber" IS ''EIN Numarası (Employer Identification Number)''';
                    END IF;
                END$$;`);

    await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'taxIDNumber'
                    ) THEN
                        ALTER TABLE "tenants" ADD "taxIDNumber" character varying;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'taxIDNumber'
                    ) THEN
                        EXECUTE 'COMMENT ON COLUMN "tenants"."taxIDNumber" IS ''Tax ID Numarası''';
                    END IF;
                END$$;`);

    await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'businessLicense'
                    ) THEN
                        ALTER TABLE "tenants" ADD "businessLicense" character varying;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'businessLicense'
                    ) THEN
                        EXECUTE 'COMMENT ON COLUMN "tenants"."businessLicense" IS ''Business License Number''';
                    END IF;
                END$$;`);

    await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'salesTaxNumber'
                    ) THEN
                        ALTER TABLE "tenants" ADD "salesTaxNumber" character varying;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = 'salesTaxNumber'
                    ) THEN
                        EXECUTE 'COMMENT ON COLUMN "tenants"."salesTaxNumber" IS ''Sales Tax Number''';
                    END IF;
                END$$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "salesTaxNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "businessLicense"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "taxIDNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "einNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "finanzamt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "handelsregisternummer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "umsatzsteuerID"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "steuernummer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "rcsNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "tvaNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "apeCode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "sirenNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "siretNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "kepAddress"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "mersisNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "taxOffice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "website"`,
    );
  }
}
