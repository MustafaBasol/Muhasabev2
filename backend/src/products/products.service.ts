import { Injectable, NotFoundException } from '@nestjs/common';
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

  async create(createProductDto: CreateProductDto, tenantId: string): Promise<Product> {
    console.log('📦 Backend: Yeni ürün oluşturuluyor:', {
      name: createProductDto.name,
      category: createProductDto.category,
      taxRate: createProductDto.taxRate,
      categoryTaxRateOverride: createProductDto.categoryTaxRateOverride,
      tenantId
    });

    const product = this.productsRepository.create({
      ...createProductDto,
      tenantId,
    });

    const saved = await this.productsRepository.save(product);
    
    console.log('✅ Backend: Ürün kaydedildi:', {
      id: saved.id,
      name: saved.name,
      taxRate: saved.taxRate,
      categoryTaxRateOverride: saved.categoryTaxRateOverride
    });

    return saved;
  }

  async update(id: string, updateProductDto: UpdateProductDto, tenantId: string): Promise<Product> {
    console.log('✏️ Backend: Ürün güncelleniyor:', {
      id,
      taxRate: updateProductDto.taxRate,
      categoryTaxRateOverride: updateProductDto.categoryTaxRateOverride
    });

    await this.productsRepository.update(
      { id, tenantId },
      updateProductDto,
    );
    
    const updated = await this.findOne(id, tenantId);
    
    console.log('✅ Backend: Ürün güncellendi:', {
      id: updated.id,
      name: updated.name,
      taxRate: updated.taxRate,
      categoryTaxRateOverride: updated.categoryTaxRateOverride
    });
    
    return updated;
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const product = await this.findOne(id, tenantId);
    await this.productsRepository.remove(product);
  }

  async updateStock(id: string, quantity: number, tenantId: string): Promise<Product> {
    const product = await this.findOne(id, tenantId);
    product.stock = Number(product.stock) + quantity;
    return this.productsRepository.save(product);
  }
}
