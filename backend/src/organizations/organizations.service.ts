import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationMember } from './entities/organization-member.entity';
import { Invite } from './entities/invite.entity';
import { User } from '../users/entities/user.entity';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';
import { InviteUserDto, UpdateMemberRoleDto } from './dto/member.dto';
import { Role, Plan } from '../common/enums/organization.enum';
import { PlanLimitService } from '../common/plan-limits.service';
import { EmailService } from '../services/email.service';
import { randomBytes } from 'crypto';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private memberRepository: Repository<OrganizationMember>,
    @InjectRepository(Invite)
    private inviteRepository: Repository<Invite>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private emailService: EmailService,
  ) {}

  async create(createOrganizationDto: CreateOrganizationDto, ownerId: string): Promise<Organization> {
    const user = await this.userRepository.findOne({ where: { id: ownerId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create organization
    const organization = this.organizationRepository.create({
      name: createOrganizationDto.name,
      plan: createOrganizationDto.plan || Plan.STARTER,
    });

    const savedOrganization = await this.organizationRepository.save(organization);

    // Create organization member with OWNER role
    const member = this.memberRepository.create({
      organizationId: savedOrganization.id,
      userId: ownerId,
      role: Role.OWNER,
    });

    await this.memberRepository.save(member);

    return savedOrganization;
  }

  async findAll(userId: string): Promise<Organization[]> {
    const members = await this.memberRepository.find({
      where: { userId },
      relations: ['organization'],
    });

    return members.map(member => member.organization);
  }

  async findOne(id: string, userId: string): Promise<Organization> {
    // Check if user is a member of this organization
    const member = await this.memberRepository.findOne({
      where: { organizationId: id, userId },
      relations: ['organization', 'organization.members', 'organization.members.user'],
    });

    if (!member) {
      throw new NotFoundException('Organization not found or access denied');
    }

    return member.organization;
  }

  async update(id: string, updateOrganizationDto: UpdateOrganizationDto, userId: string): Promise<Organization> {
    // Check if user is owner or admin
    const member = await this.memberRepository.findOne({
      where: { organizationId: id, userId },
    });

    if (!member || (member.role !== Role.OWNER && member.role !== Role.ADMIN)) {
      throw new ForbiddenException('Insufficient permissions to update organization');
    }

    await this.organizationRepository.update(id, updateOrganizationDto);
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    // Only owners can delete organizations
    const member = await this.memberRepository.findOne({
      where: { organizationId: id, userId, role: Role.OWNER },
    });

    if (!member) {
      throw new ForbiddenException('Only organization owners can delete organizations');
    }

    await this.organizationRepository.delete(id);
  }

  async inviteUser(organizationId: string, inviteUserDto: InviteUserDto, inviterId: string): Promise<Invite> {
    // Check if inviter has permission (owner or admin)
    const inviterMember = await this.memberRepository.findOne({
      where: { organizationId, userId: inviterId },
    });

    if (!inviterMember || (inviterMember.role !== Role.OWNER && inviterMember.role !== Role.ADMIN)) {
      throw new ForbiddenException('Insufficient permissions to invite users');
    }

    // Get organization to check plan
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Check plan limits for adding a new member (include pending invites)
    const currentMemberCount = await this.memberRepository.count({
      where: { organizationId },
    });
    
    const pendingInviteCount = await this.inviteRepository.count({
      where: { organizationId, acceptedAt: IsNull() },
    });
    
    const totalCount = currentMemberCount + pendingInviteCount;

    const canAdd = PlanLimitService.canAddMember(totalCount, organization.plan);
    if (!canAdd) {
      const errorMessage = PlanLimitService.getMemberLimitError(organization.plan);
      throw new BadRequestException(errorMessage);
    }

    // Check if user is already a member
    const existingMember = await this.memberRepository.findOne({
      where: { organizationId },
      relations: ['user'],
    });

    if (existingMember?.user?.email === inviteUserDto.email) {
      throw new BadRequestException('User is already a member of this organization');
    }

    // Check if there's already a pending invite
    const existingInvite = await this.inviteRepository.findOne({
      where: { organizationId, email: inviteUserDto.email, acceptedAt: IsNull() },
    });

    if (existingInvite) {
      throw new BadRequestException('Invitation already sent to this email');
    }

    // Create invite
    const invite = this.inviteRepository.create({
      organizationId,
      email: inviteUserDto.email,
      role: inviteUserDto.role,
      token: randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    const savedInvite = await this.inviteRepository.save(invite);

    // Send invitation email
    try {
      // Use hash-based route so static hosting works without server-side rewrites
      const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5174';
      const inviteUrl = `${frontendBase}/#join?token=${savedInvite.token}`;
      
      await this.emailService.sendEmail({
        to: inviteUserDto.email,
        subject: `Invitation to join ${organization.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">Organization Invitation</h2>
            
            <p>You have been invited to join <strong>${organization.name}</strong> as a <strong>${inviteUserDto.role}</strong>.</p>
            
            <div style="background-color: #ecfdf5; border: 1px solid #10b981; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;">Click the link below to accept the invitation:</p>
              <a href="${inviteUrl}" style="color: #059669; text-decoration: none; font-weight: bold;">${inviteUrl}</a>
            </div>
            
            <p><strong>Note:</strong> This invitation will expire in 7 days.</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            
            <p style="font-size: 12px; color: #6b7280;">
              MoneyFlow Accounting System | Istanbul, Turkey
            </p>
            <hr style="margin: 24px 0; border:none; border-top: 1px solid #e5e7eb;" />
            <h3 style="color:#374151; margin-top:0;">TR</h3>
            <p><strong>${organization.name}</strong> organizasyonuna <strong>${inviteUserDto.role}</strong> rolüyle katılmanız için davet edildiniz.</p>
            <p>Daveti kabul etmek için bağlantıya tıklayın: <a href="${inviteUrl}">${inviteUrl}</a></p>
            <p><em>Not:</em> Davet 7 gün içinde geçerlidir.</p>
          </div>
        `,
        text: `
You have been invited to join ${organization.name} as a ${inviteUserDto.role}.

Accept invitation: ${inviteUrl}

This invitation will expire in 7 days.

MoneyFlow Accounting System
        `
      });

      console.log(`✅ Invitation email sent to ${inviteUserDto.email}`);
    } catch (error) {
      console.error(`❌ Failed to send invitation email to ${inviteUserDto.email}:`, error);
      // Don't throw error - invitation is still created even if email fails
    }

    return savedInvite;
  }

  async acceptInvite(token: string, userId: string): Promise<OrganizationMember> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const invite = await this.inviteRepository.findOne({
      where: { token, acceptedAt: IsNull() },
      relations: ['organization'],
    });

    if (!invite) {
      throw new NotFoundException('Invalid or expired invitation');
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    if (invite.email !== user.email) {
      throw new BadRequestException('Invitation email does not match user email');
    }

    // Check if user is already a member
    const existingMember = await this.memberRepository.findOne({
      where: { organizationId: invite.organizationId, userId },
    });

    if (existingMember) {
      throw new BadRequestException('User is already a member of this organization');
    }

    // Check plan limits before accepting the invite
    const currentMemberCount = await this.memberRepository.count({
      where: { organizationId: invite.organizationId },
    });

    const canAdd = PlanLimitService.canAddMember(currentMemberCount, invite.organization.plan);
    if (!canAdd) {
      const errorMessage = PlanLimitService.getMemberLimitError(invite.organization.plan);
      throw new BadRequestException(errorMessage);
    }

    // Create organization member
    const member = this.memberRepository.create({
      organizationId: invite.organizationId,
      userId,
      role: invite.role,
    });

    const savedMember = await this.memberRepository.save(member);

    // Mark invite as accepted
    invite.acceptedAt = new Date();
    await this.inviteRepository.save(invite);

    return savedMember;
  }

  async getMembers(organizationId: string, userId: string): Promise<OrganizationMember[]> {
    // Check if user is a member of this organization
    const userMember = await this.memberRepository.findOne({
      where: { organizationId, userId },
    });

    if (!userMember) {
      throw new ForbiddenException('Access denied');
    }

    return this.memberRepository.find({
      where: { organizationId },
      relations: ['user'],
    });
  }

  async updateMemberRole(organizationId: string, memberId: string, updateMemberRoleDto: UpdateMemberRoleDto, userId: string): Promise<OrganizationMember> {
    // Check if user is owner or admin
    const userMember = await this.memberRepository.findOne({
      where: { organizationId, userId },
    });

    if (!userMember || (userMember.role !== Role.OWNER && userMember.role !== Role.ADMIN)) {
      throw new ForbiddenException('Insufficient permissions to update member roles');
    }

    const targetMember = await this.memberRepository.findOne({
      where: { id: memberId, organizationId },
    });

    if (!targetMember) {
      throw new NotFoundException('Member not found');
    }

    // Owners cannot be demoted by non-owners
    if (targetMember.role === Role.OWNER && userMember.role !== Role.OWNER) {
      throw new ForbiddenException('Cannot modify owner permissions');
    }

    // Cannot demote yourself if you're the only owner
    if (targetMember.userId === userId && targetMember.role === Role.OWNER) {
      const ownerCount = await this.memberRepository.count({
        where: { organizationId, role: Role.OWNER },
      });

      if (ownerCount === 1) {
        throw new BadRequestException('Cannot demote the only owner');
      }
    }

    targetMember.role = updateMemberRoleDto.role;
    return this.memberRepository.save(targetMember);
  }

  async removeMember(organizationId: string, memberId: string, userId: string): Promise<void> {
    // Check if user is owner or admin
    const userMember = await this.memberRepository.findOne({
      where: { organizationId, userId },
    });

    if (!userMember || (userMember.role !== Role.OWNER && userMember.role !== Role.ADMIN)) {
      throw new ForbiddenException('Insufficient permissions to remove members');
    }

    const targetMember = await this.memberRepository.findOne({
      where: { id: memberId, organizationId },
    });

    if (!targetMember) {
      throw new NotFoundException('Member not found');
    }

    // Cannot remove owners unless you're an owner
    if (targetMember.role === Role.OWNER && userMember.role !== Role.OWNER) {
      throw new ForbiddenException('Cannot remove owner');
    }

    // Cannot remove yourself if you're the only owner
    if (targetMember.userId === userId && targetMember.role === Role.OWNER) {
      const ownerCount = await this.memberRepository.count({
        where: { organizationId, role: Role.OWNER },
      });

      if (ownerCount === 1) {
        throw new BadRequestException('Cannot remove the only owner');
      }
    }

    await this.memberRepository.remove(targetMember);
  }

  async getPendingInvites(organizationId: string, userId: string): Promise<Invite[]> {
    // Check if user is owner or admin
    const userMember = await this.memberRepository.findOne({
      where: { organizationId, userId },
    });

    if (!userMember || (userMember.role !== Role.OWNER && userMember.role !== Role.ADMIN)) {
      throw new ForbiddenException('Insufficient permissions to view invites');
    }

    return this.inviteRepository.find({
      where: { organizationId, acceptedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async getUserOrganizations(userId: string): Promise<{ organization: Organization; role: Role }[]> {
    const members = await this.memberRepository.find({
      where: { userId },
      relations: ['organization'],
      order: { createdAt: 'ASC' },
    });

    // If user has no organizations, create a default one
    if (members.length === 0) {
      console.log(`📦 User ${userId} has no organizations, creating default organization...`);
      const defaultOrg = await this.migrateUserToOrganization(userId);
      
      // Fetch the member record for the new organization
      const newMember = await this.memberRepository.findOne({
        where: { userId, organizationId: defaultOrg.id },
        relations: ['organization'],
      });

      if (newMember) {
        console.log(`✅ Default organization created for user ${userId}: ${defaultOrg.name}`);
        return [{
          organization: newMember.organization,
          role: newMember.role,
        }];
      }
    }

    return members.map(member => ({
      organization: member.organization,
      role: member.role,
    }));
  }

  async getUserRoleInOrganization(organizationId: string, userId: string): Promise<Role | null> {
    const member = await this.memberRepository.findOne({
      where: { organizationId, userId },
    });

    return member?.role || null;
  }

  async migrateUserToOrganization(userId: string): Promise<Organization> {
    // Check if user already has an organization
    const existingMember = await this.memberRepository.findOne({
      where: { userId },
      relations: ['organization'],
    });

    if (existingMember) {
      return existingMember.organization;
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create default organization for existing user
    const organizationName = `${user.firstName} ${user.lastName}'s Organization`;
    
    return this.create({
      name: organizationName,
      plan: Plan.STARTER,
    }, userId);
  }

  async getMembershipStats(organizationId: string, userId: string): Promise<{
    currentMembers: number;
    maxMembers: number;
    canAddMore: boolean;
    plan: Plan;
  }> {
    // Check if user is a member of this organization
    const userMember = await this.memberRepository.findOne({
      where: { organizationId, userId },
    });

    if (!userMember) {
      throw new ForbiddenException('Access denied');
    }

    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const currentMembers = await this.memberRepository.count({
      where: { organizationId },
    });

    const maxMembers = PlanLimitService.getMaxMembers(organization.plan);
    const canAddMore = PlanLimitService.canAddMember(currentMembers, organization.plan);

    return {
      currentMembers,
      maxMembers,
      canAddMore,
      plan: organization.plan,
    };
  }

  async cancelInvite(organizationId: string, inviteId: string, userId: string): Promise<void> {
    // Check if user has permission (OWNER or ADMIN)
    const userMember = await this.memberRepository.findOne({
      where: { organizationId, userId },
    });

    if (!userMember || (userMember.role !== Role.OWNER && userMember.role !== Role.ADMIN)) {
      throw new ForbiddenException('Only owners and admins can cancel invites');
    }

    // Find the invite
    const invite = await this.inviteRepository.findOne({
      where: { id: inviteId, organizationId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    // Delete the invite
    await this.inviteRepository.remove(invite);
  }

  async resendInvite(organizationId: string, inviteId: string, userId: string): Promise<Invite> {
    // Check if user has permission (OWNER or ADMIN)
    const userMember = await this.memberRepository.findOne({
      where: { organizationId, userId },
    });

    if (!userMember || (userMember.role !== Role.OWNER && userMember.role !== Role.ADMIN)) {
      throw new ForbiddenException('Only owners and admins can resend invites');
    }

    // Find the invite
    const invite = await this.inviteRepository.findOne({
      where: { id: inviteId, organizationId },
      relations: ['organization'],
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    // Update expiry date (extend by 7 days)
    const newExpiryDate = new Date();
    newExpiryDate.setDate(newExpiryDate.getDate() + 7);
    
    invite.expiresAt = newExpiryDate;

    // Save updated invite
    const updated = await this.inviteRepository.save(invite);

    // Try sending the invitation email again
    try {
      const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5174';
      const inviteUrl = `${frontendBase}/#join?token=${invite.token}`;

      await this.emailService.sendEmail({
        to: invite.email,
        subject: `Reminder: Invitation to join ${invite.organization.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">Invitation Reminder</h2>
            <p>You still have a pending invitation to join <strong>${invite.organization.name}</strong> as a <strong>${invite.role}</strong>.</p>
            <div style="background-color: #ecfdf5; border: 1px solid #10b981; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;">Use this link to accept the invitation:</p>
              <a href="${inviteUrl}" style="color: #059669; text-decoration: none; font-weight: bold;">${inviteUrl}</a>
            </div>
            <p><strong>Note:</strong> This invitation has been extended and will expire on ${newExpiryDate.toLocaleString()}.</p>
            <hr style="margin: 24px 0; border:none; border-top: 1px solid #e5e7eb;" />
            <h3 style="color:#374151; margin-top:0;">TR</h3>
            <p><strong>${invite.organization.name}</strong> organizasyonuna <strong>${invite.role}</strong> olarak katılmanız için bekleyen bir davetiniz var.</p>
            <p>Daveti kabul etmek için bu bağlantıyı kullanın: <a href="${inviteUrl}">${inviteUrl}</a></p>
            <p><em>Not:</em> Davetin süresi uzatıldı. Yeni bitiş: ${newExpiryDate.toLocaleString()}.</p>
          </div>
        `,
        text: `
You still have a pending invitation to join ${invite.organization.name} as a ${invite.role}.

Accept invitation: ${inviteUrl}

This invitation has been extended and will expire on ${newExpiryDate.toLocaleString()}.
        `
      });

      console.log(`📧 Resent invitation email to ${invite.email}`);
    } catch (error) {
      console.error(`❌ Failed to resend invitation email to ${invite.email}:`, error);
      // Do not fail the request if email fails
    }

    return updated;
  }
}