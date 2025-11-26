import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserLoginTimezone1731715200001 implements MigrationInterface {
  name = 'AddUserLoginTimezone1731715200001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add columns if not exist (PostgreSQL)
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginTimeZone" character varying',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginUtcOffsetMinutes" integer',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop columns if exist (PostgreSQL >= 9.6)
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "lastLoginUtcOffsetMinutes"',
    );
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "lastLoginTimeZone"',
    );
  }
}
