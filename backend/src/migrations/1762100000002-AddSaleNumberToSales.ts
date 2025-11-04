import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddSaleNumberToSales1762100000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add saleNumber column (nullable first to allow update), then fill existing, then set not null
    await queryRunner.addColumn(
      'sales',
      new TableColumn({
        name: 'saleNumber',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
    );

    // Create unique index on saleNumber
    await queryRunner.createIndex(
      'sales',
      new TableIndex({
        name: 'UQ_sales_saleNumber',
        columnNames: ['saleNumber'],
        isUnique: true,
      }),
    );

    // For existing rows, generate a simple sequential number per createdAt order
    await queryRunner.query(`
      WITH numbered AS (
        SELECT id,
               ROW_NUMBER() OVER (ORDER BY "createdAt") AS rn,
               to_char("createdAt", 'YYYY') AS yyyy,
               to_char("createdAt", 'MM') AS mm
        FROM sales
        WHERE "saleNumber" IS NULL
      )
      UPDATE sales s
      SET "saleNumber" = 'SAL-' || n.yyyy || '-' || n.mm || '-' || lpad(n.rn::text, 3, '0')
      FROM numbered n
      WHERE s.id = n.id;
    `);

    // Finally set NOT NULL constraint
    await queryRunner.changeColumn(
      'sales',
      'saleNumber',
      new TableColumn({
        name: 'saleNumber',
        type: 'varchar',
        length: '32',
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('sales', 'UQ_sales_saleNumber');
    await queryRunner.dropColumn('sales', 'saleNumber');
  }
}
