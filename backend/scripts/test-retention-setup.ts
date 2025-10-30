#!/usr/bin/env ts-node

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { AuditLog, AuditAction } from '../src/audit/entities/audit-log.entity';
import { Tenant, TenantStatus, SubscriptionPlan } from '../src/tenants/entities/tenant.entity';
import { User } from '../src/users/entities/user.entity';

dotenv.config();

class RetentionTestSetup {
  private dataSource: DataSource;

  constructor() {
    this.dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USER || 'moneyflow',
      password: process.env.DATABASE_PASSWORD || 'moneyflow123',
      database: process.env.DATABASE_NAME || 'moneyflow_dev',
      entities: [AuditLog, Tenant, User],
      synchronize: false,
      logging: false,
    });
  }

  async initialize(): Promise<void> {
    await this.dataSource.initialize();
    console.log('✅ Database connection established');
  }

  async createTestData(): Promise<void> {
    console.log('🧪 Creating test data for retention validation...');

    // Create old audit logs (10 months old - should be purged)
    const auditLogRepo = this.dataSource.getRepository(AuditLog);
    const tenantRepo = this.dataSource.getRepository(Tenant);

    // Find or create a test tenant
    let testTenant = await tenantRepo.findOne({ where: { slug: 'test-tenant' } });
    if (!testTenant) {
      testTenant = tenantRepo.create({
        name: 'Test Tenant',
        slug: 'test-tenant',
        companyName: 'Test Company',
        subscriptionPlan: SubscriptionPlan.FREE,
        status: TenantStatus.ACTIVE,
      });
      await tenantRepo.save(testTenant);
    }

    // Create old audit logs (10 months ago - should be eligible for purge)
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 10);

    const oldAuditLog = auditLogRepo.create({
      tenantId: testTenant.id,
      entity: 'test_entity',
      action: AuditAction.CREATE,
      diff: { test: 'old data' },
      ip: '127.0.0.1',
      userAgent: 'test-agent',
    });
    
    await auditLogRepo.save(oldAuditLog);
    
    // Manually update the createdAt to simulate old data
    await auditLogRepo.query(
      'UPDATE audit_log SET "createdAt" = $1 WHERE id = $2',
      [oldDate, oldAuditLog.id]
    );

    // Create recent audit logs (1 month ago - should NOT be purged)
    const recentDate = new Date();
    recentDate.setMonth(recentDate.getMonth() - 1);

    const recentAuditLog = auditLogRepo.create({
      tenantId: testTenant.id,
      entity: 'test_entity',
      action: AuditAction.UPDATE,
      diff: { test: 'recent data' },
      ip: '127.0.0.1',
      userAgent: 'test-agent',
    });
    
    await auditLogRepo.save(recentAuditLog);
    
    // Manually update the createdAt to simulate recent data
    await auditLogRepo.query(
      'UPDATE audit_log SET "createdAt" = $1 WHERE id = $2',
      [recentDate, recentAuditLog.id]
    );

    // Create an expired tenant for account data testing
    const expiredDate = new Date();
    expiredDate.setFullYear(expiredDate.getFullYear() - 2); // 2 years old

    const expiredTenant = tenantRepo.create({
      name: 'Expired Test Tenant',
      slug: 'expired-test-tenant',
      companyName: 'Expired Test Company',
      subscriptionPlan: SubscriptionPlan.FREE,
      status: TenantStatus.EXPIRED,
    });
    
    await tenantRepo.save(expiredTenant);
    
    // Update the updatedAt to simulate old closure
    await tenantRepo.query(
      'UPDATE tenants SET "updatedAt" = $1 WHERE id = $2',
      [expiredDate, expiredTenant.id]
    );

    console.log('✅ Test data created:');
    console.log(`   - Old audit log (10 months): ${oldAuditLog.id}`);
    console.log(`   - Recent audit log (1 month): ${recentAuditLog.id}`);
    console.log(`   - Expired tenant (2 years): ${expiredTenant.id}`);
  }

  async verifyTestData(): Promise<void> {
    console.log('🔍 Verifying test data...');

    const auditLogRepo = this.dataSource.getRepository(AuditLog);
    const tenantRepo = this.dataSource.getRepository(Tenant);

    // Check old audit logs (should be eligible for purge)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 274); // 9 months in days

    const oldLogs = await auditLogRepo
      .createQueryBuilder('audit')
      .where('audit.createdAt < :cutoffDate', { cutoffDate })
      .getCount();

    const recentLogs = await auditLogRepo
      .createQueryBuilder('audit')
      .where('audit.createdAt >= :cutoffDate', { cutoffDate })
      .getCount();

    // Check expired tenants
    const expiredTenants = await tenantRepo
      .createQueryBuilder('tenant')  
      .where('tenant.status IN (:...statuses)', { statuses: [TenantStatus.EXPIRED, TenantStatus.SUSPENDED] })
      .andWhere('tenant.updatedAt < :cutoffDate', { 
        cutoffDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // 1 year ago
      })
      .getCount();

    console.log('📊 Test data summary:');
    console.log(`   - Old audit logs (eligible for purge): ${oldLogs}`);
    console.log(`   - Recent audit logs (should be kept): ${recentLogs}`);
    console.log(`   - Expired tenants (eligible for account purge): ${expiredTenants}`);
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test data...');

    const auditLogRepo = this.dataSource.getRepository(AuditLog);
    const tenantRepo = this.dataSource.getRepository(Tenant);

    // Clean up test audit logs
    await auditLogRepo.delete({ entity: 'test_entity' });

    // Clean up test tenants
    await tenantRepo.delete({ slug: 'test-tenant' });
    await tenantRepo.delete({ slug: 'expired-test-tenant' });

    console.log('✅ Test data cleaned up');
  }

  async close(): Promise<void> {
    await this.dataSource.destroy();
    console.log('🔌 Database connection closed');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'setup';

  const testSetup = new RetentionTestSetup();
  await testSetup.initialize();

  try {
    switch (command) {
      case 'setup':
        await testSetup.createTestData();
        await testSetup.verifyTestData();
        break;
      
      case 'verify':
        await testSetup.verifyTestData();
        break;
      
      case 'cleanup':
        await testSetup.cleanup();
        break;
      
      default:
        console.log('Usage: npm run test:retention [setup|verify|cleanup]');
        console.log('  setup   - Create test data');
        console.log('  verify  - Check current test data');
        console.log('  cleanup - Remove test data');
    }
  } catch (error) {
    console.error('💥 Test setup failed:', error);
    process.exit(1);
  } finally {
    await testSetup.close();
  }
}

if (require.main === module) {
  main();
}