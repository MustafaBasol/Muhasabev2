import React, { useMemo } from 'react';
import { X, Edit, Calendar, User, BadgeDollarSign, Send, Check, XCircle, FileDown, RefreshCw, Lock, Link as LinkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../contexts/CurrencyContext';
import { sanitizeRteHtml } from '../utils/security';
import ConfirmModal from './ConfirmModal';
import { logger } from '../utils/logger';
import { safeLocalStorage } from '../utils/localStorageSafe';
import type {
  Quote as QuoteApiModel,
  QuoteStatus as QuoteApiStatus,
  QuoteItemDto,
  QuoteRevision,
} from '../api/quotes';

export type QuoteStatus = QuoteApiStatus;

type QuoteMetadata = {
  createdByName?: string;
  updatedByName?: string;
};

export type Quote = QuoteApiModel & QuoteMetadata;

type QuoteLegacyItem = Partial<QuoteItemDto> & {
  id?: string;
  name?: string;
  productName?: string;
  qty?: number;
  price?: number;
  unit_price?: number;
};

interface NormalizedQuoteItem {
  key: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

const normalizeQuoteItem = (raw: QuoteItemDto | QuoteLegacyItem): NormalizedQuoteItem => {
  const description = raw.description ?? raw.name ?? raw.productName ?? '';
  const quantity = Number(raw.quantity ?? raw.qty ?? 0);
  const unitPrice = Number(raw.unitPrice ?? raw.price ?? raw.unit_price ?? 0);
  const total = Number(
    raw.total ?? (Number.isFinite(quantity) && Number.isFinite(unitPrice) ? quantity * unitPrice : 0)
  );
  const keySource = raw.id ?? `${description}-${unitPrice}-${total}`;
  return {
    key: String(keySource),
    description,
    quantity,
    unitPrice,
    total,
  };
};

interface QuoteViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: Quote | null;
  onEdit?: (quote: Quote) => void;
  onChangeStatus?: (quote: Quote, status: QuoteStatus) => void;
  onRevise?: (quote: Quote) => void;
}

const QuoteViewModal: React.FC<QuoteViewModalProps> = ({ isOpen, onClose, quote, onEdit, onChangeStatus, onRevise }) => {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useCurrency();
  const [confirmAccept, setConfirmAccept] = React.useState(false);

  // Yalnızca işaretlenen alanlar için dil yardımcıları ve etiketler
  const getActiveLang = () => {
    const storedLang = safeLocalStorage.getItem('i18nextLng');
    if (storedLang && storedLang.length >= 2) {
      return storedLang.slice(0, 2).toLowerCase();
    }
    const cand = (i18n.resolvedLanguage || i18n.language || 'en') as string;
    return cand.slice(0,2).toLowerCase();
  };
  const toLocale = (l: string) => (l === 'tr' ? 'tr-TR' : l === 'de' ? 'de-DE' : l === 'fr' ? 'fr-FR' : 'en-US');
  const lang = getActiveLang();

  const L = {
    createdBy: { tr:'Oluşturan', en:'Created by', fr:'Créé par', de:'Erstellt von' }[lang as 'tr'|'en'|'fr'|'de'] || 'Created by',
    createdAt: { tr:'Oluşturulma', en:'Created at', fr:'Créé le', de:'Erstellt am' }[lang as 'tr'|'en'|'fr'|'de'] || 'Created at',
    updatedBy: { tr:'Son güncelleyen', en:'Last updated by', fr:'Dernière mise à jour par', de:'Zuletzt aktualisiert von' }[lang as 'tr'|'en'|'fr'|'de'] || 'Last updated by',
    updatedAt: { tr:'Son güncelleme', en:'Last updated', fr:'Dernière mise à jour', de:'Zuletzt aktualisiert' }[lang as 'tr'|'en'|'fr'|'de'] || 'Last updated',
    status: {
      draft: { tr:'Taslak', en:'Draft', fr:'Brouillon', de:'Entwurf' }[lang as 'tr'|'en'|'fr'|'de'] || 'Draft',
      sent: { tr:'Gönderildi', en:'Sent', fr:'Envoyé', de:'Gesendet' }[lang as 'tr'|'en'|'fr'|'de'] || 'Sent',
      viewed: { tr:'Görüntülendi', en:'Viewed', fr:'Consulté', de:'Gesehen' }[lang as 'tr'|'en'|'fr'|'de'] || 'Viewed',
      accepted: { tr:'Kabul Edildi', en:'Accepted', fr:'Accepté', de:'Angenommen' }[lang as 'tr'|'en'|'fr'|'de'] || 'Accepted',
      declined: { tr:'Reddedildi', en:'Declined', fr:'Refusé', de:'Abgelehnt' }[lang as 'tr'|'en'|'fr'|'de'] || 'Declined',
      expired: { tr:'Süresi Doldu', en:'Expired', fr:'Expiré', de:'Abgelaufen' }[lang as 'tr'|'en'|'fr'|'de'] || 'Expired',
    }
  } as const;

  const statusMap = {
    draft: { label: t('quotes.statusLabels.draft', { defaultValue: L.status.draft }), className: 'bg-gray-100 text-gray-800' },
    sent: { label: t('quotes.statusLabels.sent', { defaultValue: L.status.sent }), className: 'bg-blue-100 text-blue-800' },
    viewed: { label: t('quotes.statusLabels.viewed', { defaultValue: L.status.viewed }), className: 'bg-indigo-100 text-indigo-800' },
    accepted: { label: t('quotes.statusLabels.accepted', { defaultValue: L.status.accepted }), className: 'bg-green-100 text-green-800' },
    declined: { label: t('quotes.statusLabels.declined', { defaultValue: L.status.declined }), className: 'bg-red-100 text-red-800' },
    expired: { label: t('quotes.statusLabels.expired', { defaultValue: L.status.expired }), className: 'bg-yellow-100 text-yellow-800' },
  } as const;

  // Hooks must not be called conditionally across renders.
  // Compute daysLeft unconditionally and guard inside the memo.
  const daysLeft = useMemo(() => {
    if (!quote?.validUntil) return null;
    const end = new Date(quote.validUntil).getTime();
    const start = new Date().setHours(0,0,0,0);
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return diff;
  }, [quote?.validUntil]);

  // Not: Artık modal açılınca otomatik 'viewed' yapılmaz. 'viewed' yalnızca public sayfada tetiklenir.

  if (!isOpen || !quote) return null;

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString(toLocale(lang));

  // Revizyon tablosu için durum etiketi (yalnızca işaretlenen alan)
  const getStatusLabel = (status: string) => {
    const key = String(status) as keyof typeof L.status;
    const defaults = L.status;
    switch (key) {
      case 'draft': return t('quotes.statusLabels.draft', { defaultValue: defaults.draft });
      case 'sent': return t('quotes.statusLabels.sent', { defaultValue: defaults.sent });
      case 'viewed': return t('quotes.statusLabels.viewed', { defaultValue: defaults.viewed });
      case 'accepted': return t('quotes.statusLabels.accepted', { defaultValue: defaults.accepted });
      case 'declined': return t('quotes.statusLabels.declined', { defaultValue: defaults.declined });
      case 'expired': return t('quotes.statusLabels.expired', { defaultValue: defaults.expired });
      default: return status;
    }
  };
  const todayISO = new Date().toISOString().slice(0,10);
  const isTerminal = quote.status === 'accepted' || quote.status === 'declined' || quote.status === 'expired';
  const isLocked = quote.status === 'accepted';
  const isExpiredByDate = quote.validUntil ? (quote.validUntil < todayISO) : false;
  const showExpired = !isTerminal && isExpiredByDate;

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {quote.quoteNumber}
              {quote.version && quote.version > 1 && (
                <span className="ml-2 text-sm text-gray-500">{t('quotes.version', { n: quote.version })}</span>
              )}
            </h2>
            <p className="text-sm text-gray-500">{t('quotes.viewModal.details')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusMap[quote.status].className}`}>{statusMap[quote.status].label}</span>
            {isLocked && (
              <span className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700" title={t('quotes.lockedHint') || 'Kabul edildi. Bu teklif kilitli.'}>
                <Lock className="w-3 h-3" />
                {t('quotes.locked', { defaultValue: 'Kilitli' })}
              </span>
            )}
            {showExpired && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                {t('quotes.statusLabels.expired')}
              </span>
            )}
            {onRevise && isTerminal && quote.status !== 'accepted' && (
              <button
                onClick={() => { onClose(); setTimeout(() => onRevise(quote), 100); }}
                className="inline-flex items-center gap-1 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                title={t('quotes.actions.revise')}
              >
                <RefreshCw className="w-4 h-4" />
                <span className="text-xs font-medium">{t('quotes.actions.revise')}</span>
              </button>
            )}
            {/* Duruma bağlı hızlı aksiyonlar */}
            {onChangeStatus && (quote.status === 'draft') && (
              <button
                onClick={() => onChangeStatus(quote, 'sent')}
                className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                title={t('quotes.actions.send')}
              >
                <Send className="w-4 h-4" />
                <span className="text-xs font-medium">{t('quotes.actions.send')}</span>
              </button>
            )}
            {onChangeStatus && (quote.status === 'sent' || quote.status === 'viewed') && (
              <>
                <button
                  onClick={() => setConfirmAccept(true)}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  title={t('quotes.actions.accept')}
                >
                  <Check className="w-4 h-4" />
                  <span className="text-xs font-medium">{t('quotes.actions.accept')}</span>
                </button>
                <button
                  onClick={() => onChangeStatus(quote, 'declined')}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  title={t('quotes.actions.decline')}
                >
                  <XCircle className="w-4 h-4" />
                  <span className="text-xs font-medium">{t('quotes.actions.decline')}</span>
                </button>
              </>
            )}
            {onEdit && !isLocked && (
              <button
                onClick={() => { onClose(); setTimeout(() => onEdit(quote), 100); }}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Oluşturan / Güncelleyen Bilgisi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-xs text-gray-600">
              <div>
                <span className="text-gray-500">{L.createdBy}:</span>{' '}
                <span className="font-medium">{quote.createdByName || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">{L.createdAt}:</span>{' '}
                <span className="font-medium">{quote.createdAt ? new Date(quote.createdAt).toLocaleString(toLocale(lang)) : '—'}</span>
              </div>
            </div>
            <div className="text-xs text-gray-600">
              <div>
                <span className="text-gray-500">{L.updatedBy}:</span>{' '}
                <span className="font-medium">{quote.updatedByName || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">{L.updatedAt}:</span>{' '}
                <span className="font-medium">{quote.updatedAt ? new Date(quote.updatedAt).toLocaleString(toLocale(lang)) : '—'}</span>
              </div>
            </div>
          </div>

          {/* Kilit bilgisi */}
          {isLocked && (
            <div className="rounded-md border border-gray-200 bg-gray-50 text-gray-800 px-3 py-2 text-sm">
              🔒 {t('quotes.lockedBanner', { defaultValue: 'Bu teklif kabul edildi ve kilitlidir. Düzenleme veya silme yapılamaz.' })}
            </div>
          )}

          {/* Kalemler */}
          {Array.isArray(quote.items) && quote.items.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('invoices.productsAndServices')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">{t('invoices.description')}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">{t('invoices.quantity')}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">{t('invoices.unitPriceExclVAT')}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">{t('invoices.totalInclVAT')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(quote.items ?? []).map((raw) => {
                      const item = normalizeQuoteItem(raw);
                      return (
                        <tr key={item.key}>
                          <td className="px-3 py-2 text-sm text-gray-800">{item.description}</td>
                          <td className="px-3 py-2 text-sm text-right text-gray-700">{item.quantity}</td>
                          <td className="px-3 py-2 text-sm text-right text-gray-700">{formatCurrency(item.unitPrice, quote.currency)}</td>
                          <td className="px-3 py-2 text-sm text-right font-medium text-gray-900">{formatCurrency(item.total, quote.currency)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center text-sm text-gray-700">
                <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                <span className="mr-2 text-gray-500">{t('quotes.table.date')}:</span>
                <span className="font-medium">{formatDate(quote.issueDate)}</span>
              </div>
              {quote.validUntil && (
                <div className="flex items-center text-sm text-gray-700">
                  <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                  <span className="mr-2 text-gray-500">{t('quotes.validUntil')}:</span>
                  <span className="font-medium">{formatDate(quote.validUntil)}</span>
                  {typeof daysLeft === 'number' && daysLeft >= 0 && !showExpired && (
                    <span className="ml-2 text-xs text-gray-500">{t('quotes.expiresIn', { days: daysLeft })}</span>
                  )}
                  {showExpired && (
                    <span className="ml-2 text-xs text-red-600">{t('quotes.expiredOn', { date: formatDate(quote.validUntil) })}</span>
                  )}
                </div>
              )}
              <div className="flex items-center text-sm text-gray-700">
                <User className="w-4 h-4 mr-2 text-gray-400" />
                <span className="mr-2 text-gray-500">{t('quotes.table.customer')}:</span>
                <span className="font-medium">{quote.customerName}</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center text-sm text-gray-700">
                <BadgeDollarSign className="w-4 h-4 mr-2 text-gray-400" />
                <span className="mr-2 text-gray-500">{t('quotes.table.amount')}:</span>
                <span className="font-semibold text-gray-900">{formatCurrency(quote.total, quote.currency)}</span>
              </div>
              <div className="flex items-center text-sm text-gray-700">
                <span className="mr-2 text-gray-500">{t('quotes.createModal.currency')}:</span>
                <span className="font-medium">{quote.currency}</span>
              </div>
            </div>
          </div>

          {/* Revizyon Geçmişi */}
          {Array.isArray(quote.revisions) && quote.revisions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('quotes.revisionHistory', { defaultValue: 'Revizyon Geçmişi' })}</h3>
              <div className="overflow-x-auto">
                <table className="w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700" style={{width:'15%'}}>v</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700" style={{width:'25%'}}>{t('quotes.table.date')}</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700" style={{width:'25%'}}>{t('quotes.validUntil')}</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700" style={{width:'20%'}}>{t('quotes.table.status')}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700" style={{width:'15%'}}>{t('quotes.table.amount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {quote.revisions.map((rev: QuoteRevision, idx: number) => (
                      <tr key={`rev-${idx}`}>
                        <td className="px-3 py-2 text-sm text-gray-800">v{rev.version}</td>
                        <td className="px-3 py-2 text-sm text-gray-700">{formatDate(rev.issueDate)}</td>
                        <td className="px-3 py-2 text-sm text-gray-700">{rev.validUntil ? formatDate(rev.validUntil) : '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-700">{getStatusLabel(rev.status)}</td>
                        <td className="px-3 py-2 text-sm text-right font-medium text-gray-900">{formatCurrency(Number(rev.total || 0), quote.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* İşin Kapsamı */}
          {(quote.scopeOfWorkHtml && String(quote.scopeOfWorkHtml).trim().length > 0) && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('quotes.scopeOfWork.title', { defaultValue: 'İşin Kapsamı' })}</h3>
              <div className="prose max-w-none prose-sm text-gray-800 border border-gray-200 rounded-lg p-4 bg-white"
                   dangerouslySetInnerHTML={{ __html: sanitizeRteHtml(String(quote.scopeOfWorkHtml || '')) }} />
            </div>
          )}

          {/* İkincil aksiyonlar: Sadece PDF indir ve gerekirse e-posta (link kopyalama kaldırıldı) */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
            <button
              onClick={async () => {
                const { generateQuotePDF } = await import('../utils/pdfGenerator');
                await generateQuotePDF({
                  id: quote.id,
                  quoteNumber: quote.quoteNumber,
                  customerName: quote.customerName,
                  customerId: quote.customerId,
                  issueDate: quote.issueDate,
                  validUntil: quote.validUntil,
                  status: quote.status,
                  currency: quote.currency,
                  total: quote.total,
                  items: (quote.items || []).map((it) => ({
                    description: it.description,
                    quantity: it.quantity,
                    unitPrice: it.unitPrice,
                    total: it.total,
                  })),
                  scopeOfWorkHtml: quote.scopeOfWorkHtml || ''
                }, { filename: quote.quoteNumber });
              }}
              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200"
              title={t('quotes.actions.downloadPdf')}
            >
              <FileDown className="w-4 h-4" />
              <span className="text-sm font-medium">{t('quotes.actions.downloadPdf')}</span>
            </button>

            {/* Public paylaşım linkini kopyalama */}
            {quote.publicId && (
              <button
                onClick={async () => {
                  try {
                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                    const url = `${origin}/public/quote/${encodeURIComponent(String(quote.publicId))}`;
                    await navigator.clipboard.writeText(url);
                    try {
                      window.dispatchEvent(
                        new CustomEvent('showToast', {
                          detail: {
                            message: t('quotes.actions.copyPublicLinkSuccess', { defaultValue: 'Bağlantı kopyalandı.' }) as string,
                            tone: 'success',
                          },
                        })
                      );
                    } catch (dispatchError) {
                      logger.debug('Public quote toast dispatch failed', dispatchError);
                    }
                    // İlk kez paylaşım yapılıyorsa taslak statüsünü 'sent' yap
                    if (onChangeStatus && (quote.status === 'draft')) {
                      onChangeStatus(quote, 'sent');
                    }
                  } catch (err) {
                    console.warn('Clipboard copy failed, showing fallback', err);
                    try {
                      const origin = typeof window !== 'undefined' ? window.location.origin : '';
                      const url = `${origin}/public/quote/${encodeURIComponent(String(quote.publicId))}`;
                      alert(url);
                    } catch (fallbackError) {
                      logger.debug('Public quote link alert fallback failed', fallbackError);
                    }
                  }
                }}
                className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200"
                title={t('quotes.actions.copyPublicLink', { defaultValue: 'Public Link Kopyala' })}
              >
                <LinkIcon className="w-4 h-4" />
                <span className="text-sm font-medium">{t('quotes.actions.copyPublicLink', { defaultValue: 'Public Link Kopyala' })}</span>
              </button>
            )}

            {/* E-postayı yeniden gönder butonu istenmediği için gizlendi
            {(quote.status === 'sent' || quote.status === 'viewed') && (
              <button
                onClick={() => {
                  // Stub: E-postayı yeniden gönder - entegrasyon aşamasında
                  console.log('Resend email (stub) for quote', quote.id);
                  alert(t('quotes.actions.resendEmail'));
                }}
                className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200"
                title={t('quotes.actions.resendEmail')}
              >
                <Mail className="w-4 h-4" />
                <span className="text-sm font-medium">{t('quotes.actions.resendEmail')}</span>
              </button>
            )}
            */}
          </div>
        </div>
      </div>
    </div>
    {/* Kabul onayı */}
    {confirmAccept && (
      <ConfirmModal
        isOpen={true}
        title={t('common.confirm', { defaultValue: 'Onay' })}
        message={t('quotes.confirmAccept', { defaultValue: 'Teklifi kabul etmek istediğinizden emin misiniz? Bu işlem geri alınamaz.' })}
        confirmText={t('common.yes', { defaultValue: 'Evet' })}
        cancelText={t('common.no', { defaultValue: 'Hayır' })}
        onCancel={() => setConfirmAccept(false)}
        onConfirm={() => { setConfirmAccept(false); onChangeStatus && quote && onChangeStatus(quote, 'accepted'); }}
      />
    )}
    </>
  );
};

export default QuoteViewModal;
