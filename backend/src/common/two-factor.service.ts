import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface TwoFactorSecretResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

@Injectable()
export class TwoFactorService {
  /**
   * TOTP için güvenli secret üretir
   */
  generateSecret(): string {
    // Base32 karakterleri için 32 byte random veri
    const buffer = crypto.randomBytes(20);
    return this.base32Encode(buffer);
  }

  /**
   * TOTP token hesaplar (6 haneli, 30 saniye geçerli)
   */
  generateToken(secret: string, timeWindow?: number): string {
    const time = Math.floor((timeWindow || Date.now()) / 30000);
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigUInt64BE(BigInt(time), 0);

    const secretBuffer = this.base32Decode(secret);
    const hmac = crypto.createHmac('sha1', secretBuffer);
    hmac.update(timeBuffer);
    const digest = hmac.digest();

    const offset = digest[digest.length - 1] & 0xf;
    const code =
      (((digest[offset] & 0x7f) << 24) |
        ((digest[offset + 1] & 0xff) << 16) |
        ((digest[offset + 2] & 0xff) << 8) |
        (digest[offset + 3] & 0xff)) %
      1000000;

    return code.toString().padStart(6, '0');
  }

  /**
   * TOTP token doğrular (±1 time window toleransı ile)
   */
  verifyToken(secret: string, token: string): boolean {
    const currentTime = Date.now();

    // Mevcut zaman dilimi
    if (this.generateToken(secret, currentTime) === token) {
      return true;
    }

    // Önceki zaman dilimi (30 saniye önce)
    if (this.generateToken(secret, currentTime - 30000) === token) {
      return true;
    }

    // Sonraki zaman dilimi (30 saniye sonra)
    if (this.generateToken(secret, currentTime + 30000) === token) {
      return true;
    }

    return false;
  }

  /**
   * QR kod URL'i oluşturur
   */
  generateQRCodeUrl(
    secret: string,
    accountName: string,
    issuer: string = 'Muhasebe App',
  ): string {
    const encodedAccount = encodeURIComponent(accountName);
    const encodedIssuer = encodeURIComponent(issuer);
    return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  /**
   * Backup kodları üretir (10 adet 8 haneli)
   */
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Kullanıcı için 2FA setup bilgilerini oluşturur
   */
  generateTwoFactorSetup(accountName: string): TwoFactorSecretResponse {
    const secret = this.generateSecret();
    const qrCodeUrl = this.generateQRCodeUrl(secret, accountName);
    const backupCodes = this.generateBackupCodes();

    return {
      secret,
      qrCodeUrl,
      backupCodes,
    };
  }

  /**
   * Base32 encoding (RFC 4648)
   */
  private base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31];
    }

    return output;
  }

  /**
   * Base32 decoding
   */
  private base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let index = 0;
    const output = Buffer.alloc(Math.ceil((encoded.length * 5) / 8));

    for (let i = 0; i < encoded.length; i++) {
      const charIndex = alphabet.indexOf(encoded.charAt(i).toUpperCase());
      if (charIndex === -1) continue;

      value = (value << 5) | charIndex;
      bits += 5;

      if (bits >= 8) {
        output[index++] = (value >>> (bits - 8)) & 255;
        bits -= 8;
      }
    }

    return output.slice(0, index);
  }
}
