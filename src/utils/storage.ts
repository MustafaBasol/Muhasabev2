// src/utils/storage.ts
// Güvenli localStorage wrapper

import { safeLocalStorage } from './localStorageSafe';

/**
 * AES-GCM tabanlı güvenli encryption
 * Web Crypto API kullanarak güçlü şifreleme
 */
const secureEncrypt = async (text: string, password: string): Promise<string> => {
  if (!text) return '';
  
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    // Salt oluştur
    const salt = crypto.getRandomValues(new Uint8Array(16));
    
    // Anahtarı türet
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // IV oluştur
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Şifrele
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
    
    // Salt + IV + encrypted data'yı birleştir
    const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    result.set(salt);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);

    // Büyük verilerde (örn. base64 logo) call stack taşmaması için chunk'lı base64 dönüşümü
    let binary = '';
    const chunkSize = 0x8000; // 32KB
    for (let i = 0; i < result.length; i += chunkSize) {
      const chunk = result.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  } catch (error) {
    console.error('Encryption failed:', error);
    return '';
  }
};

// Basit base64 kontrolü (tam garantili değil ama pratik)
const isProbablyBase64 = (str: string): boolean => {
  if (!str) return false;
  // JSON benzeri içerikleri hemen ele
  if (str.trim().startsWith('{') || str.trim().startsWith('[') || str.includes(':"')) return false;
  // Base64 karakter seti ve padding kontrolü
  const base64Regex = /^[A-Za-z0-9+/=\s]+$/;
  if (!base64Regex.test(str)) return false;
  const cleaned = str.replace(/\s+/g, '');
  return cleaned.length % 4 === 0;
};

const secureDecrypt = async (encryptedData: string, password: string): Promise<string> => {
  if (!encryptedData) return '';
  
  try {
    // Şifrelenmemiş (düz) veri gelmişse sessizce vazgeç
    if (!isProbablyBase64(encryptedData)) return '';
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Base64 decode
    const data = new Uint8Array(
      atob(encryptedData)
        .split('')
        .map(char => char.charCodeAt(0))
    );
    
    // Salt, IV ve encrypted data'yı ayır
    const salt = data.slice(0, 16);
    const iv = data.slice(16, 28);
    const encrypted = data.slice(28);
    
    // Anahtarı türet
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    // Şifre çöz
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    return decoder.decode(decrypted);
  } catch {
    // Sessizce fallback'a izin ver (legacy/plaintext durumları için)
    return '';
  }
};

// Fallback için basit XOR (eski veriler için)
const simpleEncrypt = (text: string, key: string): string => {
  if (!text) return '';
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);
};

const simpleDecrypt = (encrypted: string, key: string): string => {
  if (!encrypted) return '';
  try {
    const decoded = atob(encrypted);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    return '';
  }
};

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'default-key-change-me-please-use-secure-key';
const ENABLE_ENCRYPTION = import.meta.env.VITE_ENABLE_ENCRYPTION === 'true';
const USE_SECURE_CRYPTO = import.meta.env.VITE_USE_SECURE_CRYPTO === 'true';

/**
 * Güvenli localStorage operations
 */
export const secureStorage = {
  /**
   * Veriyi localStorage'a güvenli şekilde kaydet
   */
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (!ENABLE_ENCRYPTION) {
        safeLocalStorage.setItem(key, value);
        return;
      }

      let dataToStore: string;
      if (USE_SECURE_CRYPTO && window.crypto && window.crypto.subtle) {
        // Modern tarayıcılarda güvenli şifreleme kullan
        dataToStore = await secureEncrypt(value, ENCRYPTION_KEY);
      } else {
        // Fallback: basit XOR
        dataToStore = simpleEncrypt(value, ENCRYPTION_KEY);
      }
      
      safeLocalStorage.setItem(key, dataToStore);
    } catch (error) {
      console.error('Storage setItem failed:', error);
    }
  },

  /**
   * localStorage'dan veriyi güvenli şekilde oku
   */
  getItem: async (key: string): Promise<string | null> => {
    try {
      const stored = safeLocalStorage.getItem(key);
      if (!stored) return null;
      
      if (!ENABLE_ENCRYPTION) {
        return stored;
      }

      // Eski/şifresiz kayıtlar için hızlı kaçış
      if (!isProbablyBase64(stored)) {
        return stored; // plaintext fallback
      }

      if (USE_SECURE_CRYPTO && window.crypto && window.crypto.subtle) {
        // Modern tarayıcılarda güvenli şifre çözme kullan
        const decrypted = await secureDecrypt(stored, ENCRYPTION_KEY);
        // Eğer güvenli şifre çözme başarısızsa, fallback dene
        return decrypted || simpleDecrypt(stored, ENCRYPTION_KEY);
      } else {
        // Fallback: basit XOR
        return simpleDecrypt(stored, ENCRYPTION_KEY);
      }
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
      safeLocalStorage.removeItem(key);
    } catch (error) {
      console.error('Storage removeItem failed:', error);
    }
  },

  /**
   * JSON veriyi kaydet
   */
  setJSON: async <T>(key: string, value: T): Promise<void> => {
    try {
      const jsonString = JSON.stringify(value);
      await secureStorage.setItem(key, jsonString);
    } catch (error) {
      console.error('Storage setJSON failed:', error);
    }
  },

  /**
   * JSON veriyi oku
   */
  getJSON: async <T>(key: string): Promise<T | null> => {
    try {
      const stored = await secureStorage.getItem(key);
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
  setLoggedIn: async (value: boolean): Promise<void> => {
    await secureStorage.setItem('isLoggedIn', value.toString());
  },

  /**
   * Login durumunu kontrol et
   */
  isLoggedIn: async (): Promise<boolean> => {
    const result = await secureStorage.getItem('isLoggedIn');
    return result === 'true';
  },

  /**
   * Logout - tüm session verilerini temizle
   */
  clearSession: (): void => {
    secureStorage.removeItem('isLoggedIn');
    // İhtiyaç durumunda diğer session verilerini de temizle
  },
};
