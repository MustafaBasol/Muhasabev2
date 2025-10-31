import React, { useState, useEffect } from 'react';
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
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [status, setStatus] = useState<'validating' | 'valid' | 'invalid' | 'expired' | 'accepting' | 'success' | 'error' | 'already_member'>('validating');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      setLoading(true);
      setStatus('validating');
      
      const result = await organizationsApi.validateInviteToken(token);
      
      if (result.valid && result.invite) {
        setInvite(result.invite);
        
        // Check if invite is expired
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
    } catch (error: any) {
      console.error('Token validation failed:', error);
      setStatus('invalid');
      setError(error.response?.data?.message || 'Failed to validate invite token');
    } finally {
      setLoading(false);
    }
  };

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
      
    } catch (error: any) {
      console.error('Failed to accept invite:', error);
      setStatus('error');
      setError(error.response?.data?.message || 'Failed to accept invitation');
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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <Users className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Giriş Yapın
          </h2>
          <p className="text-gray-600 mb-6">
            Daveti kabul etmek için önce giriş yapmanız gerekiyor.
          </p>
          
          <button
            onClick={onNavigateHome}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Giriş Yap
          </button>
        </div>
      </div>
    );
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
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleAcceptInvite}
            disabled={status === 'accepting'}
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