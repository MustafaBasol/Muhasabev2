import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getPennylaneAuthorizeUrl,
  getPennylaneStatus,
  disconnectPennylane,
  syncPennylaneInvoices,
  verifyPennylaneConnection,
  syncIncomingInvoices,
} from '../../api/integrations';
import { formatAppDateTime } from '../../utils/dateFormat';

export default function PennylaneIntegrationPanel() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<{
    connected: boolean;
    connectedAt?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingIncoming, setSyncingIncoming] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await getPennylaneStatus();
      setStatus(s);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    // OAuth callback sonrası ?connected=pennylane parametresini kontrol et
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'pennylane') {
      setSyncMessage(t('integrations.pennylane.connected'));
      const url = new URL(window.location.href);
      url.searchParams.delete('connected');
      window.history.replaceState({}, '', url.toString());
    }
    if (params.get('error')) {
      setSyncMessage(`${t('integrations.pennylane.connectionError')} ${params.get('error')}`);
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url.toString());
    }
  }, [load]);

  const handleConnect = () => {
    window.location.href = getPennylaneAuthorizeUrl();
  };

  const handleDisconnect = async () => {
    if (!confirm(t('integrations.pennylane.disconnect') + '?')) return;
    setDisconnecting(true);
    try {
      await disconnectPennylane();
      await load();
      setSyncMessage(t('integrations.pennylane.disconnect'));
    } catch {
      setSyncMessage(t('common.error', 'Bağlantı kesme başarısız.'));
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await syncPennylaneInvoices();
      setSyncMessage(
        `${t('integrations.pennylane.syncInvoices')}: ${result.updated ?? 0}`,
      );
    } catch {
      setSyncMessage(t('common.error', 'Senkronizasyon sırasında hata oluştu.'));
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncIncoming = async () => {
    setSyncingIncoming(true);
    setSyncMessage(null);
    try {
      const result = await syncIncomingInvoices();
      setSyncMessage(
        `${t('integrations.pennylane.incomingSyncDone')}: +${result.created}`,
      );
    } catch {
      setSyncMessage(t('integrations.pennylane.incomingSyncError'));
    } finally {
      setSyncingIncoming(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setSyncMessage(null);
    try {
      const result = await verifyPennylaneConnection();
      setSyncMessage(
        result.ok
          ? `${t('integrations.pennylane.verified')} (${result.email ?? ''})`
          : t('integrations.pennylane.verifyFailed'),
      );
    } catch {
      setSyncMessage(t('integrations.pennylane.verifyFailed'));
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse h-24 bg-gray-100 rounded-xl" />
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl p-5">
      {/* Başlık */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Pennylane logosu (metin tabanlı) */}
          <div className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center text-white font-bold text-sm">
            PL
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Pennylane</h3>
            <p className="text-xs text-gray-500">
              {t('integrations.pennylane.subtitle')}
            </p>
          </div>
        </div>

        {/* Bağlantı durumu göstergesi */}
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
            status?.connected
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              status?.connected ? 'bg-green-500' : 'bg-gray-400'
            }`}
          />
          {status?.connected ? t('integrations.pennylane.connectedLabel') : t('integrations.pennylane.notConnectedLabel')}
        </span>
      </div>

      {/* Bağlantı bilgisi */}
      {status?.connected && status.connectedAt && (
        <p className="text-xs text-gray-500 mb-4">
          {t('integrations.pennylane.connectedSince')} {formatAppDateTime(status.connectedAt)}
        </p>
      )}

      {/* Bildirim mesajı */}
      {syncMessage && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm">
          {syncMessage}
        </div>
      )}

      {/* Aksiyonlar */}
      <div className="flex flex-wrap gap-2">
        {!status?.connected ? (
          <button
            onClick={handleConnect}
            className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition-colors"
          >
            {t('integrations.pennylane.connect')}
          </button>
        ) : (
          <>
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {verifying ? t('integrations.pennylane.testing') : t('integrations.pennylane.testConnection')}
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {syncing ? t('integrations.pennylane.syncing') : t('integrations.pennylane.syncInvoices')}
            </button>
            <button
              onClick={handleSyncIncoming}
              disabled={syncingIncoming}
              className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {syncingIncoming ? t('integrations.pennylane.incomingSyncing') : t('integrations.pennylane.syncIncoming')}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="px-4 py-2 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {disconnecting ? t('integrations.pennylane.disconnecting') : t('integrations.pennylane.disconnect')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
