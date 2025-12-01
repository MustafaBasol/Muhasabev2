import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCurrencyToTenant1733000000000 implements MigrationInterface {
  name = 'AddCurrencyToTenant1733000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add currency column to tenants table
    await queryRunner.addColumn(
      'tenants',
      new TableColumn({
        name: 'currency',
        type: 'varchar',
        length: '3',
        isNullable: true,
        default: "'TRY'",
        comment: 'Currency (TRY|USD|EUR|GBP)',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('tenants', 'currency');
  }
}
