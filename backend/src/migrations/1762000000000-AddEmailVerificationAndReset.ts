import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerificationAndReset1762000000000
  implements MigrationInterface
{
  name = 'AddEmailVerificationAndReset1762000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isEmailVerified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerificationToken" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerificationSentAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetToken" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetExpiresAt" TIMESTAMP`,
    );
    // Indexes for faster lookups
    try {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_users_emailVerificationToken ON "users" ("emailVerificationToken")`,
      );
    } catch (error) {
      console.warn(
        'AddEmailVerificationAndReset migration: email verification token index creation skipped',
        error,
      );
    }
    try {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_users_passwordResetToken ON "users" ("passwordResetToken")`,
      );
    } catch (error) {
      console.warn(
        'AddEmailVerificationAndReset migration: password reset token index creation skipped',
        error,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_users_passwordResetToken`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_users_emailVerificationToken`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordResetExpiresAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordResetToken"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerifiedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerificationSentAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerificationToken"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "isEmailVerified"`,
    );
  }
}
