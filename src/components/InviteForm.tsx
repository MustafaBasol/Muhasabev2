import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, UserPlus } from 'lucide-react';
import { organizationsApi, InviteMemberData, MembershipStats } from '../api/organizations';

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
    
    try {
      await organizationsApi.inviteMember(organizationId, formData);
      
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
          title={!membershipStats.canAddMore ? t('org.members.invite.limitReached') : ''}
        >
          <UserPlus className="w-4 h-4" />
          <span>
            {!membershipStats.canAddMore 
              ? t('org.members.limitFull')
              : t('org.members.invite.button')
            }
          </span>
        </button>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className="space-y-4 border-t border-gray-200 pt-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              {t('org.members.invite.form.email')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                id="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder={t('org.members.invite.form.emailPlaceholder')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              {t('org.members.invite.form.role')}
            </label>
            <select
              id="role"
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'OWNER' | 'ADMIN' | 'MEMBER' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {t(`org.members.roles.${role}`)}
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
              {t('org.members.cancel')}
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
              <span>{loading ? t('org.members.sending') : t('org.members.inviteButton')}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default InviteForm;