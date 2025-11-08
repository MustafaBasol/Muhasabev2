import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailOutbox1762500000000 implements MigrationInterface {
  name = 'CreateEmailOutbox1762500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_outbox" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "to" varchar(320) NOT NULL,
        "subject" varchar(255) NOT NULL,
        "provider" varchar(32) NOT NULL,
        "success" boolean NOT NULL DEFAULT false,
        "messageId" varchar(64),
        "correlationId" varchar(64),
        "userId" varchar(64),
        "tenantId" varchar(64),
        "tokenId" varchar(64),
        "type" varchar(32),
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_email_outbox_to ON "email_outbox" ("to");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_email_outbox_created_at ON "email_outbox" ("createdAt");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_email_outbox_type ON "email_outbox" ("type");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_email_outbox_type; DROP INDEX IF EXISTS idx_email_outbox_created_at; DROP INDEX IF EXISTS idx_email_outbox_to; DROP TABLE IF EXISTS "email_outbox";`);
  }
}