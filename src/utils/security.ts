// src/utils/security.ts
// Frontend güvenlik utilities

import DOMPurify from 'dompurify';
import { safeLocalStorage } from './localStorageSafe';
import i18n from '../i18n/config';

/**
 * XSS saldırılarına karşı HTML içeriğini temizle
 */
export const sanitizeHtml = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOW_DATA_ATTR: false,
  });
};

/**
 * Zengin metin (RTE) HTML temizleyici
 * - Başlıklar, listeler, alıntı, kod bloğu, img, link vb. korunur
 * - data: URI ile gömülü görsellere izin verir (sadece img/src)
 */
export const sanitizeRteHtml = (dirty: string): string => {
  const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|ftp|tel|file|sms|cid|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.-]|$))/i;
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'h1','h2','h3','h4','h5','h6',
      'p','br','strong','b','em','i','u','s','code','pre','blockquote','hr',
      'ul','ol','li','a','img',
      'table','thead','tbody','tr','th','td'
    ],
    ALLOWED_ATTR: ['href','target','rel','src','alt','title','colspan','rowspan'],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP,
    FORBID_TAGS: ['script','style']
  });
};

/**
 * Güvenli string escape - özel karakterleri encode et
 */
export const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * SQL injection'a karşı temel koruma (client-side)
 */
export const validateInput = (input: string): boolean => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(;|--|\||\/\*|\*\/)/g,
    /('|(\\')|(\\")|(\\\\))/g,
  ];
  
  return !sqlPatterns.some(pattern => pattern.test(input));
};

/**
 * Email formatı doğrulama
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
};

/**
 * Güçlü şifre kontrolü
 */
export const isStrongPassword = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  const minLen = 8;
  
  if (password.length < minLen) {
    errors.push(i18n.t('auth.passwordStrength.minLength', { min: minLen }));
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push(i18n.t('auth.passwordStrength.lowercase'));
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push(i18n.t('auth.passwordStrength.uppercase'));
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push(i18n.t('auth.passwordStrength.number'));
  }
  
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push(i18n.t('auth.passwordStrength.special'));
  }
  
  // Yaygın şifreler kontrolü
  const commonPasswords = [
    'password', '123456', 'admin', 'qwerty', 'abc123',
    'password123', 'admin123', '12345678'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push(i18n.t('auth.passwordStrength.tooCommon'));
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * CSRF token generator (basit implementation)
 */
export const generateCSRFToken = (): string => {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Rate limiting için client-side helper
 */
export const createRateLimiter = (limit: number, windowMs: number) => {
  const requests = new Map<string, number[]>();
  
  return (key: string): boolean => {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!requests.has(key)) {
      requests.set(key, []);
    }
    
    const keyRequests = requests.get(key)!;
    
    // Eski istekleri temizle
    const validRequests = keyRequests.filter(time => time > windowStart);
    
    if (validRequests.length >= limit) {
      return false; // Rate limit aşıldı
    }
    
    validRequests.push(now);
    requests.set(key, validRequests);
    
    return true; // İzin verildi
  };
};

/**
 * Local storage güvenlik kontrolleri
 */
export const isLocalStorageSecure = (): boolean => {
  try {
    // HTTPS kontrolü
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      console.warn('⚠️ HTTPS kullanılmıyor - localStorage güvenli değil');
      return false;
    }
    
    // Third-party cookies disabled check
    const testKey = '__storage_test__';
    safeLocalStorage.setItem(testKey, 'test');
    const stored = safeLocalStorage.getItem(testKey);
    safeLocalStorage.removeItem(testKey);
    if (stored !== 'test') {
      console.warn('⚠️ localStorage değer doğrulaması başarısız');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ localStorage kullanılamıyor:', error);
    return false;
  }
};

/**
 * Content Security Policy violation reporter
 */
export const setupCSPReporting = () => {
  document.addEventListener('securitypolicyviolation', (event) => {
    console.error('🚨 CSP Violation:', {
      blockedURI: event.blockedURI,
      documentURI: event.documentURI,
      violatedDirective: event.violatedDirective,
      originalPolicy: event.originalPolicy,
    });
    
    // Production'da bu bilgileri server'a gönder
    if (import.meta.env.PROD) {
      fetch('/api/csp-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'csp-violation',
          details: {
            blockedURI: event.blockedURI,
            documentURI: event.documentURI,
            violatedDirective: event.violatedDirective,
          },
          timestamp: new Date().toISOString(),
        }),
      }).catch(console.error);
    }
  });
};