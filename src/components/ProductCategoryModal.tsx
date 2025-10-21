import React from 'react';
import { X, Tag, PlusCircle, Percent } from 'lucide-react';

interface ProductCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (categoryName: string, taxRate: number) => void;
  categories: string[];
}

export default function ProductCategoryModal({
  isOpen,
  onClose,
  onSubmit,
  categories,
}: ProductCategoryModalProps) {
  const [name, setName] = React.useState('');
  const [taxRate, setTaxRate] = React.useState('18');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) {
      setName('');
      setTaxRate('18');
      setError('');
      return;
    }
    setName('');
    setTaxRate('18');
    setError('');
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = () => {
    const normalized = name.trim();
    if (!normalized) {
      setError('Kategori adı zorunludur');
      return;
    }

    const taxRateNum = parseFloat(taxRate);
    if (isNaN(taxRateNum) || taxRateNum < 0 || taxRateNum > 100) {
      setError('KDV oranı 0-100 arasında olmalıdır');
      return;
    }

    const exists = categories
      .map(current => current.toLocaleLowerCase('tr-TR'))
      .includes(normalized.toLocaleLowerCase('tr-TR'));

    if (exists) {
      setError('Bu kategori zaten mevcut');
      return;
    }

    onSubmit(normalized, taxRateNum);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
              <PlusCircle className="h-5 w-5 text-indigo-600" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Kategori Ekle</h2>
              <p className="text-sm text-gray-500">Yeni ürün kategorisini kaydedin.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700" htmlFor="category-name">
            <Tag className="h-4 w-4 text-gray-400" />
            Kategori adı
          </label>
          <input
            id="category-name"
            type="text"
            value={name}
            onChange={event => {
              setName(event.target.value);
              if (error) {
                setError('');
              }
            }}
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Örn: Elektronik"
          />
          
          <label className="mt-4 flex items-center gap-2 text-sm font-medium text-gray-700" htmlFor="category-tax-rate">
            <Percent className="h-4 w-4 text-gray-400" />
            KDV Oranı (%)
          </label>
          <input
            id="category-tax-rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={taxRate}
            onChange={event => {
              setTaxRate(event.target.value);
              if (error) {
                setError('');
              }
            }}
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Örn: 18"
          />
          <p className="mt-1 text-xs text-gray-500">Bu kategorideki ürünler için varsayılan KDV oranı</p>
          
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
