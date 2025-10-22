import React, { useState, useEffect } from 'react';
import { adminApi } from '../api/admin';
import { Edit, Trash2, ChevronDown, ChevronUp, Filter, X } from 'lucide-react';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string;
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
}

interface TableData {
  customers: any[];
  suppliers: any[];
  products: any[];
  invoices: any[];
  expenses: any[];
}

const AdminPage: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: 'admin123' });
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
  const [activeTab, setActiveTab] = useState<'users' | 'tenants' | 'data'>('users');
  
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
    if (token === 'admin-access-granted') {
      setIsAuthenticated(true);
      loadAllData();
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await adminApi.login(loginForm.username, loginForm.password);
      if (response.success) {
        setIsAuthenticated(true);
        localStorage.setItem('admin-token', response.adminToken);
        loadAllData();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      
      // Load users and tenants
      const [usersData, tenantsData] = await Promise.all([
        adminApi.getUsers(),
        adminApi.getTenants()
      ]);

      setUsers(usersData || []);
      setTenants(tenantsData || []);

      // Load table data
      const [customersData, suppliersData, productsData, invoicesData, expensesData] = await Promise.all([
        adminApi.getTableData('customers').catch(() => []),
        adminApi.getTableData('suppliers').catch(() => []),
        adminApi.getTableData('products').catch(() => []),
        adminApi.getTableData('invoices').catch(() => []),
        adminApi.getTableData('expenses').catch(() => [])
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
    return {
      users: users.length,
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kullanıcı Adı
                </label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Şifre
                </label>
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
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Çıkış Yap
          </button>
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
            🏢 Tenant'lar ({tenants.length})
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'data'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📊 Veriler
          </button>
        </div>

        {/* Stats */}
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
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">👥 Kullanıcılar</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        İsim
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Şirket
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rol
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
                    {users.map((user) => (
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
                            {user.role}
                          </span>
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
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Düzenle"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              className="text-red-600 hover:text-red-900"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
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
                <h2 className="text-lg font-semibold text-gray-800">🏢 Tenant Bilgileri</h2>
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
                        <h3 className="font-semibold text-gray-800">Slug</h3>
                        <p className="text-gray-600">@{tenant.slug}</p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">Abonelik</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          tenant.subscriptionPlan === 'premium' 
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {tenant.subscriptionPlan}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">Durum</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          tenant.status === 'active' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {tenant.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">📊 Veriler</h2>
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
      </div>
    </div>
  );
};

export default AdminPage;