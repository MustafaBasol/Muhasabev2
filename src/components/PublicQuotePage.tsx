import React, { useEffect, useMemo, useState } from 'react';
import { FileDown, Link as LinkIcon, Check, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../contexts/CurrencyContext';
// DOMPurify doğrudan kullanılmıyor; RTE içeriği için sanitizeRteHtml kullanıyoruz
import { sanitizeRteHtml } from '../utils/security';
import { getPublicQuote, markViewedPublic, acceptPublic, declinePublic } from '../api/quotes';

interface QuoteItem { id: string; description: string; quantity: number; unitPrice: number; total: number; }
interface QuotePublic {
  id: string;
  quoteNumber: string;
  customerName: string;
  issueDate: string;
  validUntil?: string;
  currency: 'TRY'|'USD'|'EUR'|'GBP';
  total: number;
  status: 'draft'|'sent'|'viewed'|'accepted'|'declined'|'expired';
  items?: QuoteItem[];
  scopeOfWorkHtml?: string;
}

interface PublicQuotePageProps { quoteId: string; }

const PublicQuotePage: React.FC<PublicQuotePageProps> = ({ quoteId }) => {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useCurrency();
  const [quote, setQuote] = useState<QuotePublic | null>(null);
  const [processing, setProcessing] = useState<false | 'accept' | 'decline'>(false);
  const [info, setInfo] = useState<string | null>(null);
  const [company, setCompany] = useState<any | null>(null);
  const [preparedBy, setPreparedBy] = useState<string | null>(null);
  const [markedViewed, setMarkedViewed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPublicQuote(String(quoteId));
        if (!cancelled) {
          setQuote(data);
          // Backend'ten gelen tenantPublicProfile varsa şirket bilgilerini buradan al
          if ((data as any)?.tenantPublicProfile) {
            setCompany((data as any).tenantPublicProfile);
          }
        }
      } catch (e) {
        if (!cancelled) setQuote(null);
      }
    })();
    return () => { cancelled = true; };
  }, [quoteId]);

  // Bu sayfa görüntülendiğinde, durum 'draft' veya 'sent' ise otomatik olarak 'viewed' yap
  useEffect(() => {
    if (!quote) return;
    if (markedViewed) return;
    if (quote.status === 'sent' || quote.status === 'draft') {
      (async () => {
        try {
          const updated = await markViewedPublic(String(quoteId));
          setQuote(updated);
        } finally {
          setMarkedViewed(true);
        }
      })();
    }
  }, [quote, markedViewed, quoteId]);

  // "Hazırlayan" bilgisini lokal kullanıcıdan (sadece görüntüleme için) yükle
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem('user');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
        setPreparedBy(name || null);
      }
    } catch {}
  }, []);

  const todayISO = new Date().toISOString().slice(0,10);
  const isExpiredByDate = quote?.validUntil ? (quote.validUntil < todayISO) : false;
  const showExpired = quote && !['accepted','declined','expired'].includes(quote.status) && isExpiredByDate;

  // Görüntülenecek toplam: backend total yoksa kalemlerden hesapla
  const displayTotal = useMemo(() => {
    if (!quote) return 0;
    const backendTotal = Number(quote.total) || 0;
    if (backendTotal > 0) return backendTotal;
    const sumFromItems = (quote.items || []).reduce((sum, it) => {
      const itemTotal = Number(it.total);
      if (!isNaN(itemTotal) && itemTotal !== 0) return sum + itemTotal;
      // total yoksa quantity * unitPrice dene
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unitPrice) || 0;
      return sum + (qty * price);
    }, 0);
    return Number(sumFromItems) || 0;
  }, [quote]);

  type SettingsLanguage = 'tr' | 'en' | 'fr' | 'de';
  const activeLang = useMemo<SettingsLanguage>(() => {
    const l = (i18n.language || 'tr').toLowerCase().substring(0,2);
    return (['tr','en','fr','de'] as const).includes(l as any) ? (l as SettingsLanguage) : 'en';
  }, [i18n.language]);

  const L = useMemo(() => ({
    tr: {
      title: 'Teklif', appSubtitle: 'Teklif dökümanı', customerInfo: 'Müşteri Bilgileri',
      quoteNumber: 'Teklif No', issueDate: 'Düzenleme Tarihi', validUntil: 'Geçerlilik Tarihi', status: 'Durum',
      items: { description: 'Açıklama', quantity: 'Miktar', unitPrice: 'Birim Fiyat', total: 'Toplam' },
      totals: { grandTotal: 'Genel Toplam' }, footer: 'Bu belge bilgi amaçlıdır.', preparedBy: 'Teklifi Hazırlayan',
      copied: 'Bağlantı kopyalandı.'
    },
    en: {
      title: 'Quote', appSubtitle: 'Quotation document', customerInfo: 'Customer Information',
      quoteNumber: 'Quote No', issueDate: 'Issue Date', validUntil: 'Valid Until', status: 'Status',
      items: { description: 'Description', quantity: 'Qty', unitPrice: 'Unit Price', total: 'Total' },
      totals: { grandTotal: 'Grand Total' }, footer: 'This document is for information purposes.', preparedBy: 'Prepared by',
      copied: 'Link copied.'
    },
    fr: {
      title: 'Devis', appSubtitle: 'Document de devis', customerInfo: 'Informations client',
      quoteNumber: 'N° de devis', issueDate: 'Date', validUntil: 'Valable jusqu’au', status: 'Statut',
      items: { description: 'Description', quantity: 'Qté', unitPrice: 'Prix unitaire', total: 'Total' },
      totals: { grandTotal: 'Total général' }, footer: 'Document à titre indicatif.', preparedBy: 'Préparé par',
      copied: 'Lien copié.'
    },
    de: {
      title: 'Angebot', appSubtitle: 'Angebotsdokument', customerInfo: 'Kundeninformationen',
      quoteNumber: 'Angebotsnr.', issueDate: 'Datum', validUntil: 'Gültig bis', status: 'Status',
      items: { description: 'Beschreibung', quantity: 'Menge', unitPrice: 'Einzelpreis', total: 'Summe' },
      totals: { grandTotal: 'Gesamtsumme' }, footer: 'Dieses Dokument dient nur zur Information.', preparedBy: 'Erstellt von',
      copied: 'Link kopiert.'
    }
  }[activeLang]), [activeLang]);

  // PDF ile aynı şirket-alanları (ülkeye göre) oluşturucu
  type Country = 'TR'|'FR'|'DE'|'US'|'OTHER';
  const country: Country = useMemo(() => {
    const fromCompany = (company?.country || '').toString().toUpperCase();
    if (['TR','FR','DE','US','OTHER'].includes(fromCompany)) return fromCompany as Country;
    // ülke gelmezse dili baz al
    return activeLang === 'tr' ? 'TR' : activeLang === 'fr' ? 'FR' : activeLang === 'de' ? 'DE' : 'US';
  }, [company?.country, activeLang]);

  const legalRows = useMemo(() => {
    const c = company || {};
    const row = (label: string, value?: string) => value ? (<div key={label} className="text-sm text-gray-800"><strong>{label}:</strong> <span>{value}</span></div>) : null;
    switch (country) {
      case 'TR':
        return [
          row('VKN', c.taxNumber),
          row('Vergi Dairesi', c.taxOffice),
          row('Mersis', c.mersisNumber),
          row('KEP', c.kepAddress),
        ];
      case 'FR':
        return [
          row('SIRET', c.siretNumber),
          row('SIREN', c.sirenNumber),
          row('APE', c.apeCode),
          row('TVA', c.tvaNumber),
          row('RCS', c.rcsNumber),
        ];
      case 'DE':
        return [
          row('Steuernummer', c.steuernummer),
          row('USt-IdNr', c.umsatzsteuerID),
          row('HRB', c.handelsregisternummer),
          row('Geschäftsführer', c.geschaeftsfuehrer),
        ];
      case 'US':
        return [
          row('EIN', c.einNumber),
          row('Tax ID', c.taxId),
          row('Business License', c.businessLicenseNumber),
          row('State', c.stateOfIncorporation),
        ];
      default:
        return [
          row('Registration No', c.registrationNumber),
          row('VAT', c.vatNumberGeneric),
          row('Tax ID', c.taxIdGeneric),
          row('State/Region', c.stateOrRegion),
        ];
    }
  }, [company, country]);

  const statusLabel = useMemo(() => {
    if (!quote) return '';
    const s = String(quote.status).toLowerCase();
    switch (activeLang) {
      case 'tr':
        return s === 'accepted' ? 'Kabul Edildi' : s === 'declined' ? 'Reddedildi' : s === 'sent' ? 'Gönderildi' : s === 'viewed' ? 'Görüntülendi' : s === 'expired' ? 'Süresi Doldu' : 'Taslak';
      case 'fr':
        return s === 'accepted' ? 'Accepté' : s === 'declined' ? 'Refusé' : s === 'sent' ? 'Envoyé' : s === 'viewed' ? 'Consulté' : s === 'expired' ? 'Expiré' : 'Brouillon';
      case 'de':
        return s === 'accepted' ? 'Akzeptiert' : s === 'declined' ? 'Abgelehnt' : s === 'sent' ? 'Gesendet' : s === 'viewed' ? 'Gesehen' : s === 'expired' ? 'Abgelaufen' : 'Entwurf';
      default:
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
  }, [quote, activeLang]);

  // Status updates handled via backend below

  const handleAccept = async () => {
    if (!quote) return;
    if (!window.confirm(t('quotes.confirmAccept') || 'Teklifi kabul etmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) return;
    setProcessing('accept');
    try {
      const updated = await acceptPublic(String(quoteId));
      setQuote(updated);
      setInfo(t('quotes.acceptedThanks') || 'Teşekkürler, teklif kabul edildi.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!quote) return;
    if (!window.confirm(t('quotes.confirmDecline') || 'Teklifi reddetmek istediğinizden emin misiniz?')) return;
    setProcessing('decline');
    try {
      const updated = await declinePublic(String(quoteId));
      setQuote(updated);
      setInfo(t('quotes.declinedInfo') || 'Teklif reddedildi.');
    } finally {
      setProcessing(false);
    }
  };

  if (!quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white border rounded-xl shadow p-8 max-w-lg w-full text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">{t('quotes.title') || 'Teklif'}</h1>
          <p className="text-gray-600">{t('quotes.noQuotesFound') || 'Teklif bulunamadı.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-start justify-center bg-gray-50 p-6">
      <div className="bg-white border rounded-xl shadow p-6 w-full max-w-3xl">
        {/* Üst başlık: logo + başlık ve aksiyonlar */}
        <div className="flex items-center justify-between mb-4 border-b border-indigo-200 pb-3">
          <div className="flex items-end gap-3">
            {company?.logoDataUrl ? (
              <img src={company.logoDataUrl} alt="logo" className="h-16 object-contain" />
            ) : null}
            <div className="hidden sm:block">
              <div className="text-indigo-600 font-extrabold text-xl">{L.title}</div>
              <div className="text-gray-500 text-xs">{L.appSubtitle}</div>
              <div className="text-sm text-gray-900 mt-1 font-semibold">{quote.quoteNumber}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const { generateQuotePDF } = await import('../utils/pdfGenerator');
                await generateQuotePDF({
                  id: quote.id,
                  quoteNumber: quote.quoteNumber,
                  customerName: quote.customerName,
                  issueDate: quote.issueDate,
                  validUntil: quote.validUntil,
                  status: quote.status,
                  currency: quote.currency,
                  total: displayTotal,
                  items: (quote.items || []).map(it => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, total: it.total })),
                  scopeOfWorkHtml: (quote as any).scopeOfWorkHtml || ''
                }, { filename: quote.quoteNumber, company: company || undefined });
              }}
              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200"
            >
              <FileDown className="w-4 h-4" /> <span className="text-sm">{t('quotes.actions.downloadPdf') || 'PDF İndir'}</span>
            </button>
            <button
              onClick={async () => {
                const url = window.location.href;
                try { 
                  await navigator.clipboard.writeText(url);
                  try { window.dispatchEvent(new CustomEvent('showToast', { detail: { message: L.copied, tone: 'success' } })); } catch {}
                  setInfo(L.copied);
                } catch (err) {
                  console.warn('Failed to copy link to clipboard', err);
                  try { alert(url); } catch {}
                }
              }}
              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200"
            >
              <LinkIcon className="w-4 h-4" /> <span className="text-sm">{t('quotes.actions.copyLink') || 'Link Kopyala'}</span>
            </button>
          </div>
        </div>

        {/* Şirket ve müşteri blokları */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mt-2 mb-5">
          <div className="text-sm text-gray-800">
            {company?.name ? <div className="text-base font-semibold text-gray-900">{company.name}</div> : null}
            {company?.address ? <div className="text-gray-600 whitespace-pre-line">{company.address}</div> : null}
            <div className="mt-2 space-y-1">
              {legalRows}
              {company?.iban ? <div className="text-sm text-gray-800"><strong>IBAN:</strong> <span>{company.iban}</span></div> : null}
              {company?.phone ? <div className="text-sm text-gray-800"><strong>Tel:</strong> <span>{company.phone}</span></div> : null}
              {company?.email ? <div className="text-sm text-gray-800"><strong>Email:</strong> <span>{company.email}</span></div> : null}
              {company?.website ? <div className="text-sm text-gray-800"><strong>Web:</strong> <span>{company.website}</span></div> : null}
            </div>
          </div>
          <div className="text-right text-sm text-gray-800">
            <div className="text-gray-700 font-semibold mb-1">{L.customerInfo}</div>
            <div className="font-medium">{quote.customerName}</div>
            {(() => {
              try {
                const raw = localStorage.getItem('customers_cache');
                const arr = raw ? JSON.parse(raw) : [];
                const found = Array.isArray(arr) ? arr.find((c: any) => c.name === quote.customerName || String(c.id) === (quote as any).customerId) : null;
                return found ? (
                  <>
                    {found.email ? <div className="text-gray-600">{found.email}</div> : null}
                    {found.phone ? <div className="text-gray-600">{found.phone}</div> : null}
                    {found.address ? <div className="text-gray-600 whitespace-pre-line">{found.address}</div> : null}
                  </>
                ) : null;
              } catch { return null; }
            })()}
          </div>
        </div>

        {/* Teklif meta alanları */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="text-sm text-gray-700 space-y-1">
            <div><span className="text-gray-500 mr-2">{L.quoteNumber}:</span><span className="font-medium">{quote.quoteNumber}</span></div>
            <div><span className="text-gray-500 mr-2">{L.issueDate}:</span><span className="font-medium">{new Date(quote.issueDate).toLocaleDateString(activeLang==='tr'?'tr-TR':activeLang==='fr'?'fr-FR':activeLang==='de'?'de-DE':'en-US')}</span></div>
            {quote.validUntil ? (
              <div><span className="text-gray-500 mr-2">{L.validUntil}:</span><span className="font-medium">{new Date(quote.validUntil).toLocaleDateString(activeLang==='tr'?'tr-TR':activeLang==='fr'?'fr-FR':activeLang==='de'?'de-DE':'en-US')}</span></div>
            ) : null}
          </div>
          <div className="text-sm text-gray-700 space-y-1 sm:text-right">
            {quote.status ? (
              <div>
                <span className="text-gray-500 mr-2">{L.status}:</span>
                <span className="font-medium">{statusLabel}</span>
              </div>
            ) : null}
            <div><span className="text-gray-500 mr-2">{t('quotes.createModal.currency') || 'Para Birimi'}:</span><span className="font-medium">{quote.currency}</span></div>
          </div>
        </div>

        {info && (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {info}
          </div>
        )}

        {Array.isArray(quote.items) && quote.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">{L.items.description}</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">{L.items.quantity}</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">{L.items.unitPrice}</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">{L.items.total}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(quote.items || []).map((it) => (
                  <tr key={it.id}>
                    <td className="px-3 py-2 text-sm text-gray-800">{it.description}</td>
                    <td className="px-3 py-2 text-sm text-right text-gray-700">{it.quantity}</td>
                    <td className="px-3 py-2 text-sm text-right text-gray-700">{formatCurrency(it.unitPrice, quote.currency)}</td>
                    <td className="px-3 py-2 text-sm text-right font-medium text-gray-900">{formatCurrency(it.total, quote.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {displayTotal > 0 && (
          <div className="flex items-center justify-end mt-4">
            <div className="text-lg font-semibold">{formatCurrency(displayTotal, quote.currency)}</div>
          </div>
        )}

        {/* İşin Kapsamı (genel sayfada görünür) */}
        {Boolean((quote as any).scopeOfWorkHtml) && (
          <div className="mt-8">
            <div className="text-base font-semibold text-gray-900 mb-2">{t('quotes.scopeOfWork.title', { defaultValue: 'İşin Kapsamı' })}</div>
            <div
              className="prose prose-sm max-w-none text-gray-800"
              dangerouslySetInnerHTML={{ __html: sanitizeRteHtml((quote as any).scopeOfWorkHtml || '') }}
            />
          </div>
        )}

        {/* Notlar ve hazırlayan */}
        <div className="mt-6">
          <div className="text-xs font-semibold text-gray-900 mb-1">
            {activeLang==='tr' ? 'AÇIKLAMA' : activeLang==='fr' ? 'REMARQUES' : activeLang==='de' ? 'ANMERKUNGEN' : 'NOTES'}
          </div>
          <ul className="text-sm text-gray-800 list-disc pl-5 space-y-1">
            <li>{activeLang==='tr' ? 'Teklifimiz KDV hariç olarak paylaşılmıştır.' : activeLang==='fr' ? 'Notre offre est indiquée hors TVA.' : activeLang==='de' ? 'Unser Angebot ist exkl. MwSt.' : 'Our offer is exclusive of VAT.'}</li>
            <li>{(() => {
              if (!quote.validUntil) return activeLang==='tr' ? 'Teklifimiz 30 gün geçerlidir.' : activeLang==='fr' ? 'Notre offre est valable 30 jours.' : activeLang==='de' ? 'Unser Angebot ist 30 Tage gültig.' : 'Our offer is valid for 30 days.';
              try {
                const start = new Date(quote.issueDate).getTime();
                const end = new Date(quote.validUntil).getTime();
                const diff = Math.round((end - start) / 86400000) || 30;
                return activeLang==='tr' ? `Teklifimiz ${diff} gün geçerlidir.` : activeLang==='fr' ? `Notre offre est valable ${diff} jours.` : activeLang==='de' ? `Unser Angebot ist ${diff} Tage gültig.` : `Our offer is valid for ${diff} days.`;
              } catch {
                return activeLang==='tr' ? 'Teklifimiz 30 gün geçerlidir.' : activeLang==='fr' ? 'Notre offre est valable 30 jours.' : activeLang==='de' ? 'Unser Angebot ist 30 Tage gültig.' : 'Our offer is valid for 30 days.';
              }
            })()}</li>
          </ul>
          {preparedBy ? (
            <div className="text-right text-sm text-gray-800 mt-2">
              <strong>{L.preparedBy}:</strong> {preparedBy}
            </div>
          ) : null}
        </div>

        {/* Alıcı aksiyonları */}
        {!['accepted','declined'].includes(quote.status) && !showExpired && (
          <div className="mt-6 flex gap-3 text-sm">
            <button
              disabled={processing !== false}
              onClick={handleAccept}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-white ${processing==="accept"? 'bg-green-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              <Check className="w-4 h-4" /> {t('quotes.actions.accept') || 'Kabul Et'}
            </button>
            <button
              disabled={processing !== false}
              onClick={handleDecline}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-white ${processing==="decline"? 'bg-red-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              <XCircle className="w-4 h-4" /> {t('quotes.actions.decline') || 'Reddet'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicQuotePage;
