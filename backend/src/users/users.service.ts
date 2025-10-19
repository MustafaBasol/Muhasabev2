import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

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
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

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
}
