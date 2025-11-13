import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '../users/entities/user.entity';
import { EmailService } from '../services/email.service';
import { SecurityService } from '../common/security.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import * as crypto from 'crypto';
import { AuditService } from '../audit/audit.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { Inject, forwardRef } from '@nestjs/common';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { Role } from '../common/enums/organization.enum';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private tenantsService: TenantsService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private securityService: SecurityService,
    @InjectRepository(EmailVerificationToken)
    private evtRepo: Repository<EmailVerificationToken>,
    @InjectRepository(PasswordResetToken)
    private prtRepo: Repository<PasswordResetToken>,
    private auditService: AuditService,
    @Inject(forwardRef(() => OrganizationsService))
    private organizationsService: OrganizationsService,
  ) {}
  private getNumberEnv(name: string, def: number): number {
    const raw = (process.env[name] || '').trim();
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : def;
  }
  // Basit, process içi resend cooldown (email başına). Dağıtık için merkezi store gerekir.
  private resendCooldown = new Map<string, number>();

  async register(registerDto: RegisterDto) {
    // Parola basit politika kontrolü
    const minLen = this.getNumberEnv('PASSWORD_MIN_LENGTH', 8);
    if (!registerDto.password || registerDto.password.length < minLen) {
      throw new BadRequestException(
        `Password must be at least ${minLen} characters`,
      );
    }
    // Parola güç skoru kontrolü (opsiyonel)
    const minScore = this.getNumberEnv('PASSWORD_MIN_SCORE', 0);
    if (minScore > 0) {
      try {
        const strength = this.securityService.evaluatePasswordStrength(
          registerDto.password,
        );
        if (strength.score < minScore) {
          throw new BadRequestException(
            `Password too weak (score ${strength.score}/${minScore}). Suggestions: ${strength.suggestions.join('; ')}`,
          );
        }
      } catch (e) {
        // evaluate hata verirse default olarak izin ver (fail-open) veya fail-closed tercih edilebilir.
      }
    }
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Create tenant first
    const tenant = await this.tenantsService.create({
      name:
        registerDto.companyName ||
        `${registerDto.firstName} ${registerDto.lastName}`,
      companyName: registerDto.companyName,
    });

    // Create admin user for the tenant
    const user = await this.usersService.create({
      email: registerDto.email,
      password: registerDto.password,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      role: UserRole.TENANT_ADMIN,
      tenantId: tenant.id,
    });

    // Issue email verification token record (24h)
    const raw = this.securityService.generateRandomString(24);
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    const verifyHours = this.getNumberEnv('VERIFICATION_TOKEN_TTL_HOURS', 24);
    const expiresAt = new Date(Date.now() + verifyHours * 60 * 60 * 1000);
    const evt = await this.evtRepo.save(
      this.evtRepo.create({ userId: user.id, tokenHash, expiresAt }),
    );

    // Send verification email
    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.APP_PUBLIC_URL ||
      'http://localhost:5174';
    const appBase = frontendUrl.replace(/\/?$/, '');
    const verifyLink = `${appBase}/auth/verify?token=${raw}&u=${user.id}`;
    try {
      await this.emailService.sendEmail({
        to: user.email,
        subject: 'E-posta Doğrulama',
        html: `
          <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto;">
            <h2 style="color:#059669;">E-posta Doğrulama</h2>
            <p>Merhaba ${user.firstName || ''} ${user.lastName || ''},</p>
            <p>Hesabınızı doğrulamak için aşağıdaki bağlantıya tıklayın:</p>
            <p><a href="${verifyLink}">${verifyLink}</a></p>
            <hr style="margin:24px 0; border:none; border-top:1px solid #e5e7eb;" />
            <h3 style="color:#374151; margin-top:0;">Email Verification (EN)</h3>
            <p>Hello ${user.firstName || ''} ${user.lastName || ''},</p>
            <p>Please click the link below to verify your account:</p>
            <p><a href="${verifyLink}">${verifyLink}</a></p>
          </div>
        `,
        meta: {
          userId: user.id,
          tenantId: user.tenantId,
          tokenId: evt.id,
          correlationId: crypto.randomUUID(),
          type: 'verify',
        },
      });
    } catch (err) {
      // no-op: E-posta gönderimi başarısız olsa bile kayıt akışı devam eder
      // (loglama seviyesi ve gerçek gönderim daha sonra entegre edilebilir)
    }

    // Generate JWT token
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        isEmailVerified: (user as any).isEmailVerified === true,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        subscriptionPlan: tenant.subscriptionPlan,
        status: tenant.status,
        maxUsers: tenant.maxUsers,
        subscriptionExpiresAt: tenant.subscriptionExpiresAt,
        cancelAtPeriodEnd: (tenant as any).cancelAtPeriodEnd === true,
      },
      token: this.jwtService.sign(payload),
    };
  }

  /**
   * Spec-compliant signup endpoint: issues verification token and returns minimal info.
   */
  async signupWithToken(registerDto: RegisterDto, req?: any) {
    const res = await this.register(registerDto);
    // Audit log
    try {
      const tenantId = res?.tenant?.id;
      await this.auditService.log({
        tenantId: tenantId || res?.user?.tenantId,
        userId: res?.user?.id,
        entity: 'auth',
        action: AuditAction.CREATE,
        diff: { event: 'signup', email: registerDto.email },
        ip: req?.ip,
        userAgent: req?.headers?.['user-agent'],
      });
    } catch {}
    return { success: true };
  }

  async login(loginDto: LoginDto) {
    // Find user by email
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Validate password
    const isPasswordValid = await this.usersService.validatePassword(
      user,
      loginDto.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Optionally require verified email for login
    const verificationRequired =
      (process.env.EMAIL_VERIFICATION_REQUIRED || 'false').toLowerCase() ===
        'true' && process.env.NODE_ENV !== 'test';
    if (verificationRequired && !user.isEmailVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    // === Organizasyon Tenant Senkronizasyonu ===
    // Senaryo: Kullanıcının kişisel tenant'ında veri yok; başka bir organizasyonda MEMBER/ADMIN ise
    // dashboard verilerini OWNER'ın tenantId'si üzerinden görmek istiyor.
    // Mevcut mantık: İlk non-OWNER organizasyon için OWNER tenantId'sini benimse.
    try {
      const orgs = await this.organizationsService.getUserOrganizations(user.id);
      if (Array.isArray(orgs) && orgs.length > 0) {
        // Kullanıcının OWNER olmadığı ilk organizasyonu seç
        const targetMembership = orgs.find(o => o.role !== Role.OWNER);
        if (targetMembership) {
          const ownerTid = await (this.organizationsService as any).getOwnerTenantId(targetMembership.organization.id);
          if (ownerTid && ownerTid !== user.tenantId) {
            await this.usersService.update(user.id, { tenantId: ownerTid });
            (user as any).tenantId = ownerTid;
            try {
              const ownerTenant = await this.tenantsService.findOne(ownerTid);
              (user as any).tenant = ownerTenant;
            } catch {}
          }
        }
      }
    } catch {
      // Sessiz geç
    }

    // Generate JWT token
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        isEmailVerified: (user as any).isEmailVerified === true,
      },
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
            subscriptionPlan: user.tenant.subscriptionPlan,
            status: user.tenant.status,
            maxUsers: (user.tenant as any).maxUsers,
            subscriptionExpiresAt: (user.tenant as any).subscriptionExpiresAt,
            cancelAtPeriodEnd: (user.tenant as any).cancelAtPeriodEnd === true,
          }
        : null,
      token: this.jwtService.sign(payload),
    };
  }

  async getProfile(user: any) {
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        isEmailVerified: user.isEmailVerified === true,
      },
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
            subscriptionPlan: user.tenant.subscriptionPlan,
            status: user.tenant.status,
            maxUsers: user.tenant.maxUsers,
            subscriptionExpiresAt: user.tenant.subscriptionExpiresAt,
            cancelAtPeriodEnd: user.tenant.cancelAtPeriodEnd === true,
          }
        : null,
    };
  }

  /**
   * Issue a new short-lived access token for sliding sessions.
   * Frontend will call this periodically (e.g. every 5 minutes) while user is active.
   */
  async refresh(user: any) {
    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };
    return {
      token: this.jwtService.sign(payload),
      expiresIn: '15m',
    };
  }

  /**
   * Public flow: Complete invitation by setting a password.
   * - Validates invite token
   * - Creates user + personal tenant if not exists, or updates password if exists
   * - Marks email as verified
   * - Accepts invite (adds membership)
   * Returns minimal success payload; frontend will login afterwards.
   */
  async registerViaInvite(
    token: string,
    password: string,
  ): Promise<{ success: true; email: string }>
  {
    if (!token || !password) {
      throw new BadRequestException('token and password are required');
    }

    // 1) Validate invite and ensure not expired/accepted
    const invite = await this.organizationsService.validateInvite(token);
    if (!invite) throw new NotFoundException('Invalid invite token');
    if (invite.acceptedAt) {
      return { success: true, email: invite.email }; // idempotent
    }
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
      throw new BadRequestException('Invitation has expired');
    }

    // 2) Find or create user for invited email
    let user = await this.usersService.findByEmail(invite.email);

    // Resolve target tenant as the OWNER's tenant of the invited organization
    let targetTenantId: string | null = null;
    try {
      const ownerTid = await this.organizationsService.getOwnerTenantId(
        invite.organization?.id || (invite as any).organizationId,
      );
      targetTenantId = ownerTid || null;
    } catch {
      targetTenantId = null;
    }

    if (!user) {
      // IMPORTANT: Do NOT create a personal tenant for invited users.
      // Create the user directly and attach to the owner's tenant if resolvable.
      const localPart = (invite.email || '').split('@')[0] || 'Kullanıcı';
      user = await this.usersService.create({
        email: invite.email,
        password,
        firstName: localPart,
        lastName: '',
        tenantId: targetTenantId || null as any,
      });
    } else {
      // Update password for existing user and align tenant if needed
      await this.usersService.update(user.id, {
        password,
        ...(targetTenantId && user.tenantId !== targetTenantId
          ? { tenantId: targetTenantId }
          : {}),
      });
      user = await this.usersService.findOne(user.id);
    }

    // 3) Mark email verified (invite proves ownership)
    if (!user.isEmailVerified) {
      await this.usersService.update(user.id, {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null as unknown as any,
      });
    }

    // 4) Accept invite and set current org (also ensures tenant sync if not set above)
    await this.organizationsService.acceptInvite(token, user.id);
    try {
      await (this.usersService as any).userRepository.update(user.id, {
        currentOrgId: invite.organization?.id || invite.organizationId,
      });
    } catch {}

    return { success: true, email: invite.email };
  }

  async resendVerification(email: string) {
    const now = Date.now();
    const key = String(email || '')
      .trim()
      .toLowerCase();
    const last = this.resendCooldown.get(key) || 0;
    const cooldownSec = this.getNumberEnv('RESEND_COOLDOWN_SECONDS', 60);
    // cooldown içinde tekrar istek gelirse sessizce kabul et ama yeni mail üretme
    if (now - last < cooldownSec * 1000) {
      return { success: true };
    }
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Do not reveal whether user exists
      return { success: true };
    }
    if (user.isEmailVerified) {
      return { success: true, message: 'Already verified' };
    }
    const raw = this.securityService.generateRandomString(24);
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    const verifyHours = this.getNumberEnv('VERIFICATION_TOKEN_TTL_HOURS', 24);
    const expiresAt = new Date(Date.now() + verifyHours * 60 * 60 * 1000);
    const evt = await this.evtRepo.save(
      this.evtRepo.create({ userId: user.id, tokenHash, expiresAt }),
    );
    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.APP_PUBLIC_URL ||
      'http://localhost:5174';
    const appBase = frontendUrl.replace(/\/?$/, '');
    const verifyLink = `${appBase}/auth/verify?token=${raw}&u=${user.id}`;
    await this.emailService.sendEmail({
      to: user.email,
      subject: 'E-posta Doğrulama',
      html: `
        <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto;">
          <h2 style="color:#059669;">E-posta Doğrulama (Yeniden)</h2>
          <p>Merhaba ${user.firstName || ''} ${user.lastName || ''},</p>
          <p>Hesabınızı doğrulamak için aşağıdaki bağlantıya tıklayın:</p>
          <p><a href="${verifyLink}">${verifyLink}</a></p>
          <hr style="margin:24px 0; border:none; border-top:1px solid #e5e7eb;" />
          <h3 style="color:#374151; margin-top:0;">Email Verification (Resend) - EN</h3>
          <p>Hello ${user.firstName || ''} ${user.lastName || ''},</p>
          <p>Please use the link below to verify your account:</p>
          <p><a href="${verifyLink}">${verifyLink}</a></p>
        </div>
      `,
      meta: {
        userId: user.id,
        tenantId: user.tenantId,
        tokenId: evt.id,
        correlationId: crypto.randomUUID(),
        type: 'verify-resend',
      },
    });
    // Cooldown damgası
    this.resendCooldown.set(key, now);
    return { success: true };
  }

  // Backward-compatible verification using old user field
  async verifyEmailLegacy(token: string) {
    if (!token) throw new BadRequestException('Token required');
    const repo: any = (this.usersService as any).userRepository;
    const target = await repo.findOne({
      where: { emailVerificationToken: token },
    });
    if (!target) throw new NotFoundException('Invalid or expired token');
    await this.usersService.update(target.id, {
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      emailVerificationToken: null as unknown as any,
    });
    return { success: true };
  }

  // New hashed verification using table
  async verifyEmailHashed(rawToken: string, userId: string) {
    if (!rawToken || !userId)
      throw new BadRequestException('token and u are required');
    const submitHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    // Find valid tokens for this user (not used, not expired)
    const candidates = await this.evtRepo.find({
      where: { userId, usedAt: null as any },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    // Timing safe compare across small set
    const submitBuf = Buffer.from(submitHash, 'hex');
    const match = candidates.find((t) => {
      if (new Date(t.expiresAt).getTime() < Date.now()) return false;
      try {
        const dbBuf = Buffer.from(t.tokenHash || '', 'hex');
        if (dbBuf.length !== submitBuf.length) return false;
        return crypto.timingSafeEqual(dbBuf, submitBuf);
      } catch {
        return false;
      }
    });
    if (!match) throw new NotFoundException('Invalid or expired token');
    // Mark used and update user
    match.usedAt = new Date();
    await this.evtRepo.save(match);
    await this.usersService.update(userId, {
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    });
    // Güvenlik: Diğer bekleyen doğrulama tokenlarını da geçersiz kıl
    try {
      const others = candidates.filter((t) => t.id !== match.id);
      if (others.length) {
        for (const t of others) {
          t.usedAt = t.usedAt || new Date();
        }
        await this.evtRepo.save(others);
      }
    } catch {}
    // Audit log
    try {
      const user = await this.usersService.findOne?.(userId as any);
      await this.auditService.log({
        tenantId: (user as any)?.tenantId,
        userId: userId as any,
        entity: 'auth',
        action: AuditAction.UPDATE,
        diff: { event: 'verify-email' },
      });
    } catch {}
    return { success: true };
  }

  async forgotPasswordLegacy(email: string) {
    const user = await this.usersService.findByEmail(email);
    // Do not reveal existence
    if (!user) return { success: true };
    const token = this.securityService.generateRandomString(24);
    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.APP_PUBLIC_URL ||
      'http://localhost:5174';
    const resetLink = `${frontendUrl}/#reset-password?token=${token}`;
    try {
      await this.emailService.sendEmail({
        to: user.email,
        subject: 'Şifre Sıfırlama Talebi',
        html: `
        <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto;">
          <h2 style="color:#b91c1c;">Şifre Sıfırlama</h2>
          <p>Merhaba ${user.firstName || ''} ${user.lastName || ''},</p>
          <p>Şifrenizi sıfırlamak için aşağıdaki bağlantıyı kullanın (1 saat geçerlidir):</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
          <hr style="margin:24px 0; border:none; border-top:1px solid #e5e7eb;" />
          <h3 style="color:#374151; margin-top:0;">Password Reset (EN)</h3>
          <p>Hello ${user.firstName || ''} ${user.lastName || ''},</p>
          <p>Use the link below to reset your password (valid for 1 hour):</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
        </div>
      `,
      });
    } catch (err) {
      // E-posta sağlayıcısı hatası 500'e dönüşmesin — akışı sessizce başarılı kabul et
      // (loglama ileride eklenecek)
    }
    return { success: true };
  }

  async issuePasswordReset(email: string, req?: any) {
    const user = await this.usersService.findByEmail(email);
    // Don't reveal
    if (!user) return { success: true };
    const raw = this.securityService.generateRandomString(24);
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    const resetMinutes = this.getNumberEnv('RESET_TOKEN_TTL_MINUTES', 60);
    const expiresAt = new Date(Date.now() + resetMinutes * 60 * 1000);
    const prt = await this.prtRepo.save(
      this.prtRepo.create({
        userId: user.id,
        tokenHash,
        expiresAt,
        ip: req?.ip,
        ua: req?.headers?.['user-agent'],
      }),
    );
    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.APP_PUBLIC_URL ||
      'http://localhost:5174';
    const appBase = frontendUrl.replace(/\/?$/, '');
    const resetLink = `${appBase}/auth/reset?token=${raw}&u=${user.id}`;
    try {
      await this.emailService.sendEmail({
        to: user.email,
        subject: 'Şifre Sıfırlama Talebi',
        html: `
        <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto;">
          <h2 style="color:#b91c1c;">Şifre Sıfırlama</h2>
          <p>Merhaba ${user.firstName || ''} ${user.lastName || ''},</p>
          <p>Şifrenizi sıfırlamak için aşağıdaki bağlantıyı kullanın (1 saat geçerlidir):</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
        </div>
        `,
        meta: {
          userId: user.id,
          tenantId: user.tenantId,
          tokenId: prt.id,
          correlationId: crypto.randomUUID(),
          type: 'reset',
        },
      });
    } catch (err) {
      // Mail gönderimi başarısız olsa bile kullanıcıya başarı döndür (hesap varlığını ortaya çıkarmamak için)
    }
    // Audit
    try {
      await this.auditService.log({
        tenantId: user.tenantId,
        userId: user.id,
        entity: 'auth',
        action: AuditAction.UPDATE,
        diff: { event: 'forgot-password' },
        ip: req?.ip,
        userAgent: req?.headers?.['user-agent'],
      });
    } catch {}
    return { success: true };
  }

  async resetPasswordLegacy(token: string, newPassword: string) {
    if (!token || !newPassword)
      throw new BadRequestException('Token and newPassword required');
    // Find by token
    let target: any = null;
    try {
      const repo: any = (this.usersService as any).userRepository;
      target = await repo.findOne({ where: { passwordResetToken: token } });
    } catch (err) {
      // no-op: repo erişimi sorununda daha sonra hedef null kontrolü ile hata döneceğiz
    }
    if (!target) throw new NotFoundException('Invalid or expired token');
    if (
      !target.passwordResetExpiresAt ||
      new Date(target.passwordResetExpiresAt).getTime() < Date.now()
    ) {
      throw new BadRequestException('Reset token expired');
    }
    await this.usersService.update(target.id, {
      password: newPassword,
      passwordResetToken: null as unknown as any,
      passwordResetExpiresAt: null as unknown as any,
    });
    return { success: true };
  }

  async resetPasswordHashed(
    rawToken: string,
    userId: string,
    newPassword: string,
  ) {
    if (!rawToken || !userId || !newPassword)
      throw new BadRequestException('token, u and newPassword required');
    const minLen = this.getNumberEnv('PASSWORD_MIN_LENGTH', 8);
    if (newPassword.length < minLen) {
      throw new BadRequestException(
        `Password must be at least ${minLen} characters`,
      );
    }
    const minScore = this.getNumberEnv('PASSWORD_MIN_SCORE', 0);
    if (minScore > 0) {
      try {
        const strength =
          this.securityService.evaluatePasswordStrength(newPassword);
        if (strength.score < minScore) {
          throw new BadRequestException(
            `Password too weak (score ${strength.score}/${minScore}). Suggestions: ${strength.suggestions.join('; ')}`,
          );
        }
      } catch {}
    }
    const submitHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const candidates = await this.prtRepo.find({
      where: { userId, usedAt: null as any },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    const submitBuf = Buffer.from(submitHash, 'hex');
    const match = candidates.find((t) => {
      if (new Date(t.expiresAt).getTime() < Date.now()) return false;
      try {
        const dbBuf = Buffer.from(t.tokenHash || '', 'hex');
        if (dbBuf.length !== submitBuf.length) return false;
        return crypto.timingSafeEqual(dbBuf, submitBuf);
      } catch {
        return false;
      }
    });
    if (!match) throw new NotFoundException('Invalid or expired token');
    // Update password
    await this.usersService.update(userId, { password: newPassword });
    // Mark used and invalidate other outstanding tokens for safety
    match.usedAt = new Date();
    await this.prtRepo.save(match);
    // Optional: invalidate any other unused tokens for this user
    try {
      const others = candidates.filter((t) => t.id !== match.id);
      if (others.length) {
        for (const t of others) {
          t.usedAt = t.usedAt || new Date();
        }
        await this.prtRepo.save(others);
      }
    } catch {}
    return { success: true };
  }
}
