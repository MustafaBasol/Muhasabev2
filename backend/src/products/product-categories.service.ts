import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductCategory } from './entities/product-category.entity';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';

@Injectable()
export class ProductCategoriesService {
  constructor(
    @InjectRepository(ProductCategory)
    private categoriesRepository: Repository<ProductCategory>,
  ) {}

  async findAll(tenantId: string): Promise<ProductCategory[]> {
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

  async findByName(name: string, tenantId: string): Promise<ProductCategory | null> {
    return this.categoriesRepository.findOne({
      where: { 
        name: name.trim(),
        tenantId,
        isActive: true 
      },
    });
  }

  async create(createCategoryDto: CreateProductCategoryDto, tenantId: string): Promise<ProductCategory> {
    // Check for duplicate name
    const existing = await this.findByName(createCategoryDto.name, tenantId);
    if (existing) {
      throw new ConflictException(`Category "${createCategoryDto.name}" already exists`);
    }

    const category = this.categoriesRepository.create({
      ...createCategoryDto,
      tenantId,
    });

    return this.categoriesRepository.save(category);
  }

  async update(id: string, updateCategoryDto: UpdateProductCategoryDto, tenantId: string): Promise<ProductCategory> {
    // Check if category exists
    const category = await this.findOne(id, tenantId);

    // Korumalı kategorilerin ismini değiştirmeyi engelle
    if (category.isProtected && updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      throw new BadRequestException(`Protected category "${category.name}" cannot be renamed`);
    }

    // If name is being updated, check for duplicates
    if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      const existing = await this.findByName(updateCategoryDto.name, tenantId);
      if (existing) {
        throw new ConflictException(`Category "${updateCategoryDto.name}" already exists`);
      }
    }

    await this.categoriesRepository.update(
      { id, tenantId },
      updateCategoryDto,
    );
    return this.findOne(id, tenantId);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const category = await this.findOne(id, tenantId);
    
    // Korumalı kategorileri silmeyi engelle
    if (category.isProtected) {
      throw new BadRequestException(`Protected category "${category.name}" cannot be deleted`);
    }
    
    // Soft delete by setting isActive to false
    await this.categoriesRepository.update(
      { id, tenantId },
      { isActive: false },
    );
  }
}
