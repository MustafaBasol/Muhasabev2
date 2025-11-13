import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, UserPlus } from 'lucide-react';
import { organizationsApi, InviteMemberData, MembershipStats } from '../api/organizations';
import { useAuth } from '../contexts/AuthContext';

interface InviteFormProps {
  organizationId: string;
  currentUserRole: 'OWNER' | 'ADMIN' | 'MEMBER';
  onInviteSent: () => void;
  membershipStats: MembershipStats;
}

const InviteForm: React.FC<InviteFormProps> = ({
  organizationId,
  currentUserRole,
  onInviteSent,
  membershipStats,
}) => {
  const { t } = useTranslation();
  const { tenant, refreshUser } = useAuth(); // tenant ve refreshUser ileride tekrar deneme/senkron için kullanılacak
  const tt = (key: string, fallback: string) => {
    const v = t(key);
    return v && v !== key ? v : fallback;
  };
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<InviteMemberData>({
    email: '',
    role: 'MEMBER',
  });

  const canInvite = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canInvite) {
      return;
    }

    // Check plan limits
    if (!membershipStats.canAddMore) {
      const errorEvent = new CustomEvent('showToast', {
        detail: { 
          message: t('org.members.invite.limitReached'), 
          tone: 'error' 
        }
      });
      window.dispatchEvent(errorEvent);
      return;
    }

    setLoading(true);
    
    const attemptInvite = async () => {
      await organizationsApi.inviteMember(organizationId, formData);
    };
    try {
      try {
        await attemptInvite();
      } catch (err: any) {
        // Plan limiti / senkron gecikmesi kaynaklı 400 ise bir kez sync edip yeniden dene
        const status = err?.response?.status;
        const msg: string = err?.response?.data?.message || '';
        const looksLimit = status === 400 && /limit|plan|member|STARTER/i.test(msg);
        if (looksLimit) {
          try {
            const tenantId = String((tenant as any)?.id || localStorage.getItem('tenantId') || '');
            if (tenantId) {
              const { syncSubscription } = await import('../api/billing');
              await syncSubscription(tenantId);
              await refreshUser();
            }
            await attemptInvite(); // ikinci deneme
          } catch {
            throw err; // orijinal hatayı fırlat
          }
        } else {
          throw err;
        }
      }
      
      // Reset form
      setFormData({ email: '', role: 'MEMBER' });
      setIsOpen(false);
      
      // Notify parent component
      onInviteSent();
      
      // Show success message
      const successEvent = new CustomEvent('showToast', {
        detail: { message: t('org.members.invite.success'), tone: 'success' }
      });
      window.dispatchEvent(successEvent);
    } catch (error: any) {
      console.error('Failed to send invite:', error);
      
      let errorMessage = t('org.members.invite.error');
      
      if (error.response?.status === 409) {
        errorMessage = t('org.members.invite.duplicate');
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      const errorEvent = new CustomEvent('showToast', {
        detail: { message: errorMessage, tone: 'error' }
      });
      window.dispatchEvent(errorEvent);
    } finally {
      setLoading(false);
    }
  };



  const availableRoles = currentUserRole === 'OWNER' 
    ? ['MEMBER', 'ADMIN'] as const
    : ['MEMBER'] as const;

  if (!canInvite) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            {t('org.members.invite.title')}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {membershipStats.currentMembers} / {membershipStats.maxMembers === -1 ? '∞' : membershipStats.maxMembers} {t('org.members.membersLabel')}
            <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
              {membershipStats.plan}
            </span>
          </p>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={!membershipStats.canAddMore}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            membershipStats.canAddMore
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          title={!membershipStats.canAddMore ? tt('org.members.invite.limitReached', 'Üye limiti dolu') : ''}
        >
          <UserPlus className="w-4 h-4" />
          <span>
            {!membershipStats.canAddMore 
              ? tt('org.members.limitFull', 'Üye limiti dolu')
              : tt('org.members.invite.button', 'Üye Davet Et')
            }
          </span>
        </button>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className="space-y-4 border-t border-gray-200 pt-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              {tt('org.members.invite.form.email', 'E-posta Adresi')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                id="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder={tt('org.members.invite.form.emailPlaceholder', 'E-posta adresi')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              {tt('org.members.invite.form.role', 'Rol')}
            </label>
            <select
              id="role"
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'OWNER' | 'ADMIN' | 'MEMBER' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {tt(`org.members.roles.${role}` as any, role === 'ADMIN' ? 'Yönetici' : role === 'MEMBER' ? 'Üye' : role)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {tt('org.members.cancel', 'İptal')}
            </button>
            <button
              type="submit"
              disabled={loading || !formData.email.trim()}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              <span>{loading ? tt('org.members.sending', 'Gönderiliyor…') : tt('org.members.inviteButton', 'Davet Gönder')}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default InviteForm;