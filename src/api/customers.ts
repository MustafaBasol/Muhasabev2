import apiClient from './client';

export enum CustomerType {
  B2B = 'b2b',
  B2C = 'b2c',
  INDIVIDUAL = 'individual',
}

export interface CustomerBillingAddress {
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string; // ISO 3166-1 alpha-2
  state?: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  siretNumber?: string;
  sirenNumber?: string;
  tvaNumber?: string;
  customerType?: CustomerType;
  billingAddress?: CustomerBillingAddress | null;
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
  siretNumber?: string;
  sirenNumber?: string;
  tvaNumber?: string;
  customerType?: CustomerType;
  billingAddress?: CustomerBillingAddress;
  company?: string;
}

export interface UpdateCustomerDto {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  siretNumber?: string;
  sirenNumber?: string;
  tvaNumber?: string;
  customerType?: CustomerType;
  billingAddress?: CustomerBillingAddress;
  company?: string;
}

/**
 * Tüm müşterileri listele (tenant-aware)
 */
export const getCustomers = async (): Promise<Customer[]> => {
  const response = await apiClient.get<Customer[]>('/customers');
  return response.data;
};

/**
 * Tek müşteri getir
 */
export const getCustomer = async (id: string): Promise<Customer> => {
  const response = await apiClient.get<Customer>(`/customers/${id}`);
  return response.data;
};

/**
 * Yeni müşteri oluştur
 */
export const createCustomer = async (data: CreateCustomerDto): Promise<Customer> => {
  const response = await apiClient.post<Customer>('/customers', data);
  return response.data;
};

/**
 * Müşteri güncelle
 */
export const updateCustomer = async (
  id: string,
  data: UpdateCustomerDto
): Promise<Customer> => {
  const response = await apiClient.patch<Customer>(`/customers/${id}`, data);
  return response.data;
};

/**
 * Müşteri sil
 */
export const deleteCustomer = async (id: string): Promise<void> => {
  await apiClient.delete(`/customers/${id}`);
};
