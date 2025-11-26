import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateBankAccountsTable1762800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // bank_accounts tablosu
    const tableExists = await queryRunner.hasTable('bank_accounts');
    if (!tableExists) {
      await queryRunner.createTable(
        new Table({
          name: 'bank_accounts',
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
              length: '150',
              isNullable: false,
            },
            {
              name: 'iban',
              type: 'varchar',
              length: '34',
              isNullable: false,
            },
            {
              name: 'bankName',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'currency',
              type: 'varchar',
              length: '3',
              isNullable: false,
              default: "'TRY'",
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
            new TableForeignKey({
              columnNames: ['tenantId'],
              referencedTableName: 'tenants',
              referencedColumnNames: ['id'],
              onDelete: 'CASCADE',
            }),
          ],
        }),
      );

      await queryRunner.createIndex(
        'bank_accounts',
        new TableIndex({
          name: 'IDX_bank_accounts_tenant_id',
          columnNames: ['tenantId'],
        }),
      );
      await queryRunner.createIndex(
        'bank_accounts',
        new TableIndex({
          name: 'IDX_bank_accounts_created_at',
          columnNames: ['createdAt'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('bank_accounts');
    if (tableExists) {
      await queryRunner.dropTable('bank_accounts');
    }
  }
}
