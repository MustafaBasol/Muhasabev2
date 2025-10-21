import { X, Plus, FileText } from 'lucide-react';

interface InvoiceTypeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNewSale: () => void;
  onSelectExistingSale: () => void;
}

export default function InvoiceTypeSelectionModal({
  isOpen,
  onClose,
  onSelectNewSale,
  onSelectExistingSale
}: InvoiceTypeSelectionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Yeni Fatura</h2>
              <p className="text-sm text-gray-500">Fatura türünü seçin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-4">
            {/* Yeni Satış Seçeneği */}
            <button
              onClick={onSelectNewSale}
              className="w-full p-6 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg hover:from-blue-100 hover:to-blue-200 transition-all group"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Yeni Satış</h3>
                  <p className="text-sm text-gray-600">
                    Yeni bir satış kaydı oluşturup fatura kesin
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Satış ve fatura otomatik olarak oluşturulur
                  </p>
                </div>
              </div>
            </button>

            {/* Mevcut Satış Seçeneği */}
            <button
              onClick={onSelectExistingSale}
              className="w-full p-6 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg hover:from-green-100 hover:to-green-200 transition-all group"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center group-hover:bg-green-600 transition-colors">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Mevcut Satış</h3>
                  <p className="text-sm text-gray-600">
                    Daha önce yapılmış satışlardan birine fatura kesin
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Sadece fatura bilgileri düzenlenebilir
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}