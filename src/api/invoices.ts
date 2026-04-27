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
  description?: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  discountAmount?: number;
  lineNet?: number;
  lineTax?: number;
  lineGross?: number;
  unit?: string;
  total: number;
}

/**
 * Backend 'lines' (invoice_lines tablosu) → frontend 'items' normalize eder.
 * Her iki field da her zaman dolu olur.
 */
function normalizeInvoice(raw: any): any {
  if (!raw) return raw;
  const backendLines: any[] = Array.isArray(raw.lines) ? raw.lines : [];
  const items: InvoiceLineItem[] = backendLines.map((l: any) => ({
    productId: l.productId ?? undefined,
    productName: l.productName ?? l.description ?? '',
    description: l.description ?? l.productName ?? '',
    quantity: Number(l.quantity) || 0,
    unitPrice: Number(l.unitPrice) || 0,
    taxRate: Number(l.taxRate) || 0,
    discountAmount: Number(l.discountAmount) || 0,
    lineNet: Number(l.lineNet) || 0,
    lineTax: Number(l.lineTax) || 0,
    lineGross: Number(l.lineGross) || 0,
    unit: l.unit ?? undefined,
    total: Number(l.lineGross) || Number(l.lineNet) || (Number(l.quantity) * Number(l.unitPrice)) || 0,
  }));
  return {
    ...raw,
    items: items.length ? items : (Array.isArray(raw.items) ? raw.items : []),
    lineItems: items.length ? items : (Array.isArray(raw.lineItems) ? raw.lineItems : []),
    lines: backendLines,
  };
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
  discountAmount?: number;
  notes?: string;
  status?: InvoiceStatus | string;
  // Opsiyonel: Satış ile ilişkilendirme (backend destekliyorsa)
  saleId?: string;
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
  return (response.data as any[]).map(normalizeInvoice);
};

/**
 * Tek fatura getir
 */
export const getInvoice = async (id: string): Promise<Invoice> => {
  const response = await apiClient.get<Invoice>(`/invoices/${id}`);
  return normalizeInvoice(response.data);
};

/**
 * Yeni fatura oluştur
 */
export const createInvoice = async (data: CreateInvoiceDto): Promise<Invoice> => {
  const response = await apiClient.post<Invoice>('/invoices', data);
  return normalizeInvoice(response.data);
};

/**
 * Fatura güncelle
 */
export const updateInvoice = async (
  id: string,
  data: UpdateInvoiceDto
): Promise<Invoice> => {
  const response = await apiClient.patch<Invoice>(`/invoices/${id}`, data);
  return normalizeInvoice(response.data);
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
