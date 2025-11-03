import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGdprFieldsToUsers1761775949182 implements MigrationInterface {
  name = 'AddGdprFieldsToUsers1761775949182';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletionRequestedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isPendingDeletion" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "isPendingDeletion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "deletionRequestedAt"`,
    );
  }
}
