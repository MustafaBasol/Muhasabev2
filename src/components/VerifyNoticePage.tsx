import { useEffect, useMemo, useState } from 'react';
import { Mail, Timer, RefreshCw, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LegalHeader from './LegalHeader';
import { authService } from '../api/auth';
import { safeSessionStorage } from '../utils/localStorageSafe';

export default function VerifyNoticePage() {
  const { t } = useTranslation();
  const readStoredExpiry = () => {
    const stored = safeSessionStorage.getItem('pending_verification_cooldown_until');
    if (!stored) return null;
    const parsed = parseInt(stored, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const [cooldown, setCooldown] = useState<number>(() => {
    const expiresAt = readStoredExpiry();
    if (!expiresAt) return 0;
    return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  });
  const [cooldownExpiry, setCooldownExpiry] = useState<number | null>(() => readStoredExpiry());
  const email = useMemo(() => safeSessionStorage.getItem('pending_verification_email') || '', []);

  useEffect(() => {
    if (!cooldownExpiry) {
      setCooldown(0);
      return;
    }

    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((cooldownExpiry - Date.now()) / 1000));
      setCooldown(remaining);
      if (remaining <= 0) {
        setCooldownExpiry(null);
        safeSessionStorage.removeItem('pending_verification_cooldown_until');
      }
    };

    updateRemaining();
    const intervalId = setInterval(updateRemaining, 1000);
    return () => clearInterval(intervalId);
  }, [cooldownExpiry]);

  const beginCooldown = () => {
    const expires = Date.now() + 60_000;
    setCooldownExpiry(expires);
    setCooldown(60);
    safeSessionStorage.setItem('pending_verification_cooldown_until', expires.toString());
  };

  const resend = async () => {
    if (!email) return;
    if (cooldown > 0) return;
    try {
      await authService.resendVerification(email);
      beginCooldown();
    } catch {
      beginCooldown();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <LegalHeader />
      <div className="flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <button onClick={() => (window.location.hash = 'login')} className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 mb-4">
              <ArrowLeft className="h-4 w-4" /> {t('common.back', 'Geri')}
            </button>
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                <Mail className="h-8 w-8" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.verifyYourEmail', 'E-postanızı doğrulayın')}</h1>
            <p className="text-gray-600 mb-6">
              {email ? (
                <>{t('auth.verifySentTo', 'Doğrulama bağlantısı e-posta adresinize gönderildi:')} <strong>{email}</strong></>
              ) : (
                t('auth.verifySent', 'E-posta adresinize doğrulama bağlantısı gönderdik.')
              )}
            </p>
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={resend}
                disabled={!email || cooldown>0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                {cooldown>0
                  ? t('auth.resendIn', {
                      seconds: cooldown,
                      defaultValue: 'Tekrar göndermek için bekleyin: {{seconds}}s',
                    })
                  : t('auth.resend', 'Tekrar gönder')}
              </button>
              <div className="text-xs text-gray-500 flex items-center gap-1"><Timer className="h-3 w-3" />{t('auth.resendCooldown', 'Güvenlik için 60 saniye bekleme uygulanır')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
