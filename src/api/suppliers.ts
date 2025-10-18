import apiClient from './client';

export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierDto {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
}

export interface UpdateSupplierDto {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
}

/**
 * Tüm tedarikçileri listele
 */
export const getSuppliers = async (): Promise<Supplier[]> => {
  const response = await apiClient.get('/suppliers');
  return response.data;
};

/**
 * Tek tedarikçi getir
 */
export const getSupplier = async (id: string): Promise<Supplier> => {
  const response = await apiClient.get(`/suppliers/${id}`);
  return response.data;
};

/**
 * Yeni tedarikçi oluştur
 */
export const createSupplier = async (data: CreateSupplierDto): Promise<Supplier> => {
  const response = await apiClient.post('/suppliers', data);
  return response.data;
};

/**
 * Tedarikçi güncelle
 */
export const updateSupplier = async (
  id: string,
  data: UpdateSupplierDto
): Promise<Supplier> => {
  const response = await apiClient.patch(`/suppliers/${id}`, data);
  return response.data;
};

/**
 * Tedarikçi sil
 */
export const deleteSupplier = async (id: string): Promise<void> => {
  await apiClient.delete(`/suppliers/${id}`);
};
