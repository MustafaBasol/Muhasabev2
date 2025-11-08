import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
// İsteğe bağlı hafif parola skoru ölçümü (entropy tahmini)
// zxcvbn kullanmak yerine basit karakter çeşitliliği ve uzunluk üzerinden skorlama yapıyoruz.

export interface PasswordScoreResult {
  score: number; // 0-4 arası hedef (zxcvbn benzeri ölçek)
  length: number;
  variety: number; // kullanılan karakter grubu sayısı
  entropyBits: number; // kaba tahmin
  suggestions: string[];
}

@Injectable()
export class SecurityService {
  // Increased from 10 to 12 for better security
  private readonly BCRYPT_ROUNDS = 12;

  /**
   * Hash a password using bcrypt with increased rounds
   * @param plainPassword - The plain text password
   * @returns Promise<string> - The hashed password
   */
  async hashPassword(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, this.BCRYPT_ROUNDS);
  }

  /**
   * Compare a plain password with a hashed password
   * @param plainPassword - The plain text password
   * @param hashedPassword - The hashed password
   * @returns Promise<boolean> - True if passwords match
   */
  async comparePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Password'ü senkron olarak hash'ler (backup codes için)
   */
  hashPasswordSync(password: string): string {
    return bcrypt.hashSync(password, this.BCRYPT_ROUNDS);
  }

  /**
   * Random string üretir (token, verification code vb için)
   */
  generateRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate recovery codes for 2FA
   * @param count - Number of recovery codes to generate
   * @returns string[] - Array of recovery codes
   */
  generateRecoveryCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character recovery codes
      codes.push(this.generateRandomString(4).toUpperCase());
    }
    return codes;
  }

  /**
   * Basit parola skoru hesaplama (zxcvbn'u dahil etmeden).
   * Ölçütler:
   * - Uzunluk
   * - Karakter çeşitliliği (küçük, büyük, rakam, sembol)
   * - Kaba entropy tahmini: length * log2(varietyPoolSize)
   * Skor aralığı 0-4; >=minScore gereksinimini karşılıyorsa kabul.
   */
  evaluatePasswordStrength(password: string): PasswordScoreResult {
    const suggestions: string[] = [];
    if (!password) {
      return {
        score: 0,
        length: 0,
        variety: 0,
        entropyBits: 0,
        suggestions: ['Parola boş'],
      };
    }
    const length = password.length;
    let variety = 0;
    const lowers = /[a-z]/.test(password);
    const uppers = /[A-Z]/.test(password);
    const digits = /\d/.test(password);
    const symbols = /[^A-Za-z0-9]/.test(password);
    variety += lowers ? 1 : 0;
    variety += uppers ? 1 : 0;
    variety += digits ? 1 : 0;
    variety += symbols ? 1 : 0;
    const poolSize =
      (lowers ? 26 : 0) +
      (uppers ? 26 : 0) +
      (digits ? 10 : 0) +
      (symbols ? 33 : 0);
    const entropyBits =
      poolSize > 0 ? Math.round(length * Math.log2(poolSize)) : 0;

    // Heuristik skor hesaplama
    let score = 0;
    if (length >= 8) score++;
    if (length >= 12) score++;
    if (variety >= 3) score++;
    if (entropyBits >= 60) score++;
    if (entropyBits >= 80) score++;
    if (score > 4) score = 4;

    if (length < 12) suggestions.push('Daha uzun bir parola kullanın (>=12)');
    if (variety < 3)
      suggestions.push('Küçük, büyük harf, rakam ve sembol karışımı ekleyin');
    if (entropyBits < 60) suggestions.push('Sık rastlanan kalıplardan kaçının');

    return { score, length, variety, entropyBits, suggestions };
  }
}
