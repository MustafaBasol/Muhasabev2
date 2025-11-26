import { InvoiceStatus } from '../entities/invoice.entity';

export type NumericString = `${number}`;

export interface InvoiceLineItemInput extends Record<string, unknown> {
  productId?: string;
  productName?: string;
  description?: string;
  quantity?: number | NumericString;
  unitPrice?: number | NumericString;
  taxRate?: number | NumericString;
  discountAmount?: number | NumericString;
}

export interface InvoiceAuditMetadata {
  createdById?: string | null;
  createdByName?: string | null;
  updatedById?: string | null;
  updatedByName?: string | null;
}

export interface BaseInvoiceDto extends InvoiceAuditMetadata {
  invoiceNumber?: string;
  customerId?: string | null;
  issueDate?: string | Date;
  dueDate?: string | Date;
  subtotal?: number | NumericString;
  taxAmount?: number | NumericString;
  discountAmount?: number | NumericString;
  total?: number | NumericString;
  status?: InvoiceStatus;
  notes?: string | null;
  saleId?: string | null;
  type?: string;
  refundedInvoiceId?: string | null;
  lineItems?: InvoiceLineItemInput[];
  items?: InvoiceLineItemInput[];
}

export interface CreateInvoiceDto extends BaseInvoiceDto {
  issueDate: string | Date;
  dueDate: string | Date;
  lineItems?: InvoiceLineItemInput[];
}

export type UpdateInvoiceDto = BaseInvoiceDto & {
  isVoided?: boolean;
  voidReason?: string | null;
  voidedAt?: string | Date | null;
  voidedBy?: string | null;
};

export interface InvoiceStatistics {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  count: number;
}
