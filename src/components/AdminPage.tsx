import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../api/admin';
import { Edit, Trash2, ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
import BackupManagementPage from './admin/BackupManagementPage';
import DataRetentionPage from './admin/DataRetentionPage';
import PlanLimitsPage from './admin/PlanLimitsPage';
// OrganizationManagementPage ve TenantLimitsPage kaldırıldı
import TenantConsolePage from './admin/TenantConsolePage';
import { useAuth } from '../contexts/AuthContext';
import StatusPage from './status/StatusPage';
import { BillingInvoiceDTO, listInvoices as userListInvoices } from '../api/billing';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string;
  lastLoginTimeZone?: string;
  lastLoginUtcOffsetMinutes?: number;
  createdAt: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    companyName: string;
  };
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  companyName: string;
  subscriptionPlan: string;
  status: string;
  createdAt?: string;
  subscriptionExpiresAt?: string;
}

interface TableData {
  customers: any[];
  suppliers: any[];
  products: any[];
  invoices: any[];
  expenses: any[];
}

const AdminPage: React.FC = () => {
  const { t } = useTranslation('common');
  const { tenant: authTenant } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: 'owner', password: '' });
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tableData, setTableData] = useState<TableData>({
    customers: [],
    suppliers: [],
    products: [],
    invoices: [],
    expenses: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'users' | 'tenants' | 'data' | 'backups' | 'retention' | 'status' | 'planLimits' | 'tenantConsole'>('users');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('all');
  // Users sekmesi için şirket filtresi (sunucu tarafı)
  const [userTenantFilter, setUserTenantFilter] = useState<string>('all');
  // Data sekmesi için şirket filtresi (tab içi kullanım)
  const [dataTenantFilter, setDataTenantFilter] = useState<string>('all');
  // Tenants sekmesi için filtreler
  const [tenantFilters, setTenantFilters] = useState<{ status: string; plan: string; startFrom: string; startTo: string }>({
    status: '',
    plan: '',
    startFrom: '',
    startTo: ''
  });
  const [actionMessage, setActionMessage] = useState<string>('');
  // Kullanıcı düzenleme modalı
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<{ firstName: string; lastName: string; email: string; phone: string }>({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  // Silme modalı state
  const [deleteModalUser, setDeleteModalUser] = useState<User | null>(null);
  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard'>('soft');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const openEditUser = (u: User) => {
    setEditingUser(u);
    setEditForm({
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      email: u.email || '',
      phone: (u as any).phone || ''
    });
  };
  const closeEditUser = () => setEditingUser(null);
  const saveEditUser = async () => {
    if (!editingUser) return;
    if (!window.confirm(t('admin.users.updateConfirm', 'Bu kullanıcıyı güncellemek istediğinize emin misiniz?'))) return;
    try {
      setLoading(true);
      await adminApi.updateUserDetails(editingUser.id, editForm);
      // Güncel listeyi filtre ile yeniden çek
      const usersData = await adminApi.getUsers(userTenantFilter !== 'all' ? userTenantFilter : undefined);
      setUsers(usersData || []);
      setActionMessage('Kullanıcı güncellendi');
      setTimeout(() => setActionMessage(''), 2000);
      closeEditUser();
    } catch (e) {
      console.error('Kullanıcı güncellenemedi', e);
    } finally {
      setLoading(false);
    }
  };
  const sendPasswordResetEmail = async () => {
    if (!editingUser) return;
    if (!window.confirm(t('admin.users.passwordResetConfirm', 'Şifre sıfırlama e-postası gönderilsin mi?'))) return;
    try {
      setLoading(true);
      await adminApi.sendPasswordReset(editingUser.id);
      setActionMessage('Şifre sıfırlama e-postası gönderildi (simülasyon)');
      setTimeout(() => setActionMessage(''), 2500);
    } catch (e) {
      console.error('E-posta gönderilemedi', e);
    } finally {
      setLoading(false);
    }
  };
  // Şirketler sekmesinde inline düzenleme kontrolü
  const [editingPlanIds, setEditingPlanIds] = useState<Set<string>>(new Set());
  const [editingStatusIds, setEditingStatusIds] = useState<Set<string>>(new Set());
  const [editingBillingIds, setEditingBillingIds] = useState<Set<string>>(new Set());

  // Tenant detayları: limitler + fatura geçmişi
  const [openTenantDetails, setOpenTenantDetails] = useState<Set<string>>(new Set());
  const [tenantOverviewMap, setTenantOverviewMap] = useState<Record<string, any>>({});
  const [tenantInvoicesMap, setTenantInvoicesMap] = useState<Record<string, BillingInvoiceDTO[]>>({});
  // Her tenant için fatura tablosunda "tümünü göster" durumu
  const [showAllInvoicesMap, setShowAllInvoicesMap] = useState<Record<string, boolean>>({});

  // Plan label normalize (4 planı 3’e indir): STARTER / PRO / BUSINESS
  const normalizePlanLabel = (plan?: string) => {
    const p = (plan || '').toLowerCase();
    if (p.includes('enterprise') || p.includes('business')) return 'BUSINESS';
    if (p.includes('professional') || p === 'pro') return 'PRO';
    // free ve basic => STARTER
    return 'STARTER';
  };
  const planDisplayToApi = (display: string) => {
    const d = display.toUpperCase();
    if (d === 'BUSINESS') return 'enterprise';
    if (d === 'PRO') return 'professional';
    return 'basic'; // STARTER
  };
  const planFilterToApi = (display: string) => {
    // Filtrede STARTER => basic, PRO => professional, BUSINESS => enterprise
    if (!display) return '';
    return planDisplayToApi(display);
  };

  // Yardımcılar (gerekirse kullanılabilir)
  // const isEditingPlan = (id: string) => editingPlanIds.has(id);
  // const isEditingStatus = (id: string) => editingStatusIds.has(id);
  // const isEditingBilling = (id: string) => editingBillingIds.has(id);

  const toggleEditSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string, enable?: boolean) => {
    setter(prev => {
      const ns = new Set(prev);
      if (enable === undefined) {
        if (ns.has(id)) ns.delete(id); else ns.add(id);
      } else {
        if (enable) ns.add(id); else ns.delete(id);
      }
      return ns;
    });
  };
  
  // Table visibility states
  const [visibleTables, setVisibleTables] = useState<{[key: string]: boolean}>({
    customers: false,
    suppliers: false,
    products: false,
    invoices: false,
    expenses: false
  });

  // Filter states
  const [filters, setFilters] = useState<{[key: string]: string}>({
    customers: '',
    suppliers: '',
    products: '',
    invoices: '',
    expenses: ''
  });

  useEffect(() => {
    const token = localStorage.getItem('admin-token');
    if (token) {
  setIsAuthenticated(true);
  // Varsayılan tenant filtresi: authTenant varsa onu seç, yoksa 'all'
  const def = authTenant?.id || 'all';
  setSelectedTenantId(def);
  setUserTenantFilter(def);
  setDataTenantFilter(def);
  loadAllData(def !== 'all' ? def : undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Admin token süresi dolduğunda login ekranına dön
  useEffect(() => {
    const onExpired = () => {
      setIsAuthenticated(false);
      setError('Admin oturumunuz sona erdi. Lütfen yeniden giriş yapın.');
    };
    window.addEventListener('adminAuthExpired', onExpired as any);
    return () => window.removeEventListener('adminAuthExpired', onExpired as any);
  }, []);

  // Tenant filtresi değiştiğinde tablo verilerini yeniden yükle
  useEffect(() => {
    if (!isAuthenticated) return;
    loadTables(selectedTenantId !== 'all' ? selectedTenantId : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTenantId]);

  // Users sekmesi: şirket filtresi değişince kullanıcıları yeniden çek
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchUsers(userTenantFilter !== 'all' ? userTenantFilter : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userTenantFilter]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await adminApi.login(loginForm.username, loginForm.password);
      if (response.success) {
  setIsAuthenticated(true);
  localStorage.setItem('admin-token', response.adminToken);
  // Admin login sonrası, varsayılan olarak kullanıcının tenant'ını seç
  const defaultTenant = authTenant?.id || 'all';
  setSelectedTenantId(defaultTenant);
  setUserTenantFilter(defaultTenant);
  setDataTenantFilter(defaultTenant);
  loadAllData(defaultTenant !== 'all' ? defaultTenant : undefined);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  const loadAllData = async (tenantId?: string) => {
    try {
      setLoading(true);
      
      // Load users and tenants
      const [usersData, tenantsData] = await Promise.all([
        adminApi.getUsers(tenantId),
        adminApi.getTenants()
      ]);

      setUsers(usersData || []);
      setTenants(tenantsData || []);

      // Load table data (tenant filtresi ile)
      const [customersData, suppliersData, productsData, invoicesData, expensesData] = await Promise.all([
        adminApi.getTableData('customers', tenantId).catch(() => []),
        adminApi.getTableData('suppliers', tenantId).catch(() => []),
        adminApi.getTableData('products', tenantId).catch(() => []),
        adminApi.getTableData('invoices', tenantId).catch(() => []),
        adminApi.getTableData('expenses', tenantId).catch(() => [])
      ]);

      setTableData({
        customers: Array.isArray(customersData) ? customersData.reverse() : [],
        suppliers: Array.isArray(suppliersData) ? suppliersData.reverse() : [],
        products: Array.isArray(productsData) ? productsData.reverse() : [],
        invoices: Array.isArray(invoicesData) ? invoicesData.reverse() : [],
        expenses: Array.isArray(expensesData) ? expensesData.reverse() : []
      });

    } catch (err: any) {
      setError('Veri yükleme başarısız');
      console.error('Load data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (tenantId?: string) => {
    try {
      setLoading(true);
      const usersData = await adminApi.getUsers(tenantId);
      setUsers(usersData || []);
    } catch (e) {
      console.error('Kullanıcılar yüklenemedi', e);
    } finally {
      setLoading(false);
    }
  };

  // Tenants filtreleri için otomatik yükleme
  const fetchTenantsWithFilters = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getTenants({
        status: tenantFilters.status || undefined,
        plan: tenantFilters.plan ? planFilterToApi(tenantFilters.plan) : undefined,
        startFrom: tenantFilters.startFrom || undefined,
        startTo: tenantFilters.startTo || undefined,
      });
      setTenants(data || []);
    } catch (e) {
      console.error('Şirketler yüklenemedi', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchTenantsWithFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFilters.status, tenantFilters.plan, tenantFilters.startFrom, tenantFilters.startTo]);

  // Sadece tabloları yeniden yüklemek için yardımcı fonksiyon
  const loadTables = async (tenantId?: string) => {
    try {
      setLoading(true);
      const [customersData, suppliersData, productsData, invoicesData, expensesData] = await Promise.all([
        adminApi.getTableData('customers', tenantId).catch(() => []),
        adminApi.getTableData('suppliers', tenantId).catch(() => []),
        adminApi.getTableData('products', tenantId).catch(() => []),
        adminApi.getTableData('invoices', tenantId).catch(() => []),
        adminApi.getTableData('expenses', tenantId).catch(() => [])
      ]);
      setTableData({
        customers: Array.isArray(customersData) ? customersData.reverse() : [],
        suppliers: Array.isArray(suppliersData) ? suppliersData.reverse() : [],
        products: Array.isArray(productsData) ? productsData.reverse() : [],
        invoices: Array.isArray(invoicesData) ? invoicesData.reverse() : [],
        expenses: Array.isArray(expensesData) ? expensesData.reverse() : []
      });
    } catch (err) {
      console.error('Tablolar yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleTableVisibility = (tableName: string) => {
    setVisibleTables(prev => ({
      ...prev,
      [tableName]: !prev[tableName]
    }));
  };

  const handleFilterChange = (tableName: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [tableName]: value
    }));
  };

  const filterData = (data: any[], tableName: string) => {
    const filterValue = filters[tableName].toLowerCase();
    if (!filterValue) return data;

    return data.filter(item => {
      return Object.values(item).some(value => 
        String(value || '').toLowerCase().includes(filterValue)
      );
    });
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('admin-token');
    setUsers([]);
    setTenants([]);
    setTableData({
      customers: [],
      suppliers: [],
      products: [],
      invoices: [],
      expenses: []
    });
  };

  const calculateStats = () => {
    const activeUsers = users.filter(u => u.isActive).length;
    return {
      users: activeUsers,
      customers: tableData.customers.length,
      suppliers: tableData.suppliers.length,
      products: tableData.products.length,
      invoices: tableData.invoices.length,
      expenses: tableData.expenses.length
    };
  };

  const renderTable = (tableName: string, data: any[], columns: string[]) => {
    const filteredData = filterData(data, tableName);
    const isVisible = visibleTables[tableName];

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => toggleTableVisibility(tableName)}
              className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
            >
              {isVisible ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              <span className="font-medium capitalize">{tableName} ({data.length})</span>
            </button>
          </div>
          
          {isVisible && (
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filtrele..."
                  value={filters[tableName]}
                  onChange={(e) => handleFilterChange(tableName, e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {filters[tableName] && (
                  <button
                    onClick={() => handleFilterChange(tableName, '')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {isVisible && (
          <div className="overflow-hidden">
            <div className="max-h-80 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {columns.map(column => (
                      <th key={column} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredData.slice(0, 10).map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      {columns.map(column => (
                        <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {typeof item[column] === 'object' ? JSON.stringify(item[column]) : (item[column] || '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredData.length > 10 && (
                <div className="p-4 text-center text-sm text-gray-500 border-t border-gray-200">
                  {filteredData.length - 10} daha fazla kayıt var (kaydırarak görün)
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const toggleUserActive = async (userId: string, isActive: boolean) => {
    try {
      setLoading(true);
      const confirmMsg = isActive
        ? t('admin.users.deactivateConfirm', 'Kullanıcıyı pasifleştirmek istediğinize emin misiniz?')
        : t('admin.users.activateConfirm', 'Kullanıcıyı aktifleştirmek istediğinize emin misiniz?');
      if (!window.confirm(confirmMsg)) return;
      await adminApi.updateUserStatus(userId, !isActive);
      // Mevcut filtre ile kullanıcıları tazele
      const usersData = await adminApi.getUsers(userTenantFilter !== 'all' ? userTenantFilter : undefined);
      setUsers(usersData || []);
    } catch (e) {
      console.error('Kullanıcı durumu güncellenemedi', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-red-100">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔐</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Admin Panel</h1>
              <p className="text-gray-600">Güvenli giriş gereklidir</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kullanıcı Adı
                </label>
                <p className="text-xs text-gray-500 mb-2">Genellikle: owner (dev ortamı)</p>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Şifre
                </label>
                <p className="text-xs text-gray-500 mb-2">Backend .env içindeki ADMIN_PASSWORD (veya ADMIN_PASSWORD_HASH)</p>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
              >
                {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const stats = calculateStats();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🔒</span>
            <h1 className="text-2xl font-bold text-gray-800">Admin Paneli</h1>
          </div>
          <div className="flex items-center gap-3">
            
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Çıkış Yap
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'users'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            👥 Kullanıcılar ({stats.users})
          </button>
          <button
            onClick={() => setActiveTab('tenants')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'tenants'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🏢 Şirketler ({tenants.length})
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'data'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📊 Veri Tabanı
          </button>
          {/* Üyelikler sekmesi kaldırıldı */}
          <button
            onClick={() => setActiveTab('backups')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'backups'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            💾 Yedekleme
          </button>
          <button
            onClick={() => setActiveTab('retention')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'retention'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🗑️ Veri Temizleme
          </button>
          <button
            onClick={() => setActiveTab('planLimits')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'planLimits'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📏 Plan Limitleri
          </button>
          {/* Tenant Limitleri sekmesi kaldırıldı */}
          <button
            onClick={() => setActiveTab('tenantConsole')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'tenantConsole'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🧭 Tenant Yönetim
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'status'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📈 Durum
          </button>
        </div>

        {/* İstatistikler */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.users}</div>
            <div className="text-sm text-blue-800">Kullanıcı</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.customers}</div>
            <div className="text-sm text-green-800">Müşteri</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.suppliers}</div>
            <div className="text-sm text-purple-800">Tedarikçi</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.products}</div>
            <div className="text-sm text-yellow-800">Ürün</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.invoices}</div>
            <div className="text-sm text-red-800">Fatura</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.expenses}</div>
            <div className="text-sm text-orange-800">Gider</div>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 className="text-lg font-semibold text-gray-800">👥 Kullanıcılar</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Şirket:</span>
                  <select
                    value={userTenantFilter}
                    onChange={(e) => setUserTenantFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">Tümü</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.companyName || t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ad Soyad
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        E-posta
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Şirket
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Yetki
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Son Giriş
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Son Giriş Saat Dilimi
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Durum
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        İşlemler
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(userTenantFilter === 'all' ? users : users.filter(u => u.tenant?.id === userTenantFilter)).map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.tenant?.companyName || user.tenant?.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {user.role === 'admin' ? 'Yönetici' : 'Kullanıcı'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {(() => {
                            const tz = (user as any).lastLoginTimeZone;
                            const off = (user as any).lastLoginUtcOffsetMinutes;
                            const offLabel = typeof off === 'number'
                              ? `UTC${off >= 0 ? '+' : ''}${(off/60).toFixed(1).replace('.0','')}`
                              : '';
                            return tz || offLabel || '—';
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {user.isActive ? 'Aktif' : 'Pasif'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openEditUser(user)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Düzenle"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { setDeleteMode('soft'); setDeleteModalUser(user); }}
                              className="text-red-600 hover:text-red-900"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => toggleUserActive(user.id, user.isActive)}
                              className={`px-3 py-1 rounded-md text-xs font-medium text-white ${user.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                            >
                              {user.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tenants' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">🏢 Şirketler ve Abonelik Yönetimi</h2>
                    <p className="text-xs text-gray-600 mt-1">Bu sayfadan tüm şirketleri görüntüleyebilir, plan ve durumlarını güncelleyebilir, sonraki ödeme tarihini ayarlayabilir veya aboneliği iptal edebilirsiniz. Yapılan her değişiklik için onay istenir.</p>
                    {actionMessage && (
                      <div className="mt-2 inline-block text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded">
                        {actionMessage}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-500 mb-1">Durum</label>
                      <select
                        value={tenantFilters.status}
                        onChange={(e) => setTenantFilters(prev => ({ ...prev, status: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">Tümü</option>
                        <option value="active">Aktif</option>
                        <option value="suspended">Askıda</option>
                        <option value="trial">Deneme</option>
                        <option value="expired">Süresi Doldu</option>
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-500 mb-1">Plan</label>
                      <select
                        value={tenantFilters.plan}
                        onChange={(e) => setTenantFilters(prev => ({ ...prev, plan: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">Tümü</option>
                        <option value="STARTER">STARTER</option>
                        <option value="PRO">PRO</option>
                        <option value="BUSINESS">BUSINESS</option>
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-500 mb-1">Başlangıç (≥)</label>
                      <input
                        type="date"
                        value={tenantFilters.startFrom}
                        onChange={(e) => setTenantFilters(prev => ({ ...prev, startFrom: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-500 mb-1">Bitiş (≤)</label>
                      <input
                        type="date"
                        value={tenantFilters.startTo}
                        onChange={(e) => setTenantFilters(prev => ({ ...prev, startTo: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        setLoading(true);
                        try {
                          const data = await adminApi.getTenants({
                            status: tenantFilters.status || undefined,
                            plan: tenantFilters.plan || undefined,
                            startFrom: tenantFilters.startFrom || undefined,
                            startTo: tenantFilters.startTo || undefined,
                          });
                          setTenants(data || []);
                        } catch (e) {
                          console.error('Şirketler yüklenemedi', e);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                      Filtreleri Uygula
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-6">
                {tenants.map((tenant) => (
                  <div key={tenant.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-800">Şirket Adı</h3>
                        <p className="text-gray-600">{tenant.companyName || tenant.name}</p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">URL Kodu</h3>
                        <p className="text-gray-600">@{tenant.slug}</p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">Abonelik Planı</h3>
                        {!editingPlanIds.has(tenant.id) ? (
                          <button
                            onClick={() => toggleEditSet(setEditingPlanIds, tenant.id, true)}
                            className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 hover:bg-gray-200"
                            title="Düzenlemek için tıklayın"
                          >
                            {normalizePlanLabel(tenant.subscriptionPlan) || '-'}
                          </button>
                        ) : (
                          <select
                            autoFocus
                            defaultValue={normalizePlanLabel(tenant.subscriptionPlan)}
                            onBlur={() => toggleEditSet(setEditingPlanIds, tenant.id, false)}
                            onChange={(e) => {
                              const displayPlan = e.target.value;
                              const apiPlan = planDisplayToApi(displayPlan);
                              if (!window.confirm(t('admin.tenants.updatePlanConfirm', { name: tenant.companyName || tenant.name, plan: displayPlan, defaultValue: `${tenant.companyName || tenant.name} için planı '${displayPlan}' olarak güncellemek istediğinize emin misiniz?` }))) return;
                              adminApi.updateTenantSubscription(tenant.id, { plan: apiPlan })
                                .then(() => {
                                  setTenants(prev => prev.map(x => x.id === tenant.id ? { ...x, subscriptionPlan: apiPlan } : x));
                                  setActionMessage('Plan güncellendi');
                                  setTimeout(() => setActionMessage(''), 2000);
                                })
                                .catch(err => console.error('Plan güncellenemedi', err))
                                .finally(() => toggleEditSet(setEditingPlanIds, tenant.id, false));
                            }}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="STARTER">STARTER</option>
                            <option value="PRO">PRO</option>
                            <option value="BUSINESS">BUSINESS</option>
                          </select>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">Durum</h3>
                        {!editingStatusIds.has(tenant.id) ? (
                          <button
                            onClick={() => toggleEditSet(setEditingStatusIds, tenant.id, true)}
                            className={`px-2 py-1 text-xs rounded-full ${tenant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                            title="Düzenlemek için tıklayın"
                          >
                            {tenant.status}
                          </button>
                        ) : (
                          <select
                            autoFocus
                            defaultValue={tenant.status || 'active'}
                            onBlur={() => toggleEditSet(setEditingStatusIds, tenant.id, false)}
                            onChange={(e) => {
                              const newStatus = e.target.value;
                              if (!window.confirm(t('admin.tenants.updateStatusConfirm', { name: tenant.companyName || tenant.name, status: newStatus, defaultValue: `${tenant.companyName || tenant.name} için durumu '${newStatus}' olarak güncellemek istediğinize emin misiniz?` }))) return;
                              adminApi.updateTenantSubscription(tenant.id, { status: newStatus })
                                .then(() => {
                                  setTenants(prev => prev.map(x => x.id === tenant.id ? { ...x, status: newStatus } : x));
                                  setActionMessage('Durum güncellendi');
                                  setTimeout(() => setActionMessage(''), 2000);
                                })
                                .catch(err => console.error('Durum güncellenemedi', err))
                                .finally(() => toggleEditSet(setEditingStatusIds, tenant.id, false));
                            }}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="active">Aktif</option>
                            <option value="suspended">Askıda</option>
                            <option value="trial">Deneme</option>
                            <option value="expired">Süresi Doldu</option>
                          </select>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">Başlangıç</h3>
                        <p className="text-gray-600">{tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : '-'}</p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">Sonraki Ödeme</h3>
                        {!editingBillingIds.has(tenant.id) ? (
                          <button
                            onClick={() => toggleEditSet(setEditingBillingIds, tenant.id, true)}
                            className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 hover:bg-gray-200"
                            title="Düzenlemek için tıklayın"
                          >
                            {tenant.subscriptionExpiresAt ? new Date(tenant.subscriptionExpiresAt).toLocaleDateString() : '-'}
                          </button>
                        ) : (
                          <input
                            autoFocus
                            type="date"
                            defaultValue={tenant.subscriptionExpiresAt ? new Date(tenant.subscriptionExpiresAt).toISOString().slice(0,10) : ''}
                            onBlur={() => toggleEditSet(setEditingBillingIds, tenant.id, false)}
                            onKeyDown={(e) => { if (e.key === 'Escape') toggleEditSet(setEditingBillingIds, tenant.id, false); }}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) return;
                              if (!window.confirm(t('admin.tenants.updateNextPaymentConfirm', { name: tenant.companyName || tenant.name, date: val, defaultValue: `${tenant.companyName || tenant.name} için sonraki ödeme tarihini ${val} olarak ayarlamak istediğinize emin misiniz?` }))) return;
                              adminApi.updateTenantSubscription(tenant.id, { nextBillingAt: val })
                                .then(() => {
                                  setActionMessage('Sonraki ödeme tarihi güncellendi');
                                  setTimeout(() => setActionMessage(''), 2000);
                                })
                                .catch(err => console.error('Tarih güncellenemedi', err))
                                .finally(() => toggleEditSet(setEditingBillingIds, tenant.id, false));
                            }}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">Abonelik</h3>
                        <button
                          onClick={() => {
                            if (!window.confirm(t('admin.tenants.cancelSubscriptionConfirm', { name: tenant.companyName || tenant.name, defaultValue: `${tenant.companyName || tenant.name} için aboneliği iptal etmek istediğinize emin misiniz?` }))) return;
                            adminApi.updateTenantSubscription(tenant.id, { cancel: true })
                              .then(() => {
                                setActionMessage('Abonelik iptal edildi');
                                setTimeout(() => setActionMessage(''), 2000);
                              })
                              .catch(err => console.error('İptal edilemedi', err));
                          }}
                          className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm"
                        >
                          İptal Et
                        </button>
                      </div>
                      <div className="md:col-span-2">
                        <h3 className="font-semibold text-gray-800">Tehlikeli Bölge</h3>
                        <div className="flex flex-wrap gap-3 items-center mt-2">
                          <button
                            onClick={async () => {
                              const name = tenant.companyName || tenant.name;
                              const confirmed = window.confirm(t('admin.tenants.dangerDeleteTenantConfirm', { name, defaultValue: `DİKKAT: '${name}' hesabını ve tüm verilerini KALICI olarak silmek üzeresiniz. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?` }));
                              if (!confirmed) return;
                              try {
                                setLoading(true);
                                await adminApi.deleteTenant(tenant.id, { hard: true, backupBefore: false });
                                setTenants(prev => prev.filter(t => t.id !== tenant.id));
                                // Kullanıcılar sekmesindeki filtre bu tenant ise 'all' yap ve listeyi tazele
                                if (userTenantFilter === tenant.id) {
                                  setUserTenantFilter('all');
                                  await fetchUsers(undefined);
                                } else {
                                  // Filtre farklıysa da güncel sunucu durumu için kullanıcı listesini yenile
                                  await fetchUsers(userTenantFilter !== 'all' ? userTenantFilter : undefined);
                                }
                                // Data sekmesinde seçili tenant bu ise 'all' yap
                                if (selectedTenantId === tenant.id) {
                                  setSelectedTenantId('all');
                                  await loadTables(undefined);
                                }
                                setActionMessage('Hesap kalıcı olarak silindi');
                                setTimeout(() => setActionMessage(''), 2500);
                              } catch (e) {
                                console.error('Hesap silinemedi', e);
                                alert('Hesap silinemedi. Konsolu kontrol edin.');
                              } finally {
                                setLoading(false);
                              }
                            }}
                            className="px-4 py-2 border border-red-400 text-white bg-red-600 rounded-lg hover:bg-red-700 text-sm"
                          >
                            Hesabı Kalıcı Olarak Sil
                          </button>
                          <span className="text-xs text-gray-500">Bu işlem geri alınamaz. Yalnızca yetkili yöneticiler kullanmalıdır.</span>
                        </div>
                      </div>
                      <div className="md:col-span-2 border-t pt-3 mt-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-800">Detaylar</h3>
                          <button
                            onClick={async () => {
                              const next = new Set(openTenantDetails);
                              if (next.has(tenant.id)) {
                                next.delete(tenant.id);
                                setOpenTenantDetails(next);
                                return;
                              }
                              next.add(tenant.id);
                              setOpenTenantDetails(next);
                              // Lazy-load overview and invoices
                              try {
                                const [overviewRes, invoicesRes] = await Promise.all([
                                  adminApi.getTenantOverview(tenant.id).catch(() => null),
                                  adminApi.getTenantInvoices(tenant.id).catch(() => null),
                                ]);
                                if (overviewRes) {
                                  setTenantOverviewMap(prev => ({ ...prev, [tenant.id]: overviewRes }));
                                }
                                if (invoicesRes && Array.isArray(invoicesRes.invoices) && invoicesRes.invoices.length > 0) {
                                  setTenantInvoicesMap(prev => ({ ...prev, [tenant.id]: invoicesRes.invoices as BillingInvoiceDTO[] }));
                                } else {
                                  // Fallback: aynı tenant'a kullanıcı olarak da giriş yapılmışsa user endpointi ile dene
                                  try {
                                    const meTenant = (() => {
                                      try { const t = localStorage.getItem('tenant'); return t ? JSON.parse(t) : null; } catch { return null; }
                                    })();
                                    if (meTenant?.id && meTenant.id === tenant.id) {
                                      const u = await userListInvoices(tenant.id);
                                      if (Array.isArray(u?.invoices) && u.invoices.length > 0) {
                                        setTenantInvoicesMap(prev => ({ ...prev, [tenant.id]: u.invoices as BillingInvoiceDTO[] }));
                                      }
                                    }
                                  } catch {}
                                }
                              } catch (e) {
                                // Sessizce geç
                              }
                            }}
                            className="px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                          >
                            {openTenantDetails.has(tenant.id) ? 'Gizle' : 'Göster'}
                          </button>
                        </div>
                        {openTenantDetails.has(tenant.id) && (
                          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="bg-gray-50 rounded-md p-3 border">
                              <h4 className="font-medium text-gray-800 mb-2">Plan ve Limitler</h4>
                              <div className="text-sm text-gray-700 space-y-1">
                                <div>
                                  <span className="text-gray-500">Plan: </span>
                                  <span className="font-medium">{normalizePlanLabel(tenant.subscriptionPlan)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Kullanıcı Limiti (maxUsers): </span>
                                  <span className="font-medium">{
                                    (() => {
                                      const val = tenantOverviewMap[tenant.id]?.maxUsers ?? tenantOverviewMap[tenant.id]?.limits?.maxUsers;
                                      if (val === undefined || val === null) return '-';
                                      if (val === -1) return '∞';
                                      return val;
                                    })()
                                  }</span>
                                </div>
                              </div>
                            </div>
                            <div className="bg-gray-50 rounded-md p-3 border">
                              <h4 className="font-medium text-gray-800 mb-2">Fatura Geçmişi</h4>
                              {Array.isArray(tenantInvoicesMap[tenant.id]) && tenantInvoicesMap[tenant.id].length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-sm">
                                    <thead>
                                      <tr className="text-left text-gray-500">
                                        <th className="py-1 pr-4">Numara</th>
                                        <th className="py-1 pr-4">Tarih</th>
                                        <th className="py-1 pr-4">Tutar</th>
                                        <th className="py-1 pr-4">Durum</th>
                                        <th className="py-1 pr-4">Bağlantılar</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {tenantInvoicesMap[tenant.id]
                                        .slice(0, showAllInvoicesMap[tenant.id] ? tenantInvoicesMap[tenant.id].length : 6)
                                        .map((inv) => {
                                          const status = inv.status || (inv.paid ? 'paid' : 'unknown');
                                          const statusClass = (() => {
                                            switch (status) {
                                              case 'paid': return 'bg-green-100 text-green-700 border border-green-200';
                                              case 'open': return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
                                              case 'draft': return 'bg-blue-100 text-blue-700 border border-blue-200';
                                              case 'uncollectible': return 'bg-orange-100 text-orange-700 border border-orange-200';
                                              case 'void': return 'bg-gray-200 text-gray-600 border border-gray-300';
                                              case 'upcoming': return 'bg-purple-100 text-purple-700 border border-purple-200';
                                              default: return 'bg-gray-100 text-gray-700 border border-gray-200';
                                            }
                                          })();
                                          return (
                                            <tr key={inv.id} className="border-t">
                                              <td className="py-1 pr-4">{inv.number || inv.id}</td>
                                              <td className="py-1 pr-4">{inv.created ? new Date(inv.created).toLocaleDateString() : '-'}</td>
                                              <td className="py-1 pr-4">{typeof inv.total === 'number' ? `${(inv.total / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${inv.currency?.toUpperCase()}` : '-'}</td>
                                              <td className="py-1 pr-4">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium inline-block ${statusClass}`}>{status}</span>
                                              </td>
                                              <td className="py-1 pr-4 space-x-2">
                                                {inv.hostedInvoiceUrl && (
                                                  <a className="text-blue-600 hover:underline" href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer">Görüntüle</a>
                                                )}
                                                {inv.pdf && (
                                                  <a className="text-blue-600 hover:underline" href={inv.pdf} target="_blank" rel="noreferrer">PDF</a>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                    </tbody>
                                  </table>
                                  {tenantInvoicesMap[tenant.id].length > 6 && (
                                    <div className="mt-2 text-center">
                                      <button
                                        onClick={() => setShowAllInvoicesMap(prev => ({ ...prev, [tenant.id]: !prev[tenant.id] }))}
                                        className="text-xs px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
                                      >
                                        {showAllInvoicesMap[tenant.id] ? 'Daha az göster' : `Tümünü göster (${tenantInvoicesMap[tenant.id].length})`}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500">
                                  Fatura bulunamadı.
                                  {tenantOverviewMap[tenant.id] && !tenantOverviewMap[tenant.id].stripeCustomerId && (
                                    <span className="ml-1 text-xs text-gray-400">(Stripe müşteri ID yok – ilk abonelik/fatura işlemi sonrası oluşur)</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tenants detay alanı: Limitler + Fatura geçmişi */}
        {activeTab === 'tenants' && (
          <div className="mt-2" />
        )}

        {activeTab === 'data' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-gray-800">📊 Veri Tabanı Tabloları</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Şirket:</span>
                  <select
                    value={dataTenantFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDataTenantFilter(val);
                      setSelectedTenantId(val);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">Tümü</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.companyName || t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-gray-600 mb-6">
                Tablolar varsayılan olarak gizlidir. Görüntülemek için tablo başlığına tıklayın.
              </p>
              
              {renderTable('customers', tableData.customers, ['name', 'email', 'company', 'phone', 'totalSpent'])}
              {renderTable('suppliers', tableData.suppliers, ['name', 'email', 'company', 'phone', 'totalPaid'])}
              {renderTable('products', tableData.products, ['name', 'description', 'price', 'category', 'stock'])}
              {renderTable('invoices', tableData.invoices, ['invoiceNumber', 'customerName', 'amount', 'status', 'date'])}
              {renderTable('expenses', tableData.expenses, ['expenseNumber', 'supplierName', 'amount', 'category', 'date'])}
            </div>
          </div>
        )}

        {/* Subscriptions sekmesi kaldırıldı; abonelik yönetimi Şirketler sekmesine taşındı. */}

        {/* Üyelikler sekmesi kaldırıldı */}

        {activeTab === 'backups' && (
          <BackupManagementPage />
        )}

        {activeTab === 'retention' && (
          <DataRetentionPage />
        )}

        {activeTab === 'planLimits' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <PlanLimitsPage />
          </div>
        )}

        {/* Tenant Limitleri sekmesi kaldırıldı */}

        {activeTab === 'tenantConsole' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <TenantConsolePage />
          </div>
        )}

        {activeTab === 'status' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* StatusPage tam sayfa tasarımla geldiği için, yekpare başlığını gizlemek adına basit bir container içine gömüp kullanıyoruz */}
            <div className="p-6">
              <StatusPage />
            </div>
          </div>
        )}

        {/* Kullanıcı Düzenleme Modalı */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-lg">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Kullanıcı Düzenle</h3>
                <button onClick={closeEditUser} className="text-gray-500 hover:text-gray-700">✖</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Ad</label>
                    <input
                      type="text"
                      value={editForm.firstName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Soyad</label>
                    <input
                      type="text"
                      value={editForm.lastName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">E-posta</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+90..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <button
                  onClick={sendPasswordResetEmail}
                  className="px-4 py-2 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50"
                >
                  Şifre Sıfırlama Maili Gönder
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={closeEditUser} className="px-4 py-2 text-sm border rounded-lg">{t('common.cancel')}</button>
                  <button onClick={saveEditUser} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700">Kaydet</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Kullanıcı Silme Modalı */}
        {deleteModalUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-full max-w-md shadow-xl border border-red-200">
              <div className="px-5 py-4 border-b border-red-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-red-700">Kullanıcıyı Sil</h3>
                <button
                  onClick={() => setDeleteModalUser(null)}
                  className="text-gray-500 hover:text-gray-700"
                >✖</button>
              </div>
              <div className="p-5 space-y-4">
                <div className="text-sm text-gray-700 leading-relaxed">
                  <p className="mb-2"><strong>{deleteModalUser.firstName} {deleteModalUser.lastName}</strong> - {deleteModalUser.email}</p>
                  <p className="mb-2">Bu işlemi dikkatli yapın. Soft silme kullanıcıyı pasif hale getirir ve gerektiğinde geri döndürülebilir. Hard silme kalıcıdır ve kullanıcı kaydı tamamen kaldırılır.</p>
                  {deleteMode === 'hard' && (
                    <p className="text-red-600 font-medium">DİKKAT: Hard silme geri alınamaz. İlgili ilişkisel kayıtlar (audit log vb. hariç) cascade ile kaybolabilir.</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="delMode"
                      value="soft"
                      checked={deleteMode === 'soft'}
                      onChange={() => setDeleteMode('soft')}
                    />
                    <span>Soft Sil (Pasifleştir)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="delMode"
                      value="hard"
                      checked={deleteMode === 'hard'}
                      onChange={() => setDeleteMode('hard')}
                    />
                    <span className="text-red-600">Hard Sil (Kalıcı)</span>
                  </label>
                </div>
              </div>
              <div className="px-5 py-4 border-t flex items-center justify-between bg-red-50">
                <button
                  onClick={() => setDeleteModalUser(null)}
                  className="px-4 py-2 text-sm rounded-lg border bg-white hover:bg-gray-50"
                  disabled={deleteLoading}
                >{t('common.cancel')}</button>
                <button
                  onClick={async () => {
                    if (!deleteModalUser) return;
                    const hard = deleteMode === 'hard';
                    const confirmText = hard ? 'Bu kullanıcı kalıcı olarak silinecek. Onaylıyor musunuz?' : 'Kullanıcı pasifleştirilecek. Onaylıyor musunuz?';
                    if (!window.confirm(confirmText)) return;
                    try {
                      setDeleteLoading(true);
                      await adminApi.deleteUser(deleteModalUser.id, { hard });
                      setUsers(prev => hard ? prev.filter(u => u.id === deleteModalUser.id ? false : true) : prev.map(u => u.id === deleteModalUser.id ? { ...u, isActive: false } : u));
                      setActionMessage(hard ? 'Kullanıcı kalıcı olarak silindi' : 'Kullanıcı pasifleştirildi');
                      setTimeout(() => setActionMessage(''), 2500);
                      setDeleteModalUser(null);
                    } catch (e: any) {
                      console.error('Silme hatası', e);
                      const status = e?.response?.status;
                      if (status === 404) {
                        setActionMessage('Kullanıcı zaten silinmiş veya bulunamadı (404)');
                        setTimeout(() => setActionMessage(''), 2500);
                        setDeleteModalUser(null);
                        // Sunucudaki güncel durumu yansıtmak için listeyi tazele
                        fetchUsers(userTenantFilter !== 'all' ? userTenantFilter : undefined);
                      } else {
                        alert('Silme başarısız. Konsolu kontrol edin.');
                      }
                    } finally {
                      setDeleteLoading(false);
                    }
                  }}
                  disabled={deleteLoading}
                  className={`px-4 py-2 text-sm rounded-lg text-white ${deleteMode === 'hard' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'} disabled:opacity-60`}
                >{deleteLoading ? 'İşleniyor...' : (deleteMode === 'hard' ? 'Kalıcı Sil' : 'Pasifleştir')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;