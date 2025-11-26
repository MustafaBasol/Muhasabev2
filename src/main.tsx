import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './contexts/AuthContext';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n/config';
import App from './App';
import './index.css';
import './i18n/config'; // i18n konfigürasyonunu yükle
import './debug-env'; // Environment debug
import { logger } from './utils/logger';

// Konsol gürültüsünü azalt: debug/info varsayılan olarak susturulur
logger.installConsoleMute();
logger.info('🚀 Comptario uygulaması başlatılıyor...');

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
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </I18nextProvider>
    </StrictMode>
  );
  
  logger.info('✅ Comptario uygulaması başarıyla yüklendi!');
} catch (err: unknown) {
  if (err instanceof Error) {
    logger.error('❌ Uygulama yüklenemedi:', err);
    logger.error('Stack trace:', err.stack);
  } else {
    logger.error('❌ Uygulama yüklenemedi:', err);
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

