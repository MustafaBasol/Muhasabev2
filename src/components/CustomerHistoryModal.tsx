import { useMemo } from 'react';
import { X, FileText, Calendar } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';
import { normalizeStatusKey, resolveStatusLabel } from '../utils/status';
import type { Quote } from '../api/quotes';
import { logger } from '../utils/logger';
import { readLegacyTenantId, safeLocalStorage } from '../utils/localStorageSafe';

interface InvoiceLike {
  invoiceNumber?: string;
  issueDate?: string;
  total?: number;
  status?: unknown;
}

interface SaleLike {
  id?: string | number;
  saleNumber?: string;
  customerName?: string;
  customerEmail?: string;
  productName?: string;
  date?: string;
  saleDate?: string;
  createdAt?: string;
  amount?: number;
  status?: unknown;
}

interface CustomerSummary {
  name: string;
  email?: string;
}

interface CustomerHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerSummary | null;
  invoices: InvoiceLike[];
  sales?: SaleLike[];
  onViewInvoice?: (invoice: InvoiceLike) => void;
  onCreateInvoice?: (customer: CustomerSummary) => void;
  onViewSale?: (sale: SaleLike) => void;
  onViewQuote?: (quote: QuoteCacheEntry) => void;
}

type QuoteCacheEntry = Pick<Quote, 'id' | 'quoteNumber' | 'customerName' | 'issueDate' | 'total' | 'status' | 'version' | 'currency'> & {
  customerEmail?: string | null;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
};

const ensureString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const ensureNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const normalizeComparable = (value?: string | null): string => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const sanitizeQuoteEntry = (value: unknown, fallbackId: string): QuoteCacheEntry | null => {
  if (!isPlainObject(value)) return null;
  const id = ensureString(value.id).trim() || fallbackId;
  const quoteNumber = ensureString(value.quoteNumber).trim() || fallbackId;
  const customerName = ensureString(value.customerName).trim();
  const issueDate = ensureString(value.issueDate).slice(0, 10) || undefined;
  const total = ensureNumber(value.total);
  const version = typeof value.version === 'number' ? value.version : undefined;
  const status = ensureString(value.status).toLowerCase() as Quote['status'] | undefined;
  const currency = ensureString(value.currency) || undefined;
  const customerEmail = ensureString(value.customerEmail) || undefined;
  return {
    id,
    quoteNumber,
    customerName,
    issueDate,
    total,
    status,
    version,
    currency,
    customerEmail,
  };
};

const readCustomerQuotes = (customerName?: string, customerEmail?: string): QuoteCacheEntry[] => {
  try {
    const tid = readLegacyTenantId() || '';
    const key = tid ? `quotes_cache_${tid}` : 'quotes_cache';
    const raw = safeLocalStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalizedName = normalizeComparable(customerName);
    const normalizedEmail = normalizeComparable(customerEmail);
    return parsed
      .map((entry, index) => sanitizeQuoteEntry(entry, `quote-${index}`))
      .filter((quote): quote is QuoteCacheEntry => Boolean(quote))
      .filter((quote) => {
        const quoteName = normalizeComparable(quote.customerName);
        const quoteEmail = normalizeComparable(quote.customerEmail);
        const matchesName = normalizedName ? quoteName === normalizedName : false;
        const matchesEmail = normalizedEmail ? quoteEmail === normalizedEmail : false;
        return matchesName || matchesEmail;
      });
  } catch (error) {
    logger.warn('[CustomerHistoryModal] Failed to read quote cache', error);
    return [];
  }
};

export default function CustomerHistoryModal({ 
  isOpen, 
  onClose, 
  customer, 
  invoices,
  sales = [],
  onViewInvoice,
  onCreateInvoice,
  onViewSale,
  onViewQuote
}: CustomerHistoryModalProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation();
  const normalizedCustomerName = normalizeComparable(customer?.name);
  const normalizedCustomerEmail = normalizeComparable(customer?.email);
  const customerSales = useMemo(() => {
    if (!sales.length) return [];
    if (!normalizedCustomerName && !normalizedCustomerEmail) return [];
    return sales.filter(sale => {
      const saleName = normalizeComparable(sale.customerName);
      const saleEmail = normalizeComparable(sale.customerEmail);
      const matchesName = normalizedCustomerName ? saleName === normalizedCustomerName : false;
      const matchesEmail = normalizedCustomerEmail ? saleEmail === normalizedCustomerEmail : false;
      return matchesName || matchesEmail;
    });
  }, [sales, normalizedCustomerName, normalizedCustomerEmail]);
  const customerQuotes = useMemo(
    () => readCustomerQuotes(customer?.name, customer?.email),
    [customer?.name, customer?.email]
  );
  
  const statusLabels = useMemo(() => ({
    paid: `✅ ${resolveStatusLabel(t, 'paid')}`,
    sent: `📤 ${resolveStatusLabel(t, 'sent')}`,
    overdue: `⚠️ ${resolveStatusLabel(t, 'overdue')}`,
    draft: `📝 ${resolveStatusLabel(t, 'draft')}`
  }), [t]);
  
  if (!isOpen || !customer) return null;
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    const value = new Date(dateString);
    return Number.isNaN(value.getTime()) ? '—' : value.toLocaleDateString('tr-TR');
  };

  const formatAmount = (amount?: number | null) => {
    const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
    return formatCurrency(value);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {customer.name} - {t('customer.history')}
            </h2>
            <p className="text-sm text-gray-500">
              {invoices.length + customerSales.length} {t('customer.transactions')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
              {invoices.length === 0 && customerSales.length === 0 && customerQuotes.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('customer.noHistory')}
              </h3>
              <p className="text-gray-500 mb-6">
                {customer.name} {t('customer.noHistoryDesc')}
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  💡 <strong>{t('customer.tip')}</strong> {t('customer.tipDesc')}
                </p>
                <button
                  onClick={() => onCreateInvoice?.(customer)}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  {t('customer.createInvoice')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Teklifler */}
              {customerQuotes.map((q, index) => (
                <div key={`quote-${index}`} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <span className="text-purple-600 text-sm font-bold">Q</span>
                      </div>
                      <div>
                        <div className="font-medium text-purple-600">
                          <button
                            onClick={() => onViewQuote?.(q)}
                            className="text-purple-600 hover:text-purple-800 transition-colors cursor-pointer"
                            title={t('quotes.view') || 'Teklifi görüntüle'}
                          >
                            {q.quoteNumber}
                          </button>
                          {q.version && q.version > 1 ? <span className="ml-1 text-xs text-gray-500">v{q.version}</span> : null}
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(q.issueDate)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        {formatAmount(q.total)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(() => {
                          const key = normalizeStatusKey(String(q.status || ''));
                          return resolveStatusLabel(t, key);
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Satışlar */}
              {customerSales.map((sale, index) => (
                <div key={`sale-${index}`} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <span className="text-green-600 text-sm font-bold">S</span>
                      </div>
                      <div>
                        <div className="font-medium text-green-600">
                          <button
                            onClick={() => onViewSale?.(sale)}
                            className="text-green-600 hover:text-green-800 transition-colors cursor-pointer"
                            title={t('sales.view') || 'Satışı görüntüle'}
                          >
                            {sale.saleNumber || `SAL-${sale.id}`}
                          </button>
                        </div>
                        <p className="text-sm text-gray-600">{sale.productName}</p>
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(sale.date || sale.saleDate || sale.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">
                        +{formatAmount(sale.amount)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {(() => {
                          const key = normalizeStatusKey(String(sale.status || ''));
                          const map = {
                            completed: `✅ ${resolveStatusLabel(t, 'completed')}`,
                            pending: `⏳ ${resolveStatusLabel(t, 'pending')}`,
                            cancelled: `❌ ${resolveStatusLabel(t, 'cancelled')}`
                          } as const;
                          return key in map ? map[key as keyof typeof map] : resolveStatusLabel(t, key);
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Faturalar */}
              {invoices.map((invoice, index) => (
                <div key={`invoice-${index}`} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <button
                          onClick={() => onViewInvoice?.(invoice)}
                          className="font-medium text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                          title={t('common.view', { defaultValue: 'Görüntüle' }) as string}
                        >
                          {invoice.invoiceNumber || t('invoices.unnamed', { defaultValue: 'Fatura' })}
                        </button>
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(invoice.issueDate)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        {formatAmount(invoice.total)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {(() => {
                          const key = normalizeStatusKey(String(invoice.status || ''));
                          return statusLabels[key as keyof typeof statusLabels] || resolveStatusLabel(t, key);
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}