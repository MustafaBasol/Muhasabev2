import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminConfig } from './entities/admin-config.entity';
import { SecurityService } from '../common/security.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

@Injectable()
export class AdminSecurityService {
  constructor(
    @InjectRepository(AdminConfig)
    private readonly configRepo: Repository<AdminConfig>,
    private readonly security: SecurityService,
  ) {}

  private async getOrInit(): Promise<AdminConfig> {
    let cfg = await this.configRepo.findOne({ where: { id: 1 } });
    if (!cfg) {
      const username = process.env.ADMIN_USERNAME || 'admin';
      const hash = process.env.ADMIN_PASSWORD_HASH
        ? process.env.ADMIN_PASSWORD_HASH
        : this.security.hashPasswordSync(
            process.env.ADMIN_PASSWORD || 'admin123',
          );
      const seed: Partial<AdminConfig> = {
        id: 1,
        username,
        passwordHash: hash,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        recoveryCodes: null,
      };
      cfg = this.configRepo.create(seed);
      cfg = await this.configRepo.save(cfg);
    }
    return cfg;
  }

  async getConfig() {
    const cfg = await this.getOrInit();
    return {
      username: cfg.username,
      twoFactorEnabled: cfg.twoFactorEnabled,
    };
  }

  async updateCredentials(
    currentPassword: string,
    newUsername?: string,
    newPassword?: string,
  ) {
    const cfg = await this.getOrInit();
    const ok = await this.security.comparePassword(
      currentPassword,
      cfg.passwordHash,
    );
    if (!ok) throw new UnauthorizedException('Mevcut şifre hatalı');
    if (newUsername && newUsername.trim()) cfg.username = newUsername.trim();
    if (newPassword && newPassword.length >= 8) {
      const score = this.security.evaluatePasswordStrength(newPassword);
      if (score.score < 3) {
        throw new UnauthorizedException(
          'Yeni şifre zayıf. En az 12 karakter ve karmaşık olmalı.',
        );
      }
      cfg.passwordHash = await this.security.hashPassword(newPassword);
    }
    await this.configRepo.save(cfg);
    return { success: true };
  }

  async begin2FASetup() {
    const cfg = await this.getOrInit();
    const secret = speakeasy.generateSecret({
      name: 'Admin Panel',
      length: 20,
    });
    // Geçici olarak secret'ı kaydet ve 2FA etkin değil işaretli kalsın
    cfg.twoFactorSecret = secret.base32;
    await this.configRepo.save(cfg);
    const otpauthUrl = secret.otpauth_url!;
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { otpauthUrl, qrDataUrl, base32: secret.base32 };
  }

  async verify2FA(token: string) {
    const cfg = await this.getOrInit();
    if (!cfg.twoFactorSecret)
      throw new NotFoundException('2FA kurulumu başlatılmadı');
    const verified = speakeasy.totp.verify({
      secret: cfg.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1,
    });
    if (!verified) throw new UnauthorizedException('Geçersiz doğrulama kodu');
    cfg.twoFactorEnabled = true;
    // Kurtarma kodları üret ve kaydet
    const recovery = this.security.generateRecoveryCodes(10);
    cfg.recoveryCodes = recovery;
    await this.configRepo.save(cfg);
    return { success: true, recoveryCodes: recovery };
  }

  async disable2FA() {
    const cfg = await this.getOrInit();
    cfg.twoFactorEnabled = false;
    cfg.twoFactorSecret = null;
    cfg.recoveryCodes = null;
    await this.configRepo.save(cfg);
    return { success: true };
  }

  async validateLogin(username: string, password: string, totp?: string) {
    const cfg = await this.getOrInit();
    if (username !== cfg.username) return false;
    const ok = await this.security.comparePassword(password, cfg.passwordHash);
    if (!ok) return false;
    if (cfg.twoFactorEnabled) {
      if (!totp) return false;
      // Önce TOTP doğrula
      const isTotp = speakeasy.totp.verify({
        secret: cfg.twoFactorSecret!,
        encoding: 'base32',
        token: totp,
        window: 1,
      });
      if (isTotp) return true;
      // TOTP başarısızsa tek kullanımlık kurtarma kodlarını dene
      if (Array.isArray(cfg.recoveryCodes) && cfg.recoveryCodes.length > 0) {
        const idx = cfg.recoveryCodes.findIndex(
          (c) => c && String(c).trim() === String(totp).trim(),
        );
        if (idx >= 0) {
          const next = [...cfg.recoveryCodes];
          next.splice(idx, 1); // tek kullanımlık: kullanılan kodu kaldır
          cfg.recoveryCodes = next;
          await this.configRepo.save(cfg);
          return true;
        }
      }
      return false;
    }
    return true;
  }
}
