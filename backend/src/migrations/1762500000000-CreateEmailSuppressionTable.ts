import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailSuppressionTable1762500000000
  implements MigrationInterface
{
  name = 'CreateEmailSuppressionTable1762500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_suppression" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(320) NOT NULL UNIQUE,
        "reason" varchar(50) NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_email_suppression_email ON "email_suppression" ("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_email_suppression_email; DROP TABLE IF EXISTS "email_suppression";`,
    );
  }
}
