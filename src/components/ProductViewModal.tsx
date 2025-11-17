import React from 'react';
import {
  X,
  Package,
  Tag,
  Barcode,
  Layers,
  DollarSign,
  Calendar
} from 'lucide-react';
import type { Product } from './ProductList';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';

interface ProductViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onEdit?: (product: Product) => void;
}

export default function ProductViewModal({ isOpen, onClose, product, onEdit }: ProductViewModalProps) {
  const { formatCurrency } = useCurrency();
  const { t, i18n } = useTranslation();
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
    edit: { tr: 'Düzenle', en: 'Edit', fr: 'Modifier', de: 'Bearbeiten' }[lang as 'tr'|'en'|'fr'|'de'] || 'Edit',
    close: { tr: 'Kapat', en: 'Close', fr: 'Fermer', de: 'Schließen' }[lang as 'tr'|'en'|'fr'|'de'] || 'Close',
    recordInfo: { tr: 'Kayıt Bilgisi', en: 'Record Info', fr: 'Infos d’enregistrement', de: 'Eintragsinfo' }[lang as 'tr'|'en'|'fr'|'de'] || 'Record Info',
    createdBy: { tr: 'Oluşturan', en: 'Created by', fr: 'Créé par', de: 'Erstellt von' }[lang as 'tr'|'en'|'fr'|'de'] || 'Created by',
    createdAt: { tr: 'Oluşturulma', en: 'Created at', fr: 'Créé le', de: 'Erstellt am' }[lang as 'tr'|'en'|'fr'|'de'] || 'Created at',
    updatedBy: { tr: 'Son güncelleyen', en: 'Last updated by', fr: 'Dernière mise à jour par', de: 'Zuletzt aktualisiert von' }[lang as 'tr'|'en'|'fr'|'de'] || 'Last updated by',
    updatedAt: { tr: 'Son güncelleme', en: 'Last updated', fr: 'Dernière mise à jour', de: 'Zuletzt aktualisiert' }[lang as 'tr'|'en'|'fr'|'de'] || 'Last updated',
    features: { tr: 'Özellikler', en: 'Features', fr: 'Caractéristiques', de: 'Eigenschaften' }[lang as 'tr'|'en'|'fr'|'de'] || 'Features',
    category: { tr: 'Kategori', en: 'Category', fr: 'Catégorie', de: 'Kategorie' }[lang as 'tr'|'en'|'fr'|'de'] || 'Category',
    sku: { tr: 'SKU', en: 'SKU', fr: 'SKU', de: 'SKU' }[lang as 'tr'|'en'|'fr'|'de'] || 'SKU',
    unit: { tr: 'Birim', en: 'Unit', fr: 'Unité', de: 'Einheit' }[lang as 'tr'|'en'|'fr'|'de'] || 'Unit',
    registeredDate: { tr: 'Kayıt Tarihi', en: 'Registered Date', fr: 'Date d’enregistrement', de: 'Registrierungsdatum' }[lang as 'tr'|'en'|'fr'|'de'] || 'Registered Date',
    priceStock: { tr: 'Fiyat ve Stok', en: 'Price and Stock', fr: 'Prix et Stock', de: 'Preis und Bestand' }[lang as 'tr'|'en'|'fr'|'de'] || 'Price and Stock',
    salePrice: { tr: 'Satış Fiyatı', en: 'Sale Price', fr: 'Prix de vente', de: 'Verkaufspreis' }[lang as 'tr'|'en'|'fr'|'de'] || 'Sale Price',
    cost: { tr: 'Maliyet', en: 'Cost', fr: 'Coût', de: 'Kosten' }[lang as 'tr'|'en'|'fr'|'de'] || 'Cost',
    stockQty: { tr: 'Stok Miktarı', en: 'Stock Quantity', fr: 'Quantité en stock', de: 'Bestandsmenge' }[lang as 'tr'|'en'|'fr'|'de'] || 'Stock Quantity',
    critical: { tr: 'Kritik Seviye', en: 'Critical Level', fr: 'Niveau critique', de: 'Kritischer Bestand' }[lang as 'tr'|'en'|'fr'|'de'] || 'Critical Level',
    description: { tr: 'Açıklama', en: 'Description', fr: 'Description', de: 'Beschreibung' }[lang as 'tr'|'en'|'fr'|'de'] || 'Description',
    notSpecified: { tr: 'Belirtilmemiş', en: 'Not specified', fr: 'Non spécifié', de: 'Nicht angegeben' }[lang as 'tr'|'en'|'fr'|'de'] || 'Not specified',
  };
  
  if (!isOpen || !product) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-100">
              <Package className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{product.name}</h2>
              <p className="text-sm text-gray-500">{L.sku}: {product.sku}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onEdit(product);
                  onClose();
                }}
                className="rounded-lg border border-indigo-100 px-4 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
              >
                {L.edit}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label={L.close}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid gap-6 p-6">
          {/* Oluşturan / Güncelleyen */}
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{L.recordInfo}</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 text-xs text-gray-600">
              <div>
                <div>{L.createdBy}: <span className="font-medium">{(product as any).createdByName || '—'}</span></div>
                <div>{L.createdAt}: <span className="font-medium">{(product as any).createdAt ? new Date((product as any).createdAt).toLocaleString(toLocale(lang)) : '—'}</span></div>
              </div>
              <div>
                <div>{L.updatedBy}: <span className="font-medium">{(product as any).updatedByName || '—'}</span></div>
                <div>{L.updatedAt}: <span className="font-medium">{(product as any).updatedAt ? new Date((product as any).updatedAt).toLocaleString(toLocale(lang)) : '—'}</span></div>
              </div>
            </div>
          </section>
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{L.features}</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <DetailItem icon={Tag} label={L.category} value={product.category || L.notSpecified} />
              <DetailItem icon={Barcode} label={L.sku} value={product.sku} />
              <DetailItem icon={Layers} label={L.unit} value={product.unit} />
              <DetailItem icon={Calendar} label={L.registeredDate} value={new Date(product.createdAt).toLocaleDateString(toLocale(lang))} />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{L.priceStock}</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <DetailItem icon={DollarSign} label={L.salePrice} value={formatCurrency(product.unitPrice || 0)} />
              <DetailItem icon={DollarSign} label={L.cost} value={formatCurrency(product.costPrice || 0)} />
              <DetailItem icon={Layers} label={L.stockQty} value={`${product.stockQuantity} ${product.unit}`} />
              <DetailItem icon={Layers} label={L.critical} value={product.reorderLevel} />
            </div>
          </section>

          {product.description && (
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{L.description}</h3>
              <p className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
                {product.description}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

interface DetailItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}

function DetailItem({ icon: Icon, label, value }: DetailItemProps) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <Icon className="h-4 w-4 text-gray-400" />
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}
