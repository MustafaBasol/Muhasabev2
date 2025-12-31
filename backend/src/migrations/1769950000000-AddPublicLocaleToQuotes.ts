import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPublicLocaleToQuotes1769950000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'quotes',
      new TableColumn({
        name: 'publicLocale',
        type: 'varchar',
        length: '8',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('quotes', 'publicLocale');
  }
}
