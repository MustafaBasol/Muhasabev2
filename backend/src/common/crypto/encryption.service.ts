import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;   // GCM önerilen IV boyutu
const TAG_BYTES = 16;  // GCM auth tag boyutu
const SEPARATOR = ':';

/**
 * EncryptionService — AES-256-GCM şifreleme/şifre çözme.
 *
 * Format (base64url): `<iv>:<ciphertext>:<authTag>`
 *   - iv:       12 byte rastgele değer
 *   - ciphertext: değişken uzunlukta
 *   - authTag:  16 byte GCM kimlik doğrulama etiketi
 *
 * Ortam değişkeni:
 *   APP_ENCRYPTION_KEY — 64 karakter hex (32 byte = 256 bit)
 *   Üret: openssl rand -hex 32
 *
 * Şifreli olmayan (eski) değerler "şeffaf geçiş" olarak döndürülür:
 * formatı doğrulanamayan bir değer decrypt()'e verilirse ham haliyle döner
 * (geçirme dönemi sonrası kaldırılacak yorum: TODO Phase 9 rotasyonu).
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private key!: Buffer;

  onModuleInit(): void {
    const hex = process.env.APP_ENCRYPTION_KEY;

    if (!hex) {
      this.logger.warn(
        'APP_ENCRYPTION_KEY tanımlı değil — token şifreleme devre dışı (plaintext mod). ' +
        'Üretim ortamında mutlaka ayarlayın: openssl rand -hex 32',
      );
      // Geliştirme ortamı için sabit bir test anahtarı
      this.key = Buffer.from(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'hex',
      );
      return;
    }

    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error(
        'APP_ENCRYPTION_KEY geçersiz: tam olarak 64 hex karakter (32 byte) olmalı.',
      );
    }

    this.key = Buffer.from(hex, 'hex');
    this.logger.log('EncryptionService hazır (AES-256-GCM).');
  }

  // ─── Şifrele ──────────────────────────────────────────────────────────────

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, this.key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
      iv.toString('base64url'),
      ciphertext.toString('base64url'),
      tag.toString('base64url'),
    ].join(SEPARATOR);
  }

  // ─── Çöz ──────────────────────────────────────────────────────────────────

  /**
   * Şifrelenmiş değeri çöz.
   * Bilinmeyen format → düz metin olarak döndür (geçiş dönemi uyumluluğu).
   */
  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(SEPARATOR);
    if (parts.length !== 3) {
      // Eski / şifrelenmemiş kayıt — olduğu gibi döndür
      return ciphertext;
    }

    const [ivB64, ctB64, tagB64] = parts;
    try {
      const iv = Buffer.from(ivB64, 'base64url');
      const ct = Buffer.from(ctB64, 'base64url');
      const tag = Buffer.from(tagB64, 'base64url');

      if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
        return ciphertext; // Format hatası → geçiş dönemi toleransı
      }

      const decipher = createDecipheriv(ALGO, this.key, iv);
      decipher.setAuthTag(tag);

      return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    } catch {
      // Bozuk şifreli metin veya yanlış anahtar
      this.logger.error('Decrypt hatası — şifreli veri bozuk veya anahtar uyumsuz.');
      throw new Error('Token şifre çözme başarısız.');
    }
  }

  /**
   * Değerin şifrelenmiş formatta olup olmadığını kontrol eder.
   */
  isEncrypted(value: string): boolean {
    return value.split(SEPARATOR).length === 3;
  }
}
