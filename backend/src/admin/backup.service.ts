import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface BackupMetadata {
  id: string;
  type: 'system' | 'user' | 'tenant';
  entityId?: string; // userId veya tenantId
  entityName?: string;
  filename: string;
  size: number;
  createdAt: Date;
  description?: string;
}

@Injectable()
export class BackupService {
  private readonly backupDir = '/workspaces/Muhasabev2/backend/backups';
  private readonly metadataFile = '/workspaces/Muhasabev2/backend/backups/metadata.json';

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Tenant)
    private tenantsRepository: Repository<Tenant>,
    private dataSource: DataSource,
  ) {}

  /**
   * Metadata dosyasını oku
   */
  private async readMetadata(): Promise<BackupMetadata[]> {
    try {
      const data = await fs.readFile(this.metadataFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  /**
   * Metadata dosyasına yaz
   */
  private async writeMetadata(metadata: BackupMetadata[]): Promise<void> {
    await fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2));
  }

  /**
   * Tüm backup'ları listele
   */
  async listBackups(type?: 'system' | 'user' | 'tenant'): Promise<BackupMetadata[]> {
    const metadata = await this.readMetadata();
    
    if (type) {
      return metadata.filter(b => b.type === type);
    }
    
    return metadata.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Belirli bir kullanıcının backup'larını listele
   */
  async listUserBackups(userId: string): Promise<BackupMetadata[]> {
    const metadata = await this.readMetadata();
    return metadata
      .filter(b => b.type === 'user' && b.entityId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Sistem bazlı backup oluştur (tüm veritabanı)
   */
  async createSystemBackup(description?: string): Promise<BackupMetadata> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `system_backup_${timestamp}.sql`;
    const filepath = path.join(this.backupDir, filename);

    // PostgreSQL dump al
    const command = `docker exec moneyflow-db pg_dump -U moneyflow moneyflow_dev > ${filepath}`;
    await execAsync(command);

    // Dosya boyutunu al
    const stats = await fs.stat(filepath);

    const metadata: BackupMetadata = {
      id: `system_${Date.now()}`,
      type: 'system',
      filename,
      size: stats.size,
      createdAt: new Date(),
      description: description || 'Sistem geneli backup',
    };

    // Metadata'ya ekle
    const allMetadata = await this.readMetadata();
    allMetadata.push(metadata);
    await this.writeMetadata(allMetadata);

    return metadata;
  }

  /**
   * Kullanıcı bazlı backup oluştur
   */
  async createUserBackup(userId: string, description?: string): Promise<BackupMetadata> {
    const user = await this.usersRepository.findOne({ 
      where: { id: userId },
      relations: ['tenant']
    });
    
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `user_${userId}_${timestamp}.json`;
    const filepath = path.join(this.backupDir, filename);

    // Kullanıcının tüm verilerini topla
    const userData = {
      user: user,
      customers: await this.dataSource.query(
        'SELECT * FROM customers WHERE "tenantId" = $1',
        [user.tenantId]
      ),
      suppliers: await this.dataSource.query(
        'SELECT * FROM suppliers WHERE "tenantId" = $1',
        [user.tenantId]
      ),
      products: await this.dataSource.query(
        'SELECT * FROM products WHERE "tenantId" = $1',
        [user.tenantId]
      ),
      invoices: await this.dataSource.query(
        'SELECT * FROM invoices WHERE "tenantId" = $1',
        [user.tenantId]
      ),
      expenses: await this.dataSource.query(
        'SELECT * FROM expenses WHERE "tenantId" = $1',
        [user.tenantId]
      ),
    };

    // JSON olarak kaydet
    await fs.writeFile(filepath, JSON.stringify(userData, null, 2));

    const stats = await fs.stat(filepath);

    const metadata: BackupMetadata = {
      id: `user_${userId}_${Date.now()}`,
      type: 'user',
      entityId: userId,
      entityName: `${user.firstName} ${user.lastName}`,
      filename,
      size: stats.size,
      createdAt: new Date(),
      description: description || `${user.email} kullanıcı verisi`,
    };

    const allMetadata = await this.readMetadata();
    allMetadata.push(metadata);
    await this.writeMetadata(allMetadata);

    return metadata;
  }

  /**
   * Tenant bazlı backup oluştur
   */
  async createTenantBackup(tenantId: string, description?: string): Promise<BackupMetadata> {
    const tenant = await this.tenantsRepository.findOne({ where: { id: tenantId } });
    
    if (!tenant) {
      throw new NotFoundException('Tenant bulunamadı');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `tenant_${tenantId}_${timestamp}.json`;
    const filepath = path.join(this.backupDir, filename);

    // Tenant'ın tüm verilerini topla
    const tenantData = {
      tenant: tenant,
      users: await this.dataSource.query(
        'SELECT * FROM users WHERE "tenantId" = $1',
        [tenantId]
      ),
      customers: await this.dataSource.query(
        'SELECT * FROM customers WHERE "tenantId" = $1',
        [tenantId]
      ),
      suppliers: await this.dataSource.query(
        'SELECT * FROM suppliers WHERE "tenantId" = $1',
        [tenantId]
      ),
      products: await this.dataSource.query(
        'SELECT * FROM products WHERE "tenantId" = $1',
        [tenantId]
      ),
      product_categories: await this.dataSource.query(
        'SELECT * FROM product_categories WHERE "tenantId" = $1',
        [tenantId]
      ),
      invoices: await this.dataSource.query(
        'SELECT * FROM invoices WHERE "tenantId" = $1',
        [tenantId]
      ),
      expenses: await this.dataSource.query(
        'SELECT * FROM expenses WHERE "tenantId" = $1',
        [tenantId]
      ),
    };

    await fs.writeFile(filepath, JSON.stringify(tenantData, null, 2));

    const stats = await fs.stat(filepath);

    const metadata: BackupMetadata = {
      id: `tenant_${tenantId}_${Date.now()}`,
      type: 'tenant',
      entityId: tenantId,
      entityName: tenant.name,
      filename,
      size: stats.size,
      createdAt: new Date(),
      description: description || `${tenant.name} tenant verisi`,
    };

    const allMetadata = await this.readMetadata();
    allMetadata.push(metadata);
    await this.writeMetadata(allMetadata);

    return metadata;
  }

  /**
   * Sistem backup'ını geri yükle
   */
  async restoreSystemBackup(backupId: string): Promise<{ success: boolean; message: string }> {
    const metadata = await this.readMetadata();
    const backup = metadata.find(b => b.id === backupId);

    if (!backup || backup.type !== 'system') {
      throw new NotFoundException('Backup bulunamadı');
    }

    const filepath = path.join(this.backupDir, backup.filename);

    // Veritabanını sıfırla ve geri yükle
    const commands = [
      'docker exec moneyflow-db psql -U moneyflow -d postgres -c "DROP DATABASE IF EXISTS moneyflow_dev;"',
      'docker exec moneyflow-db psql -U moneyflow -d postgres -c "CREATE DATABASE moneyflow_dev;"',
      `docker exec -i moneyflow-db psql -U moneyflow moneyflow_dev < ${filepath}`,
    ];

    for (const command of commands) {
      await execAsync(command);
    }

    return {
      success: true,
      message: `Sistem ${backup.createdAt} tarihli backup'tan geri yüklendi`,
    };
  }

  /**
   * Kullanıcı backup'ını geri yükle (sadece bu kullanıcının verileri)
   */
  async restoreUserBackup(userId: string, backupId: string): Promise<{ success: boolean; message: string }> {
    const metadata = await this.readMetadata();
    const backup = metadata.find(b => b.id === backupId);

    if (!backup || backup.type !== 'user' || backup.entityId !== userId) {
      throw new NotFoundException('Backup bulunamadı');
    }

    const filepath = path.join(this.backupDir, backup.filename);
    const backupData = JSON.parse(await fs.readFile(filepath, 'utf-8'));

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tenantId = backupData.user.tenantId;

      // Mevcut tenant verilerini sil
      await queryRunner.query('DELETE FROM expenses WHERE "tenantId" = $1', [tenantId]);
      await queryRunner.query('DELETE FROM invoices WHERE "tenantId" = $1', [tenantId]);
      await queryRunner.query('DELETE FROM products WHERE "tenantId" = $1', [tenantId]);
      await queryRunner.query('DELETE FROM suppliers WHERE "tenantId" = $1', [tenantId]);
      await queryRunner.query('DELETE FROM customers WHERE "tenantId" = $1', [tenantId]);

      // Backup'tan verileri geri yükle
      if (backupData.customers?.length > 0) {
        for (const customer of backupData.customers) {
          await queryRunner.query(
            `INSERT INTO customers (id, name, email, phone, address, "taxNumber", company, balance, "tenantId", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [customer.id, customer.name, customer.email, customer.phone, customer.address, 
             customer.taxNumber, customer.company, customer.balance, customer.tenantId, 
             customer.createdAt, customer.updatedAt]
          );
        }
      }

      if (backupData.suppliers?.length > 0) {
        for (const supplier of backupData.suppliers) {
          await queryRunner.query(
            `INSERT INTO suppliers (id, name, email, phone, address, "taxNumber", company, balance, "tenantId", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [supplier.id, supplier.name, supplier.email, supplier.phone, supplier.address,
             supplier.taxNumber, supplier.company, supplier.balance, supplier.tenantId,
             supplier.createdAt, supplier.updatedAt]
          );
        }
      }

      if (backupData.products?.length > 0) {
        for (const product of backupData.products) {
          await queryRunner.query(
            `INSERT INTO products (id, name, code, description, price, cost, stock, "minStock", unit, category, "taxRate", "isActive", "tenantId", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [product.id, product.name, product.code, product.description, product.price,
             product.cost, product.stock, product.minStock, product.unit, product.category,
             product.taxRate, product.isActive, product.tenantId, product.createdAt, product.updatedAt]
          );
        }
      }

      if (backupData.invoices?.length > 0) {
        for (const invoice of backupData.invoices) {
          await queryRunner.query(
            `INSERT INTO invoices (id, "invoiceNumber", "tenantId", "customerId", "issueDate", "dueDate", subtotal, "taxAmount", "discountAmount", total, status, notes, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [invoice.id, invoice.invoiceNumber, invoice.tenantId, invoice.customerId,
             invoice.issueDate, invoice.dueDate, invoice.subtotal, invoice.taxAmount,
             invoice.discountAmount, invoice.total, invoice.status, invoice.notes,
             invoice.createdAt, invoice.updatedAt]
          );
        }
      }

      if (backupData.expenses?.length > 0) {
        for (const expense of backupData.expenses) {
          await queryRunner.query(
            `INSERT INTO expenses (id, "expenseNumber", "tenantId", "supplierId", description, "expenseDate", amount, category, status, notes, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [expense.id, expense.expenseNumber, expense.tenantId, expense.supplierId,
             expense.description, expense.expenseDate, expense.amount, expense.category,
             expense.status, expense.notes, expense.createdAt, expense.updatedAt]
          );
        }
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: `Kullanıcı verileri ${backup.createdAt} tarihli backup'tan geri yüklendi`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Tenant backup'ını geri yükle
   */
  async restoreTenantBackup(tenantId: string, backupId: string): Promise<{ success: boolean; message: string }> {
    // Kullanıcı restore ile aynı mantık, sadece tenant ID kontrolü farklı
    return this.restoreUserBackup(tenantId, backupId);
  }

  /**
   * Backup sil
   */
  async deleteBackup(backupId: string): Promise<{ success: boolean }> {
    const metadata = await this.readMetadata();
    const backup = metadata.find(b => b.id === backupId);

    if (!backup) {
      throw new NotFoundException('Backup bulunamadı');
    }

    // Dosyayı sil
    const filepath = path.join(this.backupDir, backup.filename);
    await fs.unlink(filepath);

    // Metadata'dan kaldır
    const updatedMetadata = metadata.filter(b => b.id !== backupId);
    await this.writeMetadata(updatedMetadata);

    return { success: true };
  }

  /**
   * 30 günden eski backup'ları temizle
   */
  async cleanupOldBackups(): Promise<{ deleted: number; message: string }> {
    const metadata = await this.readMetadata();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const oldBackups = metadata.filter(b => new Date(b.createdAt) < thirtyDaysAgo);

    for (const backup of oldBackups) {
      try {
        const filepath = path.join(this.backupDir, backup.filename);
        await fs.unlink(filepath);
      } catch (error) {
        console.error(`Backup silinemedi: ${backup.filename}`, error);
      }
    }

    const updatedMetadata = metadata.filter(b => new Date(b.createdAt) >= thirtyDaysAgo);
    await this.writeMetadata(updatedMetadata);

    return {
      deleted: oldBackups.length,
      message: `${oldBackups.length} eski backup temizlendi`,
    };
  }

  /**
   * Backup istatistikleri
   */
  async getStatistics(): Promise<any> {
    const metadata = await this.readMetadata();
    
    const totalSize = metadata.reduce((sum, b) => sum + b.size, 0);
    const systemBackups = metadata.filter(b => b.type === 'system').length;
    const userBackups = metadata.filter(b => b.type === 'user').length;
    const tenantBackups = metadata.filter(b => b.type === 'tenant').length;

    return {
      total: metadata.length,
      systemBackups,
      userBackups,
      tenantBackups,
      totalSize: totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      oldestBackup: metadata.length > 0 ? metadata.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0].createdAt : null,
      newestBackup: metadata.length > 0 ? metadata.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0].createdAt : null,
    };
  }
}
