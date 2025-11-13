import { MigrationInterface, QueryRunner, TableUnique } from 'typeorm';

export class UniqueProductCodePerTenant1762115200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('products');
    if (!table) return;

    // Drop existing unique constraint on code, if any
    const existingUniqueOnCode = table.uniques.find(
      (u) => u.columnNames.length === 1 && u.columnNames[0] === 'code',
    );
    if (existingUniqueOnCode) {
      await queryRunner.dropUniqueConstraint('products', existingUniqueOnCode);
    }

    // Create composite unique constraint on (tenantId, code)
    const compositeUnique = new TableUnique({
      name: 'UQ_products_tenantId_code',
      columnNames: ['tenantId', 'code'],
    });
    // Only create if it doesn't already exist
    const alreadyHasComposite = table.uniques.some(
      (u) =>
        u.columnNames.length === 2 &&
        u.columnNames.includes('tenantId') &&
        u.columnNames.includes('code'),
    );
    if (!alreadyHasComposite) {
      await queryRunner.createUniqueConstraint('products', compositeUnique);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('products');
    if (!table) return;

    // Drop composite unique constraint
    const composite = table.uniques.find(
      (u) =>
        u.columnNames.length === 2 &&
        u.columnNames.includes('tenantId') &&
        u.columnNames.includes('code'),
    );
    if (composite) {
      await queryRunner.dropUniqueConstraint('products', composite);
    }

    // Re-create old unique on code (best-effort)
    const uniqueOnCode = new TableUnique({
      name: 'UQ_products_code',
      columnNames: ['code'],
    });
    await queryRunner.createUniqueConstraint('products', uniqueOnCode);
  }
}
