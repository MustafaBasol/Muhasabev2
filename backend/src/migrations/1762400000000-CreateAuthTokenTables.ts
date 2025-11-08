import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthTokenTables1762400000000 implements MigrationInterface {
  name = 'CreateAuthTokenTables1762400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // email_verification_tokens
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "tokenHash" varchar(128) NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "usedAt" TIMESTAMP NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "ip" varchar(45) NULL,
        "ua" text NULL,
        CONSTRAINT fk_evt_user FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_evt_user_id ON "email_verification_tokens" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_evt_expires_at ON "email_verification_tokens" ("expiresAt")`,
    );

    // password_reset_tokens
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "tokenHash" varchar(128) NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "usedAt" TIMESTAMP NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "ip" varchar(45) NULL,
        "ua" text NULL,
        CONSTRAINT fk_prt_user FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_prt_user_id ON "password_reset_tokens" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_prt_expires_at ON "password_reset_tokens" ("expiresAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_prt_expires_at; DROP INDEX IF EXISTS idx_prt_user_id; DROP TABLE IF EXISTS "password_reset_tokens";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_evt_expires_at; DROP INDEX IF EXISTS idx_evt_user_id; DROP TABLE IF EXISTS "email_verification_tokens";`,
    );
  }
}
