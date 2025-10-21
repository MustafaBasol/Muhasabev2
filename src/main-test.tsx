import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

console.log('🚀 Main.tsx başladı');

try {
  const root = document.getElementById('root');
  console.log('📍 Root element:', root);
  
  if (!root) {
    throw new Error('Root element bulunamadı!');
  }
  
  createRoot(root).render(
    <StrictMode>
      <h1 style={{color: 'red', fontSize: '24px', padding: '20px'}}>
        ✅ React Çalışıyor! Test Mesajı
      </h1>
    </StrictMode>
  );
  
  console.log('✅ React app başarıyla render edildi');
} catch (error) {
  console.error('❌ React app render hatası:', error);
  document.body.innerHTML = `<h1 style="color: red;">HATA: ${error.message}</h1>`;
}