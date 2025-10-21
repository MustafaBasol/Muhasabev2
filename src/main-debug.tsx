import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Import components step by step to find the error
console.log('1. Main.tsx başladı');

try {
  console.log('2. AuthContext import ediliyor...');
  const { AuthProvider } = await import('./contexts/AuthContext');
  console.log('3. AuthContext başarıyla import edildi');

  console.log('4. CurrencyContext import ediliyor...');
  const { CurrencyProvider } = await import('./contexts/CurrencyContext');
  console.log('5. CurrencyContext başarıyla import edildi');

  console.log('6. App import ediliyor...');
  const App = (await import('./App')).default;
  console.log('7. App başarıyla import edildi');

  console.log('8. CSS import ediliyor...');
  await import('./index.css');
  console.log('9. CSS başarıyla import edildi');

  const root = document.getElementById('root');
  console.log('10. Root element:', root);
  
  if (!root) {
    throw new Error('Root element bulunamadı!');
  }
  
  console.log('11. React render başlıyor...');
  createRoot(root).render(
    <StrictMode>
      <AuthProvider>
        <CurrencyProvider>
          <App />
        </CurrencyProvider>
      </AuthProvider>
    </StrictMode>
  );
  
  console.log('12. ✅ React app başarıyla render edildi');
} catch (error: any) {
  console.error('❌ Hata oluştu:', error);
  console.error('❌ Stack trace:', error.stack);
  document.body.innerHTML = `
    <div style="color: red; padding: 20px; font-family: monospace;">
      <h1>HATA OLUŞTU</h1>
      <p><strong>Mesaj:</strong> ${error.message}</p>
      <p><strong>Stack:</strong></p>
      <pre>${error.stack}</pre>
    </div>
  `;
}