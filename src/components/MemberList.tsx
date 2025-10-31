import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Crown, Shield, User, MoreVertical, UserMinus } from 'lucide-react';
import { OrganizationMember, organizationsApi } from '../api/organizations';

interface MemberListProps {
  members: OrganizationMember[];
  organizationId: string;
  currentUserRole: 'OWNER' | 'ADMIN' | 'MEMBER';
  currentUserId: string;
  onMemberRemoved: (memberId: string) => void;
  onMemberRoleUpdated: (memberId: string, newRole: 'OWNER' | 'ADMIN' | 'MEMBER') => void;
}

const MemberList: React.FC<MemberListProps> = ({
  members,
  organizationId,
  currentUserRole,
  currentUserId,
  onMemberRemoved,
  onMemberRoleUpdated,
}) => {
  const { t } = useTranslation();
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const canManageMembers = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';

  const getRoleIcon = (role: 'OWNER' | 'ADMIN' | 'MEMBER') => {
    switch (role) {
      case 'OWNER':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'ADMIN':
        return <Shield className="w-4 h-4 text-blue-500" />;
      case 'MEMBER':
        return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleBadgeClass = (role: 'OWNER' | 'ADMIN' | 'MEMBER') => {
    switch (role) {
      case 'OWNER':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'MEMBER':
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleRemoveMember = async (member: OrganizationMember) => {
    if (member.role === 'OWNER') {
      alert(t('org.members.remove.cannotRemoveOwner'));
      return;
    }

    const confirmed = window.confirm(
      t('org.members.remove.message', { name: `${member.user.firstName} ${member.user.lastName}` })
    );

    if (!confirmed) return;

    setLoadingActions(prev => ({ ...prev, [member.id]: true }));
    
    try {
      await organizationsApi.removeMember(organizationId, member.id);
      onMemberRemoved(member.id);
      
      // Show success message
      const successEvent = new CustomEvent('showToast', {
        detail: { message: t('org.members.remove.success'), tone: 'success' }
      });
      window.dispatchEvent(successEvent);
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      const errorEvent = new CustomEvent('showToast', {
        detail: { 
          message: error.response?.data?.message || t('org.members.remove.error'), 
          tone: 'error' 
        }
      });
      window.dispatchEvent(errorEvent);
    } finally {
      setLoadingActions(prev => ({ ...prev, [member.id]: false }));
      setOpenMenus(prev => ({ ...prev, [member.id]: false }));
    }
  };

  const handleRoleChange = async (member: OrganizationMember, newRole: 'OWNER' | 'ADMIN' | 'MEMBER') => {
    if (member.role === newRole) return;

    setLoadingActions(prev => ({ ...prev, [member.id]: true }));
    
    try {
      await organizationsApi.updateMemberRole(organizationId, member.id, { role: newRole });
      onMemberRoleUpdated(member.id, newRole);
      
      const successEvent = new CustomEvent('showToast', {
        detail: { message: t('org.members.updateRole.success'), tone: 'success' }
      });
      window.dispatchEvent(successEvent);
    } catch (error: any) {
      console.error('Failed to update member role:', error);
      const errorEvent = new CustomEvent('showToast', {
        detail: { 
          message: error.response?.data?.message || t('org.members.updateRole.error'), 
          tone: 'error' 
        }
      });
      window.dispatchEvent(errorEvent);
    } finally {
      setLoadingActions(prev => ({ ...prev, [member.id]: false }));
      setOpenMenus(prev => ({ ...prev, [member.id]: false }));
    }
  };

  const toggleMenu = (memberId: string) => {
    setOpenMenus(prev => ({ ...prev, [memberId]: !prev[memberId] }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (members.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {t('org.members.empty.title')}
        </h3>
        <p className="text-gray-500">
          {t('org.members.empty.subtitle')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('org.members.table.name')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('org.members.table.email')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('org.members.table.role')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('org.members.table.joinedAt')}
              </th>
              {canManageMembers && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('org.members.table.actions')}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {members.map((member) => {
              const isCurrentUser = member.user.id === currentUserId;
              const canManageThisMember = canManageMembers && !isCurrentUser && member.role !== 'OWNER';
              
              return (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {(member.user.firstName?.[0] || '') + (member.user.lastName?.[0] || '')}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {member.user.firstName} {member.user.lastName}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-gray-500">(Siz)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{member.user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getRoleIcon(member.role)}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeClass(member.role)}`}>
                        {t(`org.members.roles.${member.role}`)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(member.createdAt)}
                  </td>
                  {canManageMembers && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {canManageThisMember ? (
                        <div className="relative">
                          <button
                            onClick={() => toggleMenu(member.id)}
                            disabled={loadingActions[member.id]}
                            className="text-gray-400 hover:text-gray-500 p-1 rounded"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          
                          {openMenus[member.id] && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-10">
                              <div className="py-1">
                                {/* Role Change Options */}
                                {member.role !== 'ADMIN' && currentUserRole === 'OWNER' && (
                                  <button
                                    onClick={() => handleRoleChange(member, 'ADMIN')}
                                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    <Shield className="w-4 h-4 mr-2 text-blue-500" />
                                    Yönetici Yap
                                  </button>
                                )}
                                {member.role !== 'MEMBER' && (
                                  <button
                                    onClick={() => handleRoleChange(member, 'MEMBER')}
                                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    <User className="w-4 h-4 mr-2 text-gray-500" />
                                    Üye Yap
                                  </button>
                                )}
                                
                                {/* Remove Member */}
                                <button
                                  onClick={() => handleRemoveMember(member)}
                                  className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                                >
                                  <UserMinus className="w-4 h-4 mr-2 text-red-500" />
                                  Çıkar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MemberList;