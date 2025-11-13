import apiClient from './client';

export interface SaleItemDto {
  productId?: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number; // % cinsinden (örn: 18)
}

export interface CreateSaleDto {
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  saleDate: string; // YYYY-MM-DD
  items: SaleItemDto[];
  discountAmount?: number;
  notes?: string;
  sourceQuoteId?: string;
  invoiceId?: string;
}

export interface UpdateSaleDto extends Partial<CreateSaleDto> {
  status?: 'created' | 'invoiced' | 'refunded';
}

export const getSales = async (): Promise<any[]> => {
  const res = await apiClient.get('/sales');
  return res.data;
};

export const getSale = async (id: string): Promise<any> => {
  const res = await apiClient.get(`/sales/${id}`);
  return res.data;
};

export const createSale = async (data: CreateSaleDto): Promise<any> => {
  const res = await apiClient.post('/sales', data);
  return res.data;
};

export const updateSale = async (id: string, data: UpdateSaleDto): Promise<any> => {
  const res = await apiClient.patch(`/sales/${id}`, data);
  return res.data;
};

export const deleteSale = async (id: string): Promise<void> => {
  await apiClient.delete(`/sales/${id}`);
};
