import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { logger } from './utils/logger';

logger.info('🚀 Main.tsx başladı');

try {
  const root = document.getElementById('root');
    logger.debug('📍 Root element:', root);
  
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
  
  logger.info('✅ React app başarıyla render edildi');
} catch (error) {
  console.error('❌ React app render hatası:', error);
  const msg = error instanceof Error ? error.message : String(error);
  document.body.innerHTML = `<h1 style="color: red;">HATA: ${msg}</h1>`;
}