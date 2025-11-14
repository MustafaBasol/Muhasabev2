import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductCategory } from './entities/product-category.entity';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductCategoriesService {
  constructor(
    @InjectRepository(ProductCategory)
    private categoriesRepository: Repository<ProductCategory>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async findAll(tenantId: string, includeInactive = false): Promise<ProductCategory[]> {
    if (includeInactive) {
      return this.categoriesRepository.find({
        where: { tenantId },
        order: { isActive: 'DESC', name: 'ASC' as const },
      });
    }
    return this.categoriesRepository.find({
      where: { tenantId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<ProductCategory> {
    const category = await this.categoriesRepository.findOne({
      where: { id, tenantId },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async findByName(
    name: string,
    tenantId: string,
  ): Promise<ProductCategory | null> {
    // Hem aktif hem inaktif kayıtları bulabilmek için isActive filtresi uygulanmaz
    return this.categoriesRepository.findOne({
      where: {
        name: name.trim(),
        tenantId,
      },
    });
  }

  async create(
    createCategoryDto: CreateProductCategoryDto,
    tenantId: string,
  ): Promise<ProductCategory> {
    // Aynı isimde kategori var mı? (aktif/inaktif fark etmez)
    const existing = await this.findByName(createCategoryDto.name, tenantId);
    if (existing) {
      if (existing.isActive) {
        // Aktif ise tekrar oluşturulamaz
        throw new ConflictException(
          `Category "${createCategoryDto.name}" already exists`,
        );
      }
      // İnaktif ise re-activate et ve güncelle
      existing.isActive = true;
      if (typeof createCategoryDto.taxRate === 'number') {
        (existing as any).taxRate = createCategoryDto.taxRate;
      }
      if (typeof createCategoryDto.parentId === 'string') {
        (existing as any).parentId = createCategoryDto.parentId;
      }
      if (typeof createCategoryDto.isProtected === 'boolean') {
        (existing as any).isProtected = createCategoryDto.isProtected;
      }
      return this.categoriesRepository.save(existing);
    }

    const category = this.categoriesRepository.create({
      ...createCategoryDto,
      tenantId,
    });
    try {
      return await this.categoriesRepository.save(category);
    } catch (err: any) {
      const isUniqueViolation =
        err?.code === '23505' ||
        (typeof err?.message === 'string' && err.message.includes('UNIQUE constraint failed'));
      if (isUniqueViolation) {
        throw new ConflictException(
          `Category "${createCategoryDto.name}" already exists (including inactive). Please use a different name or reactivate the existing one.`,
        );
      }
      throw err;
    }
  }

  async update(
    id: string,
    updateCategoryDto: UpdateProductCategoryDto,
    tenantId: string,
  ): Promise<ProductCategory> {
    // Check if category exists
    const category = await this.findOne(id, tenantId);

    // Korumalı kategorilerin ismini değiştirmeyi engelle
    if (
      category.isProtected &&
      updateCategoryDto.name &&
      updateCategoryDto.name !== category.name
    ) {
      throw new BadRequestException(
        `Protected category "${category.name}" cannot be renamed`,
      );
    }

    // If name is being updated, check for duplicates among active categories
    if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      const dup = await this.categoriesRepository.findOne({
        where: { name: updateCategoryDto.name.trim(), tenantId, isActive: true },
      });
      if (dup) {
        throw new ConflictException(
          `Category "${updateCategoryDto.name}" already exists`,
        );
      }
    }

    try {
      await this.categoriesRepository.update({ id, tenantId }, updateCategoryDto);
    } catch (err: any) {
      const isUniqueViolation =
        err?.code === '23505' ||
        (typeof err?.message === 'string' && err.message.includes('UNIQUE constraint failed'));
      if (isUniqueViolation) {
        throw new ConflictException(
          `Category "${updateCategoryDto.name}" already exists (including inactive).`,
        );
      }
      throw err;
    }
    return this.findOne(id, tenantId);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const category = await this.findOne(id, tenantId);

    // Korumalı kategorileri silmeyi engelle
    if (category.isProtected) {
      throw new BadRequestException(
        `Protected category "${category.name}" cannot be deleted`,
      );
    }

    // Bu kategoride ürün var mı? (aktif ürünleri kontrol et)
    const productCount = await this.productsRepository.count({
      where: {
        tenantId,
        isActive: true,
        category: category.name,
      },
    });

    if (productCount > 0) {
      // 409: İş kuralı çatışması – arşivlemeyi engelle
      // Frontend i18n için kod + sayı döndürüyoruz
      throw new ConflictException({
        code: 'CATEGORY_HAS_PRODUCTS',
        count: productCount,
        message: `Category has ${productCount} products and cannot be archived`,
      });
    }

    // Soft delete by setting isActive to false
    await this.categoriesRepository.update(
      { id, tenantId },
      { isActive: false },
    );
  }
}
