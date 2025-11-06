// Safe environment debug helper
// Only logs when explicitly enabled to avoid leaking sensitive configuration.
// Enable temporarily in browser console:
//   localStorage.setItem('debug', '1'); location.reload();
// Or set VITE_DEBUG_MODE=true in .env (for local DEV only)

const DEBUG_ENABLED = (
  (import.meta.env.DEV && (import.meta.env.VITE_DEBUG_MODE === 'true')) ||
  (typeof localStorage !== 'undefined' && localStorage.getItem('debug') === '1')
);

if (DEBUG_ENABLED) {
  console.log('=== ENVIRONMENT DEBUG (safe) ===');
  console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
  console.log('MODE:', import.meta.env.MODE, '| DEV:', import.meta.env.DEV, '| PROD:', import.meta.env.PROD);
  const testUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3000');
  console.log('Final API URL will be:', testUrl);
}

// Expose a minimal helper for on-demand check without auto-logging
window.envDebug = () => {
  // Intentionally minimal to avoid dumping entire env
  console.log('Current API Base URL:', import.meta.env.VITE_API_URL);
};