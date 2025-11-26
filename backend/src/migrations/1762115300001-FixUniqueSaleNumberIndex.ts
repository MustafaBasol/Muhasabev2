import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixUniqueSaleNumberIndex1762115300001
  implements MigrationInterface
{
  name = 'FixUniqueSaleNumberIndex1762115300001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Postgres'te daha önce TableIndex ile oluşturulmuş UNIQUE index'i düşür
    await queryRunner.query(`DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'UQ_sales_saleNumber'
      ) THEN
        EXECUTE 'DROP INDEX IF EXISTS "UQ_sales_saleNumber"';
      END IF;
    END$$;`);

    // Eski constraint'e karşı da tedbir (eğer constraint olarak eklenmişse)
    await queryRunner.query(`DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'UNIQUE' AND table_name = 'sales' AND constraint_name = 'UQ_sales_saleNumber'
      ) THEN
        EXECUTE 'ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "UQ_sales_saleNumber"';
      END IF;
    END$$;`);

    // Yeni bileşik tekil index (tenantId, saleNumber)
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sales_tenant_saleNumber_idx" ON "sales" ("tenantId", "saleNumber");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Bileşik tekil index'i kaldır, eski tekil index'i (sadece saleNumber) geri yükleme
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_sales_tenant_saleNumber_idx";`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sales_saleNumber" ON "sales" ("saleNumber");`,
    );
  }
}
