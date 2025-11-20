import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, User, Building2, UserPlus, Phone, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import LegalHeader from './LegalHeader';
import TurnstileCaptcha from './TurnstileCaptcha';

export default function RegisterPage() {
  const { register, isLoading } = useAuth();
  const { t } = useTranslation();
  const [formData, setFormData] = useState(() => {
    let prefill = '';
    try { prefill = sessionStorage.getItem('prefill_email') || localStorage.getItem('prefill_email') || ''; } catch {}
    return {
      name: '',
      email: prefill,
      password: '',
      confirmPassword: '',
      company: '',
      phone: '',
      address: ''
    };
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [emailConflict, setEmailConflict] = useState<{ email: string } | null>(null);

  // Mount olduğunda eğer daha önce başlatılmış bir doğrulama süreci varsa banner'ı tekrar göster
  useEffect(() => {
    // Join sayfasından gelen e-posta prefill'i bir kez kullanıldıysa temizle
    try { sessionStorage.removeItem('prefill_email'); } catch {}
    try { localStorage.removeItem('prefill_email'); } catch {}
    try {
      const pending = sessionStorage.getItem('pending_verification_email');
      const verificationRequired = String(import.meta.env.VITE_EMAIL_VERIFICATION_REQUIRED || '').toLowerCase() === 'true';
      if (verificationRequired && pending) {
        setPendingVerificationEmail(pending);
        setSuccess('Hesabınız oluşturuldu. Lütfen e-postanızı kontrol edin ve doğrulama bağlantısına tıklayın.');
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setEmailConflict(null);
    
    // Form doğrulama
    if (!formData.name || !formData.email || !formData.password) {
      setError('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }

    if (formData.password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır');
      return;
    }

    if (!agreedToTerms) {
      setError('Kullanım Koşulları ve Gizlilik Politikasını kabul etmelisiniz');
      return;
    }

    try {
      // Kayıt işlemi
      const userData = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        company: formData.company,
        phone: formData.phone,
        address: formData.address,
        turnstileToken: captchaToken || undefined,
      };

      // Captcha zorunlu (site key yoksa bile sentinel token gelebilir). Site key yoksa bile backend secret yoksa fail-open.
      const siteKey = (import.meta as any).env?.VITE_TURNSTILE_SITE_KEY || '';
      if (siteKey && !captchaToken) {
        setError('Lütfen insan doğrulamasını tamamlayın');
        return;
      }
      
      await register(userData);
      const verificationRequired = String(import.meta.env.VITE_EMAIL_VERIFICATION_REQUIRED || '').toLowerCase() === 'true';
      if (verificationRequired) {
        setSuccess('Hesabınız oluşturuldu. Lütfen e-postanızı kontrol edin ve doğrulama bağlantısına tıklayın.');
        setPendingVerificationEmail(formData.email);
      } else {
        setSuccess('Hesabınız başarıyla oluşturuldu! Giriş yapabilirsiniz.');
      }
      
      // Eğer doğrulama gerekli değilse 2 saniye sonra login'e yönlendir
      if (!verificationRequired) {
        setTimeout(() => {
          window.location.href = '#login';
        }, 2000);
      } else {
        // Doğrulama gerekiyorsa success banner kalıcı; isteğe bağlı verify-notice sayfasına yönlendirme butonu sunacağız
      }
      
    } catch (error: any) {
      // 409 (Conflict) -> email zaten kayıtlı kullanıcı dostu akış
      const status = error?.response?.status ?? error?.status;
      const messageRaw = error?.response?.data?.message || error?.message || '';
      const lowered = String(messageRaw).toLowerCase();
      if (status === 409 || messageRaw === 'EMAIL_IN_USE' || lowered.includes('already exists') || lowered.includes('zaten')) {
        setEmailConflict({ email: formData.email });
        // Kullanıcıya hata blokunu değil yönlendirici rehberi göstereceğiz
      } else {
        setError(messageRaw || 'Kayıt sırasında bir hata oluştu');
      }
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
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                <UserPlus className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('auth.registerTitle', 'Hesap Oluştur')}</h1>
            <p className="text-gray-600">{t('auth.registerSubtitle', 'Ücretsiz hesabınızı oluşturun ve hemen başlayın')}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && !emailConflict && (
              <div className="flex items-center space-x-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                <span>{error}</span>
              </div>
            )}
            {emailConflict && (
              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-semibold">Bu e-posta ile zaten bir hesap var: <span className="underline">{emailConflict.email}</span></p>
                <p>Nasıl devam etmek istersiniz?</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Şifrenizi biliyorsanız <button type="button" onClick={() => (window.location.hash = 'login')} className="text-blue-600 hover:text-blue-700 font-medium underline">Giriş yapın</button>
                  </li>
                  <li>
                    Şifrenizi hatırlamıyorsanız <button type="button" onClick={() => (window.location.hash = 'forgot-password')} className="text-blue-600 hover:text-blue-700 font-medium underline">Şifre sıfırlama bağlantısı isteyin</button>
                  </li>
                  <li>
                    Farklı bir hesap oluşturmak istiyorsanız başka bir e-posta adresiyle tekrar deneyin.
                  </li>
                </ul>
                <div className="text-xs text-amber-700 pt-1">Güvenlik için hangi e-postaların kayıtlı olduğunu açıkça göstermiyoruz; bu uyarı sizin girdinizden yola çıkarak gösterilir.</div>
              </div>
            )}
            
            {success && (
              <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <div className="flex-1">
                    <p className="font-semibold">{success}</p>
                    {pendingVerificationEmail && (
                      <p className="text-xs mt-1">Gönderilen adres: <span className="font-mono">{pendingVerificationEmail}</span></p>
                    )}
                  </div>
                </div>
                {pendingVerificationEmail && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => (window.location.hash = 'verify-notice')}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Doğrulama Durumunu Gör
                    </button>
                    <button
                      type="button"
                      disabled={resendCooldown>0 || resendLoading}
                      onClick={async () => {
                        if (!pendingVerificationEmail || resendCooldown>0) return;
                        setResendLoading(true);
                        try {
                          await import('../api/auth').then(m => m.authService.resendVerification(pendingVerificationEmail));
                          setResendCooldown(60);
                        } catch { setResendCooldown(60); }
                        finally { setResendLoading(false); }
                      }}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed bg-white text-gray-700 hover:bg-gray-50 border-gray-300"
                    >
                      {resendLoading ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/> : <RefreshCw className="h-4 w-4"/>}
                      {resendCooldown>0 ? `Tekrar gönder (${resendCooldown}s)` : 'Tekrar Gönder'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Ad Soyad */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('auth.fullName', 'Ad Soyad')} *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder={t('auth.fullNamePlaceholder', 'Adınızı ve soyadınızı girin')}
                  required
                />
              </div>
            </div>

            {/* E-posta */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('auth.emailAddress', 'E-posta Adresi')} *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={Boolean(sessionStorage.getItem('pending_invite_token') || localStorage.getItem('pending_invite_token'))}
                  className={`w-full pl-10 pr-4 py-3 border ${(sessionStorage.getItem('pending_invite_token') || localStorage.getItem('pending_invite_token')) ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'border-gray-300'} rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                  placeholder={t('auth.emailPlaceholder', 'ornek@email.com')}
                  required
                />
              </div>
            </div>

            {/* Şirket */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('auth.companyName', 'Şirket Adı')}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder={t('auth.companyPlaceholder', 'Şirket adınız (opsiyonel)')}
                />
              </div>
            </div>

            {/* Telefon */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('auth.phone', 'Telefon')}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder={t('auth.phonePlaceholder', '0555 123 45 67 (opsiyonel)')}
                />
              </div>
            </div>

            {/* Şifre */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('auth.password', 'Şifre')} *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder={t('auth.passwordHint', 'En az 6 karakter')}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Şifre Onay */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('auth.passwordConfirm', 'Şifre Onayı')} *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder={t('auth.passwordConfirmPlaceholder', 'Şifrenizi tekrar girin')}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Turnstile Captcha */}
            <div>
              <TurnstileCaptcha onToken={(t) => setCaptchaToken(t)} />
            </div>

            {/* Terms and Privacy Checkbox */}
            <div className="flex items-start space-x-3">
              <input
                id="terms-checkbox"
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="terms-checkbox" className="text-sm text-gray-600 leading-5">
                {t('auth.termsText.prefix', 'Şunları kabul ederim: ')}
                <a href="#legal/terms" target="_blank" className="text-blue-600 hover:text-blue-700 underline transition-colors">{t('footer.terms', 'Hizmet Şartları')}</a>
                {t('auth.and', ' ve ')}
                <a href="#legal/dpa" target="_blank" className="text-blue-600 hover:text-blue-700 underline transition-colors">{t('auth.dataProcessing', 'Veri İşleme Sözleşmesi')}</a>
                {t('auth.and', ' ve ')}
                <a href="#legal/privacy" target="_blank" className="text-blue-600 hover:text-blue-700 underline transition-colors">{t('footer.privacy', 'Gizlilik Politikası')}</a>
                {t('auth.and', ' ve ')}
                <a href="#legal/cookies" target="_blank" className="text-blue-600 hover:text-blue-700 underline transition-colors">{t('footer.cookies', 'Çerez Politikası')}</a>
                {t('auth.termsText.suffix', ' belgelerini okudum.')}            
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>{t('auth.registerCta', 'Hesap Oluştur')}</span>
                </>
              )}
            </button>
          </form>

          <div className="text-center mt-8">
            <p className="text-sm text-gray-600">
              {t('auth.alreadyHaveAccount', 'Zaten hesabınız var mı?')}{' '}
              <button 
                onClick={() => window.location.href = '#login'}
                className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
              >
                {t('auth.goToLogin', 'Giriş yapın')}
              </button>
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}