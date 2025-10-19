import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexes1729369200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Customers indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customers_tenant_id" 
      ON "customers" ("tenantId");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customers_email" 
      ON "customers" ("email");
    `);

    // Products indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_tenant_id" 
      ON "products" ("tenantId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_code" 
      ON "products" ("code");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_category" 
      ON "products" ("category");
    `);    // Suppliers indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_suppliers_tenant_id" 
      ON "suppliers" ("tenantId");
    `);

    // Invoices indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_tenant_id" 
      ON "invoices" ("tenantId");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_customer_id" 
      ON "invoices" ("customerId");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_status" 
      ON "invoices" ("status");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_issue_date" 
      ON "invoices" ("issueDate");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_due_date" 
      ON "invoices" ("dueDate");
    `);

    // Expenses indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_expenses_tenant_id" 
      ON "expenses" ("tenantId");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_expenses_supplier_id" 
      ON "expenses" ("supplierId");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_expenses_category" 
      ON "expenses" ("category");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_expenses_status" 
      ON "expenses" ("status");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_expenses_date" 
      ON "expenses" ("expenseDate");
    `);

    // Users indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_tenant_id" 
      ON "users" ("tenantId");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_email" 
      ON "users" ("email");
    `);

    // Composite indexes for common queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customers_tenant_created" 
      ON "customers" ("tenantId", "createdAt");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_tenant_category" 
      ON "products" ("tenantId", "category");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_tenant_status" 
      ON "invoices" ("tenantId", "status");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_expenses_tenant_category" 
      ON "expenses" ("tenantId", "category");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_customers_tenant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_customers_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_tenant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_sku"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_suppliers_tenant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_tenant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_customer_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_issue_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_due_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_expenses_tenant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_expenses_supplier_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_expenses_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_expenses_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_expenses_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_tenant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_customers_tenant_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_tenant_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_tenant_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_expenses_tenant_category"`);
  }
}
