import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

type SnapshotScalar = string | number | boolean | null | Date;

interface SnapshotRecord {
  [key: string]:
    | SnapshotScalar
    | SnapshotScalar[]
    | Record<string, unknown>
    | undefined;
}

interface UserSnapshot extends SnapshotRecord {
  id: string;
  tenantId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

interface TenantSnapshot extends SnapshotRecord {
  id: string;
  name: string;
  companyName: string | null;
  subscriptionPlan: Tenant['subscriptionPlan'];
  status: Tenant['status'];
  maxUsers: number | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  slug?: string | null;
}

interface TenantUserSnapshot extends SnapshotRecord {
  id: string;
  tenantId: string;
  email: string;
  password: string;
  firstName: string | null;
  lastName: string | null;
  role: User['role'];
  isActive: boolean;
  lastLoginAt: Date | string | null;
  lastLoginTimeZone: string | null;
  lastLoginUtcOffsetMinutes: number | null;
  deletionRequestedAt: Date | string | null;
  isPendingDeletion: boolean | null;
  twoFactorSecret: string | null;
  twoFactorEnabled: boolean;
  backupCodes: string[] | null;
  twoFactorEnabledAt: Date | string | null;
  isEmailVerified: boolean;
  emailVerificationToken: string | null;
  emailVerificationSentAt: Date | string | null;
  emailVerifiedAt: Date | string | null;
  passwordResetToken: string | null;
  passwordResetExpiresAt: Date | string | null;
  currentOrgId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  tokenVersion: number;
  notificationPreferences: string | Record<string, unknown> | null;
}

interface CustomerSnapshot extends SnapshotRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxNumber: string | null;
  company: string | null;
  balance: number | string | null;
  tenantId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface SupplierSnapshot extends SnapshotRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxNumber: string | null;
  company: string | null;
  balance: number | string | null;
  tenantId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface ProductSnapshot extends SnapshotRecord {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  price: number | string;
  cost: number | string | null;
  stock: number | string | null;
  minStock: number | string | null;
  unit: string | null;
  category: string | null;
  taxRate: number | string | null;
  isActive: boolean;
  tenantId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface ProductCategorySnapshot extends SnapshotRecord {
  id: string;
  name: string;
  tenantId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface InvoiceSnapshot extends SnapshotRecord {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  customerId: string;
  issueDate: Date | string;
  dueDate: Date | string | null;
  subtotal: number | string;
  taxAmount: number | string | null;
  discountAmount: number | string | null;
  total: number | string;
  status: string;
  notes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface ExpenseSnapshot extends SnapshotRecord {
  id: string;
  expenseNumber: string;
  tenantId: string;
  supplierId: string | null;
  description: string | null;
  expenseDate: Date | string;
  amount: number | string;
  category: string | null;
  status: string;
  notes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface UserBackupPayload {
  user: UserSnapshot;
  customers?: CustomerSnapshot[];
  suppliers?: SupplierSnapshot[];
  products?: ProductSnapshot[];
  invoices?: InvoiceSnapshot[];
  expenses?: ExpenseSnapshot[];
}

export interface TenantBackupPayload {
  tenant: TenantSnapshot;
  users?: TenantUserSnapshot[];
  customers?: CustomerSnapshot[];
  suppliers?: SupplierSnapshot[];
  products?: ProductSnapshot[];
  product_categories?: ProductCategorySnapshot[];
  invoices?: InvoiceSnapshot[];
  expenses?: ExpenseSnapshot[];
}

export interface BackupStatistics {
  total: number;
  systemBackups: number;
  userBackups: number;
  tenantBackups: number;
  totalSize: number;
  totalSizeMB: string;
  oldestBackup: string | Date | null;
  newestBackup: string | Date | null;
}

export interface BackupMetadata {
  id: string;
  type: 'system' | 'user' | 'tenant';
  entityId?: string; // userId veya tenantId
  entityName?: string;
  filename: string;
  size: number;
  createdAt: Date | string;
  description?: string;
}

type SystemBackupPayload = {
  version: 1;
  createdAt: string;
  tables: Record<string, Record<string, unknown>[]>;
};

@Injectable()
export class BackupService {
  private backupDir: string;
  private metadataFile: string;

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Tenant)
    private tenantsRepository: Repository<Tenant>,
    private dataSource: DataSource,
  ) {
    const configuredDir = process.env.BACKUP_DIR?.trim();
    const initialDir = configuredDir
      ? path.resolve(configuredDir)
      : path.resolve(process.cwd(), 'backups');

    this.backupDir = initialDir;
    this.metadataFile = path.join(this.backupDir, 'metadata.json');
  }

  private setBackupDir(dir: string) {
    this.backupDir = dir;
    this.metadataFile = path.join(dir, 'metadata.json');
  }

  private quoteIdent(identifier: string): string {
    // Identifier list comes from DB metadata; escape defensively.
    return `"${String(identifier).replace(/"/g, '""')}"`;
  }

  private async ensureBackupStorage(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch {
      const fallbackDir = path.join(os.tmpdir(), 'muhasabe-backups');
      try {
        await fs.mkdir(fallbackDir, { recursive: true });
        this.setBackupDir(fallbackDir);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new InternalServerErrorException(
          `Backup klasörü oluşturulamadı (${fallbackDir}): ${reason}`,
        );
      }
    }

    try {
      await fs.access(this.metadataFile);
    } catch {
      try {
        await fs.writeFile(this.metadataFile, '[]', 'utf-8');
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new InternalServerErrorException(
          `Backup metadata dosyası yazılamadı (${this.metadataFile}): ${reason}`,
        );
      }
    }
  }

  private async queryRows<T>(
    query: string,
    parameters: unknown[] = [],
  ): Promise<T[]> {
    const rows = (await this.dataSource.query(query, parameters)) as unknown;
    return rows as T[];
  }

  private async readBackupPayload<T>(filepath: string): Promise<T> {
    const raw = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(raw) as T;
  }

  private serializeUser(user: User): UserSnapshot {
    return {
      id: user.id,
      tenantId: user.tenantId,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      email: user.email,
    };
  }

  private serializeTenant(tenant: Tenant): TenantSnapshot {
    return {
      id: tenant.id,
      name: tenant.name,
      companyName: tenant.companyName ?? null,
      subscriptionPlan: tenant.subscriptionPlan,
      status: tenant.status,
      maxUsers: tenant.maxUsers ?? null,
      stripeCustomerId: tenant.stripeCustomerId ?? null,
      stripeSubscriptionId: tenant.stripeSubscriptionId ?? null,
      slug: tenant.slug ?? null,
    };
  }

  private formatTimestamp(value: Date | string): string {
    return new Date(value).toISOString();
  }

  /**
   * Metadata dosyasını oku
   */
  private async readMetadata(): Promise<BackupMetadata[]> {
    await this.ensureBackupStorage();
    try {
      const data = await fs.readFile(this.metadataFile, 'utf-8');
      return JSON.parse(data) as BackupMetadata[];
    } catch {
      return [];
    }
  }

  /**
   * Metadata dosyasına yaz
   */
  private async writeMetadata(metadata: BackupMetadata[]): Promise<void> {
    await this.ensureBackupStorage();
    await fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2));
  }

  /**
   * Tüm backup'ları listele
   */
  async listBackups(
    type?: 'system' | 'user' | 'tenant',
  ): Promise<BackupMetadata[]> {
    const metadata = await this.readMetadata();

    if (type) {
      return metadata.filter((b) => b.type === type);
    }

    return metadata.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /**
   * Belirli bir kullanıcının backup'larını listele
   */
  async listUserBackups(userId: string): Promise<BackupMetadata[]> {
    const metadata = await this.readMetadata();
    return metadata
      .filter((b) => b.type === 'user' && b.entityId === userId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }

  /**
   * Sistem bazlı backup oluştur (tüm veritabanı)
   */
  async createSystemBackup(description?: string): Promise<BackupMetadata> {
    await this.ensureBackupStorage();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `system_backup_${timestamp}.json`;
    const filepath = path.join(this.backupDir, filename);

    const tableRows = await this.queryRows<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name ASC`,
    );

    const excludedTables = new Set<string>([
      'migrations',
      'typeorm_metadata',
    ]);

    const tables: Record<string, Record<string, unknown>[]> = {};
    for (const row of tableRows) {
      const tableName = row.table_name;
      if (!tableName || excludedTables.has(tableName)) continue;
      tables[tableName] = await this.queryRows<Record<string, unknown>>(
        `SELECT * FROM ${this.quoteIdent(tableName)}`,
      );
    }

    const payload: SystemBackupPayload = {
      version: 1,
      createdAt: new Date().toISOString(),
      tables,
    };

    await fs.writeFile(filepath, JSON.stringify(payload, null, 2), 'utf-8');

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
  async createUserBackup(
    userId: string,
    description?: string,
  ): Promise<BackupMetadata> {
    await this.ensureBackupStorage();
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['tenant'],
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `user_${userId}_${timestamp}.json`;
    const filepath = path.join(this.backupDir, filename);

    const tenantId = user.tenantId;
    if (!tenantId) {
      throw new NotFoundException('Kullanıcının tenant bilgisi eksik');
    }

    // Kullanıcının tüm verilerini topla
    const userData: UserBackupPayload = {
      user: this.serializeUser(user),
      customers: await this.queryRows<CustomerSnapshot>(
        'SELECT * FROM customers WHERE "tenantId" = $1',
        [tenantId],
      ),
      suppliers: await this.queryRows<SupplierSnapshot>(
        'SELECT * FROM suppliers WHERE "tenantId" = $1',
        [tenantId],
      ),
      products: await this.queryRows<ProductSnapshot>(
        'SELECT * FROM products WHERE "tenantId" = $1',
        [tenantId],
      ),
      invoices: await this.queryRows<InvoiceSnapshot>(
        'SELECT * FROM invoices WHERE "tenantId" = $1',
        [tenantId],
      ),
      expenses: await this.queryRows<ExpenseSnapshot>(
        'SELECT * FROM expenses WHERE "tenantId" = $1',
        [tenantId],
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
  async createTenantBackup(
    tenantId: string,
    description?: string,
  ): Promise<BackupMetadata> {
    await this.ensureBackupStorage();
    const tenant = await this.tenantsRepository.findOne({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant bulunamadı');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `tenant_${tenantId}_${timestamp}.json`;
    const filepath = path.join(this.backupDir, filename);

    // Tenant'ın tüm verilerini topla
    const tenantData: TenantBackupPayload = {
      tenant: this.serializeTenant(tenant),
      users: await this.queryRows<TenantUserSnapshot>(
        `SELECT id,
                  email,
                  password,
                  "firstName",
                  "lastName",
                  role,
                  "isActive" AS "isActive",
                  "lastLoginAt",
                  "lastLoginTimeZone",
                  "lastLoginUtcOffsetMinutes",
                  "deletionRequestedAt",
                  "isPendingDeletion",
                  "twoFactorSecret",
                  "twoFactorEnabled",
                  "twoFactorBackupCodes" AS "backupCodes",
                  "twoFactorEnabledAt",
                  "isEmailVerified",
                  "emailVerificationToken",
                  "emailVerificationSentAt",
                  "emailVerifiedAt",
                  "passwordResetToken",
                  "passwordResetExpiresAt",
                  "tenantId",
                  "currentOrgId",
                  "createdAt",
                  "updatedAt",
                  "tokenVersion",
                  "notificationPreferences"
           FROM users
           WHERE "tenantId" = $1`,
        [tenantId],
      ),
      customers: await this.queryRows<CustomerSnapshot>(
        'SELECT * FROM customers WHERE "tenantId" = $1',
        [tenantId],
      ),
      suppliers: await this.queryRows<SupplierSnapshot>(
        'SELECT * FROM suppliers WHERE "tenantId" = $1',
        [tenantId],
      ),
      products: await this.queryRows<ProductSnapshot>(
        'SELECT * FROM products WHERE "tenantId" = $1',
        [tenantId],
      ),
      product_categories: await this.queryRows<ProductCategorySnapshot>(
        'SELECT * FROM product_categories WHERE "tenantId" = $1',
        [tenantId],
      ),
      invoices: await this.queryRows<InvoiceSnapshot>(
        'SELECT * FROM invoices WHERE "tenantId" = $1',
        [tenantId],
      ),
      expenses: await this.queryRows<ExpenseSnapshot>(
        'SELECT * FROM expenses WHERE "tenantId" = $1',
        [tenantId],
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
  async restoreSystemBackup(
    backupId: string,
  ): Promise<{ success: boolean; message: string }> {
    const metadata = await this.readMetadata();
    const backup = metadata.find((b) => b.id === backupId);

    if (!backup || backup.type !== 'system') {
      throw new NotFoundException('Backup bulunamadı');
    }

    const filepath = path.join(this.backupDir, backup.filename);

    if (!backup.filename.endsWith('.json')) {
      throw new BadRequestException(
        'Bu sistem yedeği formatı desteklenmiyor. Lütfen yeni bir sistem yedeği (JSON) oluşturun.',
      );
    }

    const backupData = await this.readBackupPayload<SystemBackupPayload>(filepath);
    if (!backupData?.tables || typeof backupData.tables !== 'object') {
      throw new BadRequestException('Backup dosyası bozuk veya beklenen formatta değil');
    }

    const tableNames = Object.keys(backupData.tables);
    if (tableNames.length === 0) {
      throw new BadRequestException('Backup boş (tablo verisi yok)');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const truncateList = tableNames.map((t) => this.quoteIdent(t)).join(', ');
      await queryRunner.query(
        `TRUNCATE TABLE ${truncateList} RESTART IDENTITY CASCADE`,
      );

      // FK bağımlılıklarına göre tablo sırasını belirle (parent önce).
      const nameSet = new Set(tableNames);
      const fkRows = (await queryRunner.query(
        `SELECT
           tc.table_name AS table_name,
           ccu.table_name AS referenced_table_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
         JOIN information_schema.constraint_column_usage ccu
           ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
         WHERE tc.constraint_type = 'FOREIGN KEY'
           AND tc.table_schema = 'public'`,
      )) as Array<{ table_name: string; referenced_table_name: string }>;

      const incoming = new Map<string, number>();
      const outgoing = new Map<string, Set<string>>();
      for (const n of tableNames) {
        incoming.set(n, 0);
        outgoing.set(n, new Set());
      }
      for (const row of fkRows) {
        const from = row.table_name;
        const to = row.referenced_table_name;
        if (!nameSet.has(from) || !nameSet.has(to)) continue;
        // to (referenced) should come before from.
        const outs = outgoing.get(to);
        if (outs && !outs.has(from)) {
          outs.add(from);
          incoming.set(from, (incoming.get(from) ?? 0) + 1);
        }
      }

      const queue: string[] = [];
      for (const [name, count] of incoming.entries()) {
        if (count === 0) queue.push(name);
      }
      queue.sort();

      const ordered: string[] = [];
      while (queue.length) {
        const current = queue.shift() as string;
        ordered.push(current);
        const outs = outgoing.get(current);
        if (!outs) continue;
        for (const dep of outs) {
          const next = (incoming.get(dep) ?? 0) - 1;
          incoming.set(dep, next);
          if (next === 0) {
            queue.push(dep);
            queue.sort();
          }
        }
      }

      // Döngü varsa (rare), kalanları en sona ekle.
      if (ordered.length !== tableNames.length) {
        const remaining = tableNames.filter((t) => !ordered.includes(t)).sort();
        ordered.push(...remaining);
      }

      for (const tableName of ordered) {
        const rows = Array.isArray(backupData.tables[tableName])
          ? backupData.tables[tableName]
          : [];
        if (rows.length === 0) continue;

        for (const row of rows) {
          const cols = Object.keys(row);
          if (cols.length === 0) continue;

          const quotedCols = cols.map((c) => this.quoteIdent(c)).join(', ');
          const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
          const values = cols.map((c) => {
            const v = (row as Record<string, unknown>)[c];
            return typeof v === 'undefined' ? null : v;
          });

          await queryRunner.query(
            `INSERT INTO ${this.quoteIdent(tableName)} (${quotedCols}) VALUES (${placeholders})`,
            values,
          );
        }
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    return {
      success: true,
      message: `Sistem ${new Date(backup.createdAt).toISOString()} tarihli backup'tan geri yüklendi`,
    };
  }

  /**
   * Kullanıcı backup'ını geri yükle (sadece bu kullanıcının verileri)
   */
  async restoreUserBackup(
    userId: string,
    backupId: string,
  ): Promise<{ success: boolean; message: string }> {
    const metadata = await this.readMetadata();
    const backup = metadata.find((b) => b.id === backupId);

    if (!backup || backup.type !== 'user' || backup.entityId !== userId) {
      throw new NotFoundException('Backup bulunamadı');
    }

    const filepath = path.join(this.backupDir, backup.filename);
    const backupData =
      await this.readBackupPayload<UserBackupPayload>(filepath);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tenantId = backupData.user.tenantId;
      if (!tenantId) {
        throw new NotFoundException('Backup verisinde tenant bilgisi yok');
      }

      // Mevcut tenant verilerini sil
      await queryRunner.query('DELETE FROM expenses WHERE "tenantId" = $1', [
        tenantId,
      ]);
      await queryRunner.query('DELETE FROM invoices WHERE "tenantId" = $1', [
        tenantId,
      ]);
      await queryRunner.query('DELETE FROM products WHERE "tenantId" = $1', [
        tenantId,
      ]);
      await queryRunner.query('DELETE FROM suppliers WHERE "tenantId" = $1', [
        tenantId,
      ]);
      await queryRunner.query('DELETE FROM customers WHERE "tenantId" = $1', [
        tenantId,
      ]);

      // Backup'tan verileri geri yükle
      const customers = backupData.customers;
      if (customers && customers.length > 0) {
        for (const customer of customers) {
          await queryRunner.query(
            `INSERT INTO customers (id, name, email, phone, address, "taxNumber", company, balance, "tenantId", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              customer.id,
              customer.name,
              customer.email,
              customer.phone,
              customer.address,
              customer.taxNumber,
              customer.company,
              customer.balance,
              customer.tenantId ?? tenantId,
              customer.createdAt,
              customer.updatedAt,
            ],
          );
        }
      }

      const suppliers = backupData.suppliers;
      if (suppliers && suppliers.length > 0) {
        for (const supplier of suppliers) {
          await queryRunner.query(
            `INSERT INTO suppliers (id, name, email, phone, address, "taxNumber", company, balance, "tenantId", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              supplier.id,
              supplier.name,
              supplier.email,
              supplier.phone,
              supplier.address,
              supplier.taxNumber,
              supplier.company,
              supplier.balance,
              supplier.tenantId ?? tenantId,
              supplier.createdAt,
              supplier.updatedAt,
            ],
          );
        }
      }

      const products = backupData.products;
      if (products && products.length > 0) {
        for (const product of products) {
          await queryRunner.query(
            `INSERT INTO products (id, name, code, description, price, cost, stock, "minStock", unit, category, "taxRate", "isActive", "tenantId", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
              product.id,
              product.name,
              product.code,
              product.description,
              product.price,
              product.cost,
              product.stock,
              product.minStock,
              product.unit,
              product.category,
              product.taxRate,
              product.isActive,
              product.tenantId ?? tenantId,
              product.createdAt,
              product.updatedAt,
            ],
          );
        }
      }

      const invoices = backupData.invoices;
      if (invoices && invoices.length > 0) {
        for (const invoice of invoices) {
          await queryRunner.query(
            `INSERT INTO invoices (id, "invoiceNumber", "tenantId", "customerId", "issueDate", "dueDate", subtotal, "taxAmount", "discountAmount", total, status, notes, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              invoice.id,
              invoice.invoiceNumber,
              invoice.tenantId ?? tenantId,
              invoice.customerId,
              invoice.issueDate,
              invoice.dueDate,
              invoice.subtotal,
              invoice.taxAmount,
              invoice.discountAmount,
              invoice.total,
              invoice.status,
              invoice.notes,
              invoice.createdAt,
              invoice.updatedAt,
            ],
          );
        }
      }

      const expenses = backupData.expenses;
      if (expenses && expenses.length > 0) {
        for (const expense of expenses) {
          await queryRunner.query(
            `INSERT INTO expenses (id, "expenseNumber", "tenantId", "supplierId", description, "expenseDate", amount, category, status, notes, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              expense.id,
              expense.expenseNumber,
              expense.tenantId ?? tenantId,
              expense.supplierId,
              expense.description,
              expense.expenseDate,
              expense.amount,
              expense.category,
              expense.status,
              expense.notes,
              expense.createdAt,
              expense.updatedAt,
            ],
          );
        }
      }

      await queryRunner.commitTransaction();

      const restoredAt = this.formatTimestamp(backup.createdAt);
      return {
        success: true,
        message: `Kullanıcı verileri ${restoredAt} tarihli backup'tan geri yüklendi`,
      };
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Tenant backup'ını geri yükle
   */
  async restoreTenantBackup(
    tenantId: string,
    backupId: string,
  ): Promise<{ success: boolean; message: string }> {
    const metadata = await this.readMetadata();
    const backup = metadata.find((b) => b.id === backupId);

    if (!backup || backup.type !== 'tenant' || backup.entityId !== tenantId) {
      throw new NotFoundException('Backup bulunamadı');
    }

    const filepath = path.join(this.backupDir, backup.filename);
    const backupData =
      await this.readBackupPayload<TenantBackupPayload>(filepath);

    const snapshotTenantId = backupData.tenant?.id ?? tenantId;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Tenanti güncelle
      if (backupData.tenant) {
        await queryRunner.query(
          `UPDATE tenants
           SET name = $1,
               "companyName" = $2,
               "subscriptionPlan" = $3,
               status = $4,
               "maxUsers" = $5,
               "stripeCustomerId" = $6,
               "stripeSubscriptionId" = $7,
               slug = COALESCE($8, slug)
           WHERE id = $9`,
          [
            backupData.tenant.name,
            backupData.tenant.companyName,
            backupData.tenant.subscriptionPlan,
            backupData.tenant.status,
            backupData.tenant.maxUsers,
            backupData.tenant.stripeCustomerId,
            backupData.tenant.stripeSubscriptionId,
            backupData.tenant.slug,
            snapshotTenantId,
          ],
        );
      }

      const deleteStatements = [
        'DELETE FROM expenses WHERE "tenantId" = $1',
        'DELETE FROM invoices WHERE "tenantId" = $1',
        'DELETE FROM products WHERE "tenantId" = $1',
        'DELETE FROM product_categories WHERE "tenantId" = $1',
        'DELETE FROM suppliers WHERE "tenantId" = $1',
        'DELETE FROM customers WHERE "tenantId" = $1',
        'DELETE FROM users WHERE "tenantId" = $1',
      ];
      for (const statement of deleteStatements) {
        await queryRunner.query(statement, [snapshotTenantId]);
      }

      const tenantsTenantId = snapshotTenantId;

      const upsertCustomers = backupData.customers ?? [];
      for (const customer of upsertCustomers) {
        await queryRunner.query(
          `INSERT INTO customers (id, name, email, phone, address, "taxNumber", company, balance, "tenantId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            customer.id,
            customer.name,
            customer.email,
            customer.phone,
            customer.address,
            customer.taxNumber,
            customer.company,
            customer.balance,
            customer.tenantId ?? tenantsTenantId,
            customer.createdAt,
            customer.updatedAt,
          ],
        );
      }

      const upsertSuppliers = backupData.suppliers ?? [];
      for (const supplier of upsertSuppliers) {
        await queryRunner.query(
          `INSERT INTO suppliers (id, name, email, phone, address, "taxNumber", company, balance, "tenantId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            supplier.id,
            supplier.name,
            supplier.email,
            supplier.phone,
            supplier.address,
            supplier.taxNumber,
            supplier.company,
            supplier.balance,
            supplier.tenantId ?? tenantsTenantId,
            supplier.createdAt,
            supplier.updatedAt,
          ],
        );
      }

      const upsertCategories = backupData.product_categories ?? [];
      for (const category of upsertCategories) {
        await queryRunner.query(
          `INSERT INTO product_categories (id, name, "tenantId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5)`,
          [
            category.id,
            category.name,
            category.tenantId ?? tenantsTenantId,
            category.createdAt,
            category.updatedAt,
          ],
        );
      }

      const upsertProducts = backupData.products ?? [];
      for (const product of upsertProducts) {
        await queryRunner.query(
          `INSERT INTO products (id, name, code, description, price, cost, stock, "minStock", unit, category, "taxRate", "isActive", "tenantId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            product.id,
            product.name,
            product.code,
            product.description,
            product.price,
            product.cost,
            product.stock,
            product.minStock,
            product.unit,
            product.category,
            product.taxRate,
            product.isActive,
            product.tenantId ?? tenantsTenantId,
            product.createdAt,
            product.updatedAt,
          ],
        );
      }

      const upsertInvoices = backupData.invoices ?? [];
      for (const invoice of upsertInvoices) {
        await queryRunner.query(
          `INSERT INTO invoices (id, "invoiceNumber", "tenantId", "customerId", "issueDate", "dueDate", subtotal, "taxAmount", "discountAmount", total, status, notes, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            invoice.id,
            invoice.invoiceNumber,
            invoice.tenantId ?? tenantsTenantId,
            invoice.customerId,
            invoice.issueDate,
            invoice.dueDate,
            invoice.subtotal,
            invoice.taxAmount,
            invoice.discountAmount,
            invoice.total,
            invoice.status,
            invoice.notes,
            invoice.createdAt,
            invoice.updatedAt,
          ],
        );
      }

      const upsertExpenses = backupData.expenses ?? [];
      for (const expense of upsertExpenses) {
        await queryRunner.query(
          `INSERT INTO expenses (id, "expenseNumber", "tenantId", "supplierId", description, "expenseDate", amount, category, status, notes, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            expense.id,
            expense.expenseNumber,
            expense.tenantId ?? tenantsTenantId,
            expense.supplierId,
            expense.description,
            expense.expenseDate,
            expense.amount,
            expense.category,
            expense.status,
            expense.notes,
            expense.createdAt,
            expense.updatedAt,
          ],
        );
      }

      const upsertUsers = backupData.users ?? [];
      for (const user of upsertUsers) {
        const notificationPrefs =
          typeof user.notificationPreferences === 'string'
            ? user.notificationPreferences
            : user.notificationPreferences
              ? JSON.stringify(user.notificationPreferences)
              : null;

        await queryRunner.query(
          `INSERT INTO users (
             id,
             email,
             password,
             "firstName",
             "lastName",
             role,
             "isActive",
             "lastLoginAt",
             "lastLoginTimeZone",
             "lastLoginUtcOffsetMinutes",
             "deletionRequestedAt",
             "isPendingDeletion",
             "twoFactorSecret",
             "twoFactorEnabled",
             "twoFactorBackupCodes",
             "twoFactorEnabledAt",
             "isEmailVerified",
             "emailVerificationToken",
             "emailVerificationSentAt",
             "emailVerifiedAt",
             "passwordResetToken",
             "passwordResetExpiresAt",
             "tenantId",
             "currentOrgId",
             "createdAt",
             "updatedAt",
             "tokenVersion",
             "notificationPreferences"
           )
           VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
             $21, $22, $23, $24, $25, $26, $27, $28
           )`,
          [
            user.id,
            user.email,
            user.password,
            user.firstName,
            user.lastName,
            user.role,
            user.isActive ?? true,
            user.lastLoginAt,
            user.lastLoginTimeZone,
            user.lastLoginUtcOffsetMinutes,
            user.deletionRequestedAt,
            user.isPendingDeletion ?? false,
            user.twoFactorSecret ?? null,
            user.twoFactorEnabled ?? false,
            user.backupCodes,
            user.twoFactorEnabledAt,
            user.isEmailVerified ?? false,
            user.emailVerificationToken,
            user.emailVerificationSentAt,
            user.emailVerifiedAt,
            user.passwordResetToken,
            user.passwordResetExpiresAt,
            user.tenantId ?? tenantsTenantId,
            user.currentOrgId,
            user.createdAt,
            user.updatedAt,
            user.tokenVersion ?? 0,
            notificationPrefs,
          ],
        );
      }

      await queryRunner.commitTransaction();

      const restoredAt = this.formatTimestamp(backup.createdAt);
      return {
        success: true,
        message: `Tenant verileri ${restoredAt} tarihli backup'tan geri yüklendi`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Backup sil
   */
  async deleteBackup(backupId: string): Promise<{ success: boolean }> {
    const metadata = await this.readMetadata();
    const backup = metadata.find((b) => b.id === backupId);

    if (!backup) {
      throw new NotFoundException('Backup bulunamadı');
    }

    // Dosyayı sil
    const filepath = path.join(this.backupDir, backup.filename);
    await fs.unlink(filepath);

    // Metadata'dan kaldır
    const updatedMetadata = metadata.filter((b) => b.id !== backupId);
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

    const oldBackups = metadata.filter(
      (b) => new Date(b.createdAt) < thirtyDaysAgo,
    );

    for (const backup of oldBackups) {
      try {
        const filepath = path.join(this.backupDir, backup.filename);
        await fs.unlink(filepath);
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`Backup silinemedi: ${backup.filename}`, reason);
      }
    }

    const updatedMetadata = metadata.filter(
      (b) => new Date(b.createdAt) >= thirtyDaysAgo,
    );
    await this.writeMetadata(updatedMetadata);

    return {
      deleted: oldBackups.length,
      message: `${oldBackups.length} eski backup temizlendi`,
    };
  }

  /**
   * Backup istatistikleri
   */
  async getStatistics(): Promise<BackupStatistics> {
    const metadata = await this.readMetadata();

    const totalSize = metadata.reduce((sum, b) => sum + b.size, 0);
    const systemBackups = metadata.filter((b) => b.type === 'system').length;
    const userBackups = metadata.filter((b) => b.type === 'user').length;
    const tenantBackups = metadata.filter((b) => b.type === 'tenant').length;
    const orderedByDate = [...metadata].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    const oldestBackup = orderedByDate[0]?.createdAt ?? null;
    const newestBackup = orderedByDate.length
      ? (orderedByDate[orderedByDate.length - 1]?.createdAt ?? null)
      : null;

    return {
      total: metadata.length,
      systemBackups,
      userBackups,
      tenantBackups,
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      oldestBackup,
      newestBackup,
    };
  }
}
