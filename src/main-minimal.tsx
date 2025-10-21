import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

console.log('🔍 Minimal test başlıyor...');

const root = document.getElementById('root');
if (!root) {
  document.body.innerHTML = '<h1 style="color: red;">Root element bulunamadı!</h1>';
  throw new Error('Root element not found');
}

try {
  createRoot(root).render(
    <StrictMode>
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        <h1 style={{ color: 'green' }}>✅ React Çalışıyor!</h1>
        <p>Bu mesajı görüyorsanız React başarıyla yüklendi.</p>
        <p>Şimdi Context'leri test edeceğiz...</p>
      </div>
    </StrictMode>
  );
  console.log('✅ Minimal React uygulaması başarıyla render edildi');
} catch (error) {
  console.error('❌ React render hatası:', error);
  document.body.innerHTML = `<h1 style="color: red;">React render hatası: ${error}</h1>`;
}