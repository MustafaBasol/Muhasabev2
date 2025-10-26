import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private suppliersRepository: Repository<Supplier>,
    @InjectRepository(Expense)
    private expensesRepository: Repository<Expense>,
  ) {}

  async findAll(tenantId: string): Promise<Supplier[]> {
    return this.suppliersRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<Supplier> {
    const supplier = await this.suppliersRepository.findOne({
      where: { id, tenantId },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }
    return supplier;
  }

  async create(createSupplierDto: CreateSupplierDto, tenantId: string): Promise<Supplier> {
    const supplier = this.suppliersRepository.create({
      ...createSupplierDto,
      tenantId,
    });

    return this.suppliersRepository.save(supplier);
  }

  async update(id: string, updateSupplierDto: UpdateSupplierDto, tenantId: string): Promise<Supplier> {
    await this.suppliersRepository.update(
      { id, tenantId },
      updateSupplierDto,
    );
    return this.findOne(id, tenantId);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const supplier = await this.findOne(id, tenantId);
    
    // Bağlı gider var mı kontrol et
    const relatedExpenses = await this.expensesRepository.find({
      where: { supplierId: id, tenantId },
      take: 5, // İlk 5 gideri al
    });

    if (relatedExpenses.length > 0) {
      const expenseNumbers = relatedExpenses.map(e => e.expenseNumber).join(', ');
      throw new HttpException({
        message: 'Bu tedarikçi silinemez çünkü bağlı giderler var',
        relatedExpenses: relatedExpenses.map(e => ({
          id: e.id,
          expenseNumber: e.expenseNumber,
          description: e.description,
          amount: e.amount,
        })),
        count: relatedExpenses.length,
      }, HttpStatus.BAD_REQUEST);
    }

    await this.suppliersRepository.remove(supplier);
  }

  async updateBalance(id: string, amount: number, tenantId: string): Promise<Supplier> {
    const supplier = await this.findOne(id, tenantId);
    supplier.balance = Number(supplier.balance) + amount;
    return this.suppliersRepository.save(supplier);
  }
}
