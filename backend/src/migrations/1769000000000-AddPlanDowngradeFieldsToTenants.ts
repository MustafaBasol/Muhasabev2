import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlanDowngradeFieldsToTenants1769000000000
  implements MigrationInterface
{
  name = 'AddPlanDowngradeFieldsToTenants1769000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "downgradePendingUntil" TIMESTAMP NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "requiredUserReduction" integer NULL`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive: kolonları bırakmak riskli olabilir; down boş bırakılır
  }
}
