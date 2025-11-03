// backend/src/common/validators/security.validator.ts
// Backend güvenlik validatorları

import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * SQL Injection koruması
 */
@ValidatorConstraint({ name: 'NoSqlInjection', async: false })
class NoSqlInjectionConstraint implements ValidatorConstraintInterface {
  validate(value: any) {
    if (typeof value !== 'string') return true;

    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
      /(;|--|\||\/\*|\*\/)/g,
      /('|(\\')|(\\")|(\\\\))/g,
      /(%27|')/gi, // SQL injection patterns
      /(%3C|<)/gi, // XSS patterns
      /(%3E|>)/gi, // XSS patterns
    ];

    return !sqlPatterns.some((pattern) => pattern.test(value));
  }

  defaultMessage() {
    return 'Input contains potentially dangerous characters';
  }
}

export function NoSqlInjection(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: NoSqlInjectionConstraint,
    });
  };
}

/**
 * XSS koruması
 */
@ValidatorConstraint({ name: 'NoXss', async: false })
class NoXssConstraint implements ValidatorConstraintInterface {
  validate(value: any) {
    if (typeof value !== 'string') return true;

    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>.*?<\/embed>/gi,
      /<link[^>]*>/gi,
      /<meta[^>]*>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload=/gi,
      /onerror=/gi,
      /onclick=/gi,
    ];

    return !xssPatterns.some((pattern) => pattern.test(value));
  }

  defaultMessage() {
    return 'Input contains potentially dangerous HTML/JavaScript';
  }
}

export function NoXss(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: NoXssConstraint,
    });
  };
}

/**
 * Güçlü şifre validasyonu
 */
@ValidatorConstraint({ name: 'StrongPassword', async: false })
class StrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(password: any) {
    if (typeof password !== 'string') return false;

    // Minimum 8 karakter
    if (password.length < 8) return false;

    // En az bir küçük harf
    if (!/[a-z]/.test(password)) return false;

    // En az bir büyük harf
    if (!/[A-Z]/.test(password)) return false;

    // En az bir rakam
    if (!/[0-9]/.test(password)) return false;

    // En az bir özel karakter (harf/rakam ve boşluk dışı herhangi bir karakter)
    if (!/[^A-Za-z0-9\s]/.test(password)) return false;

    // Yaygın şifreler kontrolü
    const commonPasswords = [
      'password',
      '123456',
      'admin',
      'qwerty',
      'abc123',
      'password123',
      'admin123',
      '12345678',
      'letmein',
      'welcome',
      'monkey',
      'dragon',
      'password1',
    ];

    if (commonPasswords.includes(password.toLowerCase())) return false;

    return true;
  }

  defaultMessage() {
    return 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character';
  }
}

export function StrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: StrongPasswordConstraint,
    });
  };
}

/**
 * Dosya yolu güvenliği
 */
@ValidatorConstraint({ name: 'SafeFilePath', async: false })
class SafeFilePathConstraint implements ValidatorConstraintInterface {
  validate(path: any) {
    if (typeof path !== 'string') return true;

    const dangerousPatterns = [
      /\.\./g, // Path traversal
      /[<>:"|?*]/g, // Invalid filename characters
      /^\/+/g, // Absolute paths
      /\\+/g, // Backslashes
    ];

    return !dangerousPatterns.some((pattern) => pattern.test(path));
  }

  defaultMessage() {
    return 'File path contains potentially dangerous characters';
  }
}

export function SafeFilePath(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: SafeFilePathConstraint,
    });
  };
}
