import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

const toColumnNameSet = (rows: unknown): Set<string> => {
  const names = new Set<string>();
  if (!Array.isArray(rows)) {
    return names;
  }
  for (const row of rows) {
    if (row && typeof row === 'object' && 'column_name' in row) {
      const value = (row as { column_name?: string }).column_name;
      if (typeof value === 'string') {
        names.add(value);
      }
    }
  }
  return names;
};

export class AddStripeColumnsToTenants1762759200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Idempotent: kolon var mı kontrol et, yoksa ekle. Prod ortamında yeniden
    // deploy / kısmi migrate senaryolarında migration çakışmasını engeller.
    const existing: unknown = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants'`,
    );
    const cols = toColumnNameSet(existing);

    const toAdd: TableColumn[] = [];
    if (!cols.has('stripeCustomerId')) {
      toAdd.push(
        new TableColumn({
          name: 'stripeCustomerId',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );
    }
    if (!cols.has('stripeSubscriptionId')) {
      toAdd.push(
        new TableColumn({
          name: 'stripeSubscriptionId',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );
    }
    if (!cols.has('billingInterval')) {
      toAdd.push(
        new TableColumn({
          name: 'billingInterval',
          type: 'varchar',
          length: '16',
          isNullable: true,
          comment: 'billing interval: month|year',
        }),
      );
    }
    if (toAdd.length) {
      await queryRunner.addColumns('tenants', toAdd);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Down migration: Kolon varsa düşür. (Idempotent)
    const existing: unknown = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants'`,
    );
    const cols = toColumnNameSet(existing);
    if (cols.has('billingInterval')) {
      await queryRunner.dropColumn('tenants', 'billingInterval');
    }
    if (cols.has('stripeSubscriptionId')) {
      await queryRunner.dropColumn('tenants', 'stripeSubscriptionId');
    }
    if (cols.has('stripeCustomerId')) {
      await queryRunner.dropColumn('tenants', 'stripeCustomerId');
    }
  }
}
