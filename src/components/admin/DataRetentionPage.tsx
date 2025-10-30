import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  Play,
  Eye,
  Trash2,
  RefreshCw,
  Calendar,
  BarChart3,
  FileX,
  Shield,
  Settings
} from 'lucide-react';
import { adminApi } from '../../api/admin';

interface RetentionConfig {
  retentionPolicies: {
    [key: string]: {
      description: string;
      retentionPeriod: string;
      retentionDays: number;
      categories: string[];
      legalHold: boolean;
      note?: string;
    };
  };
  globalSettings: {
    enabled: boolean;
    dryRunByDefault: boolean;
    auditRetention: boolean;
    maxPurgeRecordsPerRun: number;
    safetyChecks: {
      requireConfirmation: boolean;
      minRecordsThreshold: number;
      skipLegalHold: boolean;
    };
  };
}

interface RetentionStatus {
  statistics: {
    eligibleAuditLogs: number;
    expiredTenants: number;
    expiredBackupFiles: number;
    totalEligibleRecords: number;
  };
  lastUpdated: string;
}

interface RetentionHistoryItem {
  id: string;
  timestamp: string;
  action: string;
  details: {
    policy: string;
    category: string;
    eligibleRecords: number;
    purgedRecords: number;
    dryRun: boolean;
    errors: string[];
  };
  ip: string;
  userAgent: string;
}

export default function DataRetentionPage() {
  const [config, setConfig] = useState<RetentionConfig | null>(null);
  const [status, setStatus] = useState<RetentionStatus | null>(null);
  const [history, setHistory] = useState<RetentionHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'history'>('overview');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    loadRetentionData();
  }, []);

  const loadRetentionData = async () => {
    try {
      setLoading(true);
      const [configResponse, statusResponse, historyResponse] = await Promise.all([
        adminApi.getRetentionConfig(),
        adminApi.getRetentionStatus(),  
        adminApi.getRetentionHistory(),
      ]);

      if (configResponse.success) {
        setConfig(configResponse.config);
      }

      if (statusResponse.success) {
        setStatus(statusResponse);
      }

      if (historyResponse.success) {
        setHistory(historyResponse.history);
      }
    } catch (error: any) {
      setError('Failed to load retention data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const executeDryRun = async () => {
    try {
      setExecuting(true);
      setError('');
      setSuccess('');

      const response = await adminApi.executeRetentionDryRun();
      if (response.success) {
        setSuccess('Dry-run completed successfully. Check the output below.');
        // Refresh data
        await loadRetentionData();
      }
    } catch (error: any) {
      setError('Dry-run failed: ' + error.message);
    } finally {
      setExecuting(false);
    }
  };

  const executeLivePurge = async () => {
    const confirmed = window.confirm(
      '⚠️ WARNING: This will permanently delete data!\n\n' +
      'Are you absolutely sure you want to proceed with live purge?\n\n' +
      'This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setExecuting(true);
      setError('');
      setSuccess('');

      const response = await adminApi.executeRetention();
      if (response.success) {
        setSuccess('Live purge completed successfully. Data has been permanently deleted.');
        // Refresh data
        await loadRetentionData();
      }
    } catch (error: any) {
      setError('Live purge failed: ' + error.message);
    } finally {
      setExecuting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('tr-TR');
  };

  const getPolicyStatusIcon = (policy: any) => {
    if (policy.legalHold) {
      return <Shield className="w-5 h-5 text-yellow-600" title="Legal Hold - Protected" />;
    }
    return <Clock className="w-5 h-5 text-blue-600" title="Active Retention Policy" />;
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Durum Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-800 text-sm font-medium">Temizlenebilir Sistem Logları</p>
              <p className="text-2xl font-bold text-blue-900">{status?.statistics.eligibleAuditLogs || 0}</p>
            </div>
            <Database className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-800 text-sm font-medium">Süresi Dolmuş Şirketler</p>
              <p className="text-2xl font-bold text-orange-900">{status?.statistics.expiredTenants || 0}</p>
            </div>
            <FileX className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-800 text-sm font-medium">Eski Yedek Dosyaları</p>
              <p className="text-2xl font-bold text-purple-900">{status?.statistics.expiredBackupFiles || 0}</p>
            </div>
            <Trash2 className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-800 text-sm font-medium">Toplam Temizlenebilir</p>
              <p className="text-2xl font-bold text-green-900">{status?.statistics.totalEligibleRecords || 0}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* İşlemler */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <Play className="w-5 h-5 mr-2" />
          Veri Temizleme İşlemleri
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={executeDryRun}
            disabled={executing || loading}
            className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Eye className="w-5 h-5 mr-2" />
            {executing ? 'Çalışıyor...' : 'Test Çalıştır (Dry Run)'}
          </button>
          
          <button
            onClick={executeLivePurge}
            disabled={executing || loading}
            className="flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="w-5 h-5 mr-2" />
            {executing ? 'Çalıştırılıyor...' : 'Gerçek Temizlik Yap'}
          </button>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">Güvenlik Kuralları:</p>
              <ul className="mt-1 space-y-1">
                <li>• Önce <strong>Test Çalıştır</strong> ile hangi verilerin silineceğini görün</li>
                <li>• <strong>Gerçek Temizlik</strong> verileri kalıcı olarak siler - yedeklerinizin olduğundan emin olun</li>
                <li>• Hukuki koruma (muhasebe belgeleri) altındaki kayıtlar otomatik korunur</li>
                <li>• Tüm işlemler denetim kaydında loglanır</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <XCircle className="w-5 h-5 text-red-600 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <p className="text-green-800">{success}</p>
          </div>
        </div>
      )}

      {/* Last Updated */}
      {status && (
        <div className="text-sm text-gray-600 text-center">
          Last updated: {formatDate(status.lastUpdated)}
        </div>
      )}
    </div>
  );

  const renderConfig = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <Settings className="w-5 h-5 mr-2" />
          Retention Policies
        </h3>

        {config && (
          <div className="space-y-4">
            {Object.entries(config.retentionPolicies).map(([policyName, policy]) => (
              <div key={policyName} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start">
                    {getPolicyStatusIcon(policy)}
                    <div className="ml-3">
                      <h4 className="font-semibold text-gray-800 capitalize">{policyName.replace('_', ' ')}</h4>
                      <p className="text-gray-600 text-sm">{policy.description}</p>
                      {policy.note && (
                        <p className="text-yellow-700 text-sm mt-1">📝 {policy.note}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{policy.retentionPeriod}</div>
                    <div className="text-xs text-gray-500">{policy.retentionDays} days</div>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex flex-wrap gap-2">
                    {policy.categories.map((category) => (
                      <span 
                        key={category}
                        className={`px-2 py-1 text-xs rounded-full ${
                          policy.legalHold 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {config && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-semibold text-gray-800 mb-3">Global Settings</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Status:</span>
                <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                  config.globalSettings.enabled 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {config.globalSettings.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div>
                <span className="font-medium">Dry Run Default:</span>
                <span className="ml-2">{config.globalSettings.dryRunByDefault ? 'Yes' : 'No'}</span>
              </div>
              <div>
                <span className="font-medium">Audit Retention:</span>
                <span className="ml-2">{config.globalSettings.auditRetention ? 'Yes' : 'No'}</span>
              </div>
              <div>
                <span className="font-medium">Max Records Per Run:</span>
                <span className="ml-2">{config.globalSettings.maxPurgeRecordsPerRun}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Retention Job History
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Policy
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Records
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(item.timestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.details.policy}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.details.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div>Eligible: {item.details.eligibleRecords}</div>
                      <div>Purged: {item.details.purgedRecords}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {item.details.dryRun ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          Dry Run
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Live Purge
                        </span>
                      )}
                      {item.details.errors.length > 0 && (
                        <AlertTriangle className="w-4 h-4 text-yellow-600 ml-2" title="Had errors" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {history.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No retention job history found
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <Database className="w-8 h-8 mr-3 text-blue-600" />
            Veri Temizleme Yönetimi
          </h2>
          <p className="text-gray-600 mt-1">
            Otomatik veri temizleme ve saklama politikalarını yönetin
          </p>
        </div>
        <button
          onClick={loadRetentionData}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Yenile
        </button>
      </div>

      {/* Sekmeler */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'overview'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📊 Genel Bakış
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'config'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          ⚙️ Yapılandırma
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📜 Geçmiş
        </button>
      </div>

      {/* Content */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-600">Loading retention data...</span>
        </div>
      )}

      {!loading && (
        <>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'config' && renderConfig()}
          {activeTab === 'history' && renderHistory()}
        </>
      )}
    </div>
  );
}