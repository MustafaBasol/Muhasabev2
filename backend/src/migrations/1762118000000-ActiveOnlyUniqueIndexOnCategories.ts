import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActiveOnlyUniqueIndexOnCategories1762118000000 implements MigrationInterface {
  name = 'ActiveOnlyUniqueIndexOnCategories1762118000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Eski tekil index'i (tenantId,name) kaldır
    await queryRunner.query(`DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'IDX_product_categories_tenant_name'
      ) THEN
        EXECUTE 'DROP INDEX IF EXISTS "IDX_product_categories_tenant_name"';
      END IF;
    END$$;`);

    // Yalnızca aktif kategoriler için kısmi tekil index oluştur
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_active_product_categories_tenant_name" ON "product_categories" ("tenantId", "name") WHERE "isActive" = true;`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Kısmi index'i kaldır ve eski genel index'i geri getir
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_active_product_categories_tenant_name";`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_categories_tenant_name" ON "product_categories" ("tenantId", "name");`
    );
  }
}
