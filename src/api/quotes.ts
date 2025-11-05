import apiClient from './client';

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

export interface QuoteItemDto {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  productId?: string;
  unit?: string;
}

export interface CreateQuoteDto {
  quoteNumber?: string;
  customerId?: string;
  customerName?: string;
  issueDate: string; // YYYY-MM-DD
  validUntil?: string; // YYYY-MM-DD
  currency: 'TRY' | 'USD' | 'EUR' | 'GBP';
  total: number;
  status?: QuoteStatus;
  items?: QuoteItemDto[];
  scopeOfWorkHtml?: string;
}

export interface UpdateQuoteDto extends Partial<CreateQuoteDto> {
  status?: QuoteStatus;
  version?: number;
  revisions?: any[];
}

export const getQuotes = async (): Promise<any[]> => {
  const res = await apiClient.get('/quotes');
  return res.data;
};

export const getQuote = async (id: string): Promise<any> => {
  const res = await apiClient.get(`/quotes/${id}`);
  return res.data;
};

export const createQuote = async (data: CreateQuoteDto): Promise<any> => {
  const res = await apiClient.post('/quotes', data);
  return res.data;
};

export const updateQuote = async (id: string, data: UpdateQuoteDto): Promise<any> => {
  const res = await apiClient.patch(`/quotes/${id}`, data);
  return res.data;
};

export const deleteQuote = async (id: string): Promise<void> => {
  await apiClient.delete(`/quotes/${id}`);
};

// Public endpoints via publicId
export const getPublicQuote = async (publicId: string): Promise<any> => {
  const res = await apiClient.get(`/public/quotes/${publicId}`);
  return res.data;
};

export const markViewedPublic = async (publicId: string): Promise<any> => {
  const res = await apiClient.post(`/public/quotes/${publicId}/viewed`, {});
  return res.data;
};

export const acceptPublic = async (publicId: string): Promise<any> => {
  const res = await apiClient.post(`/public/quotes/${publicId}/accept`, {});
  return res.data;
};

export const declinePublic = async (publicId: string): Promise<any> => {
  const res = await apiClient.post(`/public/quotes/${publicId}/decline`, {});
  return res.data;
};
