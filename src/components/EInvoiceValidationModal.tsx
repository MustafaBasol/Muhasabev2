import React from 'react';
import { X, AlertTriangle, Edit2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface EInvoiceMissingField {
  key: string;
  label: string;
}

interface EInvoiceValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingFields: EInvoiceMissingField[];
  customerName?: string;
  onEditCustomer?: () => void;
}

export default function EInvoiceValidationModal({
  isOpen,
  onClose,
  missingFields,
  customerName,
  onEditCustomer,
}: EInvoiceValidationModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t('eInvoiceValidation.title')}
              </h2>
              {customerName && (
                <p className="text-sm text-gray-500">{customerName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">{t('eInvoiceValidation.description')}</p>

          <ul className="space-y-2">
            {missingFields.map((field) => (
              <li
                key={field.key}
                className="flex items-center space-x-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
              >
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <span className="text-sm text-red-700 font-medium">{field.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            {t('eInvoiceValidation.close')}
          </button>
          {onEditCustomer && (
            <button
              onClick={() => { onClose(); onEditCustomer(); }}
              className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
            >
              <Edit2 className="w-4 h-4" />
              <span>{t('eInvoiceValidation.editCustomer')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
