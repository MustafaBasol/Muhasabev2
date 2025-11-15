import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds createdBy/updatedBy attribution columns and FKs to core tables.
 * Safe for multiple runs: uses IF NOT EXISTS checks and guarded FK creation.
 */
export class AddAttributionFields1762805000000 implements MigrationInterface {
  name = 'AddAttributionFields1762805000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'customers',
      'suppliers',
      'products',
      'invoices',
      'sales',
      'quotes',
      'expenses',
    ];

    for (const table of tables) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "createdById" uuid NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "createdByName" varchar(255) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "updatedById" uuid NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "updatedByName" varchar(255) NULL`,
      );

      // Add FKs to users table if not exist
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = '${table}_createdById_fkey'
          ) THEN
            ALTER TABLE "${table}" ADD CONSTRAINT "${table}_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL;
          END IF;
        END$$;
      `);
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = '${table}_updatedById_fkey'
          ) THEN
            ALTER TABLE "${table}" ADD CONSTRAINT "${table}_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL;
          END IF;
        END$$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'customers',
      'suppliers',
      'products',
      'invoices',
      'sales',
      'quotes',
      'expenses',
    ];

    for (const table of tables) {
      // Drop constraints if exist
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = '${table}_createdById_fkey'
          ) THEN
            ALTER TABLE "${table}" DROP CONSTRAINT "${table}_createdById_fkey";
          END IF;
        END$$;
      `);
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = '${table}_updatedById_fkey'
          ) THEN
            ALTER TABLE "${table}" DROP CONSTRAINT "${table}_updatedById_fkey";
          END IF;
        END$$;
      `);

      // Drop columns if exist
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "updatedByName"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "updatedById"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "createdByName"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "createdById"`,
      );
    }
  }
}
