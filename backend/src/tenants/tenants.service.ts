import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant, SubscriptionPlan, TenantStatus } from './entities/tenant.entity';

export interface CreateTenantDto {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
}

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private tenantsRepository: Repository<Tenant>,
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
    // Generate slug from name
    const slug = this.generateSlug(createTenantDto.name);
    
    // Set trial expiration to 14 days from now
    const trialExpiresAt = new Date();
    trialExpiresAt.setDate(trialExpiresAt.getDate() + 14);

    const tenant = this.tenantsRepository.create({
      ...createTenantDto,
      slug,
      subscriptionPlan: SubscriptionPlan.FREE,
      status: TenantStatus.TRIAL,
      subscriptionExpiresAt: trialExpiresAt,
      maxUsers: 5,
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

    return this.tenantsRepository.save(tenant);
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
    };

    if (expiresAt) {
      updateData.subscriptionExpiresAt = expiresAt;
    }

    // Update max users based on plan
    switch (plan) {
      case SubscriptionPlan.FREE:
        updateData.maxUsers = 5;
        break;
      case SubscriptionPlan.BASIC:
        updateData.maxUsers = 10;
        break;
      case SubscriptionPlan.PROFESSIONAL:
        updateData.maxUsers = 25;
        break;
      case SubscriptionPlan.ENTERPRISE:
        updateData.maxUsers = 100;
        break;
    }

    return this.update(id, updateData);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }
}
