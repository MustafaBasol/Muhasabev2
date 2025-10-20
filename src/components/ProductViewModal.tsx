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

interface ProductViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onEdit?: (product: Product) => void;
}

export default function ProductViewModal({ isOpen, onClose, product, onEdit }: ProductViewModalProps) {
  const { formatCurrency } = useCurrency();
  
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
              <p className="text-sm text-gray-500">SKU: {product.sku}</p>
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
                Duzenle
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="Kapat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid gap-6 p-6">
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Ozellikler</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <DetailItem icon={Tag} label="Kategori" value={product.category || 'Belirtilmemis'} />
              <DetailItem icon={Barcode} label="SKU" value={product.sku} />
              <DetailItem icon={Layers} label="Birim" value={product.unit} />
              <DetailItem icon={Calendar} label="Kayit Tarihi" value={new Date(product.createdAt).toLocaleDateString()} />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Fiyat ve Stok</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <DetailItem icon={DollarSign} label="Satis Fiyati" value={formatCurrency(product.unitPrice || 0)} />
              <DetailItem icon={DollarSign} label="Maliyet" value={formatCurrency(product.costPrice || 0)} />
              <DetailItem icon={Layers} label="Stok Miktari" value={`${product.stockQuantity} ${product.unit}`} />
              <DetailItem icon={Layers} label="Kritik Seviye" value={product.reorderLevel} />
            </div>
          </section>

          {product.description && (
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Aciklama</h3>
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
