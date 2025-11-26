import { MigrationInterface, QueryRunner } from 'typeorm';

const parseCount = (rows: unknown): number => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return 0;
  }
  const value = (rows[0] as { count?: unknown })?.count;
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number(value ?? 0);
  return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Opsiyonel: Demo/boş ortamlarda bank_accounts tablosu oluşturulduktan sonra hiçbir kayıt yoksa
 * örnek veri ekleyebilmek için basit bir seed. Prod'da hiçbir zaman çalışmayacaktır çünkü
 * migration sadece tablo yoksa çalışır ve örnek seed de sadece boşsa ekler.
 */
export class SeedBankAccountsIfMissing1762800000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('bank_accounts');
    if (!exists) return;
    // Toplam kayıt sayısını kontrol et
    const countRows: unknown = await queryRunner.query(
      'SELECT COUNT(*)::int as count FROM bank_accounts',
    );
    if (parseCount(countRows) > 0) return;

    // Herhangi bir tenant için örnek bir hesap eklemek yerine no-op bırakıyoruz.
    // (Tenant bağlamı olmadığı için burada varsayımsal seed yapmak riskli.)
  }

  public async down(): Promise<void> {
    // No-op
  }
}
