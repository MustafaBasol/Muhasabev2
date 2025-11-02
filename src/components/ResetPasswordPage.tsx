import React, { useMemo, useState } from 'react';
import { Lock, CheckCircle, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authService } from '../api/auth';
import LegalHeader from './LegalHeader';

function useTokenFromHash(paramName: string) {
  return useMemo(() => {
    const hash = window.location.hash || '';
    const qIndex = hash.indexOf('?');
    if (qIndex === -1) return '';
    const query = new URLSearchParams(hash.substring(qIndex + 1));
    return query.get(paramName) || '';
  }, []);
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const token = useTokenFromHash('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password || password.length < 8) {
      setError(t('auth.passwordTooShort', 'Şifre en az 8 karakter olmalı'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.passwordMismatch', 'Şifreler eşleşmiyor'));
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'İşlem başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <LegalHeader />
      <div className="flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <button onClick={() => (window.location.hash = 'login')} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
              <ArrowLeft className="h-4 w-4" /> {t('common.back', 'Geri')}
            </button>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.resetPassword', 'Şifre Sıfırla')}</h1>
            <p className="text-gray-600 mb-6">{t('auth.resetPasswordHelp', 'Yeni şifrenizi belirleyin.')}</p>

            {done ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                <div>
                  <div className="font-semibold">{t('auth.passwordResetSuccess', 'Şifreniz güncellendi')}</div>
                  <button onClick={() => (window.location.hash = 'login')} className="text-emerald-700 underline">
                    {t('auth.goToLogin', 'Girişe dön')}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('auth.newPassword', 'Yeni Şifre')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder={t('auth.passwordPlaceholder', '••••••••')}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('auth.confirmPassword', 'Şifreyi Doğrula')}</label>
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder={t('auth.passwordPlaceholder', '••••••••')}
                  />
                </div>
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t('common.loading', 'Yükleniyor...') : t('auth.updatePassword', 'Şifreyi Güncelle')}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
