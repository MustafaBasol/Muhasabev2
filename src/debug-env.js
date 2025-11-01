// Test environment variables
console.log('=== ENVIRONMENT DEBUG ===');
console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('PROD mode:', import.meta.env.PROD);
console.log('DEV mode:', import.meta.env.DEV);
console.log('All env vars:', import.meta.env);

// Test API client initialization
const testUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3000');
console.log('Final API URL will be:', testUrl);

// Export for cleanup
window.envDebug = () => {
  console.log('Current API Base URL:', import.meta.env.VITE_API_URL);
};