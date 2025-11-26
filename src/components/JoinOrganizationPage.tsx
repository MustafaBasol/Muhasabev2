import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Users, 
  ArrowRight,
  Home,
  Crown,
  Shield,
  User
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { organizationsApi, Invite } from '../api/organizations';
import TurnstileCaptcha from './TurnstileCaptcha';
import { safeLocalStorage, safeSessionStorage } from '../utils/localStorageSafe';

type ApiErrorPayload = {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    const payload = error as ApiErrorPayload;
    return payload.response?.data?.message || payload.message || fallback;
  }
  return fallback;
};

const safeInvoke = (action: () => void, context: string) => {
  try {
    action();
  } catch (invokeError) {
    if ((import.meta.env.MODE ?? 'production') !== 'production') {
      console.warn(`JoinOrganizationPage: ${context} failed`, invokeError);
    }
  }
};

// Ayrı alt bileşen: Şifre belirleme formu (hooks burada güvenli)
const InvitePasswordForm: React.FC<{
  invite: Invite;
  token: string;
  onJoinSuccess?: () => void;
}> = ({ invite, token, onJoinSuccess }) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const captchaRequiredMessage = t('auth.captchaRequired', 'Lütfen insan doğrulamasını tamamlayın');

  const handleSetPassword = async () => {
    if (!password || password.length < 6) {
      setError(t('auth.passwordTooShort', 'Şifre en az 8 karakter olmalıdır'));
      return;
    }
    if (!captchaToken) {
      setError(captchaRequiredMessage);
      return;
    }
    try {
      setSubmitting(true);
      await organizationsApi.completeInviteWithPassword(token, password, captchaToken);
      safeInvoke(
        () => safeSessionStorage.removeItem('pending_invite_token'),
        'remove pending_invite_token from sessionStorage',
      );
      safeInvoke(
        () => safeLocalStorage.removeItem('pending_invite_token'),
        'remove pending_invite_token from localStorage',
      );
      // Otomatik giriş yap
      try {
        const { authService } = await import('../api/auth');
        await authService.login({ email: invite.email, password });
        safeInvoke(
          () =>
            window.dispatchEvent(
              new CustomEvent('showToast', {
                detail: {
                  message: 'Davet kabul edildi. Hoş geldiniz!',
                  tone: 'success',
                },
              }),
            ),
          'dispatch invite success toast',
        );
        onJoinSuccess?.();
      } catch {
        // Login başarısız olursa login sayfasına yönlendir
        safeInvoke(
          () => safeSessionStorage.setItem('prefill_email', invite.email),
          'store prefill_email in sessionStorage',
        );
        safeInvoke(
          () => safeLocalStorage.setItem('prefill_email', invite.email),
          'store prefill_email in localStorage',
        );
        window.location.hash = 'login';
      }
    } catch (error: unknown) {
      const msg = getErrorMessage(error, t('common.error', 'İşlem başarısız'));
      setError(msg);
      const lowered = String(msg || '').toLowerCase();
      if (lowered.includes('human verification') || lowered.includes('captcha')) {
        setCaptchaToken(null);
        setCaptchaResetKey((prev) => prev + 1);
      }
      safeInvoke(
        () =>
          window.dispatchEvent(
            new CustomEvent('showToast', {
              detail: { message: msg, tone: 'error' },
            }),
          ),
        'dispatch invite error toast',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <Users className="w-16 h-16 text-blue-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Şifre Belirleyin</h2>
        <p className="text-gray-600 mb-6">{invite.email} için hesabınızı oluşturmak üzere bir şifre belirleyin. E-posta doğrulaması gerekmez.</p>

        <div className="text-left space-y-2 mb-4">
          <label className="block text-sm font-medium text-gray-700">Şifre</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="En az 6 karakter"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500"
            >
              {showPw ? 'Gizle' : 'Göster'}
            </button>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-2">{t('auth.captchaPrompt', 'Devam etmeden önce insan doğrulamasını tamamlayın.')}</p>
          <TurnstileCaptcha
            key={`invite-complete-${captchaResetKey}`}
            onToken={(t) => {
              setError(null);
              setCaptchaToken(t);
            }}
          />
        </div>

        <button
          onClick={handleSetPassword}
          disabled={submitting}
          className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Kaydediliyor...' : 'Hesap Oluştur ve Katıl'}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
};

interface JoinOrganizationPageProps {
  token: string;
  onJoinSuccess?: () => void;
  onNavigateHome?: () => void;
  onNavigateDashboard?: () => void;
}

const JoinOrganizationPage: React.FC<JoinOrganizationPageProps> = ({
  token,
  onJoinSuccess,
  onNavigateHome,
  onNavigateDashboard,
}) => {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const captchaRequiredMessage = t('auth.captchaRequired', 'Lütfen insan doğrulamasını tamamlayın.');
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
  const isCodespaceHost = typeof window !== 'undefined' && (window.location.hostname?.endsWith('.github.dev') || window.location.hostname?.endsWith('.githubpreview.dev') || window.location.hostname?.includes('.app.github.dev'));
  const captchaBypassAllowed =
    import.meta.env.VITE_CAPTCHA_DEV_BYPASS === 'true' ||
    (import.meta.env.MODE !== 'production' && isCodespaceHost);
  const skipHumanVerification = captchaBypassAllowed && (!siteKey || isCodespaceHost);
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [status, setStatus] = useState<'validating' | 'valid' | 'invalid' | 'expired' | 'accepting' | 'success' | 'error' | 'already_member'>('validating');
  const [error, setError] = useState<string | null>(null);
  const [humanToken, setHumanToken] = useState<string | null>(skipHumanVerification ? 'TURNSTILE_SKIPPED' : null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  const resetHumanCaptcha = useCallback(() => {
    setHumanToken(skipHumanVerification ? 'TURNSTILE_SKIPPED' : null);
    setCaptchaResetKey((prev) => prev + 1);
  }, [skipHumanVerification]);

  const validateToken = useCallback(async (turnstileToken?: string) => {
    if (!turnstileToken) {
      setCaptchaError(captchaRequiredMessage);
      return;
    }
    try {
      setLoading(true);
      setStatus('validating');
      setError(null);
      setCaptchaError(null);
      const result = await organizationsApi.validateInviteToken(token, turnstileToken);
      if (result.valid && result.invite) {
        setCaptchaError(null);
        setInvite(result.invite);

        const now = new Date();
        const expiresAt = new Date(result.invite.expiresAt);

        if (now > expiresAt) {
          setStatus('expired');
        } else if (result.invite.acceptedAt) {
          setStatus('already_member');
        } else {
          setStatus('valid');
        }
      } else {
        setStatus('invalid');
        setError(result.error || 'Invalid invite token');
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to validate invite token');
      const lowered = String(message || '').toLowerCase();
      if (lowered.includes('human verification') || lowered.includes('captcha')) {
        setCaptchaError(t('auth.captchaVerificationFailed', 'İnsan doğrulaması doğrulanamadı. Lütfen tekrar deneyin.'));
        resetHumanCaptcha();
        return;
      }
      setStatus('invalid');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [token, resetHumanCaptcha, captchaRequiredMessage, t]);

  useEffect(() => {
    if (!token || !humanToken) return;
    validateToken(humanToken);
  }, [token, humanToken, validateToken]);

  const handleAcceptInvite = async () => {
    if (!invite || !isAuthenticated) return;

    try {
      setStatus('accepting');
      
      await organizationsApi.acceptInvite({ token });
      
      setStatus('success');
      
      // Call success callback after a short delay
      setTimeout(() => {
        onJoinSuccess?.();
      }, 2000);
      
    } catch (error: unknown) {
      console.error('Failed to accept invite:', error);
      setStatus('error');
      setError(getErrorMessage(error, 'Failed to accept invitation'));
    }
  };

  const handleDeclineInvite = () => {
    // For now, just navigate away
    onNavigateHome?.();
  };

  const getRoleIcon = (role: 'OWNER' | 'ADMIN' | 'MEMBER') => {
    switch (role) {
      case 'OWNER':
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 'ADMIN':
        return <Shield className="w-5 h-5 text-blue-500" />;
      case 'MEMBER':
        return <User className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!humanToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <Shield className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('auth.captchaRequired', 'Lütfen insan doğrulamasını tamamlayın')}</h2>
          <p className="text-gray-600 mb-6">
            {t('auth.captchaPrompt', 'Daveti görmek için lütfen kısa doğrulamayı tamamlayın.')}
          </p>
          <TurnstileCaptcha
            key={`invite-validate-${captchaResetKey}`}
            onToken={(value) => {
              setCaptchaError(null);
              setHumanToken(value);
            }}
          />
          {captchaError && <p className="mt-4 text-sm text-red-600">{captchaError}</p>}
        </div>
      </div>
    );
  }

  if (loading || status === 'validating') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Davet kontrol ediliyor...
          </h2>
          <p className="text-gray-600">
            Lütfen bekleyin, davet bağlantınız doğrulanıyor.
          </p>
        </div>
      </div>
    );
  }

  // Invalid or expired invite
  if (status === 'invalid' || status === 'expired') {
    const isExpired = status === 'expired';
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {isExpired ? t('org.join.expired.title') : t('org.join.invalid.title')}
          </h2>
          <p className="text-gray-600 mb-6">
            {isExpired ? t('org.join.expired.subtitle') : t('org.join.invalid.subtitle')}
          </p>
          
          <button
            onClick={onNavigateHome}
            className="flex items-center justify-center space-x-2 w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>{isExpired ? t('org.join.expired.action') : t('org.join.invalid.action')}</span>
          </button>
          
          {error && (
            <p className="mt-4 text-sm text-red-600">{error}</p>
          )}
        </div>
      </div>
    );
  }

  // Already a member
  if (status === 'already_member') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <Users className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {t('org.join.alreadyMember.title')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('org.join.alreadyMember.subtitle')}
          </p>
          
          <button
            onClick={onNavigateDashboard}
            className="flex items-center justify-center space-x-2 w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>{t('org.join.alreadyMember.action')}</span>
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {t('org.join.success.title')}
          </h2>
          <p className="text-gray-600 mb-6">
            {invite && t('org.join.success.subtitle', { orgName: invite.organization.name })}
          </p>
          
          <button
            onClick={onNavigateDashboard}
            className="flex items-center justify-center space-x-2 w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>{t('org.join.success.action')}</span>
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {t('org.join.error.title')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('org.join.error.subtitle')}
          </p>
          
          <div className="space-y-3">
            <button
              onClick={handleAcceptInvite}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('org.join.error.tryAgain')}
            </button>
            <button
              onClick={onNavigateHome}
              className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Ana Sayfa
            </button>
          </div>
          
          {error && (
            <p className="mt-4 text-sm text-red-600">{error}</p>
          )}
        </div>
      </div>
    );
  }

  // Valid invite - show accept/decline options
  if (!isAuthenticated) {
    if (!invite) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div>Geçersiz davet veya yükleniyor...</div>
        </div>
      );
    }
    return <InvitePasswordForm invite={invite} token={token} onJoinSuccess={onJoinSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <Users className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {t('org.join.title')}
          </h2>
          {invite && (
            <p className="text-gray-600">
              {t('org.join.subtitle', { orgName: invite.organization.name })}
            </p>
          )}
        </div>

        {invite && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Organizasyon:</span>
                <span className="font-medium text-gray-900">{invite.organization.name}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Davet edilen e-posta:</span>
                <span className="font-medium text-gray-900">{invite.email}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{t('org.join.role')}:</span>
                <div className="flex items-center space-x-2">
                  {getRoleIcon(invite.role)}
                  <span className="font-medium text-gray-900">
                    {t(`org.members.roles.${invite.role}`)}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Son geçerlilik:</span>
                <span className="text-sm text-gray-900">{formatDate(invite.expiresAt)}</span>
              </div>
            </div>
          </div>
        )}

        {user && invite && user.email !== invite.email && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-800">
                  <strong>Uyarı:</strong> Bu davet {invite.email} adresine gönderilmiş, 
                  ancak siz {user.email} ile giriş yapmışsınız.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      safeInvoke(
                        () => safeSessionStorage.setItem('prefill_email', invite.email),
                        'store prefill_email before login redirect',
                      );
                      await logout();
                      try { window.location.hash = 'login'; } catch { window.location.href = '#login'; }
                    }}
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    {invite.email} ile giriş yap
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      safeInvoke(
                        () => safeSessionStorage.setItem('prefill_email', invite.email),
                        'store prefill_email before register redirect',
                      );
                      await logout();
                      try { window.location.hash = 'register'; } catch { window.location.href = '#register'; }
                    }}
                    className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
                  >
                    {invite.email} ile kayıt ol
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleAcceptInvite}
            disabled={status === 'accepting' || (user && invite && user.email !== invite.email)}
            className="flex items-center justify-center space-x-2 w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'accepting' ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            <span>
              {status === 'accepting' ? 'Katılıyor...' : t('org.join.accept')}
            </span>
          </button>
          
          <button
            onClick={handleDeclineInvite}
            disabled={status === 'accepting'}
            className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {t('org.join.decline')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinOrganizationPage;