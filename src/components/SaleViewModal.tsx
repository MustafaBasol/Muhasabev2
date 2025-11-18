import { X, Edit, Calendar, User, Package, CreditCard, Download, Trash2 } from 'lucide-react';
import type { Sale } from '../types';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';
import { normalizeStatusKey, resolveStatusLabel } from '../utils/status';

// Sayısal stringleri güvenli biçimde sayıya çevir ("2000.00", "2.000,00", "2,000.00")
const toNumber = (v: any): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;

  if (s.includes('.') && s.includes(',')) {
    const withoutThousands = s.replace(/\./g, '');
    const withDotDecimal = withoutThousands.replace(/,/g, '.');
    const n = parseFloat(withDotDecimal);
    return Number.isFinite(n) ? n : 0;
  }
  if (s.includes(',') && !s.includes('.')) {
    const n = parseFloat(s.replace(/,/g, '.'));
    return Number.isFinite(n) ? n : 0;
  }
  const n = parseFloat(s.replace(/\s/g, ''));
  return Number.isFinite(n) ? n : 0;
};

interface SaleViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  onEdit: (sale: Sale) => void;
  onDelete?: (saleId: string) => void;
  onDownload?: (sale: Sale) => void;
}

export default function SaleViewModal({ 
  isOpen, 
  onClose, 
  sale, 
  onEdit,
  onDelete,
  onDownload
}: SaleViewModalProps) {
  const { formatCurrency } = useCurrency();
  const { t, i18n } = useTranslation();
  
  if (!isOpen || !sale) return null;

  // Dil yardımcıları ve sözlük
  const getActiveLang = () => {
    try {
      const stored = localStorage.getItem('i18nextLng');
      if (stored && stored.length >= 2) return stored.slice(0,2).toLowerCase();
    } catch {}
    const cand = (i18n.resolvedLanguage || i18n.language || 'en') as string;
    return cand.slice(0,2).toLowerCase();
  };
  const toLocale = (l: string) => (l === 'tr' ? 'tr-TR' : l === 'de' ? 'de-DE' : l === 'fr' ? 'fr-FR' : 'en-US');
  const lang = getActiveLang();

  const L = {
    details: { tr:'Satış Detayları', en:'Sale Details', fr:'Détails de vente', de:'Verkaufsdetails' }[lang as 'tr'|'en'|'fr'|'de'] || 'Sale Details',
    createdBy: { tr:'Oluşturan', en:'Created by', fr:'Créé par', de:'Erstellt von' }[lang as 'tr'|'en'|'fr'|'de'] || 'Created by',
    createdAt: { tr:'Oluşturulma', en:'Created at', fr:'Créé le', de:'Erstellt am' }[lang as 'tr'|'en'|'fr'|'de'] || 'Created at',
    updatedBy: { tr:'Son güncelleyen', en:'Last updated by', fr:'Dernière mise à jour par', de:'Zuletzt aktualisiert von' }[lang as 'tr'|'en'|'fr'|'de'] || 'Last updated by',
    updatedAt: { tr:'Son güncelleme', en:'Last updated', fr:'Dernière mise à jour', de:'Zuletzt aktualisiert' }[lang as 'tr'|'en'|'fr'|'de'] || 'Last updated',
    saleInfo: { tr:'Satış Bilgileri', en:'Sale Information', fr:'Informations de vente', de:'Verkaufsinformationen' }[lang as 'tr'|'en'|'fr'|'de'] || 'Sale Information',
    saleDate: { tr:'Satış Tarihi', en:'Sale Date', fr:'Date de vente', de:'Verkaufsdatum' }[lang as 'tr'|'en'|'fr'|'de'] || 'Sale Date',
    paymentMethod: { tr:'Ödeme Yöntemi', en:'Payment Method', fr:"Méthode de paiement", de:'Zahlungsmethode' }[lang as 'tr'|'en'|'fr'|'de'] || 'Payment Method',
    customerInfo: { tr:'Müşteri Bilgileri', en:'Customer Information', fr:'Informations client', de:'Kundeninformationen' }[lang as 'tr'|'en'|'fr'|'de'] || 'Customer Information',
    customer: { tr:'Müşteri', en:'Customer', fr:'Client', de:'Kunde' }[lang as 'tr'|'en'|'fr'|'de'] || 'Customer',
    email: { tr:'E-posta', en:'Email', fr:'E-mail', de:'E-Mail' }[lang as 'tr'|'en'|'fr'|'de'] || 'Email',
    itemsInfo: { tr:'Ürün/Hizmet Bilgileri', en:'Product/Service Information', fr:'Informations Produit/Service', de:'Produkt-/Dienstleistungsinformationen' }[lang as 'tr'|'en'|'fr'|'de'] || 'Product/Service Information',
    productService: { tr:'Ürün/Hizmet', en:'Product/Service', fr:'Produit/Service', de:'Produkt/Dienstleistung' }[lang as 'tr'|'en'|'fr'|'de'] || 'Product/Service',
    quantity: { tr:'Miktar', en:'Quantity', fr:'Quantité', de:'Menge' }[lang as 'tr'|'en'|'fr'|'de'] || 'Quantity',
    unitPrice: { tr:'Birim Fiyat', en:'Unit Price', fr:'Prix unitaire', de:'Stückpreis' }[lang as 'tr'|'en'|'fr'|'de'] || 'Unit Price',
    total: { tr:'Toplam', en:'Total', fr:'Total', de:'Gesamt' }[lang as 'tr'|'en'|'fr'|'de'] || 'Total',
    grandTotalExclVat: { tr:'Genel Toplam (KDV Hariç):', en:'Grand Total (excl. VAT):', fr:'Total général (HT):', de:'Gesamtsumme (ohne MwSt.):' }[lang as 'tr'|'en'|'fr'|'de'] || 'Grand Total (excl. VAT):',
    downloadPdf: { tr:'PDF İndir', en:'Download PDF', fr:'Télécharger PDF', de:'PDF herunterladen' }[lang as 'tr'|'en'|'fr'|'de'] || 'Download PDF',
    edit: { tr:'Düzenle', en:'Edit', fr:'Modifier', de:'Bearbeiten' }[lang as 'tr'|'en'|'fr'|'de'] || 'Edit',
    delete: { tr:'Sil', en:'Delete', fr:'Supprimer', de:'Löschen' }[lang as 'tr'|'en'|'fr'|'de'] || 'Delete',
    amountInfo: { tr:'Tutar Bilgileri', en:'Amount Information', fr:'Informations de montant', de:'Betragsinformationen' }[lang as 'tr'|'en'|'fr'|'de'] || 'Amount Information',
    totalExclVat: { tr:'Toplam Tutar (KDV Hariç):', en:'Total Amount (excl. VAT):', fr:'Montant total (HT):', de:'Gesamtbetrag (ohne MwSt.):' }[lang as 'tr'|'en'|'fr'|'de'] || 'Total Amount (excl. VAT):',
    notes: { tr:'Notlar', en:'Notes', fr:'Notes', de:'Notizen' }[lang as 'tr'|'en'|'fr'|'de'] || 'Notes',
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(toLocale(lang));
  };

  const formatAmount = (amount: any) => {
  const n = toNumber(amount);
  return formatCurrency(n);
};

  const getStatusBadge = (status: string) => {
    const key = normalizeStatusKey(status);
    // Satış durumlarını temel gruplara indir ve etiketleri i18n üzerinden çöz
    const isCompleted = ['completed', 'paid', 'invoiced', 'approved'].includes(key);
    const isCancelled = ['cancelled'].includes(key);
    const variant = isCompleted ? 'completed' : isCancelled ? 'cancelled' : 'pending';
    const statusConfig = {
      completed: { label: resolveStatusLabel(t, 'completed'), class: 'bg-green-100 text-green-800' },
      pending: { label: resolveStatusLabel(t, 'pending'), class: 'bg-yellow-100 text-yellow-800' },
      cancelled: { label: resolveStatusLabel(t, 'cancelled'), class: 'bg-red-100 text-red-800' }
    } as const;
    const config = statusConfig[variant] || { label: resolveStatusLabel(t, key), class: 'bg-gray-100 text-gray-800' } as const;
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.class}`}>
        {config.label}
      </span>
    );
  };

  const getPaymentMethodLabel = (method?: string) => {
    const key = (method || '').toString().toLowerCase();
    // Basit i18n anahtarları; bulunamazsa mevcut fallback korunur
    const map: Record<string, string> = {
      cash: t('payments.methods.cash', 'Nakit'),
      card: t('payments.methods.card', 'Kredi/Banka Kartı'),
      transfer: t('payments.methods.transfer', 'Havale/EFT'),
      check: t('payments.methods.check', 'Çek'),
    };
    return map[key] || method;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {sale.saleNumber || `SAL-${sale.id}`}
              </h2>
              <p className="text-sm text-gray-500">{t('sales.details', L.details)}</p>
            </div>
            {getStatusBadge(sale.status)}
          </div>
          <div className="flex items-center space-x-2">
            {onDownload && (
              <button
                onClick={() => onDownload(sale)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>{L.downloadPdf}</span>
              </button>
            )}
            <button
              onClick={() => onEdit(sale)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              <span>{L.edit}</span>
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(sale.id)}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>{L.delete}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6" id={`sale-${sale.id}`}>
          {/* Oluşturan / Güncelleyen Bilgisi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 text-xs text-gray-600">
            <div>
              <div>
                <span className="text-gray-500">{L.createdBy}:</span>{' '}
                <span className="font-medium">{(sale as any).createdByName || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">{L.createdAt}:</span>{' '}
                <span className="font-medium">{(sale as any).createdAt ? new Date((sale as any).createdAt).toLocaleString(toLocale(lang)) : '—'}</span>
              </div>
            </div>
            <div>
              <div>
                <span className="text-gray-500">{L.updatedBy}:</span>{' '}
                <span className="font-medium">{(sale as any).updatedByName || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">{L.updatedAt}:</span>{' '}
                <span className="font-medium">{(sale as any).updatedAt ? new Date((sale as any).updatedAt).toLocaleString(toLocale(lang)) : '—'}</span>
              </div>
            </div>
          </div>

          {/* Sale Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{L.saleInfo}</h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">{L.saleDate}:</span>
                  <span className="ml-2 font-medium">{formatDate(sale.date)}</span>
                </div>
                {sale.paymentMethod && (
                  <div className="flex items-center text-sm">
                    <CreditCard className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">{L.paymentMethod}:</span>
                    <span className="ml-2 font-medium">{getPaymentMethodLabel(sale.paymentMethod)}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{L.customerInfo}</h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <User className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">{L.customer}:</span>
                  <span className="ml-2 font-medium">{sale.customerName}</span>
                </div>
                {sale.customerEmail && (
                  <div className="flex items-center text-sm">
                    <span className="w-4 h-4 text-gray-400 mr-2 text-xs">@</span>
                    <span className="text-gray-600">{L.email}:</span>
                    <span className="ml-2 font-medium">{sale.customerEmail}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Product Info */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{L.itemsInfo}</h3>
            
            {/* Çoklu ürün varsa tablo göster */}
            {sale.items && sale.items.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {L.productService}
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {L.quantity}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {L.unitPrice}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {L.total}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sale.items.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-900">{item.productName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {formatAmount(item.unitPrice)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {formatAmount((item.total && toNumber(item.total) > 0) ? item.total : toNumber(item.unitPrice) * toNumber(item.quantity))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-right font-semibold text-gray-900">
                        {L.grandTotalExclVat}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-green-600 text-lg">
                        {formatAmount(sale.items.reduce((sum, it) => sum + toNumber(it.unitPrice) * toNumber(it.quantity), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              /* Tek ürün gösterimi (eski sistem) */
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-3 mb-2">
                  <Package className="w-5 h-5 text-gray-400" />
                  <span className="font-medium text-gray-900">{sale.productName}</span>
                </div>
                {sale.quantity && sale.unitPrice && (
                  <div className="text-sm text-gray-600 ml-8">
                    <span>Miktar: {sale.quantity}</span>
                    <span className="mx-2">•</span>
                    <span>Birim Fiyat: {formatAmount(sale.unitPrice)}</span>
                    <span className="mx-2">•</span>
                    <span>Toplam (KDV Hariç): {formatAmount(toNumber(sale.unitPrice) * toNumber(sale.quantity))}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Amount - Sadece tek ürün varsa göster */}
          {(!sale.items || sale.items.length === 0) && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{L.amountInfo}</h3>
              <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                <div className="flex justify-between items-center">
                  <span className="text-green-800 font-medium text-lg">{t('sales.totalExclVat', L.totalExclVat)}</span>
                  <span className="text-2xl font-bold text-green-600">
                    {formatAmount(toNumber(sale.unitPrice) * toNumber(sale.quantity))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {sale.notes && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{L.notes}</h3>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-gray-700">{sale.notes}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}