import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureTokenVersionOnUsers1762810000001
  implements MigrationInterface
{
  name = 'EnsureTokenVersionOnUsers1762810000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Idempotent guard: ensure column exists with default
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tokenVersion" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op safe down; only drop if exists
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "tokenVersion"`,
    );
  }
}
