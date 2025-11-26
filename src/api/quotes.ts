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
  revisions?: QuoteRevision[];
}

export interface QuoteRevision {
  version: number;
  issueDate: string;
  validUntil?: string;
  status: QuoteStatus;
  total: number;
  items?: QuoteItemDto[];
  snapshotAt: string;
}

export interface Quote extends CreateQuoteDto {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  publicId?: string;
  version?: number;
  revisions?: QuoteRevision[];
  createdAt?: string;
  updatedAt?: string;
  items?: QuoteItemDto[];
}

export interface TenantPublicProfile {
  name?: string;
  address?: string;
  country?: string;
  logoDataUrl?: string;
  iban?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxNumber?: string;
  taxOffice?: string;
  mersisNumber?: string;
  kepAddress?: string;
  siretNumber?: string;
  sirenNumber?: string;
  apeCode?: string;
  tvaNumber?: string;
  rcsNumber?: string;
  steuernummer?: string;
  umsatzsteuerID?: string;
  handelsregisternummer?: string;
  geschaeftsfuehrer?: string;
  einNumber?: string;
  taxId?: string;
  businessLicenseNumber?: string;
  stateOfIncorporation?: string;
  registrationNumber?: string;
  vatNumberGeneric?: string;
  taxIdGeneric?: string;
  stateOrRegion?: string;
}

export interface QuotePublic extends Quote {
  tenantPublicProfile?: TenantPublicProfile;
}

export const getQuotes = async (): Promise<Quote[]> => {
  const res = await apiClient.get<Quote[]>('/quotes');
  return res.data;
};

export const getQuote = async (id: string): Promise<Quote> => {
  const res = await apiClient.get<Quote>(`/quotes/${id}`);
  return res.data;
};

export const createQuote = async (data: CreateQuoteDto): Promise<Quote> => {
  const res = await apiClient.post<Quote>('/quotes', data);
  return res.data;
};

export const updateQuote = async (id: string, data: UpdateQuoteDto): Promise<Quote> => {
  const res = await apiClient.patch<Quote>(`/quotes/${id}`, data);
  return res.data;
};

export const deleteQuote = async (id: string): Promise<void> => {
  await apiClient.delete(`/quotes/${id}`);
};

// Public endpoints via publicId
export const getPublicQuote = async (publicId: string): Promise<QuotePublic> => {
  const res = await apiClient.get<QuotePublic>(`/public/quotes/${publicId}`);
  return res.data;
};

export const markViewedPublic = async (publicId: string): Promise<QuotePublic> => {
  const res = await apiClient.post<QuotePublic>(`/public/quotes/${publicId}/viewed`, {});
  return res.data;
};

export const acceptPublic = async (publicId: string): Promise<QuotePublic> => {
  const res = await apiClient.post<QuotePublic>(`/public/quotes/${publicId}/accept`, {});
  return res.data;
};

export const declinePublic = async (publicId: string): Promise<QuotePublic> => {
  const res = await apiClient.post<QuotePublic>(`/public/quotes/${publicId}/decline`, {});
  return res.data;
};
