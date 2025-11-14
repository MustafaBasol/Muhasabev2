// Product Categories API
import apiClient from './client';
import type { ProductCategory } from '../types';

export interface CreateProductCategoryDto {
  name: string;
  taxRate: number;
  parentId?: string;
  isProtected?: boolean;
}

export interface UpdateProductCategoryDto {
  name?: string;
  taxRate?: number;
  isActive?: boolean;
}

export const productCategoriesApi = {
  getAll: async (params?: { includeInactive?: boolean }): Promise<ProductCategory[]> => {
    const query = params?.includeInactive ? '?includeInactive=true' : '';
    const response = await apiClient.get(`/product-categories${query}`);
    return response.data;
  },

  getOne: async (id: string): Promise<ProductCategory> => {
    const response = await apiClient.get(`/product-categories/${id}`);
    return response.data;
  },

  create: async (data: CreateProductCategoryDto): Promise<ProductCategory> => {
    const response = await apiClient.post('/product-categories', data);
    return response.data;
  },

  update: async (id: string, data: UpdateProductCategoryDto): Promise<ProductCategory> => {
    const response = await apiClient.patch(`/product-categories/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/product-categories/${id}`);
  },
};
