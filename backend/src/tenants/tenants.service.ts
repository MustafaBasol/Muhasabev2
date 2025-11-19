import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Tenant,
  SubscriptionPlan,
  TenantStatus,
} from './entities/tenant.entity';
import { ProductCategory } from '../products/entities/product-category.entity';

export interface CreateTenantDto {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  website?: string;

  // Türkiye
  taxOffice?: string;
  mersisNumber?: string;
  kepAddress?: string;

  // Fransa
  siretNumber?: string;
  sirenNumber?: string;
  apeCode?: string;
  tvaNumber?: string;
  rcsNumber?: string;

  // Almanya
  steuernummer?: string;
  umsatzsteuerID?: string;
  handelsregisternummer?: string;
  geschaeftsfuehrer?: string;

  // Amerika
  einNumber?: string;
  taxId?: string;
  businessLicenseNumber?: string;
  stateOfIncorporation?: string;
}

export interface UpdateTenantDto {
  name?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  website?: string;
  // Serbest biçimli ayarlar: marka/logo, varsayılan banka, ülke vb.
  settings?: Record<string, any>;

  // Türkiye
  taxOffice?: string;
  mersisNumber?: string;
  kepAddress?: string;

  // Fransa
  siretNumber?: string;
  sirenNumber?: string;
  apeCode?: string;
  tvaNumber?: string;
  rcsNumber?: string;

  // Almanya
  steuernummer?: string;
  umsatzsteuerID?: string;
  handelsregisternummer?: string;
  geschaeftsfuehrer?: string;

  // Amerika
  einNumber?: string;
  taxId?: string;
  businessLicenseNumber?: string;
  stateOfIncorporation?: string;
}

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private tenantsRepository: Repository<Tenant>,
    @InjectRepository(ProductCategory)
    private productCategoriesRepository: Repository<ProductCategory>,
  ) {}

  async findAll(): Promise<Tenant[]> {
    return this.tenantsRepository.find({
      relations: ['users'],
    });
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantsRepository.findOne({
      where: { id },
      relations: ['users'],
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }
    return tenant;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.tenantsRepository.findOne({
      where: { slug },
      relations: ['users'],
    });
  }

  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    // Generate unique name and slug to avoid 23505 unique violations
    const uniqueName = await this.generateUniqueName(createTenantDto.name);
    const slug = await this.generateUniqueSlug(uniqueName);

    // FREE/STARTER plan süresizdir, subscriptionExpiresAt null olmalı
    const tenant = this.tenantsRepository.create({
      ...createTenantDto,
      name: uniqueName,
      slug,
      subscriptionPlan: SubscriptionPlan.FREE,
      status: TenantStatus.ACTIVE,
      subscriptionExpiresAt: null as any, // FREE plan süresiz
      // Starter/Free plan başlangıç kullanıcı limiti 1 olmalı
      maxUsers: 1,
      settings: {},
      features: {
        multiUser: true,
        customerManagement: true,
        basicReporting: true,
        exportData: false,
        advancedReporting: false,
        apiAccess: false,
      },
    });

    // Save with small retry on unique conflicts (race condition protection)
    let savedTenant: Tenant;
    let attempt = 0;
    let lastError: any = null;
    
    while (attempt < 3) {
      try {
        savedTenant = await this.tenantsRepository.save(tenant);
        // Otomatik olarak korumalı kategorileri oluştur
        await this.createDefaultCategories(savedTenant);
        return savedTenant;
        // Otomatik olarak korumalı kategorileri oluştur
        await this.createDefaultCategories(savedTenant);
        return savedTenant;
      } catch (err: any) {
        lastError = err;
        // Postgres unique violation
        const code = err?.code || err?.driverError?.code;
        if (code === '23505') {
          // regenerate name/slug and retry once more
          const baseName = createTenantDto.name;
          const rand = Math.random().toString(36).slice(2, 6);
          const nextName = `${baseName} ${rand}`.substring(0, 50);
          const nextSlug = await this.generateUniqueSlug(nextName);
          tenant.name = nextName;
          tenant.slug = nextSlug;
          attempt++;
          continue;
        }
        throw err;
      }
    }
    
    // Son deneme başarısız oldu
    throw lastError || new Error('Failed to create tenant after retries');
  }

  private async createDefaultCategories(tenant: Tenant): Promise<void> {
    const defaultCategories = [
      {
        name: 'Hizmetler',
        taxRate: 18,
        isProtected: true,
        isActive: true,
        tenant,
      },
      {
        name: 'Ürünler',
        taxRate: 18,
        isProtected: true,
        isActive: true,
        tenant,
      },
    ];

    await this.productCategoriesRepository.save(defaultCategories);
  }

  async update(id: string, updateData: Partial<Tenant>): Promise<Tenant> {
    await this.tenantsRepository.update(id, updateData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const tenant = await this.findOne(id);
    await this.tenantsRepository.remove(tenant);
  }

  async updateSubscription(
    id: string,
    plan: SubscriptionPlan,
    expiresAt?: Date,
  ): Promise<Tenant> {
    const updateData: Partial<Tenant> = {
      subscriptionPlan: plan,
      status: TenantStatus.ACTIVE,
      cancelAtPeriodEnd: false, // plan değişince iptal bayrağını sıfırla
    };

    if (expiresAt) {
      updateData.subscriptionExpiresAt = expiresAt;
    }

    // Update max users based on plan (Free:1, Basic:1, Pro:3, Enterprise: practically unlimited)
    switch (plan) {
      case SubscriptionPlan.FREE:
        updateData.maxUsers = 1;
        break;
      case SubscriptionPlan.BASIC:
        updateData.maxUsers = 1;
        break;
      case SubscriptionPlan.PROFESSIONAL:
        updateData.maxUsers = 3;
        break;
      case SubscriptionPlan.ENTERPRISE:
        updateData.maxUsers = 100000; // efektif sınırsız
        break;
    }

    return this.update(id, updateData);
  }

  async updateMaxUsers(id: string, maxUsers: number): Promise<Tenant> {
    // Plan bazlı zorunlu limitleri uygula
    const tenant = await this.findOne(id);
    let enforced = maxUsers;
    switch (tenant.subscriptionPlan) {
      case SubscriptionPlan.FREE:
      case SubscriptionPlan.BASIC:
        enforced = 1; // zorla 1
        break;
      case SubscriptionPlan.PROFESSIONAL:
        if (enforced < 1) enforced = 1;
        if (enforced > 3) enforced = 3;
        break;
      case SubscriptionPlan.ENTERPRISE:
        if (enforced < 1) enforced = 1;
        if (enforced > 100000) enforced = 100000;
        break;
    }
    if (tenant.maxUsers !== enforced) {
      await this.tenantsRepository.update(id, { maxUsers: enforced });
    }
    // Döndürmeden önce güncel entity çek
    const updated = await this.findOne(id);
    return updated;
  }

  async enforcePlanLimits(id: string): Promise<Tenant> {
    const tenant = await this.findOne(id);
    const before = tenant.maxUsers;
    let expected = before;
    switch (tenant.subscriptionPlan) {
      case SubscriptionPlan.FREE:
      case SubscriptionPlan.BASIC:
        expected = 1;
        break;
      case SubscriptionPlan.PROFESSIONAL:
        expected = 3;
        break;
      case SubscriptionPlan.ENTERPRISE:
        expected = 100000;
        break;
    }
    if (expected !== before) {
      await this.tenantsRepository.update(id, { maxUsers: expected });
      return this.findOne(id);
    }
    return tenant;
  }

  async setCancelAtPeriodEnd(id: string, value: boolean): Promise<Tenant> {
    await this.tenantsRepository.update(id, { cancelAtPeriodEnd: value });
    return this.findOne(id);
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = this.generateSlug(name);
    let candidate = base;
    let suffix = 1;
    // Try until we find a free slug (bounded loop with reasonable cap)
    // Even with high concurrency, DB unique constraint will protect; this reduces common collisions.
    while (await this.tenantsRepository.exist({ where: { slug: candidate } })) {
      candidate = `${base}-${suffix++}`.substring(0, 50);
      if (suffix > 1000) {
        // fallback: append random segment to avoid infinite loop
        const rand = Math.random().toString(36).slice(2, 6);
        candidate = `${base}-${rand}`.substring(0, 50);
        break;
      }
    }
    return candidate;
  }

  private async generateUniqueName(name: string): Promise<string> {
    const base = (name || '').trim() || 'tenant';
    let candidate = base;
    let suffix = 1;
    while (await this.tenantsRepository.exist({ where: { name: candidate } })) {
      candidate = `${base} ${suffix++}`.substring(0, 50);
      if (suffix > 1000) {
        const rand = Math.random().toString(36).slice(2, 6);
        candidate = `${base} ${rand}`.substring(0, 50);
        break;
      }
    }
    return candidate;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }
}
