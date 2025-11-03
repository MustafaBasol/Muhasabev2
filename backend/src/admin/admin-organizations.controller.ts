import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
  Param,
  Patch,
  Body,
  Delete,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminService } from './admin.service';
import { Organization } from '../organizations/entities/organization.entity';
import { OrganizationMember } from '../organizations/entities/organization-member.entity';
import { Invite } from '../organizations/entities/invite.entity';

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
}
