import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../api/admin';
import { Users, Shield, Crown, UserCog, Trash2, RefreshCw, Mail, type LucideIcon } from 'lucide-react';

type Role = 'owner' | 'admin' | 'member' | 'viewer' | string;

type Organization = { id: string; name: string };
type Member = { id: string; role: Role; user?: { firstName?: string; lastName?: string; email?: string } };
type Invite = { id: string; email: string; role: Role; createdAt: string };

export default function OrganizationManagementPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getErrMsg = (err: unknown) => {
    if (err && typeof err === 'object') {
      const maybe = err as { message?: string };
      if (typeof maybe.message === 'string') return maybe.message;
    }
    return '';
  };

  const loadOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      const orgs = await adminApi.listOrganizations();
      setOrganizations(orgs || []);
      if (orgs && orgs.length > 0) {
        setSelectedOrgId(orgs[0].id);
      }
    } catch (e: unknown) {
      show('error', 'Organizasyonlar yüklenemedi: ' + getErrMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);


  

  const loadMembers = useCallback(async (orgId: string) => {
    try {
      setLoading(true);
      const data = await adminApi.getOrganizationMembers(orgId);
      setMembers(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      show('error', 'Üyeler yüklenemedi: ' + getErrMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  

  const loadInvites = useCallback(async (orgId: string) => {
    try {
      const data = await adminApi.getOrganizationInvites(orgId);
      setInvites(Array.isArray(data) ? data : []);
    } catch {
      /* optional endpoint */
    }
  }, []);

  // Seçili organizasyon değiştiğinde, üyeleri ve davetleri yükle
  useEffect(() => {
    if (selectedOrgId) {
      loadMembers(selectedOrgId);
      loadInvites(selectedOrgId);
    }
  }, [loadInvites, loadMembers, selectedOrgId]);

  const show = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const onChangeRole = async (memberId: string, role: Role) => {
    if (!selectedOrgId) return;
    try {
      setLoading(true);
      await adminApi.updateMemberRole(selectedOrgId, memberId, role);
      await loadMembers(selectedOrgId);
      show('success', 'Üye rolü güncellendi');
    } catch (e: unknown) {
      show('error', 'Rol güncellenemedi: ' + getErrMsg(e));
    } finally {
      setLoading(false);
    }
  };

  const onRemoveMember = async (memberId: string) => {
    if (!selectedOrgId) return;
    if (!confirm('Bu üyeyi organizasyondan çıkarmak istiyor musunuz?')) return;
    try {
      setLoading(true);
      await adminApi.removeMember(selectedOrgId, memberId);
      await loadMembers(selectedOrgId);
      show('success', 'Üye kaldırıldı');
    } catch (e: unknown) {
      show('error', 'Üye kaldırılamadı: ' + getErrMsg(e));
    } finally {
      setLoading(false);
    }
  };

  const roleBadge = (role: Role) => {
    const base = 'px-2 py-0.5 rounded-full text-xs font-medium';
    if (role === 'owner') return <span className={`${base} bg-yellow-100 text-yellow-800`}>Sahip</span>;
    if (role === 'admin') return <span className={`${base} bg-blue-100 text-blue-800`}>Admin</span>;
    if (role === 'member') return <span className={`${base} bg-green-100 text-green-800`}>Üye</span>;
    if (role === 'viewer') return <span className={`${base} bg-gray-100 text-gray-800`}>İzleyici</span>;
    return <span className={`${base} bg-purple-100 text-purple-800`}>{role}</span>;
  };

  const roleOptions: { value: Role; label: string; icon: LucideIcon }[] = useMemo(() => ([
    { value: 'owner', label: 'Sahip', icon: Crown },
    { value: 'admin', label: 'Admin', icon: Shield },
    { value: 'member', label: 'Üye', icon: Users },
    { value: 'viewer', label: 'İzleyici', icon: UserCog },
  ]), []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-7 h-7 text-blue-600" />
            Üyelik Yönetimi
          </h2>
          <p className="text-gray-600">Organizasyon üyelerini görüntüleyin ve yönetin</p>
          <div className="mt-3 p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-900 text-sm">
            Yardım: Bu sayfadan seçili organizasyonun üyelerini ve rollerini yönetebilirsiniz. Rol değiştirmek için açılır menüyü kullanın; bir üyeyi kaldırmak için “Kaldır” butonuna basın (onay istenir). Sağdaki “Bekleyen Davetler” bölümünde gönderilmiş davetleri görürsünüz.
          </div>
        </div>
        <button onClick={() => {
          if (selectedOrgId) {
            loadMembers(selectedOrgId);
            loadInvites(selectedOrgId);
          }
        }}
          className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Yenile
        </button>
      </div>

      {message && (
        <div className={`p-3 rounded-lg border ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Organizasyon:</span>
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Members */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Üyeler ({members.length})</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {members.map((m) => (
              <div key={m.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
                    {m.user?.firstName?.[0] || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{m.user?.firstName} {m.user?.lastName}</div>
                    <div className="text-sm text-gray-600">{m.user?.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {roleBadge(m.role)}
                  <select
                    className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                    value={m.role}
                    onChange={(e) => onChangeRole(m.id, e.target.value as Role)}
                  >
                    {roleOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => onRemoveMember(m.id)}
                    className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-md border border-red-200 text-sm flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" /> Kaldır
                  </button>
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <div className="p-6 text-center text-gray-500">Üye bulunmuyor</div>
            )}
          </div>
        </div>

        {/* Invites */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Bekleyen Davetler ({invites.length})</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {invites.map((inv) => (
              <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <div className="font-medium text-gray-900">{inv.email}</div>
                  <div className="text-sm text-gray-600">Rol: {inv.role}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{new Date(inv.createdAt).toLocaleDateString('tr-TR')}</span>
                  <button className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded-md border border-blue-200 text-sm flex items-center gap-1" disabled>
                    <Mail className="w-4 h-4" /> Yeniden Gönder (yakında)
                  </button>
                </div>
              </div>
            ))}
            {invites.length === 0 && (
              <div className="p-6 text-center text-gray-500">Bekleyen davet yok</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
