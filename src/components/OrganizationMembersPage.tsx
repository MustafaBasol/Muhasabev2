import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Clock, Mail, RotateCcw, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import MemberList from './MemberList';
import InviteForm from './InviteForm';
import { 
  organizationsApi, 
  OrganizationMember, 
  Invite, 
  Organization,
  MembershipStats 
} from '../api/organizations';

const OrganizationMembersPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'OWNER' | 'ADMIN' | 'MEMBER'>('MEMBER');
  const [membershipStats, setMembershipStats] = useState<MembershipStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Loading organization data...');

      // Get user's organizations (for now, get the first one)
      const organizations = await organizationsApi.getAll();
      console.log('📊 Organizations received:', organizations);

      if (!organizations || organizations.length === 0) {
        console.log('❌ No organizations found');
        setError('No organization found');
        return;
      }

      const org = organizations[0]; // Use first organization for now
      console.log('✅ Selected organization:', org);

      if (!org || !org.id) {
        console.error('❌ Invalid organization object:', org);
        setError('Invalid organization data');
        return;
      }

      setCurrentOrganization(org);

      console.log('🔄 Loading members, invites, and stats for org:', org.id);

      // Get members, pending invites, and membership stats in parallel
      const [membersData, invitesData, statsData] = await Promise.all([
        organizationsApi.getMembers(org.id),
        organizationsApi.getPendingInvites(org.id),
        organizationsApi.getMembershipStats(org.id)
      ]);

      console.log('✅ Data loaded successfully:', {
        members: membersData.length,
        invites: invitesData.length,
        stats: statsData
      });

      setMembers(membersData);
      setPendingInvites(invitesData);
      setMembershipStats(statsData);

      // Find current user's role
      const currentMember = membersData.find(m => m.user.id === user?.id);
      if (currentMember) {
        setCurrentUserRole(currentMember.role);
        console.log('✅ Current user role:', currentMember.role);
      }

    } catch (error: any) {
      console.error('❌ Failed to load organization data:', error);
      setError(error.response?.data?.message || 'Failed to load organization data');
    } finally {
      setLoading(false);
    }
  };

  const handleMemberRemoved = (memberId: string) => {
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const handleMemberRoleUpdated = (memberId: string, newRole: 'OWNER' | 'ADMIN' | 'MEMBER') => {
    setMembers(prev => prev.map(m => 
      m.id === memberId ? { ...m, role: newRole } : m
    ));
  };

  const handleInviteSent = () => {
    // Reload pending invites and membership stats
    if (currentOrganization) {
      Promise.all([
        organizationsApi.getPendingInvites(currentOrganization.id),
        organizationsApi.getMembershipStats(currentOrganization.id)
      ])
        .then(([invites, stats]) => {
          setPendingInvites(invites);
          setMembershipStats(stats);
        })
        .catch(console.error);
    }
  };

  const handleResendInvite = async (invite: Invite) => {
    if (!currentOrganization) return;

    try {
      await organizationsApi.resendInvite(currentOrganization.id, invite.id);
      
      const successEvent = new CustomEvent('showToast', {
        detail: { message: t('org.members.pendingInvites.resendSuccess'), tone: 'success' }
      });
      window.dispatchEvent(successEvent);
    } catch (error: any) {
      console.error('Failed to resend invite:', error);
      const errorEvent = new CustomEvent('showToast', {
        detail: { 
          message: error.response?.data?.message || 'Failed to resend invite', 
          tone: 'error' 
        }
      });
      window.dispatchEvent(errorEvent);
    }
  };

  const handleCancelInvite = async (invite: Invite) => {
    if (!currentOrganization) return;

    const confirmed = window.confirm(`${invite.email} adresine gönderilen daveti iptal etmek istediğinizden emin misiniz?`);
    if (!confirmed) return;

    try {
      await organizationsApi.cancelInvite(currentOrganization.id, invite.id);
      setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
      
      const successEvent = new CustomEvent('showToast', {
        detail: { message: t('org.members.pendingInvites.cancelSuccess'), tone: 'success' }
      });
      window.dispatchEvent(successEvent);
    } catch (error: any) {
      console.error('Failed to cancel invite:', error);
      const errorEvent = new CustomEvent('showToast', {
        detail: { 
          message: error.response?.data?.message || 'Failed to cancel invite', 
          tone: 'error' 
        }
      });
      window.dispatchEvent(errorEvent);
    }
  };

  const formatExpiryDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Hata</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              {t('org.members.tryAgain')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <Users className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              {t('org.members.title')}
            </h1>
          </div>
          <p className="text-gray-600">
            {t('org.members.subtitle')}
          </p>
          {currentOrganization && membershipStats && (
            <div className="mt-4 flex items-center space-x-6 text-sm text-gray-500">
              <span>{t('org.members.organization')}: <strong>{currentOrganization.name}</strong></span>
              <span>
                {t('org.members.membersLabel')}: <strong>{membershipStats.currentMembers}</strong>
                {membershipStats.maxMembers !== -1 && (
                  <span> / {membershipStats.maxMembers}</span>
                )}
              </span>
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                {membershipStats.plan} {t('org.members.plan')}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-8">
          {/* Invite Form */}
          {currentOrganization && membershipStats && (
            <InviteForm
              organizationId={currentOrganization.id}
              currentUserRole={currentUserRole}
              onInviteSent={handleInviteSent}
              membershipStats={membershipStats}
            />
          )}

          {/* Pending Invites */}
          {pendingInvites.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Clock className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-medium text-gray-900">
                  {t('org.members.pendingInvites.title')}
                </h3>
                <span className="text-sm text-gray-500">
                  ({t('org.members.pendingInvites.count', { count: pendingInvites.length })})
                </span>
              </div>
              
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Mail className="w-4 h-4 text-orange-600" />
                      <div>
                        <div className="font-medium text-gray-900">{invite.email}</div>
                        <div className="text-sm text-gray-500">
                          {t(`org.members.roles.${invite.role}`)} • {t('org.members.pendingInvites.expires', { 
                            date: formatExpiryDate(invite.expiresAt) 
                          })}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleResendInvite(invite)}
                        className="flex items-center space-x-1 px-3 py-1 text-sm text-orange-700 bg-orange-100 rounded hover:bg-orange-200 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{t('org.members.pendingInvites.resend')}</span>
                      </button>
                      <button
                        onClick={() => handleCancelInvite(invite)}
                        className="flex items-center space-x-1 px-3 py-1 text-sm text-red-700 bg-red-100 rounded hover:bg-red-200 transition-colors"
                      >
                        <X className="w-3 h-3" />
                        <span>{t('org.members.pendingInvites.cancel')}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Member List */}
          {currentOrganization && user && (
            <MemberList
              members={members}
              organizationId={currentOrganization.id}
              currentUserRole={currentUserRole}
              currentUserId={user.id}
              onMemberRemoved={handleMemberRemoved}
              onMemberRoleUpdated={handleMemberRoleUpdated}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default OrganizationMembersPage;