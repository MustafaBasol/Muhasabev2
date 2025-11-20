import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../api/admin';

type SecurityConfig = {
  username: string;
  twoFactorEnabled: boolean;
  twoFactorProvisioning?: {
    otpauthUrl: string;
    qrDataUrl: string;
    base32: string;
  } | null;
};

export default function AdminSecurityPage() {
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Credentials form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 2FA
  const [twoFAToken, setTwoFAToken] = useState('');
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getSecurityConfig();
      setConfig(data);
      setNewUsername(data?.username || '');
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Güvenlik ayarları yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      setError('Yeni şifreler eşleşmiyor');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const res = await adminApi.updateAdminCredentials({
        currentPassword,
        newUsername: newUsername || undefined,
        newPassword: newPassword || undefined,
      });
      setMessage('Bilgiler güncellendi');
      setTimeout(() => setMessage(null), 2500);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await loadConfig();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Güncelleme başarısız');
    } finally {
      setSaving(false);
    }
  };

  const begin2FASetup = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await adminApi.twoFASetup();
      setConfig((prev) => prev ? { ...prev, twoFactorProvisioning: res } : prev);
      setIsSettingUp2FA(true);
      setMessage('Authenticator uygulamasıyla QR kodu tarayın ve kodu doğrulayın');
      setTimeout(() => setMessage(null), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || '2FA başlatılamadı');
    } finally {
      setSaving(false);
    }
  };

  const verify2FA = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await adminApi.twoFAVerify({ token: twoFAToken });
      if (Array.isArray(res?.recoveryCodes) && res.recoveryCodes.length > 0) {
        setMessage('2FA etkinleştirildi. Kurtarma kodlarınızı güvenli bir yere kaydedin.');
        setRecoveryCodes(res.recoveryCodes);
      } else {
        setMessage('2FA etkinleştirildi');
      }
      setTimeout(() => setMessage(null), 2500);
      setIsSettingUp2FA(false);
      setTwoFAToken('');
      await loadConfig();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Doğrulama başarısız');
    } finally {
      setSaving(false);
    }
  };

  const disable2FA = async () => {
    if (!window.confirm('2FA devre dışı bırakılsın mı?')) return;
    try {
      setSaving(true);
      setError(null);
      await adminApi.twoFADisable();
      setMessage('2FA devre dışı bırakıldı');
      setTimeout(() => setMessage(null), 2500);
      await loadConfig();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || '2FA devre dışı bırakılamadı');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">🔐 Admin Güvenlik</h2>
        <p className="text-sm text-gray-600">Kullanıcı adınızı, şifrenizi ve iki faktörlü kimlik doğrulamayı yönetin.</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>
      )}
      {message && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded">{message}</div>
      )}

      {/* Credentials */}
      <form onSubmit={handleUpdateCredentials} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h3 className="font-medium text-gray-800">Giriş Bilgileri</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Mevcut Şifre</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Yeni Kullanıcı Adı</label>
            <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Boş bırakırsanız değişmez" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Yeni Şifre</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Boş bırakırsanız değişmez" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Yeni Şifre (Tekrar)</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">Kaydet</button>
        </div>
      </form>

      {/* 2FA Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h3 className="font-medium text-gray-800">İki Faktörlü Kimlik Doğrulama (2FA)</h3>
        {config?.twoFactorEnabled ? (
          <div className="space-y-3">
            <p className="text-sm text-green-700">Durum: Etkin</p>
            <button onClick={disable2FA} disabled={saving} className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50">2FA'yı devre dışı bırak</button>
            {Array.isArray(recoveryCodes) && recoveryCodes.length > 0 && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-4">
                <div className="text-sm font-medium text-amber-800 mb-2">Kurtarma Kodları (tek kullanımlık)</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-amber-900">
                  {recoveryCodes.map((c) => (
                    <code key={c} className="px-2 py-1 bg-white border border-amber-300 rounded">{c}</code>
                  ))}
                </div>
                <div className="text-xs text-amber-700 mt-2">Bu kodları güvenli bir yere kaydedin. Her biri sadece bir kez kullanılabilir.</div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">Durum: Devre dışı</p>
            {!isSettingUp2FA ? (
              <button onClick={begin2FASetup} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">2FA'yı etkinleştir</button>
            ) : (
              <div className="space-y-3">
                {config?.twoFactorProvisioning?.qrDataUrl && (
                  <img src={config.twoFactorProvisioning.qrDataUrl} alt="2FA QR" className="w-40 h-40" />
                )}
                <div className="text-xs text-gray-600 break-all">
                  {config?.twoFactorProvisioning?.base32}
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Authenticator Kodu</label>
                    <input value={twoFAToken} onChange={(e) => setTwoFAToken(e.target.value)} className="px-3 py-2 border rounded-lg" placeholder="123 456" />
                  </div>
                  <button onClick={verify2FA} disabled={saving || !twoFAToken} className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50">Doğrula ve Etkinleştir</button>
                </div>
                {message?.includes('Kurtarma kod') && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3">
                    <div className="text-sm text-amber-800 font-medium mb-1">ÖNEMLİ: Kurtarma Kodları</div>
                    <div className="text-xs text-amber-700">Doğrulamadan sonra ekranda gösterilecek kurtarma kodlarını mutlaka güvenli bir yere kaydedin. Bu kodlar TOTP erişiminiz yokken giriş için tek kullanımlıktır.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Öneriler */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-2">
        <h3 className="font-medium text-gray-800">Güvenlik Önerileri</h3>
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
          <li>Parolanızı en az 12 karakter, karmaşık bir kombinasyonla belirleyin.</li>
          <li>2FA'yı etkinleştirip yedek kurtarma kodlarını güvenli yerde saklayın.</li>
          <li>Admin token'ı düzenli aralıklarla revoke edin ve yeniden giriş yapın.</li>
          <li>Üretimde düz şifre yerine `ADMIN_PASSWORD_HASH` kullanın.</li>
        </ul>
      </div>
    </div>
  );
}
