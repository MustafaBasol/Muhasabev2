import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddStripeColumnsToTenants1762759200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Idempotent: kolon var mı kontrol et, yoksa ekle. Prod ortamında yeniden
    // deploy / kısmi migrate senaryolarında migration çakışmasını engeller.
    const existing = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants'`,
    );
    const cols = new Set(existing.map((r: any) => r.column_name));

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
    const existing = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants'`,
    );
    const cols = new Set(existing.map((r: any) => r.column_name));
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
