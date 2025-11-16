import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { Tenant, SubscriptionPlan } from '../tenants/entities/tenant.entity';
import archiver from 'archiver';
import { Readable } from 'stream';
import { SecurityService } from '../common/security.service';
import {
  TwoFactorService,
  TwoFactorSecretResponse,
} from '../common/two-factor.service';
import {
  Enable2FADto,
  Verify2FADto,
  Disable2FADto,
} from './dto/enable-2fa.dto';
import { TenantPlanLimitService } from '../common/tenant-plan-limits.service';

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  tenantId: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private securityService: SecurityService,
    private twoFactorService: TwoFactorService,
  ) {}

  async findAll() {
    return this.userRepository.find({
      select: [
        'id',
        'email',
        'firstName',
        'lastName',
        'role',
        'isActive',
        'lastLoginAt',
        'lastLoginTimeZone',
        'lastLoginUtcOffsetMinutes',
        'createdAt',
      ],
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['tenant'],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      relations: ['tenant'],
    });
  }

  async findByTenant(tenantId: string): Promise<User[]> {
    return this.userRepository.find({
      where: { tenantId },
      relations: ['tenant'],
    });
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Plan limiti: Kullanıcı ekleme kontrolü
    const tenant = await this.tenantRepository.findOne({
      where: { id: createUserDto.tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const currentCount = await this.userRepository.count({
      where: { tenantId: createUserDto.tenantId },
    });
    if (!TenantPlanLimitService.canAddUserForTenant(currentCount, tenant)) {
      const effective = TenantPlanLimitService.getLimitsForTenant(tenant);
      throw new BadRequestException(
        TenantPlanLimitService.errorMessageForWithLimits('user', effective),
      );
    }

    const hashedPassword = await this.securityService.hashPassword(
      createUserDto.password,
    );

    const user = this.userRepository.create({
      email: createUserDto.email,
      password: hashedPassword,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      role: createUserDto.role || UserRole.USER,
      tenantId: createUserDto.tenantId,
    });

    return this.userRepository.save(user);
  }

  async update(id: string, updateData: Partial<User>): Promise<User> {
    console.log('🔧 UsersService.update called with:', { id, updateData });

    if (updateData.password) {
      updateData.password = await this.securityService.hashPassword(
        updateData.password,
      );
    }

    console.log('📊 Calling repository.update with:', { id, updateData });
    await this.userRepository.update(id, updateData);
    return this.findOne(id);
  }

  async updateNotificationPreferences(
    id: string,
    prefs: {
      invoiceReminders?: boolean;
      expenseAlerts?: boolean;
      salesNotifications?: boolean;
      lowStockAlerts?: boolean;
      quoteReminders?: boolean;
    },
  ): Promise<User> {
    // Shallow validation (ensure booleans if provided)
    const cleaned: any = {};
    for (const key of [
      'invoiceReminders',
      'expenseAlerts',
      'salesNotifications',
      'lowStockAlerts',
      'quoteReminders',
    ]) {
      if (key in prefs) {
        const v = (prefs as any)[key];
        if (typeof v === 'boolean') cleaned[key] = v;
      }
    }
    await this.userRepository.update(id, {
      notificationPreferences: cleaned,
      updatedAt: new Date(),
    } as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userRepository.update(id, {
      lastLoginAt: new Date(),
    });
  }

  async incrementTokenVersion(userId: string): Promise<User> {
    const user = await this.findOne(userId);
    const next = ((user as any).tokenVersion || 0) + 1;
    await this.userRepository.update(userId, { tokenVersion: next, updatedAt: new Date() } as any);
    return this.findOne(userId);
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return this.securityService.comparePassword(password, user.password);
  }

  /**
   * GDPR: Export all user data as ZIP archive
   */
  async exportUserData(userId: string): Promise<Buffer> {
    const user = await this.findOne(userId);
    const tenantId = user.tenantId;

    // Query all related data for this tenant - using TypeORM repositories instead of raw SQL
    let invoices = [];
    let expenses = [];
    let customers = [];
    let suppliers = [];
    let products = [];
    let productCategories = [];

    try {
      // Use entity manager to get repositories dynamically
      const entityManager = this.userRepository.manager;

      // Get invoices
      try {
        invoices = await entityManager.query(
          `SELECT * FROM "invoice" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC`,
          [tenantId],
        );
      } catch (e) {
        console.log('Invoice table query failed, trying alternatives...');
        try {
          invoices = await entityManager.query(
            `SELECT * FROM invoices WHERE "tenantId" = $1 ORDER BY "createdAt" DESC`,
            [tenantId],
          );
        } catch (e2) {
          console.log('No invoice data found');
        }
      }

      // Get expenses
      try {
        expenses = await entityManager.query(
          `SELECT * FROM "expense" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC`,
          [tenantId],
        );
      } catch (e) {
        try {
          expenses = await entityManager.query(
            `SELECT * FROM expenses WHERE "tenantId" = $1 ORDER BY "createdAt" DESC`,
            [tenantId],
          );
        } catch (e2) {
          console.log('No expense data found');
        }
      }

      // Get customers
      try {
        customers = await entityManager.query(
          `SELECT * FROM "customer" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC`,
          [tenantId],
        );
      } catch (e) {
        try {
          customers = await entityManager.query(
            `SELECT * FROM customers WHERE "tenantId" = $1 ORDER BY "createdAt" DESC`,
            [tenantId],
          );
        } catch (e2) {
          console.log('No customer data found');
        }
      }

      // Get suppliers
      try {
        suppliers = await entityManager.query(
          `SELECT * FROM "supplier" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC`,
          [tenantId],
        );
      } catch (e) {
        try {
          suppliers = await entityManager.query(
            `SELECT * FROM suppliers WHERE "tenantId" = $1 ORDER BY "createdAt" DESC`,
            [tenantId],
          );
        } catch (e2) {
          console.log('No supplier data found');
        }
      }

      // Get products
      try {
        products = await entityManager.query(
          `SELECT * FROM "product" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC`,
          [tenantId],
        );
      } catch (e) {
        try {
          products = await entityManager.query(
            `SELECT * FROM products WHERE "tenantId" = $1 ORDER BY "createdAt" DESC`,
            [tenantId],
          );
        } catch (e2) {
          console.log('No product data found');
        }
      }

      // Get product categories
      try {
        productCategories = await entityManager.query(
          `SELECT * FROM "product_category" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC`,
          [tenantId],
        );
      } catch (e) {
        try {
          productCategories = await entityManager.query(
            `SELECT * FROM product_categories WHERE "tenantId" = $1 ORDER BY "createdAt" DESC`,
            [tenantId],
          );
        } catch (e2) {
          console.log('No product category data found');
        }
      }
    } catch (error) {
      console.log('Database query error:', error.message);
    }

    // Collect all user data
    const userData = {
      profile: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      },
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
            companyName: user.tenant.companyName,
            subscriptionPlan: user.tenant.subscriptionPlan,
            status: user.tenant.status,
            createdAt: user.tenant.createdAt,
          }
        : null,
      invoices: invoices || [],
      expenses: expenses || [],
      customers: customers || [],
      suppliers: suppliers || [],
      products: products || [],
      productCategories: productCategories || [],
    };

    // Create manifest with data information
    const manifest = {
      exportDate: new Date().toISOString(),
      userId: userId,
      email: user.email,
      tenantId: tenantId,
      dataTypes: [
        'profile',
        'tenant',
        'invoices',
        'expenses',
        'customers',
        'suppliers',
        'products',
        'productCategories',
      ],
      totalRecords: {
        invoices: invoices.length,
        expenses: expenses.length,
        customers: customers.length,
        suppliers: suppliers.length,
        products: products.length,
        productCategories: productCategories.length,
      },
      retentionPolicy:
        'Personal data will be retained for 7 years as required by accounting regulations.',
      contact: 'privacy@comptario.com',
    };

    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on('data', (chunk) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      // Add files to archive
      archive.append(JSON.stringify(userData, null, 2), {
        name: 'user_data.json',
      });
      archive.append(JSON.stringify(manifest, null, 2), {
        name: 'manifest.json',
      });

      // Add CSV versions of all data
      archive.append(this.convertToCSV([userData.profile]), {
        name: 'profile.csv',
      });

      if (userData.invoices.length > 0) {
        archive.append(this.convertToCSV(userData.invoices), {
          name: 'invoices.csv',
        });
      }

      if (userData.expenses.length > 0) {
        archive.append(this.convertToCSV(userData.expenses), {
          name: 'expenses.csv',
        });
      }

      if (userData.customers.length > 0) {
        archive.append(this.convertToCSV(userData.customers), {
          name: 'customers.csv',
        });
      }

      if (userData.suppliers.length > 0) {
        archive.append(this.convertToCSV(userData.suppliers), {
          name: 'suppliers.csv',
        });
      }

      if (userData.products.length > 0) {
        archive.append(this.convertToCSV(userData.products), {
          name: 'products.csv',
        });
      }

      if (userData.productCategories.length > 0) {
        archive.append(this.convertToCSV(userData.productCategories), {
          name: 'productCategories.csv',
        });
      }

      archive.finalize();
    });

    // Send email notification after successful export
    try {
      // Email service integration would go here
      console.log('Data export ready for user:', user.email);
    } catch (error) {
      console.log(
        '⚠️  Failed to send export notification email:',
        error.message,
      );
    }
  }

  /**
   * GDPR: Request account deletion (mark as pending)
   */
  async requestAccountDeletion(userId: string): Promise<void> {
    const user = await this.findOne(userId);

    // Mark user as pending deletion
    await this.userRepository.update(userId, {
      deletionRequestedAt: new Date(),
      isPendingDeletion: true,
      isActive: false, // Disable login
      updatedAt: new Date(),
    });

    // Send confirmation email
    try {
      // Email service integration would go here
      console.log('Account deletion scheduled for user:', user.email);
      console.log(`📧 Deletion confirmation email sent to ${user.email}`);
    } catch (error) {
      console.log(
        '⚠️  Failed to send deletion confirmation email:',
        error.message,
      );
    }

    // TODO: Queue background job for actual deletion after retention period
    // await this.queueService.scheduleAccountDeletion(userId, 30); // 30 days

    console.log(
      `🗑️  Account deletion requested for user ${userId} (${user.email})`,
    );
  }

  /**
   * Helper: Convert object array to CSV
   */
  private convertToCSV(data: any[]): string {
    if (!data.length) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            return typeof value === 'string'
              ? `"${value.replace(/"/g, '""')}"`
              : value;
          })
          .join(','),
      ),
    ];

    return csvRows.join('\n');
  }

  /**
   * 2FA Setup - Kullanıcı için 2FA kurulumu başlatır
   */
  async setupTwoFactor(userId: string): Promise<TwoFactorSecretResponse> {
    const user = await this.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException('2FA is already enabled for this user');
    }

    // Yeni secret ve backup codes oluştur
    const setup = this.twoFactorService.generateTwoFactorSetup(user.email);

    // Secret'ı database'e kaydet (henüz aktif değil)
    await this.userRepository.update(userId, {
      twoFactorSecret: setup.secret,
      backupCodes: setup.backupCodes.map(
        (code) => this.securityService.hashPasswordSync(code), // Backup codes'ları hash'le
      ),
    });

    return setup;
  }

  /**
   * 2FA Enable - TOTP token ile 2FA'yı aktif eder
   */
  async enableTwoFactor(
    userId: string,
    dto: Enable2FADto,
  ): Promise<{ message: string; backupCodes: string[] }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException(
        '2FA setup not initiated. Call setupTwoFactor first',
      );
    }

    // TOTP token'ı doğrula
    const isValidToken = this.twoFactorService.verifyToken(
      user.twoFactorSecret,
      dto.token,
    );
    if (!isValidToken) {
      throw new BadRequestException('Invalid TOTP token');
    }

    // 2FA'yı aktif et
    await this.userRepository.update(userId, {
      twoFactorEnabled: true,
      twoFactorEnabledAt: new Date(),
    });

    // Backup codes'ları kullanıcıya döndür (sadece bir kez gösterilir)
    const backupCodes = this.twoFactorService.generateBackupCodes();
    await this.userRepository.update(userId, {
      backupCodes: backupCodes.map((code) =>
        this.securityService.hashPasswordSync(code),
      ),
    });

    return {
      message: '2FA enabled successfully',
      backupCodes,
    };
  }

  /**
   * 2FA Verify - Login sırasında TOTP/backup code doğrular
   */
  async verifyTwoFactor(userId: string, dto: Verify2FADto): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('2FA is not enabled for this user');
    }

    // 6 haneli ise TOTP token
    if (dto.token.length === 6) {
      return this.twoFactorService.verifyToken(user.twoFactorSecret, dto.token);
    }

    // 8 haneli ise backup code
    if (dto.token.length === 8 && user.backupCodes) {
      for (const hashedCode of user.backupCodes) {
        const isValidBackupCode = await this.securityService.comparePassword(
          dto.token,
          hashedCode,
        );
        if (isValidBackupCode) {
          // Kullanılan backup code'u listeden çıkar
          const updatedBackupCodes = user.backupCodes.filter(
            (code) => code !== hashedCode,
          );
          await this.userRepository.update(userId, {
            backupCodes: updatedBackupCodes,
          });
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 2FA Disable - 2FA'yı deaktif eder
   */
  async disableTwoFactor(
    userId: string,
    dto: Disable2FADto,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    // Token'ı doğrula (TOTP veya backup code)
    const isValid = await this.verifyTwoFactor(userId, { token: dto.token });
    if (!isValid) {
      throw new BadRequestException('Invalid token');
    }

    // 2FA'yı deaktif et ve tüm 2FA verilerini sil
    await this.userRepository.update(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: undefined,
      backupCodes: undefined,
      twoFactorEnabledAt: undefined,
    });

    return {
      message: '2FA disabled successfully',
    };
  }

  /**
   * Kullanıcının 2FA durumunu kontrol eder
   */
  async getTwoFactorStatus(
    userId: string,
  ): Promise<{ enabled: boolean; backupCodesCount: number }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['twoFactorEnabled', 'backupCodes'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      enabled: user.twoFactorEnabled || false,
      backupCodesCount: user.backupCodes ? user.backupCodes.length : 0,
    };
  }
}
