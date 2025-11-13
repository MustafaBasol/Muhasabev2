import { Controller, Get, Param, HttpStatus, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invite } from './entities/invite.entity';
import { AuthService } from '../auth/auth.service';
import { Inject, forwardRef } from '@nestjs/common';

@ApiTags('public-invites')
@Controller('public/invites')
export class PublicInvitesController {
  constructor(
    @InjectRepository(Invite)
    private inviteRepository: Repository<Invite>,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
  ) {}

  @Get(':token')
  @ApiOperation({ summary: 'Public: Validate invitation token (no auth)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Invite details returned' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Invalid invite token' })
  async validate(@Param('token') token: string) {
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
  @ApiOperation({ summary: 'Public: Complete invite by setting password (no auth)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Invite completed, user ready to login' })
  async complete(
    @Param('token') token: string,
    @Body() body: { password: string },
  ) {
    const pwd = (body?.password || '').trim();
    if (!pwd || pwd.length < 6) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Password must be at least 6 characters',
      };
    }
    const res = await this.authService.registerViaInvite(token, pwd);
    return res;
  }
}