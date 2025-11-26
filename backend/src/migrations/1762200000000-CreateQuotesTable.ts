import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateQuotesTable1762200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'quotes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'publicId',
            type: 'uuid',
            isNullable: false,
            default: 'gen_random_uuid()',
          },
          {
            name: 'quoteNumber',
            type: 'varchar',
            length: '32',
            isNullable: false,
          },
          { name: 'tenantId', type: 'uuid', isNullable: false },
          { name: 'customerId', type: 'uuid', isNullable: true },
          {
            name: 'customerName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          { name: 'issueDate', type: 'date', isNullable: false },
          { name: 'validUntil', type: 'date', isNullable: true },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            isNullable: false,
            default: `'TRY'`,
          },
          {
            name: 'total',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: `'draft'`,
          },
          { name: 'items', type: 'jsonb', isNullable: true },
          { name: 'scopeOfWorkHtml', type: 'text', isNullable: true },
          { name: 'version', type: 'int', isNullable: false, default: 1 },
          { name: 'revisions', type: 'jsonb', isNullable: true },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['tenantId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'tenants',
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['customerId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'customers',
            onDelete: 'SET NULL',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'quotes',
      new TableIndex({
        name: 'IDX_quotes_tenant_id',
        columnNames: ['tenantId'],
      }),
    );

    await queryRunner.createIndex(
      'quotes',
      new TableIndex({
        name: 'UQ_quotes_publicId',
        columnNames: ['publicId'],
        isUnique: true,
      }),
    );

    // Unique quoteNumber index
    await queryRunner.createIndex(
      'quotes',
      new TableIndex({
        name: 'UQ_quotes_quoteNumber',
        columnNames: ['quoteNumber'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('quotes');
  }
}
