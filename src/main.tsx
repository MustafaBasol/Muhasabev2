import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';
import './index.css';

console.log('🚀 MoneyFlow uygulaması başlatılıyor...');

// Root element'i kontrol et
const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element bulunamadı!');
}

console.log('✅ Root element bulundu, uygulama render ediliyor...');

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
  
  console.log('✅ MoneyFlow uygulaması başarıyla yüklendi!');
} catch (error: any) {
  console.error('❌ Uygulama yüklenemedi:', error);
  console.error('Stack trace:', error.stack);
  
  reactRoot.render(
    <StrictMode>
      <div style={{color: 'red', padding: '40px', textAlign: 'center', fontFamily: 'Arial, sans-serif'}}>
        <h1>❌ Uygulama Yüklenemedi</h1>
        <p style={{margin: '20px 0'}}><strong>Hata:</strong> {error.message}</p>
        <details style={{textAlign: 'left', background: '#f8f9fa', padding: '20px', borderRadius: '5px'}}>
          <summary>Teknik Detaylar</summary>
          <pre style={{fontSize: '12px', overflow: 'auto'}}>{error.stack}</pre>
        </details>
        <p style={{marginTop: '20px'}}>
          <a href="/clear-storage.html" style={{color: '#007bff'}}>Storage'ı temizle ve tekrar dene</a>
        </p>
      </div>
    </StrictMode>
  );
}

