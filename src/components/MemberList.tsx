import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
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
  const { t, i18n } = useTranslation();
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [menuPositions, setMenuPositions] = useState<Record<string, { top: number; left: number; upward: boolean }>>({});

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
    const btn = menuButtonRefs.current[memberId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const menuWidth = 192;
      const menuHeight = 200;
      const upward = window.innerHeight - rect.bottom < menuHeight + 16;
      // Fixed menü viewport koordinatlarında çalışır; scrollY eklenmez.
      const top = upward ? rect.top - menuHeight : rect.bottom;
      let left = rect.right - menuWidth; // sağa hizala
      if (left < 8) left = 8;
      if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
      setMenuPositions(prev => ({ ...prev, [memberId]: { top, left, upward } }));
    }
  };

  // Dış tıklama ile menüyü kapat
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (Object.values(openMenus).every(v => !v)) return;
      const target = e.target as HTMLElement;
      const anyButton = Object.keys(menuButtonRefs.current).some(id => {
        const btn = menuButtonRefs.current[id];
        return btn && (btn === target || btn.contains(target));
      });
      if (anyButton) return; // butona tıklama
      // Portal menüsünün içinde mi?
      const portalMenu = document.querySelector('.member-menu-portal');
      if (portalMenu && (portalMenu === target || portalMenu.contains(target))) return;
      setOpenMenus({});
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [openMenus]);

  // Scroll/resize olduğunda açık menülerin pozisyonunu güncelle
  useEffect(() => {
    const updatePositions = () => {
      Object.keys(openMenus).forEach(id => {
        if (!openMenus[id]) return;
        const btn = menuButtonRefs.current[id];
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        const menuHeight = 200;
        const upward = window.innerHeight - rect.bottom < menuHeight + 16;
        const top = upward ? rect.top - menuHeight : rect.bottom;
        let left = rect.right - 192;
        if (left < 8) left = 8;
        if (left + 192 > window.innerWidth - 8) left = window.innerWidth - 192 - 8;
        setMenuPositions(prev => ({ ...prev, [id]: { top, left, upward } }));
      });
    };
    if (Object.values(openMenus).some(v => v)) {
      window.addEventListener('scroll', updatePositions, true);
      window.addEventListener('resize', updatePositions);
    }
    return () => {
      window.removeEventListener('scroll', updatePositions, true);
      window.removeEventListener('resize', updatePositions);
    };
  }, [openMenus]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : i18n.language === 'de' ? 'de-DE' : i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('org.members.table.lastLogin')}
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
                            <span className="ml-2 text-xs text-gray-500">({t('org.members.youLabel')})</span>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {member.user.lastLoginAt
                      ? new Date(member.user.lastLoginAt).toLocaleString(
                          i18n.language === 'tr'
                            ? 'tr-TR'
                            : i18n.language === 'de'
                            ? 'de-DE'
                            : i18n.language === 'fr'
                            ? 'fr-FR'
                            : 'en-US',
                        )
                      : <span className="text-gray-400">-</span>}
                  </td>
                  {canManageMembers && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {canManageThisMember ? (
                        <div className="inline-block">
                          <button
                            ref={el => { menuButtonRefs.current[member.id] = el; }}
                            onClick={() => toggleMenu(member.id)}
                            disabled={loadingActions[member.id]}
                            className="text-gray-400 hover:text-gray-500 p-1 rounded"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openMenus[member.id] && menuPositions[member.id] && ReactDOM.createPortal(
                            <div
                              className="member-menu-portal fixed w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50"
                              style={{ top: menuPositions[member.id].top, left: menuPositions[member.id].left }}
                            >
                              <div className="py-1">
                                {/* Role Change Options */}
                                {member.role !== 'ADMIN' && currentUserRole === 'OWNER' && (
                                  <button
                                    onClick={() => handleRoleChange(member, 'ADMIN')}
                                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    <Shield className="w-4 h-4 mr-2 text-blue-500" />
                                    {t('org.members.makeAdmin')}
                                  </button>
                                )}
                                {member.role !== 'MEMBER' && (
                                  <button
                                    onClick={() => handleRoleChange(member, 'MEMBER')}
                                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    <User className="w-4 h-4 mr-2 text-gray-500" />
                                    {t('org.members.makeMember')}
                                  </button>
                                )}
                                
                                {/* Remove Member */}
                                <button
                                  onClick={() => handleRemoveMember(member)}
                                  className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                                >
                                  <UserMinus className="w-4 h-4 mr-2 text-red-500" />
                                  {t('org.members.remove.title')}
                                </button>
                              </div>
                            </div>,
                            document.body
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