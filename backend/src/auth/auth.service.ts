import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { Tenant } from '../tenants/entities/tenant.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { EmailService } from '../services/email.service';
import { SecurityService } from '../common/security.service';
import { TurnstileService } from '../common/turnstile.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import * as crypto from 'crypto';
import { AuditService } from '../audit/audit.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { Inject, forwardRef } from '@nestjs/common';
import { LoginAttemptsService } from './login-attempts.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { Role } from '../common/enums/organization.enum';
import { TenantPlanLimitService } from '../common/tenant-plan-limits.service';

type RequestHeaders = Record<string, string | string[] | undefined>;

type RequestContext = {
  ip?: string;
  headers?: RequestHeaders;
};

type ClientEnvHints = {
  timeZone?: string;
  utcOffsetMinutes?: number;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private tenantsService: TenantsService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private securityService: SecurityService,
    private turnstileService: TurnstileService,
    @InjectRepository(EmailVerificationToken)
    private evtRepo: Repository<EmailVerificationToken>,
    @InjectRepository(PasswordResetToken)
    private prtRepo: Repository<PasswordResetToken>,
    private auditService: AuditService,
    @Inject(forwardRef(() => OrganizationsService))
    private organizationsService: OrganizationsService,
    private attemptsService: LoginAttemptsService,
  ) {}
  private getNumberEnv(name: string, def: number): number {
    const raw = (process.env[name] || '').trim();
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : def;
  }
  // Basit, process içi resend cooldown (email başına). Dağıtık için merkezi store gerekir.
  private resendCooldown = new Map<string, number>();
  // Replaced by LoginAttemptsService (memory or Redis)

  async register(registerDto: RegisterDto) {
    // Turnstile mandatory for public signup when secret configured
    if (this.turnstileService.isEnabled()) {
      const ok = await this.turnstileService.verify(registerDto.turnstileToken);
      if (!ok) {
        if (!registerDto.turnstileToken) {
          throw new BadRequestException('Human verification required');
        }
        throw new BadRequestException(
          'Human verification failed, please try again.',
        );
      }
    }
    this.enforcePasswordPolicy(registerDto.password);
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

    // Send verification email (locale-aware minimal EN by default)
    const locale = (process.env.DEFAULT_EMAIL_LOCALE || 'en').toLowerCase();
    const verifyLink = this.buildVerifyLink(raw, user.id);
    const subjectVerify =
      locale === 'tr' ? 'E-posta Doğrulama' : 'Email Verification';
    const htmlVerify =
      locale === 'tr'
        ? `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#059669;">E-posta Doğrulama</h2>
          <p>Merhaba ${user.firstName || ''} ${user.lastName || ''},</p>
          <p>Hesabınızı doğrulamak için aşağıdaki bağlantıya tıklayın:</p>
          <p><a href="${verifyLink}">${verifyLink}</a></p>
        </div>`
        : `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#059669;">Email Verification</h2>
          <p>Hello ${user.firstName || ''} ${user.lastName || ''},</p>
          <p>Please click the link below to verify your account:</p>
          <p><a href="${verifyLink}">${verifyLink}</a></p>
        </div>`;
    try {
      await this.emailService.sendEmail({
        to: user.email,
        subject: subjectVerify,
        html: htmlVerify,
        meta: {
          userId: user.id,
          tenantId: user.tenantId,
          tokenId: evt.id,
          correlationId: crypto.randomUUID(),
          type: 'verify',
        },
      });
    } catch (error) {
      this.logSoftError('auth.register.email', error);
    }

    // Generate JWT token
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tokenVersion: user.tokenVersion ?? 0,
    };

    return {
      user: this.buildUserPayload(user),
      tenant: this.buildTenantPayload(tenant),
      token: this.jwtService.sign(payload),
    };
  }

  /**
   * Spec-compliant signup endpoint: issues verification token and returns minimal info.
   */
  async signupWithToken(registerDto: RegisterDto, req?: RequestContext) {
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
        ip: this.resolveClientIp(req),
        userAgent: this.resolveUserAgent(req),
      });
    } catch (error) {
      this.logSoftError('auth.signup.audit', error);
    }
    return { success: true };
  }

  async login(loginDto: LoginDto, req?: RequestContext) {
    const ip = this.resolveClientIp(req) ?? 'unknown';
    const { clientTimeZone, clientUtcOffsetMinutes, clientLocale } = loginDto;
    const alreadyCaptcha = await this.attemptsService.requireCaptcha(
      loginDto.email,
      ip,
    );
    if (alreadyCaptcha) {
      const ok = await this.turnstileService.verify(
        loginDto.turnstileToken,
        ip,
      );
      if (!ok) {
        if (!loginDto.turnstileToken)
          throw new ForbiddenException('CAPTCHA_REQUIRED');
        throw new UnauthorizedException('Human verification failed');
      }
    }

    // Find user by email
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      await this.attemptsService.increment(loginDto.email, ip);
      const need = await this.attemptsService.requireCaptcha(
        loginDto.email,
        ip,
      );
      if (need) throw new ForbiddenException('CAPTCHA_REQUIRED');
      throw new UnauthorizedException('Invalid credentials');
    }

    // Validate password
    const isPasswordValid = await this.usersService.validatePassword(
      user,
      loginDto.password,
    );
    if (!isPasswordValid) {
      await this.attemptsService.increment(loginDto.email, ip);
      const need = await this.attemptsService.requireCaptcha(
        loginDto.email,
        ip,
      );
      if (need) throw new ForbiddenException('CAPTCHA_REQUIRED');
      throw new UnauthorizedException('Invalid credentials');
    }

    // Successful login: reset attempts
    await this.attemptsService.reset(loginDto.email, ip);

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Require verified email for login unless explicitly disabled via env
    const envFlag = (process.env.EMAIL_VERIFICATION_REQUIRED ?? '')
      .trim()
      .toLowerCase();
    const verificationRequired =
      envFlag === '' || ['true', '1', 'yes', 'on'].includes(envFlag);
    if (verificationRequired && !user.isEmailVerified) {
      throw new UnauthorizedException('EMAIL_NOT_VERIFIED');
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);
    // Persist client time zone hints if provided
    try {
      const updates: Partial<User> = {};
      if (clientTimeZone) {
        updates.lastLoginTimeZone = clientTimeZone;
      }
      if (typeof clientUtcOffsetMinutes === 'number') {
        updates.lastLoginUtcOffsetMinutes = clientUtcOffsetMinutes;
      }
      if (Object.keys(updates).length > 0) {
        await this.usersService.update(user.id, updates);
      }
    } catch (error) {
      this.logSoftError('auth.login.clientHints', error);
    }

    // Audit login with client env hints (non-blocking)
    try {
      await this.auditService.log({
        tenantId: user.tenantId,
        userId: user.id,
        entity: 'auth',
        action: AuditAction.UPDATE,
        diff: {
          event: 'login',
          clientTimeZone,
          clientUtcOffsetMinutes,
          clientLocale,
        },
        ip: this.resolveClientIp(req),
        userAgent: this.resolveUserAgent(req),
      });
    } catch (error) {
      this.logSoftError('auth.login.audit', error);
    }

    // === Organizasyon Tenant Senkronizasyonu ===
    // Senaryo: Kullanıcının kişisel tenant'ında veri yok; başka bir organizasyonda MEMBER/ADMIN ise
    // dashboard verilerini OWNER'ın tenantId'si üzerinden görmek istiyor.
    // Mevcut mantık: İlk non-OWNER organizasyon için OWNER tenantId'sini benimse.
    try {
      const orgs = await this.organizationsService.getUserOrganizations(
        user.id,
      );
      if (Array.isArray(orgs) && orgs.length > 0) {
        // Kullanıcının OWNER olmadığı ilk organizasyonu seç
        const targetMembership = orgs.find((o) => o.role !== Role.OWNER);
        if (targetMembership) {
          const ownerTid = await this.organizationsService.getOwnerTenantId(
            targetMembership.organization.id,
          );
          if (ownerTid && ownerTid !== user.tenantId) {
            await this.usersService.update(user.id, { tenantId: ownerTid });
            user.tenantId = ownerTid;
            try {
              const ownerTenant = await this.tenantsService.findOne(ownerTid);
              user.tenant = ownerTenant;
            } catch (error) {
              this.logSoftError('auth.login.ownerTenantLoad', error);
            }
          }
        }
      }
    } catch (error) {
      this.logSoftError('auth.login.orgSync', error);
    }

    // If 2FA is enabled, require token (TOTP or backup code)
    if (user.twoFactorEnabled) {
      const token = loginDto.twoFactorToken;
      if (!token) {
        // Özel durum: Frontend bu mesajı yakalayıp ikinci adımı gösterecek
        throw new ForbiddenException('MFA_REQUIRED');
      }
      const ok = await this.usersService.verifyTwoFactor(user.id, { token });
      if (!ok) {
        throw new UnauthorizedException('Invalid 2FA token');
      }
    }

    // Generate JWT token
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tokenVersion: user.tokenVersion ?? 0,
    };

    return {
      user: this.buildUserPayload(user, {
        timeZone: clientTimeZone,
        utcOffsetMinutes:
          typeof clientUtcOffsetMinutes === 'number'
            ? clientUtcOffsetMinutes
            : undefined,
      }),
      tenant: this.buildTenantPayload(user.tenant),
      token: this.jwtService.sign(payload),
    };
  }

  async getProfile(user: User) {
    return {
      user: this.buildUserPayload(user),
      tenant: this.buildTenantPayload(user.tenant),
    };
  }

  /**
   * Issue a new short-lived access token for sliding sessions.
   * Frontend will call this periodically (e.g. every 5 minutes) while user is active.
   */
  async refresh(user: User) {
    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tokenVersion: user.tokenVersion ?? 0,
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
  ): Promise<{ success: true; email: string }> {
    if (!token || !password) {
      throw new BadRequestException('token and password are required');
    }

    this.enforcePasswordPolicy(password);

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
        invite.organization?.id || invite.organizationId,
      );
      targetTenantId = ownerTid || null;
    } catch {
      targetTenantId = null;
    }

    if (!user) {
      // IMPORTANT: Do NOT create a personal tenant for invited users.
      // Create the user directly and attach to the owner's tenant if resolvable.
      const localPart = (invite.email || '').split('@')[0] || 'Kullanıcı';
      const tenantIdForCreate =
        targetTenantId || invite.organization?.id || invite.organizationId;
      if (!tenantIdForCreate) {
        throw new BadRequestException('Invite has no organization context');
      }
      user = await this.usersService.create({
        email: invite.email,
        password,
        firstName: localPart,
        lastName: '',
        tenantId: tenantIdForCreate,
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
        emailVerificationToken: null,
      });
    }

    // 4) Accept invite and set current org (also ensures tenant sync if not set above)
    await this.organizationsService.acceptInvite(token, user.id);
    try {
      await this.usersService.update(user.id, {
        currentOrgId: invite.organization?.id || invite.organizationId,
      });
    } catch (error) {
      this.logSoftError('auth.invite.setCurrentOrg', error);
    }

    return { success: true, email: invite.email };
  }

  private enforcePasswordPolicy(password: string) {
    const minLen = this.getNumberEnv('PASSWORD_MIN_LENGTH', 8);
    if (!password || password.length < minLen) {
      throw new BadRequestException(
        `Password must be at least ${minLen} characters`,
      );
    }
    const minScore = this.getNumberEnv('PASSWORD_MIN_SCORE', 0);
    if (minScore > 0) {
      try {
        const strength =
          this.securityService.evaluatePasswordStrength(password);
        if (strength.score < minScore) {
          throw new BadRequestException(
            `Password too weak (score ${strength.score}/${minScore}). Suggestions: ${strength.suggestions.join('; ')}`,
          );
        }
      } catch (error) {
        this.logSoftError('auth.passwordStrengthEvaluation', error);
      }
    }
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
    const locale = (process.env.DEFAULT_EMAIL_LOCALE || 'en').toLowerCase();
    const verifyLink = this.buildVerifyLink(raw, user.id);
    const subjectResend =
      locale === 'tr'
        ? 'E-posta Doğrulama (Yeniden)'
        : 'Email Verification (Resend)';
    const htmlResend =
      locale === 'tr'
        ? `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#059669;">E-posta Doğrulama (Yeniden)</h2>
        <p>Merhaba ${user.firstName || ''} ${user.lastName || ''},</p>
        <p>Hesabınızı doğrulamak için aşağıdaki bağlantıya tıklayın:</p>
        <p><a href="${verifyLink}">${verifyLink}</a></p>
      </div>`
        : `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#059669;">Email Verification (Resend)</h2>
        <p>Hello ${user.firstName || ''} ${user.lastName || ''},</p>
        <p>Please use the link below to verify your account:</p>
        <p><a href="${verifyLink}">${verifyLink}</a></p>
      </div>`;
    await this.emailService.sendEmail({
      to: user.email,
      subject: subjectResend,
      html: htmlResend,
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
    const target = await this.usersService.findByEmailVerificationToken(token);
    if (!target) throw new NotFoundException('Invalid or expired token');
    await this.usersService.update(target.id, {
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
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
      where: { userId, usedAt: IsNull() },
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
    } catch (error) {
      this.logSoftError('auth.verifyEmail.invalidateOthers', error);
    }
    // Audit log
    try {
      const user = await this.usersService.findOne(userId);
      await this.auditService.log({
        tenantId: user.tenantId,
        userId,
        entity: 'auth',
        action: AuditAction.UPDATE,
        diff: { event: 'verify-email' },
      });
    } catch (error) {
      this.logSoftError('auth.verifyEmail.audit', error);
    }
    return { success: true };
  }

  async forgotPasswordLegacy(email: string) {
    const user = await this.usersService.findByEmail(email);
    // Do not reveal existence
    if (!user) return { success: true };
    const token = this.securityService.generateRandomString(24);
    // Legacy akışta token'ı kullanıcı kaydına yazmak unutulmuş; bu nedenle /auth/reset-password çağrısı 404 düşüyordu.
    // Güvenlik için sadece geçici süre (TTL) ekleyerek kaydediyoruz.
    try {
      const resetMinutes = this.getNumberEnv('RESET_TOKEN_TTL_MINUTES', 60);
      const expiresAt = new Date(Date.now() + resetMinutes * 60 * 1000);
      await this.usersService.update(user.id, {
        passwordResetToken: token,
        passwordResetExpiresAt: expiresAt,
      });
    } catch (error) {
      this.logSoftError('auth.forgotLegacy.persistToken', error);
    }
    const base = this.getFrontendBase();
    const locale = (process.env.DEFAULT_EMAIL_LOCALE || 'en').toLowerCase();
    const resetLink = `${base}/#reset-password?token=${token}`;
    try {
      const subject =
        locale === 'tr' ? 'Şifre Sıfırlama Talebi' : 'Password Reset Request';
      const html =
        locale === 'tr'
          ? `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#b91c1c;">Şifre Sıfırlama</h2>
          <p>Merhaba ${user.firstName || ''} ${user.lastName || ''},</p>
          <p>Şifrenizi sıfırlamak için aşağıdaki bağlantıyı kullanın (1 saat geçerlidir):</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
        </div>`
          : `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#b91c1c;">Password Reset</h2>
          <p>Hello ${user.firstName || ''} ${user.lastName || ''},</p>
          <p>Use the link below to reset your password (valid for 1 hour):</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
        </div>`;
      await this.emailService.sendEmail({
        to: user.email,
        subject,
        html,
      });
    } catch (error) {
      this.logSoftError('auth.forgotLegacy.email', error);
    }
    return { success: true };
  }

  async issuePasswordReset(email: string, req?: RequestContext) {
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
        ip: this.resolveClientIp(req) ?? null,
        ua: this.resolveUserAgent(req) ?? null,
      }),
    );
    const locale2 = (process.env.DEFAULT_EMAIL_LOCALE || 'en').toLowerCase();
    const appBase = this.getFrontendBase(req);
    const resetLink = `${appBase}/#reset-password?token=${raw}&u=${user.id}`;
    try {
      const subject =
        locale2 === 'tr' ? 'Şifre Sıfırlama Talebi' : 'Password Reset Request';
      const html =
        locale2 === 'tr'
          ? `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#b91c1c;">Şifre Sıfırlama</h2>
          <p>Merhaba ${user.firstName || ''} ${user.lastName || ''},</p>
          <p>Şifrenizi sıfırlamak için aşağıdaki bağlantıyı kullanın (1 saat geçerlidir):</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
        </div>`
          : `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#b91c1c;">Password Reset</h2>
          <p>Hello ${user.firstName || ''} ${user.lastName || ''},</p>
          <p>Use the link below to reset your password (valid for 1 hour):</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
        </div>`;
      await this.emailService.sendEmail({
        to: user.email,
        subject,
        html,
        meta: {
          userId: user.id,
          tenantId: user.tenantId,
          tokenId: prt.id,
          correlationId: crypto.randomUUID(),
          type: 'reset',
        },
      });
    } catch (error) {
      this.logSoftError('auth.reset.email', error);
    }
    // Audit
    try {
      await this.auditService.log({
        tenantId: user.tenantId,
        userId: user.id,
        entity: 'auth',
        action: AuditAction.UPDATE,
        diff: { event: 'forgot-password' },
        ip: this.resolveClientIp(req),
        userAgent: this.resolveUserAgent(req),
      });
    } catch (error) {
      this.logSoftError('auth.reset.audit', error);
    }
    return { success: true };
  }

  async resetPasswordLegacy(token: string, newPassword: string) {
    if (!token || !newPassword)
      throw new BadRequestException('Token and newPassword required');
    // Find by token
    const target = await this.usersService.findByPasswordResetToken(token);
    if (!target) throw new NotFoundException('Invalid or expired token');
    if (
      !target.passwordResetExpiresAt ||
      new Date(target.passwordResetExpiresAt).getTime() < Date.now()
    ) {
      throw new BadRequestException('Reset token expired');
    }
    await this.usersService.update(target.id, {
      password: newPassword,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    });
    return { success: true };
  }

  /**
   * Frontend base URL seçimi:
   * 1. FRONTEND_URL / APP_PUBLIC_URL env (deploy ortamı)
   * 2. Request origin / referer içindeki host (dev codespace port değişkenliği)
   * 3. Son çare: http://localhost:5174
   */
  private getFrontendBase(req?: RequestContext): string {
    const envBase =
      process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || '';
    let candidate = (envBase || '').trim();
    // Eğer env içindeki port aktif değilse ve request'te origin varsa onu al
    const origin =
      this.getHeaderValue(req, 'origin') ||
      this.getHeaderValue(req, 'referer') ||
      '';
    if (origin) {
      try {
        const o = new URL(origin);
        // Env boşsa veya farklı port ise dev senaryosunda origin'i tercih et
        if (!candidate) candidate = `${o.protocol}//${o.host}`;
        else {
          const e = new URL(candidate);
          if (e.host !== o.host && /localhost:\d+/i.test(o.host)) {
            candidate = `${o.protocol}//${o.host}`;
          }
        }
      } catch (error) {
        this.logSoftError('auth.frontendBase.origin', error);
      }
    }
    if (!candidate) candidate = 'http://localhost:5174';
    // Codespaces ortamında localhost yerine public forwarding domain'i üret
    try {
      if (/localhost:\d+/.test(candidate) && process.env.CODESPACE_NAME) {
        const u = new URL(candidate);
        const port = u.port || '5174';
        const domainSuffix =
          process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ||
          'app.github.dev';
        candidate = `https://${process.env.CODESPACE_NAME}-${port}.${domainSuffix}`;
      }
    } catch (error) {
      this.logSoftError('auth.frontendBase.codespaces', error);
    }
    return candidate.replace(/\/?$/, '');
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
      } catch (error) {
        this.logSoftError('auth.resetHashed.strength', error);
      }
    }
    const submitHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const candidates = await this.prtRepo.find({
      where: { userId, usedAt: IsNull() },
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
    } catch (error) {
      this.logSoftError('auth.resetHashed.invalidateOthers', error);
    }
    return { success: true };
  }

  private buildUserPayload(user: User, hints?: ClientEnvHints) {
    const hintTimeZone = hints?.timeZone?.trim();
    const hintOffset = hints?.utcOffsetMinutes;
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      isEmailVerified: user.isEmailVerified === true,
      lastLoginAt: user.lastLoginAt,
      lastLoginTimeZone: hintTimeZone || user.lastLoginTimeZone || undefined,
      lastLoginUtcOffsetMinutes:
        typeof hintOffset === 'number'
          ? hintOffset
          : (user.lastLoginUtcOffsetMinutes ?? undefined),
    };
  }

  private buildTenantPayload(tenant?: Tenant | null) {
    if (!tenant) return null;

    const planLimits = TenantPlanLimitService.getLimitsForTenant(tenant);
    let effectiveMaxUsers = planLimits.maxUsers;
    const storedMaxUsers =
      typeof tenant.maxUsers === 'number' && Number.isFinite(tenant.maxUsers)
        ? tenant.maxUsers
        : undefined;

    if (effectiveMaxUsers === -1 || storedMaxUsers === -1) {
      effectiveMaxUsers = -1;
    } else if (typeof storedMaxUsers === 'number') {
      effectiveMaxUsers = Math.max(effectiveMaxUsers, storedMaxUsers);
    }

    // Stripe koltuk senkronu varsa, storedMaxUsers değeri gerçek koltuk sayısını temsil eder
    if (
      tenant.stripeSubscriptionId &&
      typeof storedMaxUsers === 'number' &&
      Number.isFinite(storedMaxUsers)
    ) {
      effectiveMaxUsers = storedMaxUsers;
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      subscriptionPlan: tenant.subscriptionPlan,
      status: tenant.status,
      maxUsers: tenant.maxUsers,
      effectiveMaxUsers,
      subscriptionExpiresAt: tenant.subscriptionExpiresAt,
      cancelAtPeriodEnd: tenant.cancelAtPeriodEnd === true,
    };
  }

  private logSoftError(event: string, error: unknown) {
    const message = `${event}: ${error instanceof Error ? error.message : String(error)}`;
    this.logger.warn(message);
    if (error instanceof Error && error.stack) {
      this.logger.debug(error.stack);
    }
  }

  private getHeaderValue(
    req: RequestContext | undefined,
    header: string,
  ): string | undefined {
    const headers = req?.headers;
    if (!headers) return undefined;
    const normalized = header.toLowerCase();
    const raw =
      headers[normalized] ??
      headers[header] ??
      headers[normalized.toUpperCase()];
    if (Array.isArray(raw)) {
      return raw[0];
    }
    return typeof raw === 'string' ? raw : undefined;
  }

  private resolveClientIp(req?: RequestContext): string | undefined {
    const direct = req?.ip?.trim();
    if (direct) return direct;
    const forwarded = this.getHeaderValue(req, 'x-forwarded-for');
    return forwarded?.split(',')[0]?.trim();
  }

  private resolveUserAgent(req?: RequestContext): string | undefined {
    return this.getHeaderValue(req, 'user-agent');
  }

  private resolveFrontendBase(): string {
    const raw =
      process.env.FRONTEND_URL ||
      process.env.APP_PUBLIC_URL ||
      'http://localhost:5174';
    return raw.replace(/\/+$/, '');
  }

  private buildFrontendUrl(
    preferredPath: string | undefined,
    fallbackPath: string,
    params: Record<string, string>,
  ): string {
    const base = this.resolveFrontendBase();
    const rawPath = preferredPath?.trim() || fallbackPath;
    const normalizedPath = (rawPath.startsWith('/') ? rawPath : `/${rawPath}`)
      // collapse any duplicate slashes except the protocol portion (already stripped)
      .replace(/\/+/g, '/');
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === 'string') {
        query.append(key, value);
      }
    });
    const queryString = query.toString();
    const separator = normalizedPath.includes('?') ? '&' : '?';
    return queryString
      ? `${base}${normalizedPath}${separator}${queryString}`
      : `${base}${normalizedPath}`;
  }

  private buildVerifyLink(token: string, userId: string): string {
    const defaultPath = '/#verify-email';
    return this.buildFrontendUrl(process.env.FRONTEND_VERIFY_PATH, defaultPath, {
      token,
      u: userId,
    });
  }
}
