import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Product } from '../products/entities/product.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { ProductCategory } from '../products/entities/product-category.entity';

@Injectable()
export class AdminService {
  private activeAdminTokens: Set<string> = new Set();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(Expense)
    private expenseRepository: Repository<Expense>,
    @InjectRepository(ProductCategory)
    private productCategoryRepository: Repository<ProductCategory>,
    private dataSource: DataSource,
  ) {}

  async adminLogin(username: string, password: string) {
    // Güvenli admin kontrolü - environment variables'dan al
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    
    if (!adminPasswordHash) {
      throw new UnauthorizedException('Admin credentials not configured');
    }

    if (username !== adminUsername) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    // bcrypt ile hash kontrol et
    const bcrypt = require('bcrypt');
    const isPasswordValid = await bcrypt.compare(password, adminPasswordHash);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    // Güvenli random token üret
    const crypto = require('crypto');
    const adminToken = crypto.randomBytes(32).toString('hex');
    
    // Token'ı geçici olarak cache'de sakla (Redis kullanılmalı)
    // Şu an basit in-memory cache kullanıyoruz
    this.activeAdminTokens = this.activeAdminTokens || new Set();
    this.activeAdminTokens.add(adminToken);
    
    // 1 saat sonra token'ı geçersiz kıl
    setTimeout(() => {
      this.activeAdminTokens?.delete(adminToken);
    }, 60 * 60 * 1000);

    return {
      success: true,
      message: 'Admin login successful',
      adminToken,
      expiresIn: '1h',
    };
  }

  /**
   * Admin token doğrulama
   */
  isValidAdminToken(token: string): boolean {
    return this.activeAdminTokens.has(token);
  }

  /**
   * Admin token iptal et
   */
  revokeAdminToken(token: string): void {
    this.activeAdminTokens.delete(token);
  }

  async getAllUsers() {
    return this.userRepository.find({
      relations: ['tenant'],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        tenant: {
          id: true,
          name: true,
          slug: true,
          companyName: true,
        },
      },
    });
  }

  async getAllTenants() {
    const tenants = await this.tenantRepository.find({
      relations: ['users'],
    });

    // Her tenant için istatistikleri hesapla
    const tenantsWithStats = await Promise.all(
      tenants.map(async (tenant) => {
        const [customerCount, supplierCount, productCount, invoiceCount, expenseCount] = await Promise.all([
          this.customerRepository.count({ where: { tenantId: tenant.id } }),
          this.supplierRepository.count({ where: { tenantId: tenant.id } }),
          this.productRepository.count({ where: { tenantId: tenant.id } }),
          this.invoiceRepository.count({ where: { tenantId: tenant.id } }),
          this.expenseRepository.count({ where: { tenantId: tenant.id } }),
        ]);

        return {
          ...tenant,
          stats: {
            customers: customerCount,
            suppliers: supplierCount,
            products: productCount,
            invoices: invoiceCount,
            expenses: expenseCount,
            users: tenant.users?.length || 0,
          },
        };
      }),
    );

    return tenantsWithStats;
  }

  async getUserData(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['tenant'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.getTenantData(user.tenantId);
  }

  async getTenantData(tenantId: string) {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
      relations: ['users'],
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const [customers, suppliers, products, productCategories, invoices, expenses] = await Promise.all([
      this.customerRepository.find({ where: { tenantId } }),
      this.supplierRepository.find({ where: { tenantId } }),
      this.productRepository.find({ where: { tenantId } }),
      this.productCategoryRepository.find({ where: { tenantId } }),
      this.invoiceRepository.find({ 
        where: { tenantId },
        relations: ['customer'],
      }),
      this.expenseRepository.find({ 
        where: { tenantId },
        relations: ['supplier'],
      }),
    ]);

    return {
      tenant,
      data: {
        customers,
        suppliers,
        products,
        productCategories,
        invoices,
        expenses,
      },
      stats: {
        customers: customers.length,
        suppliers: suppliers.length,
        products: products.length,
        productCategories: productCategories.length,
        invoices: invoices.length,
        expenses: expenses.length,
        users: tenant.users?.length || 0,
      },
    };
  }

  async getAllTables() {
    const query = `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name NOT LIKE 'pg_%'
      AND table_name != 'migrations'
      ORDER BY table_name, ordinal_position
    `;

    const columns = await this.dataSource.query(query);
    
    // Tabloları grupla
    const tables = columns.reduce((acc, col) => {
      if (!acc[col.table_name]) {
        acc[col.table_name] = {
          name: col.table_name,
          columns: [],
        };
      }
      acc[col.table_name].columns.push({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        default: col.column_default,
      });
      return acc;
    }, {});

    // Her tablo için kayıt sayısını al
    const tableList = Object.values(tables) as any[];
    for (const table of tableList) {
      try {
        const countResult = await this.dataSource.query(`SELECT COUNT(*) as count FROM "${table.name}"`);
        table.recordCount = parseInt(countResult[0].count);
      } catch (error) {
        table.recordCount = 0;
      }
    }

    return tableList;
  }

  async getTableData(tableName: string, tenantId?: string, limit = 100, offset = 0) {
    // Güvenlik kontrolü - sadece belirli tablolara erişim
    const allowedTables = [
      'users', 'tenants', 'customers', 'suppliers', 
      'products', 'product_categories', 'invoices', 'expenses'
    ];

    if (!allowedTables.includes(tableName)) {
      throw new UnauthorizedException('Access to this table is not allowed');
    }

    let query = `SELECT * FROM "${tableName}"`;
    const params: any[] = [];

    // TenantId filtresi ekle
    if (tenantId && tableName !== 'tenants') {
      // Tabloda tenantId kolonu var mı kontrol et
      const hasTenanIdColumn = await this.dataSource.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'tenantId'
      `, [tableName]);

      if (hasTenanIdColumn.length > 0) {
        query += ` WHERE "tenantId" = $1`;
        params.push(tenantId);
      }
    }

    query += ` ORDER BY "createdAt" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const data = await this.dataSource.query(query, params);

    // Toplam kayıt sayısını al
    let countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
    const countParams: any[] = [];
    
    if (tenantId && tableName !== 'tenants') {
      const hasTenanIdColumn = await this.dataSource.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'tenantId'
      `, [tableName]);

      if (hasTenanIdColumn.length > 0) {
        countQuery += ` WHERE "tenantId" = $1`;
        countParams.push(tenantId);
      }
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const totalCount = parseInt(countResult[0].count);

    return {
      tableName,
      data,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    };
  }
}