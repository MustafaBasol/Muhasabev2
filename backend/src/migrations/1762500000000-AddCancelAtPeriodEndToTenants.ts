import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCancelAtPeriodEndToTenants1762500000000
  implements MigrationInterface
{
  name = 'AddCancelAtPeriodEndToTenants1762500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN DEFAULT false',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "tenants" DROP COLUMN IF EXISTS "cancelAtPeriodEnd"',
    );
  }
}
