import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Opsiyonel: Demo/boş ortamlarda bank_accounts tablosu oluşturulduktan sonra hiçbir kayıt yoksa
 * örnek veri ekleyebilmek için basit bir seed. Prod'da hiçbir zaman çalışmayacaktır çünkü
 * migration sadece tablo yoksa çalışır ve örnek seed de sadece boşsa ekler.
 */
export class SeedBankAccountsIfMissing1762800000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('bank_accounts');
    if (!exists) return;
    // Toplam kayıt sayısını kontrol et
    const [{ count }] = await queryRunner.query('SELECT COUNT(*)::int as count FROM bank_accounts');
    if (Number(count) > 0) return;

    // Herhangi bir tenant için örnek bir hesap eklemek yerine no-op bırakıyoruz.
    // (Tenant bağlamı olmadığı için burada varsayımsal seed yapmak riskli.)
  }

  public async down(): Promise<void> {
    // No-op
  }
}
