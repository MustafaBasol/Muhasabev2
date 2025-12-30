import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSiretNumberToCustomers1769300000000
  implements MigrationInterface
{
  name = 'AddSiretNumberToCustomers1769300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'customers' AND column_name = 'siretNumber'
        ) THEN
          ALTER TABLE "customers" ADD "siretNumber" character varying;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'customers' AND column_name = 'siretNumber'
        ) THEN
          EXECUTE 'COMMENT ON COLUMN "customers"."siretNumber" IS ''SIRET Numarası (FR, 14 haneli)''';
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN IF EXISTS "siretNumber"`,
    );
  }
}
