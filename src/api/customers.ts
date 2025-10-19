import apiClient from './client';

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  company?: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerDto {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  company?: string;
}

export interface UpdateCustomerDto {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  company?: string;
}

/**
 * Tüm müşterileri listele (tenant-aware)
 */
export const getCustomers = async (): Promise<Customer[]> => {
  const response = await apiClient.get('/customers');
  return response.data;
};

/**
 * Tek müşteri getir
 */
export const getCustomer = async (id: string): Promise<Customer> => {
  const response = await apiClient.get(`/customers/${id}`);
  return response.data;
};

/**
 * Yeni müşteri oluştur
 */
export const createCustomer = async (data: CreateCustomerDto): Promise<Customer> => {
  const response = await apiClient.post('/customers', data);
  return response.data;
};

/**
 * Müşteri güncelle
 */
export const updateCustomer = async (
  id: string,
  data: UpdateCustomerDto
): Promise<Customer> => {
  const response = await apiClient.patch(`/customers/${id}`, data);
  return response.data;
};

/**
 * Müşteri sil
 */
export const deleteCustomer = async (id: string): Promise<void> => {
  await apiClient.delete(`/customers/${id}`);
};
