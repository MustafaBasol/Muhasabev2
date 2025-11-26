import { safeLocalStorage } from './utils/localStorageSafe';

/*
  Safe environment debug helper.
  - Verbose env logging stays disabled unless explicitly requested.
  - Enable temporarily in the browser console with:
      window.__enableEnvDebug?.(); // helper below does the safe write + reload
*/

const getStorageDebugFlag = (): boolean => safeLocalStorage.getItem('debug') === '1';

const DEBUG_ENABLED = (
  (import.meta.env.DEV && import.meta.env.VITE_DEBUG_MODE === 'true') ||
  getStorageDebugFlag()
);

const logEnvironmentSummary = () => {
  console.log('=== ENVIRONMENT DEBUG (safe) ===');
  console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
  console.log('MODE:', import.meta.env.MODE, '| DEV:', import.meta.env.DEV, '| PROD:', import.meta.env.PROD);
  const testUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3000');
  console.log('Final API URL will be:', testUrl);
};

if (DEBUG_ENABLED) {
  logEnvironmentSummary();
}

declare global {
  interface Window {
    envDebug?: () => void;
    __enableEnvDebug?: () => void;
    __disableEnvDebug?: () => void;
  }
}

if (typeof window !== 'undefined') {
  window.envDebug = () => {
    console.log('Current API Base URL:', import.meta.env.VITE_API_URL);
  };
  window.__enableEnvDebug = () => {
    safeLocalStorage.setItem('debug', '1');
    console.log('Env debug flag enabled. Reloading...');
    window.location.reload();
  };
  window.__disableEnvDebug = () => {
    safeLocalStorage.removeItem('debug');
    console.log('Env debug flag cleared. Reloading...');
    window.location.reload();
  };
}
