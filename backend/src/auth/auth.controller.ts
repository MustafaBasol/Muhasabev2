import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpCode,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
// import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { User } from '../common/decorators/user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register new user and create tenant' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // New spec-compliant alias endpoint: /auth/signup
  @Post('signup')
  @ApiOperation({
    summary: 'Signup (alias of register) - issues email verification token',
  })
  async signup(@Body() registerDto: RegisterDto, @Req() req: any) {
    return this.authService.signupWithToken(registerDto, req);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @HttpCode(200)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@User() user: any) {
    return this.authService.getProfile(user);
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh access token (sliding session)' })
  @HttpCode(200)
  async refresh(@User() user: any) {
    // Debug log: route hit confirmation (geçici - üretimde kaldırılabilir)
    // console.log('[AuthController] /auth/refresh endpoint hit for user:', user?.id);
    return this.authService.refresh(user);
  }

  // Alternative endpoint to avoid potential proxies or middlewares conflicting with
  // the "/auth/refresh" path in some environments.
  @Post('refresh-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh access token (alt path)' })
  @HttpCode(200)
  async refreshAlt(@User() user: any) {
    return this.authService.refresh(user);
  }

  @Post('resend-verification')
  @ApiOperation({ summary: 'Resend email verification link' })
  async resendVerification(@Body() body: { email: string }) {
    return this.authService.resendVerification(body.email);
  }

  @Get('verify-email')
  @ApiOperation({
    summary: 'Verify email using legacy token (backward compatible)',
  })
  async verifyEmailLegacy(@Query('token') token: string) {
    return this.authService.verifyEmailLegacy(token);
  }

  // New spec endpoint: GET /auth/verify?token=RAW&u=USER_ID
  @Get('verify')
  @ApiOperation({ summary: 'Verify email using hashed token table' })
  async verifyEmail(
    @Query('token') rawToken: string,
    @Query('u') userId: string,
  ) {
    return this.authService.verifyEmailHashed(rawToken, userId);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Send password reset email (legacy)' })
  async forgotPasswordLegacy(@Body() body: { email: string }) {
    return this.authService.forgotPasswordLegacy(body.email);
  }

  // New spec endpoint: POST /auth/forgot {email}
  @Post('forgot')
  @ApiOperation({ summary: 'Issue password reset token and send email' })
  async forgotPassword(@Body() body: { email: string }, @Req() req: any) {
    return this.authService.issuePasswordReset(body.email, req);
  }

  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset password with legacy token (backward compatible)',
  })
  async resetPasswordLegacy(
    @Body() body: { token: string; newPassword: string },
  ) {
    return this.authService.resetPasswordLegacy(body.token, body.newPassword);
  }

  // New spec endpoint: POST /auth/reset {token, u, newPassword}
  @Post('reset')
  @ApiOperation({ summary: 'Reset password using hashed token table' })
  async resetPassword(
    @Body() body: { token: string; u: string; newPassword: string },
  ) {
    return this.authService.resetPasswordHashed(
      body.token,
      body.u,
      body.newPassword,
    );
  }
}
