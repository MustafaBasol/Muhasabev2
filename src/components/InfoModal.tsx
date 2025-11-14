import React from 'react';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';

type InfoTone = 'success' | 'error' | 'info';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  cancelLabel?: string;
  onCancel?: () => void;
  tone?: InfoTone;
  autoCloseMs?: number;
}

const toneStyles: Record<InfoTone, {
  iconBg: string;
  iconColor: string;
  button: string;
}> = {
  success: {
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    button: 'bg-green-600 hover:bg-green-700 text-white',
  },
  error: {
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    button: 'bg-red-600 hover:bg-red-700 text-white',
  },
  info: {
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
};

export default function InfoModal({
  isOpen,
  onClose,
  title,
  message,
  confirmLabel = 'OK',
  onConfirm,
  cancelLabel,
  onCancel,
  tone = 'info',
  autoCloseMs,
}: InfoModalProps) {
  // Hooks MUST be called unconditionally. Define IDs/refs/effects first.
  const titleId = React.useId();
  const descId = React.useId();
  const modalRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen || !autoCloseMs) return;
    const t = window.setTimeout(() => onClose(), autoCloseMs);
    return () => window.clearTimeout(t);
  }, [isOpen, autoCloseMs, onClose]);

  React.useEffect(() => {
    if (isOpen) {
      // Basit odak yakalama: modal açıldığında modale odak ver
      modalRef.current?.focus();
    }
  }, [isOpen]);

  // Early return AFTER hooks to keep hook order stable
  if (!isOpen) return null;

  const styles = toneStyles[tone];

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId}>
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div ref={modalRef} tabIndex={-1} className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 outline-none">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Icon */}
          <div className={`flex items-center justify-center w-12 h-12 mx-auto ${styles.iconBg} rounded-full mb-4`}>
            {tone === 'error' ? (
              <AlertTriangle className={`h-6 w-6 ${styles.iconColor}`} />
            ) : (
              <CheckCircle2 className={`h-6 w-6 ${styles.iconColor}`} />
            )}
          </div>

          {/* Title */}
          <h3 id={titleId} className="text-lg font-semibold text-gray-900 text-center mb-2">
            {title}
          </h3>

          {/* Message */}
          <p id={descId} className="text-sm text-gray-600 text-center mb-6">
            {message}
          </p>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {cancelLabel ? (
              <button
                onClick={onCancel || onClose}
                className={`w-1/2 px-4 py-2 rounded-lg transition-colors border border-gray-300 text-gray-700 bg-white hover:bg-gray-50`}
              >
                {cancelLabel}
              </button>
            ) : null}

            <button
              onClick={() => {
                try {
                  if (onConfirm) onConfirm();
                  else onClose();
                } catch {
                  // no-op
                }
              }}
              className={`${cancelLabel ? 'w-1/2' : 'w-full'} px-4 py-2 rounded-lg transition-colors ${styles.button}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
