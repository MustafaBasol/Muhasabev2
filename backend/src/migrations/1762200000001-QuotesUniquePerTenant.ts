import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class QuotesUniquePerTenant1762200000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Eski global unique indeksi kaldır
    try {
      await queryRunner.query('DROP INDEX IF EXISTS "UQ_quotes_quoteNumber"');
    } catch (_) {
      // ignore
    }
    // Eğer index constraint olarak yaratılmış ise alternatif isimlerle de deneriz
    try {
      await queryRunner.query(
        'ALTER TABLE "quotes" DROP CONSTRAINT IF EXISTS "UQ_quotes_quoteNumber"',
      );
    } catch (_) {
      // ignore
    }

    // Yeni composite unique index: tenantId + quoteNumber
    await queryRunner.createIndex(
      'quotes',
      new TableIndex({
        name: 'UQ_quotes_tenant_quoteNumber',
        columnNames: ['tenantId', 'quoteNumber'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Composite unique indeksi kaldır
    try {
      await queryRunner.query(
        'DROP INDEX IF EXISTS "UQ_quotes_tenant_quoteNumber"',
      );
    } catch (_) {
      // ignore
    }

    // Eski global unique indeksi geri getir
    await queryRunner.createIndex(
      'quotes',
      new TableIndex({
        name: 'UQ_quotes_quoteNumber',
        columnNames: ['quoteNumber'],
        isUnique: true,
      }),
    );
  }
}
