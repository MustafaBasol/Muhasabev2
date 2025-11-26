import apiClient from './client';

export type SaleStatus = 'created' | 'invoiced' | 'refunded' | 'completed' | 'pending' | 'cancelled';

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
  status?: SaleStatus;
}

export interface SaleRecord extends CreateSaleDto {
  id: string;
  saleNumber?: string;
  status?: SaleStatus;
  amount?: number;
  total?: number;
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'check';
  date?: string;
  productId?: string;
  productName?: string;
  productUnit?: string;
  quantity?: number;
  unitPrice?: number;
  createdAt?: string;
  updatedAt?: string;
}

export const getSales = async (): Promise<SaleRecord[]> => {
  const res = await apiClient.get<SaleRecord[]>('/sales');
  return res.data;
};

export const getSale = async (id: string): Promise<SaleRecord> => {
  const res = await apiClient.get<SaleRecord>(`/sales/${id}`);
  return res.data;
};

export const createSale = async (data: CreateSaleDto): Promise<SaleRecord> => {
  const res = await apiClient.post<SaleRecord>('/sales', data);
  return res.data;
};

export const updateSale = async (id: string, data: UpdateSaleDto): Promise<SaleRecord> => {
  const res = await apiClient.patch<SaleRecord>(`/sales/${id}`, data);
  return res.data;
};

export const deleteSale = async (id: string): Promise<void> => {
  await apiClient.delete(`/sales/${id}`);
};
