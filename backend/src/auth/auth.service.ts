import { Injectable, UnauthorizedException, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '../users/entities/user.entity';
import { EmailService } from '../services/email.service';
import { SecurityService } from '../common/security.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private tenantsService: TenantsService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private securityService: SecurityService,
  ) {}

  async register(registerDto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Create tenant first
    const tenant = await this.tenantsService.create({
      name: registerDto.companyName || `${registerDto.firstName} ${registerDto.lastName}`,
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

    // Generate and store email verification token
    const verificationToken = this.securityService.generateRandomString(24);
    await this.usersService.update(user.id, {
      emailVerificationToken: verificationToken,
      emailVerificationSentAt: new Date(),
      isEmailVerified: false,
    });

  // Send verification email (simulated) - use hash-based route for SPA
  const frontendUrl = process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || 'http://localhost:5174';
  const verifyLink = `${frontendUrl}/#verify-email?token=${verificationToken}`;
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
        `
      });
    } catch {}

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
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        subscriptionPlan: tenant.subscriptionPlan,
        status: tenant.status,
      },
      token: this.jwtService.sign(payload),
    };
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
    const verificationRequired = (process.env.EMAIL_VERIFICATION_REQUIRED || 'false').toLowerCase() === 'true';
    if (verificationRequired && !user.isEmailVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

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
      },
      tenant: user.tenant ? {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        subscriptionPlan: user.tenant.subscriptionPlan,
        status: user.tenant.status,
      } : null,
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
      },
      tenant: user.tenant ? {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        subscriptionPlan: user.tenant.subscriptionPlan,
        status: user.tenant.status,
      } : null,
    };
  }

  async resendVerification(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Do not reveal whether user exists
      return { success: true };
    }
    if (user.isEmailVerified) {
      return { success: true, message: 'Already verified' };
    }
    const verificationToken = this.securityService.generateRandomString(24);
    await this.usersService.update(user.id, {
      emailVerificationToken: verificationToken,
      emailVerificationSentAt: new Date(),
    });
  const frontendUrl = process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || 'http://localhost:5174';
  const verifyLink = `${frontendUrl}/#verify-email?token=${verificationToken}`;
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
      `
    });
    return { success: true };
  }

  async verifyEmail(token: string) {
    if (!token) throw new BadRequestException('Token required');
    // Find user by verification token
    let target: any = null;
    try {
      const repo: any = (this.usersService as any).userRepository;
      target = await repo.findOne({ where: { emailVerificationToken: token } });
    } catch {}
    if (!target) {
      throw new NotFoundException('Invalid or expired token');
    }
    await this.usersService.update(target.id, {
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      emailVerificationToken: null as unknown as any,
    });
    return { success: true };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    // Do not reveal existence
    if (!user) return { success: true };
    const token = this.securityService.generateRandomString(24);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.usersService.update(user.id, {
      passwordResetToken: token,
      passwordResetExpiresAt: expiresAt,
    });
  const frontendUrl = process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || 'http://localhost:5174';
  const resetLink = `${frontendUrl}/#reset-password?token=${token}`;
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
      `
    });
    return { success: true };
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token || !newPassword) throw new BadRequestException('Token and newPassword required');
    // Find by token
    let target: any = null;
    try {
      const repo: any = (this.usersService as any).userRepository;
      target = await repo.findOne({ where: { passwordResetToken: token } });
    } catch {}
    if (!target) throw new NotFoundException('Invalid or expired token');
    if (!target.passwordResetExpiresAt || new Date(target.passwordResetExpiresAt).getTime() < Date.now()) {
      throw new BadRequestException('Reset token expired');
    }
    await this.usersService.update(target.id, {
      password: newPassword,
      passwordResetToken: null as unknown as any,
      passwordResetExpiresAt: null as unknown as any,
    });
    return { success: true };
  }
}
