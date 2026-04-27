import type { TFunction } from 'i18next';
import { EInvoiceStatus } from '../api/integrations';

type EInvoiceLike = {
  providerInvoiceId?: string | null;
  eInvoiceStatus?: string | null;
};

const SENT_STATUSES = new Set<string>([
  EInvoiceStatus.SUBMITTED,
  EInvoiceStatus.SENT,
  EInvoiceStatus.APPROVED,
  EInvoiceStatus.ACCEPTED,
  EInvoiceStatus.REJECTED,
  EInvoiceStatus.REFUSED,
  EInvoiceStatus.IN_DISPUTE,
  EInvoiceStatus.COLLECTED,
  EInvoiceStatus.PARTIALLY_COLLECTED,
]);

export const hasInvoiceBeenSentToEInvoice = (invoice?: EInvoiceLike | null): boolean => {
  if (!invoice) {
    return false;
  }

  const normalizedStatus = String(invoice.eInvoiceStatus || '').trim().toLowerCase();
  return Boolean(invoice.providerInvoiceId) || SENT_STATUSES.has(normalizedStatus);
};

export const getEInvoiceSubmissionErrorContent = (
  t: TFunction,
  error: unknown,
): { title: string; message: string } => {
  const statusCode = (error as any)?.response?.status;
  const rawMessage = String(
    (error as any)?.response?.data?.error ||
      (error as any)?.response?.data?.message ||
      (error as any)?.message ||
      '',
  ).trim();
  const normalizedMessage = rawMessage.toLowerCase();

  if (statusCode === 422 && normalizedMessage.includes('already finalized')) {
    return {
      title: t('invoice.eInvoiceAlreadySentTitle'),
      message: t('invoice.eInvoiceAlreadySentMessage'),
    };
  }

  return {
    title: t('invoice.eInvoiceSendFailedTitle'),
    message: t('invoice.eInvoiceSendFailedMessage'),
  };
};