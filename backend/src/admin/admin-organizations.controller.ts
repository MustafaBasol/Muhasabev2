import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
  Param,
  Patch,
  Body,
  Delete,
  Post,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminService } from './admin.service';
import { Organization } from '../organizations/entities/organization.entity';
import { OrganizationMember } from '../organizations/entities/organization-member.entity';
import { Invite } from '../organizations/entities/invite.entity';
import { OrganizationsService } from '../organizations/organizations.service';

@Controller('admin/organizations')
export class AdminOrganizationsController {
  constructor(
    private readonly adminService: AdminService,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private readonly memberRepo: Repository<OrganizationMember>,
    @InjectRepository(Invite)
    private readonly inviteRepo: Repository<Invite>,
    private readonly organizationsService: OrganizationsService,
  ) {}

  private checkAdminAuth(headers: any) {
    const adminToken = headers['admin-token'];
    if (!adminToken) throw new UnauthorizedException('Admin token required');
    if (!this.adminService.isValidAdminToken(adminToken)) {
      throw new UnauthorizedException('Invalid or expired admin token');
    }
  }

  @Get()
  async listOrganizations(@Headers() headers: any) {
    this.checkAdminAuth(headers);
    return this.orgRepo.find({ order: { createdAt: 'DESC' } as any });
  }

  @Get(':orgId/members')
  async listMembers(@Param('orgId') orgId: string, @Headers() headers: any) {
    this.checkAdminAuth(headers);
    return this.memberRepo.find({
      where: { organizationId: orgId },
      relations: ['user'],
    });
  }

  @Get(':orgId/invites')
  async listInvites(@Param('orgId') orgId: string, @Headers() headers: any) {
    this.checkAdminAuth(headers);
    return this.inviteRepo.find({
      where: { organizationId: orgId },
      order: { createdAt: 'DESC' },
    });
  }

  @Patch(':orgId/members/:memberId/role')
  async updateMemberRole(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Body() body: { role: string },
    @Headers() headers: any,
  ) {
    this.checkAdminAuth(headers);
    const member = await this.memberRepo.findOne({
      where: { id: memberId, organizationId: orgId },
    });
    if (!member) {
      throw new Error('Member not found');
    }
    (member as any).role = body.role;
    return this.memberRepo.save(member);
  }

  @Delete(':orgId/members/:memberId')
  async removeMember(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Headers() headers: any,
  ) {
    this.checkAdminAuth(headers);
    const member = await this.memberRepo.findOne({
      where: { id: memberId, organizationId: orgId },
    });
    if (!member) {
      throw new Error('Member not found');
    }
    await this.memberRepo.remove(member);
    return { success: true };
  }

  @Post(':orgId/invite')
  async adminCreateInvite(
    @Param('orgId') orgId: string,
    @Body() body: { email: string; role: string },
    @Headers() headers: any,
  ) {
    this.checkAdminAuth(headers);
    if (!body?.email || !body?.role) {
      throw new BadRequestException('email and role are required');
    }
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    // Bir owner veya admin üyeyi davet eden olarak kullan
    const inviter = await this.memberRepo.findOne({
      where: { organizationId: orgId },
      order: { createdAt: 'ASC' } as any,
    });
    if (!inviter) throw new BadRequestException('No inviter member found');

    const invite = await this.organizationsService.inviteUser(
      orgId,
      { email: body.email, role: body.role } as any,
      inviter.userId,
    );
    return invite;
  }

  @Post(':orgId/invites/:inviteId/resend')
  async adminResendInvite(
    @Param('orgId') orgId: string,
    @Param('inviteId') inviteId: string,
    @Headers() headers: any,
  ) {
    this.checkAdminAuth(headers);
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    const inviter = await this.memberRepo.findOne({
      where: { organizationId: orgId },
      order: { createdAt: 'ASC' } as any,
    });
    if (!inviter) throw new BadRequestException('No inviter member found');

    const updated = await this.organizationsService.resendInvite(
      orgId,
      inviteId,
      inviter.userId,
    );
    return updated;
  }
}
