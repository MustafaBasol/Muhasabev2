import React from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  danger = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation('common');
  const titleText = title ?? t('confirm', { defaultValue: 'Onay' });
  const confirmTextResolved = confirmText ?? t('yes', { defaultValue: 'Evet' });
  const cancelTextResolved = cancelText ?? t('cancel', { defaultValue: 'İptal' });
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{titleText}</h3>
        </div>
        <div className="px-5 py-4 text-gray-700 whitespace-pre-line">
          {message}
        </div>
        <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="inline-flex items-center px-4 py-2 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            {cancelTextResolved}
          </button>
          <button
            onClick={onConfirm}
            className={`inline-flex items-center px-4 py-2 rounded-md text-white focus:outline-none ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {confirmTextResolved}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
