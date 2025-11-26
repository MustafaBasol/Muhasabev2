import apiClient from './client';

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export interface InvoiceLineItem {
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer?: {
    id: string;
    name: string;
    email: string;
  };
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  type?: 'product' | 'service';
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Opsiyonel: Satış ile ilişkilendirme
  saleId?: string;
}

export interface CreateInvoiceDto {
  customerId: string;
  issueDate: string;
  dueDate: string;
  type?: 'product' | 'service';
  lineItems: InvoiceLineItem[];
  taxAmount: number;
  notes?: string;
}

export interface UpdateInvoiceDto {
  customerId?: string;
  issueDate?: string;
  dueDate?: string;
  status?: InvoiceStatus;
  type?: 'product' | 'service';
  lineItems?: InvoiceLineItem[];
  taxAmount?: number;
  notes?: string;
  // Backend güncellemesinde destekleniyor: satış ile ilişkilendirme
  saleId?: string;
}

/**
 * Tüm faturaları listele
 */
export const getInvoices = async (): Promise<Invoice[]> => {
  const response = await apiClient.get<Invoice[]>('/invoices');
  return response.data;
};

/**
 * Tek fatura getir
 */
export const getInvoice = async (id: string): Promise<Invoice> => {
  const response = await apiClient.get<Invoice>(`/invoices/${id}`);
  return response.data;
};

/**
 * Yeni fatura oluştur
 */
export const createInvoice = async (data: CreateInvoiceDto): Promise<Invoice> => {
  const response = await apiClient.post<Invoice>('/invoices', data);
  return response.data;
};

/**
 * Fatura güncelle
 */
export const updateInvoice = async (
  id: string,
  data: UpdateInvoiceDto
): Promise<Invoice> => {
  const response = await apiClient.patch<Invoice>(`/invoices/${id}`, data);
  return response.data;
};

/**
 * Fatura durumu güncelle
 */
export const updateInvoiceStatus = async (
  id: string,
  status: InvoiceStatus
): Promise<Invoice> => {
  const response = await apiClient.patch<Invoice>(`/invoices/${id}/status`, { status });
  return response.data;
};

/**
 * Fatura sil
 */
export const deleteInvoice = async (id: string): Promise<void> => {
  await apiClient.delete(`/invoices/${id}`);
};

/**
 * Fatura iptal et (void)
 */
export const voidInvoice = async (id: string, reason: string): Promise<Invoice> => {
  const response = await apiClient.patch<Invoice>(`/invoices/${id}/void`, { reason });
  return response.data;
};

/**
 * Fatura geri yükle (restore)
 */
export const restoreInvoice = async (id: string): Promise<Invoice> => {
  const response = await apiClient.patch<Invoice>(`/invoices/${id}/restore`);
  return response.data;
};
