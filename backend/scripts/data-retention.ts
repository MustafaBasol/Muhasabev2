#!/usr/bin/env ts-node

import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'date-fns';
import * as dotenv from 'dotenv';

// Import entities
import { AuditLog } from '../src/audit/entities/audit-log.entity';
import { Customer } from '../src/customers/entities/customer.entity';
import { Supplier } from '../src/suppliers/entities/supplier.entity';
import { Product } from '../src/products/entities/product.entity';
import { Invoice } from '../src/invoices/entities/invoice.entity';
import { Expense } from '../src/expenses/entities/expense.entity';
import { Tenant } from '../src/tenants/entities/tenant.entity';
import { User } from '../src/users/entities/user.entity';
import { FiscalPeriod } from '../src/fiscal-periods/entities/fiscal-period.entity';
import { ProductCategory } from '../src/products/entities/product-category.entity';
import { TenantStatus, SubscriptionPlan } from '../src/tenants/entities/tenant.entity';

interface RetentionConfig {
  retentionPolicies: {
    [key: string]: {
      description: string;
      retentionPeriod: string;
      retentionDays: number;
      categories: string[];
      conditions: any;
      legalHold: boolean;
      note?: string;
    };
  };
  globalSettings: {
    enabled: boolean;
    dryRunByDefault: boolean;
    auditRetention: boolean;
    maxPurgeRecordsPerRun: number;
    safetyChecks: {
      requireConfirmation: boolean;
      minRecordsThreshold: number;
      skipLegalHold: boolean;
    };
  };
  notifications: {
    enabled: boolean;
    channels: string[];
    thresholds: {
      warningDays: number;
      criticalDays: number;
    };
  };
}

interface PurgeResult {
  policy: string;
  category: string;
  eligibleRecords: number;
  purgedRecords: number;
  skippedRecords: number;
  errors: string[];
  dryRun: boolean;
  timestamp: Date;
}

class DataRetentionService {
  private dataSource: DataSource;
  private config: RetentionConfig;
  private isDryRun: boolean;
  private results: PurgeResult[] = [];

  constructor(isDryRun: boolean = true) {
    this.isDryRun = isDryRun;
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
  const configPath = path.join(__dirname, '../config/retention.json');
  const configData = fs.readFileSync(configPath, 'utf8');
      this.config = JSON.parse(configData);
      
      if (this.config.globalSettings.dryRunByDefault && this.isDryRun === undefined) {
        this.isDryRun = true;
      }
    } catch (error) {
      console.error('Failed to load retention configuration:', error);
      throw new Error('Cannot proceed without valid retention configuration');
    }
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Load environment variables
      dotenv.config();
      
      this.dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || '5432'),
        username: process.env.DATABASE_USER || 'moneyflow',
        password: process.env.DATABASE_PASSWORD || 'moneyflow123',
        database: process.env.DATABASE_NAME || 'moneyflow_dev',
        entities: [
          AuditLog,
          Customer,
          Supplier,
          Product,
          Invoice,
          Expense,
          Tenant,
          User,
          FiscalPeriod,
          ProductCategory,
        ],
        synchronize: false,
        logging: false,
      });

      await this.dataSource.initialize();
      console.log('✅ Database connection established');
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
      throw error;
    }
  }

  private async logPurgeAction(result: PurgeResult): Promise<void> {
    if (!this.config.globalSettings.auditRetention) return;

    try {
      // Create a system tenant entry if it doesn't exist
      const tenantRepo = this.dataSource.getRepository(Tenant);
      let systemTenant = await tenantRepo.findOne({ where: { slug: 'system' } });
      
      if (!systemTenant) {
        systemTenant = tenantRepo.create({
          name: 'System',
          slug: 'system',
          companyName: 'System Operations',
          subscriptionPlan: SubscriptionPlan.ENTERPRISE,
          status: TenantStatus.ACTIVE,
        });
        await tenantRepo.save(systemTenant);
      }

      const auditLogRepo = this.dataSource.getRepository(AuditLog);
      
      // Create audit entry using repository create method
      const auditEntry = auditLogRepo.create({
        tenantId: systemTenant.id,
        entity: 'data_retention',
        action: 'DELETE' as any,
        diff: {
          policy: result.policy,
          category: result.category,
          eligibleRecords: result.eligibleRecords,
          purgedRecords: result.purgedRecords,
          skippedRecords: result.skippedRecords,
          dryRun: result.dryRun,
          errors: result.errors,
        },
        ip: 'system',
        userAgent: 'data-retention-job',
      });
      
      await auditLogRepo.save(auditEntry);
    } catch (error) {
      console.error('Failed to log purge action:', error);
    }
  }

  private calculateCutoffDate(retentionDays: number): Date {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    return cutoff;
  }

  private async purgeAuditLogs(policy: any): Promise<PurgeResult> {
    const result: PurgeResult = {
      policy: 'logs',
      category: 'audit_log',
      eligibleRecords: 0,
      purgedRecords: 0,
      skippedRecords: 0,
      errors: [],
      dryRun: this.isDryRun,
      timestamp: new Date(),
    };

    try {
      const cutoffDate = this.calculateCutoffDate(policy.retentionDays);
      const auditLogRepo = this.dataSource.getRepository(AuditLog);
      
      // Find eligible records
      const eligibleRecords = await auditLogRepo
        .createQueryBuilder('audit')
        .where('audit.createdAt < :cutoffDate', { cutoffDate })
        .getMany();
      
      result.eligibleRecords = eligibleRecords.length;

      if (!this.isDryRun && result.eligibleRecords > 0) {
        // Batch delete to avoid memory issues
        const batchSize = Math.min(this.config.globalSettings.maxPurgeRecordsPerRun, 100);
        let processed = 0;

        while (processed < result.eligibleRecords) {
          const batch = eligibleRecords.slice(processed, processed + batchSize);
          const batchIds = batch.map(record => record.id);
          
          const deleteResult = await auditLogRepo
            .createQueryBuilder()
            .delete()
            .whereInIds(batchIds)
            .execute();
          
          result.purgedRecords += deleteResult.affected || 0;
          processed += batch.length;
        }
      }
    } catch (error) {
      result.errors.push(`Audit log purge error: ${error.message}`);
    }

    return result;
  }

  private async purgeAccountData(policy: any): Promise<PurgeResult[]> {
    const results: PurgeResult[] = [];

    // Find expired/suspended tenants
    const tenantRepo = this.dataSource.getRepository(Tenant);
    const cutoffDate = this.calculateCutoffDate(policy.retentionDays);
    
    const expiredTenants = await tenantRepo
      .createQueryBuilder('tenant')
      .where('tenant.status IN (:...statuses)', { statuses: [TenantStatus.EXPIRED, TenantStatus.SUSPENDED] })
      .andWhere('tenant.updatedAt < :cutoffDate', { cutoffDate })
      .getMany();

    console.log(`Found ${expiredTenants.length} expired/suspended tenants eligible for data purging`);

    for (const tenant of expiredTenants) {
      // Purge customers
      const customerResult = await this.purgeTenantData(
        Customer,
        'customers',
        tenant.id,
        policy,
      );
      results.push(customerResult);

      // Purge suppliers
      const supplierResult = await this.purgeTenantData(
        Supplier,
        'suppliers',
        tenant.id,
        policy,
      );
      results.push(supplierResult);

      // Purge products
      const productResult = await this.purgeTenantData(
        Product,
        'products',
        tenant.id,
        policy,
      );
      results.push(productResult);
    }

    return results;
  }

  private async purgeTenantData(
    EntityClass: any,
    categoryName: string,
    tenantId: string,
    policy: any,
  ): Promise<PurgeResult> {
    const result: PurgeResult = {
      policy: 'account_basic',
      category: categoryName,
      eligibleRecords: 0,
      purgedRecords: 0,
      skippedRecords: 0,
      errors: [],
      dryRun: this.isDryRun,
      timestamp: new Date(),
    };

    try {
      const repository = this.dataSource.getRepository(EntityClass);
      
      // Find eligible records for the tenant
      const eligibleRecords = await repository
        .createQueryBuilder('entity')
        .where('entity.tenantId = :tenantId', { tenantId })
        .getMany();
      
      result.eligibleRecords = eligibleRecords.length;

      if (!this.isDryRun && result.eligibleRecords > 0) {
        // Soft delete first (if supported)
        if ('deletedAt' in new EntityClass()) {
          const updateResult = await repository
            .createQueryBuilder()
            .update()
            .set({ deletedAt: new Date() })
            .where('tenantId = :tenantId', { tenantId })
            .execute();
          
          result.purgedRecords = updateResult.affected || 0;
        } else {
          // Hard delete
          const deleteResult = await repository
            .createQueryBuilder()
            .delete()
            .where('tenantId = :tenantId', { tenantId })
            .execute();
          
          result.purgedRecords = deleteResult.affected || 0;
        }
      }
    } catch (error) {
      result.errors.push(`${categoryName} purge error: ${error.message}`);
    }

    return result;
  }

  private async purgeBackupFiles(): Promise<PurgeResult> {
    const result: PurgeResult = {
      policy: 'backups',
      category: 'backups',
      eligibleRecords: 0,
      purgedRecords: 0,
      skippedRecords: 0,
      errors: [],
      dryRun: this.isDryRun,
      timestamp: new Date(),
    };

    try {
  const backupDir = path.join(__dirname, '../backups');
      
      if (!fs.existsSync(backupDir)) {
        console.log('Backup directory does not exist, skipping backup file purge');
        return result;
      }

      const cutoffDate = this.calculateCutoffDate(this.config.retentionPolicies.backups.retentionDays);
      const files = fs.readdirSync(backupDir);
      
      for (const file of files) {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          result.eligibleRecords++;
          
          if (!this.isDryRun) {
            try {
              fs.unlinkSync(filePath);
              result.purgedRecords++;
            } catch (error) {
              result.errors.push(`Failed to delete ${file}: ${error.message}`);
            }
          }
        }
      }
    } catch (error) {
      result.errors.push(`Backup purge error: ${error.message}`);
    }

    return result;
  }

  public async executePurge(): Promise<void> {
    console.log('🚀 Starting Data Retention Job');
    console.log(`Mode: ${this.isDryRun ? 'DRY RUN' : 'LIVE PURGE'}`);
    console.log(`Timestamp: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`);
    console.log('==========================================');

    if (!this.config.globalSettings.enabled) {
      console.log('❌ Data retention is disabled in configuration');
      return;
    }

    await this.initializeDatabase();

    try {
      // Process each retention policy
      for (const [policyName, policy] of Object.entries(this.config.retentionPolicies)) {
        console.log(`\n📋 Processing policy: ${policyName}`);
        console.log(`   Description: ${policy.description}`);
        console.log(`   Retention: ${policy.retentionPeriod} (${policy.retentionDays} days)`);
        console.log(`   Legal Hold: ${policy.legalHold ? 'YES' : 'NO'}`);

        if (policy.legalHold && this.config.globalSettings.safetyChecks.skipLegalHold) {
          console.log('   ⚠️  SKIPPED - Legal hold protection enabled');
          continue;
        }

        switch (policyName) {
          case 'logs': {
            const logResult = await this.purgeAuditLogs(policy);
            this.results.push(logResult);
            break;
          }

          case 'account_basic': {
            const accountResults = await this.purgeAccountData(policy);
            this.results.push(...accountResults);
            break;
          }

          case 'backups': {
            const backupResult = await this.purgeBackupFiles();
            this.results.push(backupResult);
            break;
          }

          case 'accounting_docs': {
            console.log('   ⚖️  PROTECTED - Accounting documents under legal hold');
            break;
          }

          default: {
            console.log(`   ❓ Unknown policy type: ${policyName}`);
          }
        }
      }

      // Generate summary report
      await this.generateSummaryReport();

      // Log all purge actions to audit trail
      for (const result of this.results) {
        await this.logPurgeAction(result);
      }

    } catch (error) {
      console.error('💥 Fatal error during retention job:', error);
      throw error;
    } finally {
      await this.dataSource.destroy();
      console.log('🔌 Database connection closed');
    }
  }

  private async generateSummaryReport(): Promise<void> {
    console.log('\n📊 RETENTION JOB SUMMARY');
    console.log('==========================================');

    let totalEligible = 0;
    let totalPurged = 0;
    let totalErrors = 0;

    for (const result of this.results) {
      totalEligible += result.eligibleRecords;
      totalPurged += result.purgedRecords;
      totalErrors += result.errors.length;

      console.log(`\n${result.policy}/${result.category}:`);
      console.log(`  📄 Eligible records: ${result.eligibleRecords}`);
      console.log(`  ${this.isDryRun ? '🔍' : '🗑️'} ${this.isDryRun ? 'Would purge' : 'Purged'}: ${result.purgedRecords}`);
      
      if (result.skippedRecords > 0) {
        console.log(`  ⏭️  Skipped: ${result.skippedRecords}`);
      }
      
      if (result.errors.length > 0) {
        console.log(`  ❌ Errors: ${result.errors.length}`);
        result.errors.forEach(error => console.log(`     - ${error}`));
      }
    }

    console.log('\n📈 TOTALS:');
    console.log(`  📄 Total eligible records: ${totalEligible}`);
    console.log(`  ${this.isDryRun ? '🔍' : '🗑️'} Total ${this.isDryRun ? 'would be purged' : 'purged'}: ${totalPurged}`);
    console.log(`  ❌ Total errors: ${totalErrors}`);

    if (this.isDryRun) {
      console.log('\n💡 This was a DRY RUN - no data was actually deleted');
      console.log('   Run with --execute flag to perform actual purge');
    }

    console.log('\n✅ Retention job completed successfully');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--execute');
  const force = args.includes('--force');

  if (!isDryRun && !force) {
    console.log('⚠️  WARNING: This will permanently delete data!');
    console.log('   Use --force flag to confirm you want to proceed with live purge');
    console.log('   Or run without --execute flag for dry-run mode');
    process.exit(1);
  }

  try {
    const retentionService = new DataRetentionService(isDryRun);
    await retentionService.executePurge();
    process.exit(0);
  } catch (error) {
    console.error('💥 Retention job failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Retention job interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  Retention job terminated');
  process.exit(1);
});

if (require.main === module) {
  main();
}

export { DataRetentionService };