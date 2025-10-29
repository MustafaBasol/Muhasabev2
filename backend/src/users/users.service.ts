import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import archiver from 'archiver';
import { Readable } from 'stream';

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
    private usersRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      relations: ['tenant'],
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['tenant'],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      relations: ['tenant'],
    });
  }

  async findByTenant(tenantId: string): Promise<User[]> {
    return this.usersRepository.find({
      where: { tenantId },
      relations: ['tenant'],
    });
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    
    const user = this.usersRepository.create({
      email: createUserDto.email,
      password: hashedPassword,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      role: createUserDto.role || UserRole.USER,
      tenantId: createUserDto.tenantId,
    });

    return this.usersRepository.save(user);
  }

  async update(id: string, updateData: Partial<User>): Promise<User> {
    console.log('🔧 UsersService.update called with:', { id, updateData });
    
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    console.log('📊 Calling repository.update with:', { id, updateData });
    await this.usersRepository.update(id, updateData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.usersRepository.update(id, {
      lastLoginAt: new Date(),
    });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }

  /**
   * GDPR: Export all user data as ZIP archive
   */
  async exportUserData(userId: string): Promise<Buffer> {
    const user = await this.findOne(userId);
    
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
      tenant: user.tenant ? {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        companyName: user.tenant.companyName,
      } : null,
      // TODO: Add related data queries
      // invoices: await this.getUserInvoices(userId),
      // expenses: await this.getUserExpenses(userId),
      // customers: await this.getUserCustomers(userId),
      // suppliers: await this.getUserSuppliers(userId),
    };

    // Create manifest with data information
    const manifest = {
      exportDate: new Date().toISOString(),
      userId: userId,
      email: user.email,
      dataTypes: ['profile', 'tenant'],
      retentionPolicy: 'Personal data will be retained for 7 years as required by accounting regulations.',
      contact: 'privacy@comptario.com',
    };

    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on('data', (chunk) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      // Add files to archive
      archive.append(JSON.stringify(userData, null, 2), { name: 'user_data.json' });
      archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
      
      // Add CSV version of profile data
      const csvData = this.convertToCSV([userData.profile]);
      archive.append(csvData, { name: 'profile.csv' });

      archive.finalize();
    });
  }

  /**
   * GDPR: Request account deletion (mark as pending)
   */
  async requestAccountDeletion(userId: string): Promise<void> {
    const user = await this.findOne(userId);
    
    // Mark user as pending deletion
    await this.usersRepository.update(userId, {
      deletionRequestedAt: new Date(),
      isPendingDeletion: true,
      isActive: false, // Disable login
      updatedAt: new Date(),
    });

    // TODO: Send confirmation email
    // await this.emailService.sendDeletionConfirmation(user.email);
    
    // TODO: Queue background job for actual deletion after retention period
    // await this.queueService.scheduleAccountDeletion(userId, 30); // 30 days
    
    console.log(`🗑️  Account deletion requested for user ${userId} (${user.email})`);
  }

  /**
   * Helper: Convert object array to CSV
   */
  private convertToCSV(data: any[]): string {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
        }).join(',')
      )
    ];
    
    return csvRows.join('\n');
  }
}
