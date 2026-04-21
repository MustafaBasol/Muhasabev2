import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 — Customer compliance alanları
 *
 * Eklenenler:
 *   - customerType       : B2B / B2C / individual (e-fatura yönlendirme için kritik)
 *   - tvaNumber          : TVA/KDV numarası (FR: FR + 11 hane)
 *   - sirenNumber        : SIREN (9 haneli, SIRET'ten türetilebilir)
 *   - billingAddress     : yapılandırılmış fatura adresi (jsonb)
 *   - deliveryAddress    : teslimat adresi (jsonb, fatura adresinden farklıysa)
 *   - defaultPaymentTerms: müşteri bazlı ödeme koşulları
 *   - providerCustomerId : external provider customer eşleşme ID'si
 *
 * Mevcut `address`, `taxNumber`, `siretNumber` kolonları korunur.
 */
export class AddEInvoicePhase1FieldsToCustomers1770100000000
  implements MigrationInterface
{
  name = 'AddEInvoicePhase1FieldsToCustomers1770100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN

        -- customerType
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'customers' AND column_name = 'customerType'
        ) THEN
          ALTER TABLE "customers" ADD "customerType" character varying;
          COMMENT ON COLUMN "customers"."customerType" IS 'Müşteri tipi: b2b|b2c|individual';
        END IF;

        -- tvaNumber
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'customers' AND column_name = 'tvaNumber'
        ) THEN
          ALTER TABLE "customers" ADD "tvaNumber" character varying;
          COMMENT ON COLUMN "customers"."tvaNumber" IS 'TVA/KDV Numarası (FR: FR + 11 hane)';
        END IF;

        -- sirenNumber
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'customers' AND column_name = 'sirenNumber'
        ) THEN
          ALTER TABLE "customers" ADD "sirenNumber" character varying;
          COMMENT ON COLUMN "customers"."sirenNumber" IS 'SIREN Numarası (9 haneli)';
        END IF;

        -- billingAddress
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'customers' AND column_name = 'billingAddress'
        ) THEN
          ALTER TABLE "customers" ADD "billingAddress" jsonb;
          COMMENT ON COLUMN "customers"."billingAddress" IS 'Yapılandırılmış fatura adresi: {street, city, postalCode, country, state}';
        END IF;

        -- deliveryAddress
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'customers' AND column_name = 'deliveryAddress'
        ) THEN
          ALTER TABLE "customers" ADD "deliveryAddress" jsonb;
          COMMENT ON COLUMN "customers"."deliveryAddress" IS 'Teslimat adresi (fatura adresinden farklıysa): {street, city, postalCode, country, state}';
        END IF;

        -- defaultPaymentTerms
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'customers' AND column_name = 'defaultPaymentTerms'
        ) THEN
          ALTER TABLE "customers" ADD "defaultPaymentTerms" character varying;
          COMMENT ON COLUMN "customers"."defaultPaymentTerms" IS 'Ödeme koşulları, örn: 30 gün net';
        END IF;

        -- providerCustomerId
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'customers' AND column_name = 'providerCustomerId'
        ) THEN
          ALTER TABLE "customers" ADD "providerCustomerId" character varying;
          COMMENT ON COLUMN "customers"."providerCustomerId" IS 'External provider customer eşleşme ID (Pennylane vb.)';
        END IF;

      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const columns = [
      'providerCustomerId',
      'defaultPaymentTerms',
      'deliveryAddress',
      'billingAddress',
      'sirenNumber',
      'tvaNumber',
      'customerType',
    ];

    for (const col of columns) {
      await queryRunner.query(
        `ALTER TABLE "customers" DROP COLUMN IF EXISTS "${col}"`,
      );
    }
  }
}
