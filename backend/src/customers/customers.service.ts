import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';

import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
  ) {}

  async findAll(tenantId: string): Promise<Customer[]> {
    return this.customersRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<Customer> {
    const customer = await this.customersRepository.findOne({
      where: { id, tenantId },
    });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    return customer;
  }

  async create(createCustomerDto: CreateCustomerDto, tenantId: string): Promise<Customer> {
    const customer = this.customersRepository.create({
      ...createCustomerDto,
      tenantId,
    });

    return this.customersRepository.save(customer);
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto, tenantId: string): Promise<Customer> {
    await this.customersRepository.update(
      { id, tenantId },
      updateCustomerDto,
    );
    return this.findOne(id, tenantId);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const customer = await this.findOne(id, tenantId);
    await this.customersRepository.remove(customer);
  }

  async updateBalance(id: string, amount: number, tenantId: string): Promise<Customer> {
    const customer = await this.findOne(id, tenantId);
    customer.balance = Number(customer.balance) + amount;
    return this.customersRepository.save(customer);
  }
}
