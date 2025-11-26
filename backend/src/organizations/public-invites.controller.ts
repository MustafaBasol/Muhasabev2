import {
  Controller,
  Get,
  Param,
  HttpStatus,
  Post,
  Body,
  Query,
  Req,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invite } from './entities/invite.entity';
import { AuthService } from '../auth/auth.service';
import type { Request } from 'express';
import { TurnstileService } from '../common/turnstile.service';
import { PublicCompleteInviteDto } from './dto/public-complete-invite.dto';

@ApiTags('public-invites')
@Controller('public/invites')
export class PublicInvitesController {
  constructor(
    @InjectRepository(Invite)
    private inviteRepository: Repository<Invite>,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
    private turnstileService: TurnstileService,
  ) {}

  @Get(':token')
  @ApiOperation({ summary: 'Public: Validate invitation token (no auth)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invite details returned',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invalid invite token',
  })
  async validate(
    @Param('token') token: string,
    @Query('turnstileToken') turnstileToken?: string,
    @Req() req?: Request,
  ) {
    await this.ensureHuman(turnstileToken, req);
    const invite = await this.inviteRepository.findOne({
      where: { token },
      relations: ['organization'],
    });
    if (!invite) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'Invalid invite token',
      };
    }
    const now = new Date();
    const expired = invite.expiresAt && invite.expiresAt < now;
    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      token: invite.token,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      status: expired ? 'expired' : invite.acceptedAt ? 'accepted' : 'valid',
      organization: {
        id: invite.organization.id,
        name: invite.organization.name,
        plan: invite.organization.plan,
      },
    };
  }

  @Post(':token/register')
  @ApiOperation({
    summary: 'Public: Complete invite by setting password (no auth)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invite completed, user ready to login',
  })
  async complete(
    @Param('token') token: string,
    @Body() body: PublicCompleteInviteDto,
    @Req() req?: Request,
  ) {
    await this.ensureHuman(body?.turnstileToken, req);
    const pwd = (body?.password || '').trim();
    if (!pwd) {
      throw new BadRequestException('Password is required');
    }
    const res = await this.authService.registerViaInvite(token, pwd);
    return res;
  }

  private getRequestIp(req?: Request): string {
    const forwarded = req?.headers?.['x-forwarded-for'] as string;
    const realIp = req?.headers?.['x-real-ip'] as string;
    const cfIp = req?.headers?.['cf-connecting-ip'] as string;
    return (
      cfIp?.split(',')[0]?.trim() ||
      realIp?.split(',')[0]?.trim() ||
      forwarded?.split(',')[0]?.trim() ||
      req?.ip ||
      'unknown'
    );
  }

  private async ensureHuman(token?: string, req?: Request) {
    if (!this.turnstileService.isEnabled()) {
      return;
    }
    const ok = await this.turnstileService.verify(
      token,
      this.getRequestIp(req),
    );
    if (!ok) {
      if (!token) {
        throw new ForbiddenException('Human verification required');
      }
      throw new ForbiddenException('Human verification failed');
    }
  }
}
