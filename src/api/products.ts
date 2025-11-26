import apiClient from './client';

export interface Product {
  id: string;
  name: string;
  code: string;
  description?: string;
  price: number;
  cost?: number;
  stock: number;
  minStock: number;
  unit: string;
  category?: string;
  barcode?: string;
  taxRate: number;
  categoryTaxRateOverride?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDto {
  name: string;
  code: string;
  description?: string;
  price: number;
  cost?: number;
  stock?: number;
  minStock?: number;
  unit?: string;
  category?: string;
  barcode?: string;
  taxRate?: number;
  categoryTaxRateOverride?: number;
}

export interface UpdateProductDto {
  name?: string;
  code?: string;
  description?: string;
  price?: number;
  cost?: number;
  stock?: number;
  minStock?: number;
  unit?: string;
  category?: string;
  barcode?: string;
  taxRate?: number;
  isActive?: boolean;
  categoryTaxRateOverride?: number;
}

/**
 * Tüm ürünleri listele (tenant-aware)
 */
export const getProducts = async (): Promise<Product[]> => {
  const response = await apiClient.get<Product[]>('/products');
  return response.data;
};

/**
 * Düşük stoklu ürünleri getir
 */
export const getLowStockProducts = async (): Promise<Product[]> => {
  const response = await apiClient.get<Product[]>('/products/low-stock');
  return response.data;
};

/**
 * Tek ürün getir
 */
export const getProduct = async (id: string): Promise<Product> => {
  const response = await apiClient.get<Product>(`/products/${id}`);
  return response.data;
};

/**
 * Yeni ürün oluştur
 */
export const createProduct = async (data: CreateProductDto): Promise<Product> => {
  const response = await apiClient.post<Product>('/products', data);
  return response.data;
};

/**
 * Ürün güncelle
 */
export const updateProduct = async (
  id: string,
  data: UpdateProductDto
): Promise<Product> => {
  const response = await apiClient.patch<Product>(`/products/${id}`, data);
  return response.data;
};

/**
 * Ürün sil
 */
export const deleteProduct = async (id: string): Promise<void> => {
  await apiClient.delete(`/products/${id}`);
};
