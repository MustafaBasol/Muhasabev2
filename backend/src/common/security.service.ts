import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

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
}
