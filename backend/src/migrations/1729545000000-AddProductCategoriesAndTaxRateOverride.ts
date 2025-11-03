import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductCategoriesAndTaxRateOverride1729545000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create product_categories table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_categories" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "taxRate" decimal(5,2) NOT NULL DEFAULT 18,
        "isActive" boolean NOT NULL DEFAULT true,
        "tenantId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_product_categories_tenant" FOREIGN KEY ("tenantId") 
          REFERENCES "tenants"("id") ON DELETE CASCADE
      );
    `);

    // Create index on tenantId for better query performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_categories_tenantId" 
      ON "product_categories" ("tenantId");
    `);

    // Create unique constraint on name + tenantId
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_categories_tenant_name" 
      ON "product_categories" ("tenantId", "name");
    `);

    // Add categoryTaxRateOverride column to products table
    await queryRunner.query(`
      ALTER TABLE "products" 
      ADD COLUMN IF NOT EXISTS "categoryTaxRateOverride" decimal(5,2) NULL;
    `);

    // Add comment to explain the column
    await queryRunner.query(`
      COMMENT ON COLUMN "products"."categoryTaxRateOverride" 
      IS 'Ürüne özel KDV oranı - Kategorinin varsayılan KDV oranını geçersiz kılar';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove column from products
    await queryRunner.query(`
      ALTER TABLE "products" 
      DROP COLUMN IF EXISTS "categoryTaxRateOverride";
    `);

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_product_categories_tenant_name";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_product_categories_tenantId";
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "product_categories";
    `);
  }
}
