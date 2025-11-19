import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../types';

interface StockWarningModalProps {
  isOpen: boolean;
  product?: Product | null;
  requested: number;
  available: number;
  onClose: () => void;
  onAdjust?: () => void; // Miktarı otomatik ayarla (available değerine)
}

// Inline çok dilli metin haritası — yeni i18n anahtarı EKLEMEDEN
const STR = {
  tr: {
    title: 'Stok Uyarısı',
    requestedLabel: 'İstenen Miktar',
    availableLabel: 'Mevcut Stok',
    message: 'Girilen miktar mevcut stoktan fazla. Lütfen miktarı güncelleyin.',
    adjust: 'Miktarı Düzelt',
    close: 'Kapat'
  },
  en: {
    title: 'Stock Warning',
    requestedLabel: 'Requested Qty',
    availableLabel: 'Available Stock',
    message: 'Entered quantity exceeds available stock. Please adjust the quantity.',
    adjust: 'Adjust Quantity',
    close: 'Close'
  },
  fr: {
    title: 'Alerte Stock',
    requestedLabel: 'Quantité Demandée',
    availableLabel: 'Stock Disponible',
    message: 'La quantité saisie dépasse le stock disponible. Veuillez ajuster.',
    adjust: 'Ajuster',
    close: 'Fermer'
  },
  de: {
    title: 'Bestandswarnung',
    requestedLabel: 'Angefragte Menge',
    availableLabel: 'Verfügbarer Bestand',
    message: 'Die eingegebene Menge überschreitet den verfügbaren Bestand. Bitte anpassen.',
    adjust: 'Anpassen',
    close: 'Schließen'
  }
};

const normalizeLang = (lng?: string): keyof typeof STR => {
  const l = (lng || 'tr').toLowerCase();
  if (l.startsWith('tr')) return 'tr';
  if (l.startsWith('fr')) return 'fr';
  if (l.startsWith('de')) return 'de';
  return 'en';
};

const StockWarningModal: React.FC<StockWarningModalProps> = ({ isOpen, product, requested, available, onClose, onAdjust }) => {
  const { i18n } = useTranslation();
  if (!isOpen) return null;
  const L = STR[normalizeLang(i18n.language)];
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-yellow-300">
        <div className="px-5 py-4 flex items-center gap-3 border-b border-yellow-200">
          <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">{L.title}</h2>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm text-gray-700">
          <p className="font-medium">{L.message}</p>
          <div className="bg-gray-50 rounded-lg p-3 text-xs grid grid-cols-2 gap-2">
            <div>
              <div className="text-gray-500">{L.requestedLabel}</div>
              <div className="font-semibold text-gray-900">{requested}</div>
            </div>
            <div>
              <div className="text-gray-500">{L.availableLabel}</div>
              <div className="font-semibold text-gray-900">{available}</div>
            </div>
          </div>
          {product && (
            <p className="text-xs text-gray-500">{product.name}</p>
          )}
        </div>
        <div className="px-5 py-3 border-t bg-gray-50 flex justify-end gap-2">
          {onAdjust && (
            <button
              type="button"
              onClick={() => { onAdjust(); onClose(); }}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-yellow-500 text-white hover:bg-yellow-600"
            >
              {L.adjust}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-100"
          >
            {L.close}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockWarningModal;
