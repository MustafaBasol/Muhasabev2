import { safeLocalStorage, safeSessionStorage } from './localStorageSafe';

const ADMIN_TOKEN_KEY = 'admin-token';

let memoryToken: string | null = null;

export const adminAuthStorage = {
  getToken(): string | null {
    const sessionToken = safeSessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (sessionToken) {
      memoryToken = sessionToken;
      return sessionToken;
    }

    const legacyToken = safeLocalStorage.getItem(ADMIN_TOKEN_KEY);
    if (legacyToken) {
      memoryToken = legacyToken;
      safeSessionStorage.setItem(ADMIN_TOKEN_KEY, legacyToken);
      safeLocalStorage.removeItem(ADMIN_TOKEN_KEY);
      return legacyToken;
    }

    return memoryToken;
  },
  setToken(token: string) {
    memoryToken = token;
    safeSessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    // Ensure stale persisted copies are cleared to limit exposure window
    safeLocalStorage.removeItem(ADMIN_TOKEN_KEY);
  },
  clearToken() {
    memoryToken = null;
    safeSessionStorage.removeItem(ADMIN_TOKEN_KEY);
    safeLocalStorage.removeItem(ADMIN_TOKEN_KEY);
  },
};
