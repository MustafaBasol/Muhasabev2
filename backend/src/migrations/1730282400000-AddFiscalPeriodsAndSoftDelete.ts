import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class AddFiscalPeriodsAndSoftDelete1730282400000 implements MigrationInterface {
  name = 'AddFiscalPeriodsAndSoftDelete1730282400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create fiscal_periods table
    await queryRunner.createTable(
      new Table({
        name: 'fiscal_periods',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenantId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'periodStart',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'periodEnd',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'isLocked',
            type: 'boolean',
            default: false,
          },
          {
            name: 'lockedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'lockedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'lockReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        indices: [
          {
            name: 'IDX_fiscal_periods_tenant_id',
            columnNames: ['tenantId'],
          },
          {
            name: 'IDX_fiscal_periods_period_dates',
            columnNames: ['tenantId', 'periodStart', 'periodEnd'],
          },
        ],
      }),
      true,
    );

    // Add foreign key constraints for fiscal_periods
    await queryRunner.createForeignKey(
      'fiscal_periods',
      new TableForeignKey({
        columnNames: ['tenantId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'tenants',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'fiscal_periods',
      new TableForeignKey({
        columnNames: ['lockedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    // Add soft-delete columns to invoices
    await queryRunner.query(`
      ALTER TABLE invoices 
      ADD COLUMN is_voided boolean DEFAULT false,
      ADD COLUMN void_reason text,
      ADD COLUMN voided_at timestamp,
      ADD COLUMN voided_by uuid
    `);

    // Add foreign key for voided_by in invoices
    await queryRunner.createForeignKey(
      'invoices',
      new TableForeignKey({
        columnNames: ['voided_by'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    // Add soft-delete columns to expenses
    await queryRunner.query(`
      ALTER TABLE expenses 
      ADD COLUMN is_voided boolean DEFAULT false,
      ADD COLUMN void_reason text,
      ADD COLUMN voided_at timestamp,
      ADD COLUMN voided_by uuid
    `);

    // Add foreign key for voided_by in expenses
    await queryRunner.createForeignKey(
      'expenses',
      new TableForeignKey({
        columnNames: ['voided_by'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    // Add indices for performance
    await queryRunner.query(`
      CREATE INDEX IDX_invoices_is_voided ON invoices (is_voided);
      CREATE INDEX IDX_expenses_is_voided ON expenses (is_voided);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove indices
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_invoices_is_voided`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_expenses_is_voided`);

    // Remove soft-delete columns from expenses
    await queryRunner.query(`
      ALTER TABLE expenses 
      DROP COLUMN IF EXISTS voided_by,
      DROP COLUMN IF EXISTS voided_at,
      DROP COLUMN IF EXISTS void_reason,
      DROP COLUMN IF EXISTS is_voided
    `);

    // Remove soft-delete columns from invoices
    await queryRunner.query(`
      ALTER TABLE invoices 
      DROP COLUMN IF EXISTS voided_by,
      DROP COLUMN IF EXISTS voided_at,
      DROP COLUMN IF EXISTS void_reason,
      DROP COLUMN IF EXISTS is_voided
    `);

    // Drop fiscal_periods table
    await queryRunner.dropTable('fiscal_periods');
  }
}