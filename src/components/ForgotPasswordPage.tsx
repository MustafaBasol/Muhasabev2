import React, { useState } from 'react';
import { Mail, ArrowLeft, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authService } from '../api/auth';
import LegalHeader from './LegalHeader';

export default function ForgotPasswordPage() {
  const { t, i18n } = useTranslation('common');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // cooldown timer
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (cooldown > 0) return;
      await authService.forgotPassword(email);
      setSent(true);
      setCooldown(60);
    } catch (err: any) {
      setError(err?.message || 'İşlem sırasında bir hata oluştu');
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
            <button
              onClick={() => (window.location.hash = 'login')}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
            >
              <ArrowLeft className="h-4 w-4" /> {t('back')}
            </button>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.forgotPassword')}</h1>
            <p className="text-gray-600 mb-6">{t('auth.forgotPasswordHelp')}</p>

            {sent ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                {t('auth.resetEmailSent')}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">{t('auth.emailAddress')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder={t('auth.emailPlaceholder')}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || cooldown>0}
                  className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><Send className="h-4 w-4" /> {cooldown>0 ? t('auth.resendIn', { seconds: cooldown }) : t('auth.sendResetLink')}</>}
                </button>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
