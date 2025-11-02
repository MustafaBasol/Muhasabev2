import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';
import './index.css';
import './i18n/config'; // i18n konfigürasyonunu yükle
import './debug-env.js'; // Environment debug
import { logger } from './utils/logger';

logger.info('🚀 MoneyFlow uygulaması başlatılıyor...');

// Root element'i kontrol et
const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element bulunamadı!');
}

logger.info('✅ Root element bulundu, uygulama render ediliyor...');

// Root instance'ı oluştur ve uygulamayı direkt render et
const reactRoot = createRoot(root);

try {
  reactRoot.render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>
  );
  
  logger.info('✅ MoneyFlow uygulaması başarıyla yüklendi!');
} catch (err: unknown) {
  if (err instanceof Error) {
    console.error('❌ Uygulama yüklenemedi:', err);
    console.error('Stack trace:', err.stack);
  } else {
    console.error('❌ Uygulama yüklenemedi:', err);
  }

  reactRoot.render(
    <StrictMode>
      <div style={{color: 'red', padding: '40px', textAlign: 'center', fontFamily: 'Arial, sans-serif'}}>
        <h1>❌ Uygulama Yüklenemedi</h1>
        <p style={{margin: '20px 0'}}><strong>Hata:</strong> {err instanceof Error ? err.message : String(err)}</p>
        <details style={{textAlign: 'left', background: '#f8f9fa', padding: '20px', borderRadius: '5px'}}>
          <summary>Teknik Detaylar</summary>
          <pre style={{fontSize: '12px', overflow: 'auto'}}>{err instanceof Error ? err.stack : JSON.stringify(err, null, 2)}</pre>
        </details>
        <p style={{marginTop: '20px'}}>
          <a href="/clear-storage.html" style={{color: '#007bff'}}>Storage'ı temizle ve tekrar dene</a>
        </p>
      </div>
    </StrictMode>
  );
}

