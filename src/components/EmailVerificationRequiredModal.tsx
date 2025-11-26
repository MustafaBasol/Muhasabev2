import React from 'react';
import { ShieldAlert, MailCheck, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { safeSessionStorage } from '../utils/localStorageSafe';

interface Props {
  email?: string | null;
  onViewStatus: () => void;
  onLogout: () => void;
}

const EmailVerificationRequiredModal: React.FC<Props> = ({ email, onViewStatus, onLogout }) => {
  const { t } = useTranslation();
  const resolvedEmail = email || safeSessionStorage.getItem('pending_verification_email') || undefined;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="max-w-md w-full bg-white shadow-2xl rounded-2xl p-8 text-center border border-gray-100">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-6">
          <ShieldAlert className="w-9 h-9" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-3">
          {t('auth.verifyRequiredTitle', 'E-posta doğrulaması gerekiyor')}
        </h2>
        <p className="text-gray-600 mb-4">
          {t('auth.verifyRequiredBody', {
            defaultValue:
              'Hesabınıza erişebilmek için e-postanızı doğrulamanız gerekiyor. Gelen kutunuzu kontrol edip bağlantıya tıklayın.',
            email: resolvedEmail || '—',
          })}
        </p>
        <div className="text-sm text-gray-500 mb-6">
          {t('auth.verifyRequiredHint', 'Doğrulama yapılana kadar uygulamadaki işlemler kilitlenmiştir.')}
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={onViewStatus}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700 transition-colors"
          >
            <MailCheck className="w-5 h-5" />
            {t('auth.verifyRequiredAction', 'Doğrulama Durumunu Aç')}
          </button>
          <button
            onClick={onLogout}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50"
          >
            <LogOut className="w-5 h-5" />
            {t('auth.verifyRequiredLogout', 'Çıkış Yap')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationRequiredModal;
