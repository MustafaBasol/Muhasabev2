import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authService } from '../api/auth';
import LegalHeader from './LegalHeader';

function useQueryParam(paramName: string) {
  return useMemo(() => {
    // Support both hash (#verify-email?token=...) and path (/auth/verify?token=...&u=...)
    const url = new URL(window.location.href);
    // If hash contains query, parse that first
    if (url.hash && url.hash.includes('?')) {
      const idx = url.hash.indexOf('?');
      const qs = url.hash.substring(idx + 1);
      const params = new URLSearchParams(qs);
      const val = params.get(paramName);
      if (val) return val;
    }
    return url.searchParams.get(paramName) || '';
  }, []);
}

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const token = useQueryParam('token');
  const userId = useQueryParam('u');
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [seconds, setSeconds] = useState<number>(5);

  useEffect(() => {
    const run = async () => {
      try {
        if (token && userId) {
          // New hashed token flow
            await authService.verifyEmailHashed(token, userId);
        } else if (token) {
          // Legacy fallback (#verify-email?token=...)
          await authService.verifyEmail(token);
        } else {
          throw new Error('Token bulunamadı');
        }
        setStatus('success');
        // Doğrulama başarıyla tamamlandığında pending email bilgisini temizle
        try { sessionStorage.removeItem('pending_verification_email'); } catch {}
      } catch (err: any) {
        setStatus('error');
        setMessage(err?.message || 'Doğrulama başarısız');
      }
    };
    if (token) run();
  }, [token, userId]);

  // Başarılı doğrulama sonrası otomatik giriş sayfasına yönlendirme (5 sn)
  useEffect(() => {
    if (status !== 'success') return;
    const timer = setInterval(() => setSeconds((s) => s - 1), 1000);
    const redirect = setTimeout(() => {
      window.location.hash = 'login';
    }, 5000);
    return () => {
      clearInterval(timer);
      clearTimeout(redirect);
    };
  }, [status]);

  return (
    <div className="min-h-screen bg-slate-50">
      <LegalHeader />
      <div className="flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <button onClick={() => (window.location.hash = 'login')} className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 mb-4">
              <ArrowLeft className="h-4 w-4" /> {t('common.back', 'Geri')}
            </button>
            {status === 'loading' && <div>{t('common.loading', 'Yükleniyor...')}</div>}
            {status === 'success' && (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle className="h-12 w-12 text-emerald-600" />
                <h1 className="text-2xl font-bold text-gray-900">{t('auth.emailVerified', 'E-posta doğrulandı')}</h1>
                <p className="text-gray-600 text-sm">
                  {t('auth.redirectingToLogin', 'Giriş sayfasına yönlendiriliyorsunuz...')} ({seconds})
                </p>
                <button onClick={() => (window.location.hash = 'login')} className="text-blue-600 underline">
                  {t('auth.goToLogin', 'Girişe dön')}
                </button>
              </div>
            )}
            {status === 'error' && (
              <div className="flex flex-col items-center gap-2">
                <XCircle className="h-12 w-12 text-red-600" />
                <h1 className="text-2xl font-bold text-gray-900">{t('auth.verificationFailed', 'Doğrulama başarısız')}</h1>
                {message && <p className="text-gray-600">{message}</p>}
                <button
                  onClick={() => {
                    if (userId) {
                      window.location.hash = 'login';
                    } else {
                      window.location.hash = 'register';
                    }
                  }}
                  className="text-sm text-blue-600 underline mt-2"
                >
                  {t('auth.backToStart', 'Başa dön')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
