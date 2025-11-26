import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import LegalHeader from './LegalHeader';
import TurnstileCaptcha from './TurnstileCaptcha';
import { authService } from '../api/auth';
import { safeLocalStorage, safeSessionStorage } from '../utils/localStorageSafe';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const { t, i18n } = useTranslation();
  const [formData, setFormData] = useState(() => {
    const prefill = safeSessionStorage.getItem('prefill_email')
      || safeLocalStorage.getItem('prefill_email')
      || '';
    if (prefill) {
      safeSessionStorage.removeItem('prefill_email');
      safeLocalStorage.removeItem('prefill_email');
    }
    return { email: prefill, password: '' };
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [resending, setResending] = useState(false);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const securityFallbacks: Record<string, string> = {
    en: 'Security verification required. Please complete the verification.',
    de: 'Sicherheitsüberprüfung erforderlich. Bitte schließen Sie die Verifizierung ab.',
    fr: 'Vérification de sécurité requise. Merci de finaliser la vérification.',
    tr: 'Güvenlik doğrulaması gerekli. Lütfen doğrulamayı tamamlayın.'
  };
  const currentLang = (i18n.language || 'en').split('-')[0];
  const securityVerificationMessage = t(
    'auth.securityVerificationRequired',
    securityFallbacks[currentLang] || securityFallbacks.en
  );
  const verificationMessage = t(
    'auth.emailNotVerified',
    'E-posta doğrulanmadı. Lütfen giriş yapmadan önce e-postanızı doğrulayın.'
  );
  const setErrorWithCode = (message: string, code?: string | null) => {
    setError(message);
    setErrorCode(code ?? null);
  };
  const localizedError = useMemo(() => {
    if (!error) return '';
    if (typeof error === 'string') {
      const normalized = error.toLowerCase();
      if (normalized.includes('security verification required')) {
        return securityVerificationMessage;
      }
      if (normalized.includes('email not verified') || normalized.includes('email_not_verified')) {
        return verificationMessage;
      }
      if (normalized.includes('mfa required') || normalized.includes('mfa_required')) {
        return 'İki faktörlü doğrulama gerekli. Lütfen doğrulama kodunu girin.';
      }
    }
    return error;
  }, [error, securityVerificationMessage, verificationMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorWithCode('', null);
    
    try {
      if (captchaRequired && !captchaToken) {
        setErrorWithCode(securityVerificationMessage, 'CAPTCHA_REQUIRED');
        return;
      }
      const res = await login(
        formData.email,
        formData.password,
        mfaRequired ? (mfaToken || undefined) : undefined,
        captchaRequired ? (captchaToken || undefined) : undefined,
      );
      if ((res as any)?.mfaRequired) {
        setMfaRequired(true);
        setErrorWithCode('MFA_REQUIRED', 'MFA_REQUIRED');
        return;
      }
      if ((res as any)?.captchaRequired) {
        setCaptchaRequired(true);
        setErrorWithCode(securityVerificationMessage, 'CAPTCHA_REQUIRED');
        return;
      }
      // başarıyla giriş yaptıysak MFA durumunu sıfırla
      setMfaRequired(false);
      setMfaToken('');
      setCaptchaRequired(false);
      setCaptchaToken(null);
      setErrorWithCode('', null);
    } catch (error: any) {
      // MFA adımında yanlış kod girdiyse daha net mesaj ver
      const msg = error?.message || 'Giriş sırasında bir hata oluştu';
      const normalized = msg?.toLowerCase?.() || '';
      if (msg === 'MFA_REQUIRED' || normalized.includes('mfa required')) {
        setMfaRequired(true);
        setErrorWithCode('MFA_REQUIRED', 'MFA_REQUIRED');
      } else if (msg === 'CAPTCHA_REQUIRED' || normalized.includes('security verification required')) {
        setCaptchaRequired(true);
        setErrorWithCode(securityVerificationMessage, 'CAPTCHA_REQUIRED');
      } else if (msg === 'EMAIL_NOT_VERIFIED' || normalized.includes('email not verified') || normalized.includes('email_not_verified')) {
        setErrorWithCode('EMAIL_NOT_VERIFIED', 'EMAIL_NOT_VERIFIED');
      } else {
        setErrorWithCode(msg);
      }
    }
  };

  const isUnverifiedError = errorCode === 'EMAIL_NOT_VERIFIED';
  const handleResendVerification = async () => {
    if (!formData.email) return;
    setResending(true);
    try {
      await authService.resendVerification(formData.email);
      setErrorWithCode(
        t('auth.verificationEmailSent', 'Doğrulama e-postası gönderildi. Lütfen e-postanızı kontrol edin.'),
        'VERIFICATION_EMAIL_SENT'
      );
    } catch (e: any) {
      setErrorWithCode(e?.message || t('common.error', 'Hata'));
    } finally {
      setResending(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <LegalHeader />
      <div className="flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                <img src="/ikon-2.png" alt="Comptario" className="h-12 w-12" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('auth.welcomeTitle', 'Hoş Geldiniz')}</h1>
            <p className="text-gray-600">{t('auth.welcomeSubtitle', 'Hesabınıza giriş yaparak devam edin')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">{t('auth.emailAddress', 'E-posta Adresi')}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder={t('auth.emailPlaceholder', 'ornek@email.com')}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">{t('auth.password', 'Şifre')}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder={t('auth.passwordPlaceholder', '••••••••')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {mfaRequired && (
              <div>
                <label htmlFor="totp" className="block text-sm font-semibold text-gray-700 mb-2">2FA Kodu</label>
                <input
                  id="totp"
                  name="totp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9A-Z]{6,8}"
                  value={mfaToken}
                  onChange={(e) => setMfaToken(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="6 haneli TOTP veya 8 karakter yedek kod"
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-500">Google Authenticator / 1Password kodunu girin.</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-600">{t('auth.rememberMe', 'Beni hatırla')}</span>
              </label>
              <button
                type="button"
                onClick={() => (window.location.hash = 'forgot-password')}
                className="text-sm text-blue-600 hover:text-blue-700 transition-colors font-medium"
              >
                {t('auth.forgotPassword', 'Şifremi unuttum')}
              </button>
            </div>

            {captchaRequired && (
              <div>
                <TurnstileCaptcha onToken={(t) => setCaptchaToken(t)} />
                <p className="text-xs text-gray-500 mt-1">{t('auth.captchaHint', 'Birden fazla başarısız giriş denemesi algılandı - lütfen insan doğrulamasını tamamlayın.')}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>{mfaRequired ? 'Doğrula ve Giriş Yap' : t('auth.signIn', 'Giriş Yap')}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

          </form>

          {error && (
            <div className="mt-4 flex items-center space-x-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              <span>{localizedError || error}</span>
              {isUnverifiedError && (
                <button
                  type="button"
                  disabled={resending}
                  onClick={handleResendVerification}
                  className="ml-auto text-blue-700 underline disabled:opacity-50"
                >
                  {resending ? t('common.loading', 'Yükleniyor...') : t('auth.resendVerification', 'Doğrulama e-postasını tekrar gönder')}
                </button>
              )}
            </div>
          )}

          {/* Demo hesap bilgileri kaldırıldı */}

          <div className="mt-6 space-y-3">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">{t('auth.or', 'veya')}</span>
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => window.location.href = '#admin'}
              className="w-full bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Building2 className="h-5 w-5" />
              {t('auth.adminLogin', 'Yönetici Girişi')}
            </button>
          </div>

          <div className="text-center mt-8">
            <p className="text-sm text-gray-600">
              {t('auth.noAccount', 'Hesabınız yok mu?')}{' '}
              <button 
                onClick={() => window.location.href = '#register'}
                className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
              >
                {t('auth.createFreeAccount', 'Ücretsiz hesap oluşturun')}
              </button>
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
