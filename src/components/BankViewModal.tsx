import { X, Edit, CreditCard, Building2, User, Hash, Globe, DollarSign, Calendar, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCurrency as formatCurrencyUtil, type Currency } from '../utils/currencyFormatter';
import { safeLocalStorage } from '../utils/localStorageSafe';

interface Bank {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string;
  balance: number;
  currency: string;
  accountType: 'checking' | 'savings' | 'business';
  isActive: boolean;
  createdAt: string;
}

interface BankViewModalProps {
  isOpen?: boolean;
  onClose: () => void;
  bankAccount: Bank | null;
  bank?: Bank | null;
  onEdit: (bank: Bank) => void;
  onAddTransaction?: (bank: Bank) => void;
  onViewTransactions?: (bank: Bank) => void;
}

export default function BankViewModal({ 
  isOpen = true, 
  onClose, 
  bankAccount,
  bank,
  onEdit,
  onAddTransaction: _onAddTransaction,
  onViewTransactions: _onViewTransactions
}: BankViewModalProps) {
  const { t, i18n } = useTranslation();
  const bankData = bankAccount || bank;
  
  if (!isOpen || !bankData) {
    return null;
  }

  // Dil ve yerel ayar yardımcıları
  const getActiveLang = () => {
    const stored = safeLocalStorage.getItem('i18nextLng');
    if (stored && stored.length >= 2) return stored.slice(0,2).toLowerCase();
    const cand = (i18n.resolvedLanguage || i18n.language || 'en') as string;
    return cand.slice(0,2).toLowerCase();
  };
  const toLocale = (l: string) => (l === 'tr' ? 'tr-TR' : l === 'de' ? 'de-DE' : l === 'fr' ? 'fr-FR' : 'en-US');
  const lang = getActiveLang();

  const L = {
    currentBalance: { tr:'Mevcut Bakiye', en:'Current Balance', fr:'Solde actuel', de:'Aktueller Kontostand' }[lang as 'tr'|'en'|'fr'|'de'] || 'Current Balance',
    accountInfo: { tr:'Hesap Bilgileri', en:'Account Information', fr:'Informations du compte', de:'Kontoinformationen' }[lang as 'tr'|'en'|'fr'|'de'] || 'Account Information',
    accountName: { tr:'Hesap Adı', en:'Account Name', fr:'Nom du compte', de:'Kontoname' }[lang as 'tr'|'en'|'fr'|'de'] || 'Account Name',
    accountNo: { tr:'Hesap No', en:'Account No', fr:'N° de compte', de:'Kontonummer' }[lang as 'tr'|'en'|'fr'|'de'] || 'Account No',
    accountType: { tr:'Hesap Türü', en:'Account Type', fr:'Type de compte', de:'Kontotyp' }[lang as 'tr'|'en'|'fr'|'de'] || 'Account Type',
    openingDate: { tr:'Açılış Tarihi', en:'Opening Date', fr:"Date d'ouverture", de:'Eröffnungsdatum' }[lang as 'tr'|'en'|'fr'|'de'] || 'Opening Date',
    bankInfo: { tr:'Banka Bilgileri', en:'Bank Information', fr:'Informations bancaires', de:'Bankinformationen' }[lang as 'tr'|'en'|'fr'|'de'] || 'Bank Information',
    bank: { tr:'Banka', en:'Bank', fr:'Banque', de:'Bank' }[lang as 'tr'|'en'|'fr'|'de'] || 'Bank',
    swiftBic: { tr:'SWIFT/BIC', en:'SWIFT/BIC', fr:'SWIFT/BIC', de:'SWIFT/BIC' }[lang as 'tr'|'en'|'fr'|'de'] || 'SWIFT/BIC',
    routingNumber: { tr:'Routing Numarası', en:'Routing Number', fr:'Numéro de routage', de:'Routing-Nummer' }[lang as 'tr'|'en'|'fr'|'de'] || 'Routing Number',
    branchCode: { tr:'Şube Kodu', en:'Branch Code', fr:'Code agence', de:'Filialcode' }[lang as 'tr'|'en'|'fr'|'de'] || 'Branch Code',
    currency: { tr:'Para Birimi', en:'Currency', fr:'Devise', de:'Währung' }[lang as 'tr'|'en'|'fr'|'de'] || 'Currency',
    quickActions: { tr:'Hızlı İşlemler', en:'Quick Actions', fr:'Actions rapides', de:'Schnellaktionen' }[lang as 'tr'|'en'|'fr'|'de'] || 'Quick Actions',
    copyIban: { tr:'IBAN Kopyala', en:'Copy IBAN', fr:'Copier IBAN', de:'IBAN kopieren' }[lang as 'tr'|'en'|'fr'|'de'] || 'Copy IBAN',
    ibanCopied: { tr:'IBAN kopyalandı!', en:'IBAN copied!', fr:'IBAN copié !', de:'IBAN kopiert!' }[lang as 'tr'|'en'|'fr'|'de'] || 'IBAN copied!',
    notSpecified: { tr:'Belirtilmemiş', en:'Not specified', fr:'Non spécifié', de:'Nicht angegeben' }[lang as 'tr'|'en'|'fr'|'de'] || 'Not specified',
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return L.notSpecified;
    return new Date(dateString).toLocaleDateString(toLocale(lang));
  };

  const formatAmount = (amount: number, currency: string = 'TRY') => {
    return formatCurrencyUtil(amount, currency as Currency);
  };

  const getAccountTypeLabel = (type: string) => {
    const types = {
      tr: { checking: 'Vadesiz Hesap', savings: 'Vadeli Hesap', business: 'Ticari Hesap' },
      en: { checking: 'Checking Account', savings: 'Savings Account', business: 'Business Account' },
      fr: { checking: 'Compte courant', savings: 'Compte épargne', business: 'Compte professionnel' },
      de: { checking: 'Girokonto', savings: 'Sparkonto', business: 'Geschäftskonto' },
    } as const;
    const dict = (types as any)[lang] || types.en;
    return dict[type as keyof typeof dict] || type;
  };

  const getCurrencyName = (code: string) => {
    const currencies = {
      tr: { TRY: 'Türk Lirası', USD: 'Amerikan Doları', EUR: 'Euro', GBP: 'İngiliz Sterlini' },
      en: { TRY: 'Turkish Lira', USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound' },
      fr: { TRY: 'Livre turque', USD: 'Dollar américain', EUR: 'Euro', GBP: 'Livre sterling' },
      de: { TRY: 'Türkische Lira', USD: 'US-Dollar', EUR: 'Euro', GBP: 'Britisches Pfund' },
    } as const;
    const dict = (currencies as any)[lang] || currencies.en;
    return dict[code as keyof typeof dict] || code;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{bankData.bankName}</h2>
              <p className="text-sm text-gray-500">{t('banks.viewDetails', { defaultValue: 'Banka Hesap Detayları' })}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onEdit(bankData)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title={t('common.edit') as string}
            >
              <Edit className="w-5 h-5 text-gray-500" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6" id={`bank-${bankData.id}`}>
          {/* Balance Card */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white mb-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">{L.currentBalance}</p>
                <p className="text-3xl font-bold">{formatAmount(bankData.balance, bankData.currency)}</p>
                <p className="text-green-100 text-sm mt-1">{getCurrencyName(bankData.currency)}</p>
              </div>
              <div className="text-right">
                {(() => { const active = (bankData as any)?.isActive !== false; return (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${active ? 'bg-green-400 text-green-900' : 'bg-gray-400 text-gray-900'}`}>
                    {active ? (t('chartOfAccounts.active', { defaultValue: 'Aktif' }) as string) : (t('chartOfAccounts.passive', { defaultValue: 'Pasif' }) as string)}
                  </span>
                ); })()}
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{L.accountInfo}</h3>
              <div className="space-y-4">
                <div className="flex items-center text-sm">
                  <User className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">{L.accountName}:</span>
                    <span className="ml-2 font-medium text-gray-900">{bankData.accountName}</span>
                  </div>
                </div>
                <div className="flex items-center text-sm">
                  <Hash className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">{L.accountNo}:</span>
                    <span className="ml-2 font-medium text-gray-900">{bankData.accountNumber}</span>
                  </div>
                </div>
                <div className="flex items-center text-sm">
                  <Activity className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">{L.accountType}:</span>
                    <span className="ml-2 font-medium text-gray-900">{getAccountTypeLabel(bankData.accountType)}</span>
                  </div>
                </div>
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">{L.openingDate}:</span>
                    <span className="ml-2 font-medium text-gray-900">{formatDate(bankData.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{L.bankInfo}</h3>
              <div className="space-y-4">
                <div className="flex items-center text-sm">
                  <Building2 className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                      <span className="text-gray-600">{L.bank}:</span>
                    <span className="ml-2 font-medium text-gray-900">{bankData.bankName}</span>
                  </div>
                </div>
                <div className="flex items-start text-sm">
                  <Globe className="w-4 h-4 text-gray-400 mr-3 mt-0.5" />
                  <div>
                    <span className="text-gray-600">IBAN:</span>
                    <div className="ml-2 font-medium text-gray-900 font-mono text-xs bg-gray-100 p-2 rounded mt-1">
                      {bankData.iban}
                    </div>
                  </div>
                </div>
                {Boolean((bankData as any).swiftBic) && (
                  <div className="flex items-center text-sm">
                    <Globe className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <span className="text-gray-600">{L.swiftBic}:</span>
                      <span className="ml-2 font-medium text-gray-900">{(bankData as any).swiftBic}</span>
                    </div>
                  </div>
                )}
                {Boolean((bankData as any).routingNumber) && (
                  <div className="flex items-center text-sm">
                    <Hash className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <span className="text-gray-600">{L.routingNumber}:</span>
                      <span className="ml-2 font-medium text-gray-900">{(bankData as any).routingNumber}</span>
                    </div>
                  </div>
                )}
                {Boolean((bankData as any).branchCode) && (
                  <div className="flex items-center text-sm">
                    <Hash className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <span className="text-gray-600">{L.branchCode}:</span>
                      <span className="ml-2 font-medium text-gray-900">{(bankData as any).branchCode}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center text-sm">
                  <DollarSign className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">{L.currency}:</span>
                    <span className="ml-2 font-medium text-gray-900">{bankData.currency} - {getCurrencyName(bankData.currency)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{L.quickActions}</h3>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => {
                  const iban = bankData.iban.replace(/\s/g, '');
                  navigator.clipboard.writeText(iban);
                  alert(L.ibanCopied);
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <Globe className="w-4 h-4" />
                <span>{L.copyIban}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}