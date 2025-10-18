// src/utils/storage.ts
// Güvenli localStorage wrapper

/**
 * Basit XOR tabanlı encryption (production için daha güçlü yöntem kullanın)
 * NOT: Bu sadece temel bir obfuscation'dır, hassas veriler için uygun değildir
 */
const simpleEncrypt = (text: string, key: string): string => {
  if (!text) return '';
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result); // Base64 encode
};

const simpleDecrypt = (encrypted: string, key: string): string => {
  if (!encrypted) return '';
  try {
    const decoded = atob(encrypted); // Base64 decode
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    return '';
  }
};

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'default-key-change-me';
const ENABLE_ENCRYPTION = import.meta.env.VITE_ENABLE_ENCRYPTION === 'true';

/**
 * Güvenli localStorage operations
 */
export const secureStorage = {
  /**
   * Veriyi localStorage'a güvenli şekilde kaydet
   */
  setItem: (key: string, value: string): void => {
    try {
      const dataToStore = ENABLE_ENCRYPTION ? simpleEncrypt(value, ENCRYPTION_KEY) : value;
      localStorage.setItem(key, dataToStore);
    } catch (error) {
      console.error('Storage setItem failed:', error);
    }
  },

  /**
   * localStorage'dan veriyi güvenli şekilde oku
   */
  getItem: (key: string): string | null => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      return ENABLE_ENCRYPTION ? simpleDecrypt(stored, ENCRYPTION_KEY) : stored;
    } catch (error) {
      console.error('Storage getItem failed:', error);
      return null;
    }
  },

  /**
   * localStorage'dan veriyi sil
   */
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Storage removeItem failed:', error);
    }
  },

  /**
   * JSON veriyi kaydet
   */
  setJSON: <T>(key: string, value: T): void => {
    try {
      const jsonString = JSON.stringify(value);
      secureStorage.setItem(key, jsonString);
    } catch (error) {
      console.error('Storage setJSON failed:', error);
    }
  },

  /**
   * JSON veriyi oku
   */
  getJSON: <T>(key: string): T | null => {
    try {
      const stored = secureStorage.getItem(key);
      if (!stored) return null;
      return JSON.parse(stored) as T;
    } catch (error) {
      console.error('Storage getJSON failed:', error);
      return null;
    }
  },
};

/**
 * Demo credentials (environment variables'tan al)
 */
export const getDemoCredentials = () => ({
  email: import.meta.env.VITE_DEMO_EMAIL || 'demo@moneyflow.com',
  password: import.meta.env.VITE_DEMO_PASSWORD || 'demo123',
});

/**
 * Session yönetimi
 */
export const sessionManager = {
  /**
   * Login durumunu kaydet
   */
  setLoggedIn: (value: boolean): void => {
    secureStorage.setItem('isLoggedIn', value.toString());
  },

  /**
   * Login durumunu kontrol et
   */
  isLoggedIn: (): boolean => {
    return secureStorage.getItem('isLoggedIn') === 'true';
  },

  /**
   * Logout - tüm session verilerini temizle
   */
  clearSession: (): void => {
    secureStorage.removeItem('isLoggedIn');
    // İhtiyaç durumunda diğer session verilerini de temizle
  },
};
