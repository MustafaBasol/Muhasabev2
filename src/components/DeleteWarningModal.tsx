import { X, AlertTriangle } from 'lucide-react';

interface RelatedItem {
  id: string;
  [key: string]: any;
}

interface DeleteWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  relatedItems: RelatedItem[];
  itemType: 'invoice' | 'expense';
}

export default function DeleteWarningModal({
  isOpen,
  onClose,
  title,
  message,
  relatedItems,
  itemType,
}: DeleteWarningModalProps) {
  if (!isOpen) return null;

  const renderInvoiceItem = (item: any) => (
    <div key={item.id} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
      <div>
        <span className="font-medium text-gray-900">{item.invoiceNumber}</span>
        <span className="ml-3 text-sm text-gray-600">
          {item.total} TL - {item.status}
        </span>
      </div>
    </div>
  );

  const renderExpenseItem = (item: any) => (
    <div key={item.id} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
      <div>
        <span className="font-medium text-gray-900">{item.expenseNumber}</span>
        <span className="ml-3 text-sm text-gray-600">{item.description}</span>
      </div>
      <span className="text-sm font-medium text-gray-900">{item.amount} TL</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
            {title}
          </h3>

          {/* Message */}
          <p className="text-sm text-gray-600 text-center mb-4">
            {message}
          </p>

          {/* Related Items List */}
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Bağlı {itemType === 'invoice' ? 'Faturalar' : 'Giderler'}:
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {relatedItems.map(item => 
                itemType === 'invoice' ? renderInvoiceItem(item) : renderExpenseItem(item)
              )}
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Anladım
          </button>

          {/* Info Text */}
          <p className="text-xs text-gray-500 text-center mt-3">
            Silmek için önce bağlı {itemType === 'invoice' ? 'faturaları' : 'giderleri'} silmeniz gerekir.
          </p>
        </div>
      </div>
    </div>
  );
}
