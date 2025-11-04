import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateSalesTable1762100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sales',
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
            name: 'customerId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'saleDate',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'subtotal',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'taxAmount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'discountAmount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'total',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: `'created'`,
          },
          {
            name: 'sourceQuoteId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'invoiceId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'items',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
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
          // invoiceId isteğe bağlı; doğrudan foreign key eklemek isterseniz uncomment edin.
          // {
          //   columnNames: ['invoiceId'],
          //   referencedColumnNames: ['id'],
          //   referencedTableName: 'invoices',
          //   onDelete: 'SET NULL',
          // },
        ],
      }),
    );

    await queryRunner.createIndex(
      'sales',
      new TableIndex({
        name: 'IDX_sales_tenant_id',
        columnNames: ['tenantId'],
      }),
    );

    await queryRunner.createIndex(
      'sales',
      new TableIndex({
        name: 'IDX_sales_created_at',
        columnNames: ['createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('sales');
  }
}
