import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async findAll(tenantId: string): Promise<Product[]> {
    return this.productsRepository.find({
      where: { tenantId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findLowStock(tenantId: string): Promise<Product[]> {
    return this.productsRepository
      .createQueryBuilder('product')
      .where('product.tenantId = :tenantId', { tenantId })
      .andWhere('product.stock <= product.minStock')
      .andWhere('product.isActive = true')
      .getMany();
  }

  async findOne(id: string, tenantId: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id, tenantId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async create(
    createProductDto: CreateProductDto,
    tenantId: string,
  ): Promise<Product> {
    console.log('📦 Backend: Yeni ürün oluşturuluyor:', {
      name: createProductDto.name,
      category: createProductDto.category,
      taxRate: createProductDto.taxRate,
      categoryTaxRateOverride: createProductDto.categoryTaxRateOverride,
      tenantId,
    });

    const product = this.productsRepository.create({
      ...createProductDto,
      tenantId,
    });

    let saved: Product;
    try {
      saved = await this.productsRepository.save(product);
    } catch (error) {
      if (this.isUniqueProductCodeError(error)) {
        throw new BadRequestException(
          'Bu ürün kodu zaten kullanılıyor. Lütfen farklı bir kod deneyin.',
        );
      }
      throw error;
    }

    console.log('✅ Backend: Ürün kaydedildi:', {
      id: saved.id,
      name: saved.name,
      taxRate: saved.taxRate,
      categoryTaxRateOverride: saved.categoryTaxRateOverride,
    });

    return saved;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    tenantId: string,
  ): Promise<Product> {
    console.log('✏️ Backend: Ürün güncelleniyor:', {
      id,
      taxRate: updateProductDto.taxRate,
      categoryTaxRateOverride: updateProductDto.categoryTaxRateOverride,
    });

    await this.productsRepository.update({ id, tenantId }, updateProductDto);

    const updated = await this.findOne(id, tenantId);

    console.log('✅ Backend: Ürün güncellendi:', {
      id: updated.id,
      name: updated.name,
      taxRate: updated.taxRate,
      categoryTaxRateOverride: updated.categoryTaxRateOverride,
    });

    return updated;
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const product = await this.findOne(id, tenantId);
    await this.productsRepository.remove(product);
  }

  async updateStock(
    id: string,
    quantity: number,
    tenantId: string,
  ): Promise<Product> {
    const product = await this.findOne(id, tenantId);
    product.stock = Number(product.stock) + quantity;
    return this.productsRepository.save(product);
  }

  private isUniqueProductCodeError(error: unknown): boolean {
    const { code, message } = this.parseDbError(error);
    if (code === '23505') {
      return true;
    }
    if (!message) {
      return false;
    }
    const normalized = message.toLowerCase();
    return (
      normalized.includes('unique constraint') ||
      normalized.includes('unique constraint failed') ||
      normalized.includes('duplicate key')
    );
  }

  private parseDbError(error: unknown) {
    const result: { code?: string; message?: string } = {};
    if (typeof error === 'object' && error !== null) {
      const record = error as Record<string, unknown>;
      if (typeof record.code === 'string') {
        result.code = record.code;
      } else if (typeof record.code === 'number') {
        result.code = String(record.code);
      }
      if (typeof record.message === 'string') {
        result.message = record.message;
      }
    }
    if (!result.message && error instanceof Error) {
      result.message = error.message;
    }
    return result;
  }
}
