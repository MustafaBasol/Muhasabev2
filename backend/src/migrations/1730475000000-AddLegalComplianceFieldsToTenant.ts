import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLegalComplianceFieldsToTenant1730475000000 implements MigrationInterface {
    name = 'AddLegalComplianceFieldsToTenant1730475000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Website URL
        await queryRunner.query(`ALTER TABLE "tenants" ADD "website" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "tenants"."website" IS 'Website URL'`);
        
        // === Türkiye Yasal Alanları ===
        await queryRunner.query(`ALTER TABLE "tenants" ADD "taxOffice" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "tenants"."taxOffice" IS 'Vergi Dairesi'`);
        
        await queryRunner.query(`ALTER TABLE "tenants" ADD "mersisNumber" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "tenants"."mersisNumber" IS 'Mersis Numarası'`);
        
        await queryRunner.query(`ALTER TABLE "tenants" ADD "kepAddress" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "tenants"."kepAddress" IS 'KEP Adresi (e-fatura)'`);
        
        // === Fransa Yasal Alanları ===
        await queryRunner.query(`ALTER TABLE "tenants" ADD "siretNumber" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "tenants"."siretNumber" IS 'SIRET Numarası (14 haneli)'`);
        
        await queryRunner.query(`ALTER TABLE "tenants" ADD "sirenNumber" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "tenants"."sirenNumber" IS 'SIREN Numarası (9 haneli)'`);
        
        await queryRunner.query(`ALTER TABLE "tenants" ADD "apeCode" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "tenants"."apeCode" IS 'APE/NAF Kodu (ana faaliyet)'`);
        
        await queryRunner.query(`ALTER TABLE "tenants" ADD "tvaNumber" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "tenants"."tvaNumber" IS 'TVA Numarası (FR + 11 hane)'`);
        
        await queryRunner.query(`ALTER TABLE "tenants" ADD "rcsNumber" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "tenants"."rcsNumber" IS 'RCS Numarası (Ticaret Sicil)'`);
        
        // === Almanya Yasal Alanları ===
        await queryRunner.query(`ALTER TABLE "tenants" ADD "steuernummer" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "tenants"."steuernummer" IS 'Steuernummer (Vergi Numarası)'`);
        
        await queryRunner.query(`ALTER TABLE "tenants" ADD "umsatzsteuerID" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "tenants"."umsatzsteuerID" IS 'Umsatzsteuer-ID (DE + 9 hane)'`);
        
        await queryRunner.query(`ALTER TABLE "tenants" ADD "handelsregisternummer" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "tenants"."handelsregisternummer" IS 'Handelsregisternummer (Ticaret Sicil No)'`);
        
        await queryRunner.query(`ALTER TABLE "tenants" ADD "finanzamt" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "tenants"."finanzamt" IS 'Finanzamt (Vergi Dairesi)'`);
        
        // === Amerika Yasal Alanları ===
        await queryRunner.query(`ALTER TABLE "tenants" ADD "einNumber" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "tenants"."einNumber" IS 'EIN Numarası (Employer Identification Number)'`);
        
        await queryRunner.query(`ALTER TABLE "tenants" ADD "taxIDNumber" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "tenants"."taxIDNumber" IS 'Tax ID Numarası'`);
        
        await queryRunner.query(`ALTER TABLE "tenants" ADD "businessLicense" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "tenants"."businessLicense" IS 'Business License Number'`);
        
        await queryRunner.query(`ALTER TABLE "tenants" ADD "salesTaxNumber" character varying`);
        await queryRunner.query(`COMMENT ON COLUMN "tenants"."salesTaxNumber" IS 'Sales Tax Number'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "salesTaxNumber"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "businessLicense"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "taxIDNumber"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "einNumber"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "finanzamt"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "handelsregisternummer"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "umsatzsteuerID"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "steuernummer"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "rcsNumber"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "tvaNumber"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "apeCode"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "sirenNumber"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "siretNumber"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "kepAddress"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "mersisNumber"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "taxOffice"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "website"`);
    }
}