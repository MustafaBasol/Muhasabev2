import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { logger } from './utils/logger';

// Import components step by step to find the error
logger.info('1. Main.tsx başladı');

try {
  logger.info('2. AuthContext import ediliyor...');
  const { AuthProvider } = await import('./contexts/AuthContext');
  logger.info('3. AuthContext başarıyla import edildi');

  logger.info('4. CurrencyContext import ediliyor...');
  const { CurrencyProvider } = await import('./contexts/CurrencyContext');
  logger.info('5. CurrencyContext başarıyla import edildi');

  logger.info('6. App import ediliyor...');
  const App = (await import('./App')).default;
  logger.info('7. App başarıyla import edildi');

  logger.info('8. CSS import ediliyor...');
  await import('./index.css');
  logger.info('9. CSS başarıyla import edildi');

  const root = document.getElementById('root');
  logger.debug('10. Root element:', root);
  
  if (!root) {
    throw new Error('Root element bulunamadı!');
  }
  
  logger.info('11. React render başlıyor...');
  createRoot(root).render(
    <StrictMode>
      <AuthProvider>
        <CurrencyProvider>
          <App />
        </CurrencyProvider>
      </AuthProvider>
    </StrictMode>
  );
  
  logger.info('12. ✅ React app başarıyla render edildi');
} catch (err: unknown) {
  if (err instanceof Error) {
    console.error('❌ Hata oluştu:', err);
    console.error('❌ Stack trace:', err.stack);
  } else {
    console.error('❌ Hata oluştu:', err);
  }
  document.body.innerHTML = `
    <div style="color: red; padding: 20px; font-family: monospace;">
      <h1>HATA OLUŞTU</h1>
      <p><strong>Mesaj:</strong> ${err instanceof Error ? err.message : String(err)}</p>
      <p><strong>Stack:</strong></p>
      <pre>${err instanceof Error ? err.stack : JSON.stringify(err, null, 2)}</pre>
    </div>
  `;
}