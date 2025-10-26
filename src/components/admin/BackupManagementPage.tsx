import { useState, useEffect } from 'react';
import { 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  Clock, 
  User, 
  Building2,
  Server,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { backupsApi, type BackupMetadata, type BackupStatistics } from '../../api/backups';
import { adminApi } from '../../api/admin';

export default function BackupManagementPage() {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [statistics, setStatistics] = useState<BackupStatistics | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'system' | 'user' | 'tenant'>('all');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<{
    show: boolean;
    backup?: BackupMetadata;
    type: 'system' | 'user' | 'tenant';
  }>({ show: false, type: 'system' });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadBackups();
    loadStatistics();
    loadUsers();
  }, [filter]);

  const loadBackups = async () => {
    try {
      setLoading(true);
      const data = filter === 'all' 
        ? await backupsApi.list() 
        : await backupsApi.list(filter);
      setBackups(data);
    } catch (error: any) {
      showMessage('error', 'Backup listesi yüklenemedi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await backupsApi.getStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('İstatistikler yüklenemedi:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const userData = await adminApi.getUsers();
      setUsers(userData);
    } catch (error) {
      console.error('Kullanıcılar yüklenemedi:', error);
    }
  };

  const handleCreateSystemBackup = async () => {
    try {
      setLoading(true);
      await backupsApi.createSystemBackup('Manuel sistem yedeği');
      showMessage('success', 'Sistem yedeği oluşturuldu');
      loadBackups();
      loadStatistics();
    } catch (error: any) {
      showMessage('error', 'Yedek oluşturulamadı: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUserBackup = async () => {
    if (!selectedUser) {
      showMessage('error', 'Lütfen bir kullanıcı seçin');
      return;
    }

    try {
      setLoading(true);
      await backupsApi.createUserBackup(selectedUser, 'Manuel kullanıcı yedeği');
      showMessage('success', 'Kullanıcı yedeği oluşturuldu');
      loadBackups();
      loadStatistics();
    } catch (error: any) {
      showMessage('error', 'Yedek oluşturulamadı: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!showRestoreConfirm.backup) return;

    try {
      setLoading(true);
      
      if (showRestoreConfirm.type === 'system') {
        await backupsApi.restoreSystem(showRestoreConfirm.backup.id);
        showMessage('success', 'Sistem geri yüklendi! Sayfa yenileniyor...');
        setTimeout(() => window.location.reload(), 2000);
      } else if (showRestoreConfirm.type === 'user') {
        await backupsApi.restoreUser(
          showRestoreConfirm.backup.entityId!,
          showRestoreConfirm.backup.id
        );
        showMessage('success', 'Kullanıcı verileri geri yüklendi');
      }

      setShowRestoreConfirm({ show: false, type: 'system' });
      loadBackups();
    } catch (error: any) {
      showMessage('error', 'Geri yükleme başarısız: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (backupId: string) => {
    if (!confirm('Bu yedeği silmek istediğinizden emin misiniz?')) return;

    try {
      setLoading(true);
      await backupsApi.delete(backupId);
      showMessage('success', 'Yedek silindi');
      loadBackups();
      loadStatistics();
    } catch (error: any) {
      showMessage('error', 'Yedek silinemedi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm('30 günden eski tüm yedekleri silmek istediğinizden emin misiniz?')) return;

    try {
      setLoading(true);
      const result = await backupsApi.cleanup();
      showMessage('success', result.message);
      loadBackups();
      loadStatistics();
    } catch (error: any) {
      showMessage('error', 'Temizleme başarısız: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('tr-TR');
  };

  const getBackupIcon = (type: string) => {
    switch (type) {
      case 'system': return <Server className="h-5 w-5" />;
      case 'user': return <User className="h-5 w-5" />;
      case 'tenant': return <Building2 className="h-5 w-5" />;
      default: return <Database className="h-5 w-5" />;
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Database className="h-8 w-8" />
          Yedekleme Yönetimi
        </h1>
        <p className="text-gray-600 mt-1">
          Sistem ve kullanıcı bazlı yedeklerinizi yönetin
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600">Toplam Yedek</div>
            <div className="text-2xl font-bold text-gray-900">{statistics.total}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600">Sistem Yedekleri</div>
            <div className="text-2xl font-bold text-blue-600">{statistics.systemBackups}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600">Kullanıcı Yedekleri</div>
            <div className="text-2xl font-bold text-green-600">{statistics.userBackups}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600">Toplam Boyut</div>
            <div className="text-2xl font-bold text-purple-600">{statistics.totalSizeMB} MB</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
        <h2 className="text-lg font-semibold mb-4">Yeni Yedek Oluştur</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sistem Yedeği */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <Server className="h-5 w-5 text-blue-600" />
              Sistem Yedeği
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Tüm veritabanının yedeğini alır
            </p>
            <button
              onClick={handleCreateSystemBackup}
              disabled={loading}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              Sistem Yedeği Al
            </button>
          </div>

          {/* Kullanıcı Yedeği */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <User className="h-5 w-5 text-green-600" />
              Kullanıcı Yedeği
            </h3>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Kullanıcı Seçin</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.email})
                </option>
              ))}
            </select>
            <button
              onClick={handleCreateUserBackup}
              disabled={loading || !selectedUser}
              className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              Kullanıcı Yedeği Al
            </button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={handleCleanup}
            disabled={loading}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg border border-red-200 flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Eski Yedekleri Temizle (30+ gün)
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Filtre:</span>
          {['all', 'system', 'user', 'tenant'].map(filterType => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType as any)}
              className={`px-3 py-1 rounded-lg text-sm ${
                filter === filterType
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filterType === 'all' ? 'Tümü' : 
               filterType === 'system' ? 'Sistem' :
               filterType === 'user' ? 'Kullanıcı' : 'Tenant'}
            </button>
          ))}
        </div>
      </div>

      {/* Backup List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Yedekler ({backups.length})</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Yükleniyor...</div>
        ) : backups.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Henüz yedek bulunmuyor
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {backups.map(backup => (
              <div key={backup.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${
                      backup.type === 'system' ? 'bg-blue-100 text-blue-600' :
                      backup.type === 'user' ? 'bg-green-100 text-green-600' :
                      'bg-purple-100 text-purple-600'
                    }`}>
                      {getBackupIcon(backup.type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">
                          {backup.type === 'system' ? 'Sistem Yedeği' :
                           backup.type === 'user' ? `Kullanıcı: ${backup.entityName}` :
                           `Tenant: ${backup.entityName}`}
                        </h3>
                        <span className="text-xs text-gray-500">{formatBytes(backup.size)}</span>
                      </div>
                      
                      {backup.description && (
                        <p className="text-sm text-gray-600 mt-1">{backup.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatDate(backup.createdAt)}
                        </span>
                        <span className="text-xs font-mono">{backup.filename}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => setShowRestoreConfirm({
                        show: true,
                        backup,
                        type: backup.type as any
                      })}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 text-sm"
                    >
                      <Upload className="h-4 w-4" />
                      Geri Yükle
                    </button>
                    <button
                      onClick={() => handleDelete(backup.id)}
                      className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center gap-1 text-sm"
                    >
                      <Trash2 className="h-4 w-4" />
                      Sil
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm.show && showRestoreConfirm.backup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-yellow-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold">Geri Yükleme Onayı</h3>
            </div>

            <p className="text-gray-600 mb-4">
              {showRestoreConfirm.type === 'system' ? (
                <>
                  <strong>Dikkat:</strong> Tüm sistem {formatDate(showRestoreConfirm.backup.createdAt)} tarihine geri yüklenecek.
                  Bu işlem geri alınamaz!
                </>
              ) : (
                <>
                  <strong>{showRestoreConfirm.backup.entityName}</strong> kullanıcısının verileri{' '}
                  {formatDate(showRestoreConfirm.backup.createdAt)} tarihine geri yüklenecek.
                  Diğer kullanıcılar etkilenmeyecek.
                </>
              )}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRestoreConfirm({ show: false, type: 'system' })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleRestore}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Geri Yükleniyor...' : 'Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
