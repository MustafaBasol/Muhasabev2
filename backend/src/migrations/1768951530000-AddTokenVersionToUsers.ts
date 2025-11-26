import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds tokenVersion column to users table for JWT revocation.
 * Non-destructive: simple integer with default 0.
 */
export class AddTokenVersionToUsers1768951530000 implements MigrationInterface {
  name = 'AddTokenVersionToUsers1768951530000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Postgres: add column if not exists (safe); SQLite ignores IF NOT EXISTS on ALTER ADD
    const driver = (queryRunner.connection.options.type || '').toLowerCase();
    if (driver === 'postgres') {
      await queryRunner.query(
        'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tokenVersion" integer NOT NULL DEFAULT 0',
      );
    } else {
      // Fallback for sqlite: check pragma
      const colsRaw: unknown = await queryRunner.query(
        'PRAGMA table_info(users)',
      );
      const cols = Array.isArray(colsRaw) ? colsRaw : [];
      const exists = cols.some((col) => {
        if (!col || typeof col !== 'object') {
          return false;
        }
        const nameValue = (col as { name?: unknown }).name;
        return typeof nameValue === 'string' && nameValue === 'tokenVersion';
      });
      if (!exists) {
        await queryRunner.query(
          'ALTER TABLE "users" ADD COLUMN "tokenVersion" integer NOT NULL DEFAULT 0',
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Non-destructive rollback: leave column if other code depends; but implement drop for completeness.
    const driver = (queryRunner.connection.options.type || '').toLowerCase();
    if (driver === 'postgres') {
      await queryRunner.query(
        'ALTER TABLE "users" DROP COLUMN IF EXISTS "tokenVersion"',
      );
    } else {
      // SQLite cannot drop column easily prior to newer versions; skip.
    }
  }
}
