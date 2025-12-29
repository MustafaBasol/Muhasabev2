import { MigrationInterface, QueryRunner } from 'typeorm';

export class SetDefaultCategoryTaxRateToZero1769100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "product_categories"
      ALTER COLUMN "taxRate" SET DEFAULT 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "product_categories"
      ALTER COLUMN "taxRate" SET DEFAULT 0;
    `);
  }
}
