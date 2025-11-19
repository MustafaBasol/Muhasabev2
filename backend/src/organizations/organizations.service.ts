import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationMember } from './entities/organization-member.entity';
import { Invite } from './entities/invite.entity';
import { User } from '../users/entities/user.entity';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { InviteUserDto, UpdateMemberRoleDto } from './dto/member.dto';
import { Role, Plan } from '../common/enums/organization.enum';
import { SubscriptionPlan } from '../tenants/entities/tenant.entity';
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

  async create(
    createOrganizationDto: CreateOrganizationDto,
    ownerId: string,
  ): Promise<Organization> {
    const user = await this.userRepository.findOne({ where: { id: ownerId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create organization
    const organization = this.organizationRepository.create({
      name: createOrganizationDto.name,
      plan: createOrganizationDto.plan || Plan.STARTER,
    });

    const savedOrganization =
      await this.organizationRepository.save(organization);

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

    return members.map((member) => member.organization);
  }

  async findOne(id: string, userId: string): Promise<Organization> {
    // Check if user is a member of this organization
    const member = await this.memberRepository.findOne({
      where: { organizationId: id, userId },
      relations: [
        'organization',
        'organization.members',
        'organization.members.user',
      ],
    });

    if (!member) {
      throw new NotFoundException('Organization not found or access denied');
    }

    return member.organization;
  }

  async update(
    id: string,
    updateOrganizationDto: UpdateOrganizationDto,
    userId: string,
  ): Promise<Organization> {
    // Check if user is owner or admin
    const member = await this.memberRepository.findOne({
      where: { organizationId: id, userId },
    });

    if (!member || (member.role !== Role.OWNER && member.role !== Role.ADMIN)) {
      throw new ForbiddenException(
        'Insufficient permissions to update organization',
      );
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
      throw new ForbiddenException(
        'Only organization owners can delete organizations',
      );
    }

    await this.organizationRepository.delete(id);
  }

  async inviteUser(
    organizationId: string,
    inviteUserDto: InviteUserDto,
    inviterId: string,
  ): Promise<Invite> {
    // Check if inviter has permission (owner or admin)
    const inviterMember = await this.memberRepository.findOne({
      where: { organizationId, userId: inviterId },
    });

    if (
      !inviterMember ||
      (inviterMember.role !== Role.OWNER && inviterMember.role !== Role.ADMIN)
    ) {
      throw new ForbiddenException('Insufficient permissions to invite users');
    }

    // Get organization to check plan
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // === Plan limit hesaplaması (tenant aboneliği ile genişlet) ===
    // Mevcut üyeler + bekleyen davetler
    const currentMemberCount = await this.memberRepository.count({ where: { organizationId } });
    const pendingInviteCount = await this.inviteRepository.count({ where: { organizationId, acceptedAt: IsNull() } });
    const totalCount = currentMemberCount + pendingInviteCount;

    // Organizasyon düzeyi planı normalize et
    let normalizedPlan: Plan = (organization.plan === 'PRO' || organization.plan === 'BUSINESS' || organization.plan === 'STARTER')
      ? organization.plan
      : Plan.STARTER;

    // Organizasyon planından gelen temel limit
    let effectiveMax = PlanLimitService.getMaxMembers(normalizedPlan);

    // Davet eden kullanıcının tenant abonelik planını al (daha yüksek ise override)
    const inviterUser = await this.userRepository.findOne({ where: { id: inviterId }, relations: ['tenant'] });
    if (inviterUser?.tenant) {
      const subPlan = inviterUser.tenant.subscriptionPlan;
      const tenantMaxUsers = inviterUser.tenant.maxUsers; // -1 sınırsız

      // Tenant planını organizasyon planına map et (sadece görünür plan değil, limit amacıyla)
      const mapTenantPlanToOrgPlan = (p: SubscriptionPlan): Plan => {
        if (p === SubscriptionPlan.PROFESSIONAL) return Plan.PRO;
        if (p === SubscriptionPlan.ENTERPRISE) return Plan.BUSINESS;
        return Plan.STARTER; // FREE / BASIC => STARTER
      };

      const mappedOrgPlan = mapTenantPlanToOrgPlan(subPlan);
      // Eğer mapped plan organizasyon planından daha üst ise güncelle
      const planRank = (p: Plan) => (p === Plan.STARTER ? 1 : p === Plan.PRO ? 2 : 3);
      if (planRank(mappedOrgPlan) > planRank(normalizedPlan)) {
        normalizedPlan = mappedOrgPlan;
        // Organizasyon kaydını geriye dönük güncellemiyoruz (görsel override) fakat limit hesaplamasında kullanıyoruz
      }

      // Tenant maxUsers değeri organizasyon limitinden büyükse override et
      if (tenantMaxUsers === -1) {
        effectiveMax = -1; // sınırsız
      } else if (tenantMaxUsers > effectiveMax) {
        effectiveMax = tenantMaxUsers;
      }
    }

    const canAdd = effectiveMax === -1 ? true : totalCount < effectiveMax;
    if (!canAdd) {
      // Hata mesajını organizasyon planı yerine efektif plan üzerinden ver
      if (effectiveMax === -1) {
        // Teorik olarak buraya düşmez ama korunma amaçlı
        throw new BadRequestException('No member limit for Business plan');
      }
      throw new BadRequestException(`${normalizedPlan} plan is limited to ${effectiveMax} member${effectiveMax !== 1 ? 's' : ''}. Please upgrade your plan to add more members.`);
    }

    // Check if user is already a member
    const existingMember = await this.memberRepository.findOne({
      where: { organizationId },
      relations: ['user'],
    });

    if (existingMember?.user?.email === inviteUserDto.email) {
      throw new BadRequestException(
        'User is already a member of this organization',
      );
    }

    // Check if there's already a pending invite
    const existingInvite = await this.inviteRepository.findOne({
      where: {
        organizationId,
        email: inviteUserDto.email,
        acceptedAt: IsNull(),
      },
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
              Comptario Accounting System | Istanbul, Turkey
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

Comptario Accounting System
        `,
      });

      console.log(`✅ Invitation email sent to ${inviteUserDto.email}`);
    } catch (error) {
      console.error(
        `❌ Failed to send invitation email to ${inviteUserDto.email}:`,
        error,
      );
      // Don't throw error - invitation is still created even if email fails
    }

    return savedInvite;
  }

  async acceptInvite(
    token: string,
    userId: string,
  ): Promise<OrganizationMember> {
    let user = await this.userRepository.findOne({ where: { id: userId } });
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
      throw new BadRequestException(
        'Invitation email does not match user email',
      );
    }

    // Check if user is already a member
    const existingMember = await this.memberRepository.findOne({
      where: { organizationId: invite.organizationId, userId },
    });

    if (existingMember) {
      throw new BadRequestException(
        'User is already a member of this organization',
      );
    }

    // Check plan limits before accepting the invite (respect tenant subscription overrides)
    const currentMemberCount = await this.memberRepository.count({
      where: { organizationId: invite.organizationId },
    });

    // Base plan from organization
    let normalizedPlan: Plan = (invite.organization.plan === 'PRO' || invite.organization.plan === 'BUSINESS' || invite.organization.plan === 'STARTER')
      ? invite.organization.plan
      : Plan.STARTER;
    let effectiveMax = PlanLimitService.getMaxMembers(normalizedPlan);

    // Try to override using the tenant of an organization owner (represents subscription)
    const ownerMember = await this.memberRepository.findOne({ where: { organizationId: invite.organizationId, role: Role.OWNER } });
    if (ownerMember) {
      const ownerUser = await this.userRepository.findOne({ where: { id: ownerMember.userId }, relations: ['tenant'] });
      if (ownerUser?.tenant) {
        const subPlan = ownerUser.tenant.subscriptionPlan;
        const tenantMaxUsers = ownerUser.tenant.maxUsers;

        const mapTenantPlanToOrgPlan = (p: SubscriptionPlan): Plan => {
          if (p === SubscriptionPlan.PROFESSIONAL) return Plan.PRO;
          if (p === SubscriptionPlan.ENTERPRISE) return Plan.BUSINESS;
          return Plan.STARTER; // FREE/BASIC
        };

        const mapped = mapTenantPlanToOrgPlan(subPlan);
        const rank = (p: Plan) => (p === Plan.STARTER ? 1 : p === Plan.PRO ? 2 : 3);
        if (rank(mapped) > rank(normalizedPlan)) {
          normalizedPlan = mapped;
        }
        if (tenantMaxUsers === -1) {
          effectiveMax = -1;
        } else if (tenantMaxUsers > effectiveMax) {
          effectiveMax = tenantMaxUsers;
        }
      }
    }

    const canAdd = effectiveMax === -1 ? true : currentMemberCount < effectiveMax;
    if (!canAdd) {
      if (effectiveMax === -1) {
        throw new BadRequestException('No member limit for Business plan');
      }
      throw new BadRequestException(`${normalizedPlan} plan is limited to ${effectiveMax} member${effectiveMax !== 1 ? 's' : ''}. Please upgrade your plan to add more members.`);
    }

    // === Tenant eşitleme (organizasyon sahibi tenant'ı) ===
    // Davet edilen kullanıcı farklı bir kişisel tenant ile gelmiş olabilir.
    // İş gereksinimine göre: organizasyona katıldığında aynı muhasebe verilerini görmesi için
    // sahibin (OWNER) tenant'ına taşınır.
    try {
      const ownerMember = await this.memberRepository.findOne({ where: { organizationId: invite.organizationId, role: Role.OWNER } });
      if (ownerMember) {
        const ownerUser = await this.userRepository.findOne({ where: { id: ownerMember.userId } });
        if (ownerUser && ownerUser.tenantId && user.tenantId !== ownerUser.tenantId) {
          // Kullanıcının tenantId'sini OWNER'ın tenantId'sine güncelle
          await this.userRepository.update(user.id, { tenantId: ownerUser.tenantId });
          // Güncel user nesnesini yeniden çek (ilişki verisi gerekirse)
          user = await this.userRepository.findOne({ where: { id: user.id } });
        }
      }
    } catch (e) {
      // Sessiz: tenant eşitleme başarısız olsa bile davet kabul akışı devam etsin
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

  async validateInvite(token: string): Promise<Invite> {
    // Return invite with organization relation if exists. Do not throw for expiry; frontend handles it.
    const invite = await this.inviteRepository.findOne({
      where: { token },
      relations: ['organization'],
    });

    if (!invite) {
      throw new NotFoundException('Invalid invite token');
    }

    return invite;
  }

  async getMembers(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMember[]> {
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

  /**
   * Organizasyon sahibinin (OWNER) tenantId'sini döner.
   * Üyelerin login sırasında tenant senkronu için kullanılır.
   */
  async getOwnerTenantId(organizationId: string): Promise<string | null> {
    const ownerMember = await this.memberRepository.findOne({
      where: { organizationId, role: Role.OWNER },
      relations: ['user'],
    });
    return ownerMember?.user?.tenantId || null;
  }

  async updateMemberRole(
    organizationId: string,
    memberId: string,
    updateMemberRoleDto: UpdateMemberRoleDto,
    userId: string,
  ): Promise<OrganizationMember> {
    // Check if user is owner or admin
    const userMember = await this.memberRepository.findOne({
      where: { organizationId, userId },
    });

    if (
      !userMember ||
      (userMember.role !== Role.OWNER && userMember.role !== Role.ADMIN)
    ) {
      throw new ForbiddenException(
        'Insufficient permissions to update member roles',
      );
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

  async removeMember(
    organizationId: string,
    memberId: string,
    userId: string,
  ): Promise<void> {
    // Check if user is owner or admin
    const userMember = await this.memberRepository.findOne({
      where: { organizationId, userId },
    });

    if (
      !userMember ||
      (userMember.role !== Role.OWNER && userMember.role !== Role.ADMIN)
    ) {
      throw new ForbiddenException(
        'Insufficient permissions to remove members',
      );
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

  async getPendingInvites(
    organizationId: string,
    userId: string,
  ): Promise<Invite[]> {
    // Check if user is owner or admin
    const userMember = await this.memberRepository.findOne({
      where: { organizationId, userId },
    });

    if (
      !userMember ||
      (userMember.role !== Role.OWNER && userMember.role !== Role.ADMIN)
    ) {
      throw new ForbiddenException('Insufficient permissions to view invites');
    }

    return this.inviteRepository.find({
      where: { organizationId, acceptedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async getUserOrganizations(
    userId: string,
  ): Promise<{ organization: Organization; role: Role }[]> {
    const members = await this.memberRepository.find({
      where: { userId },
      relations: ['organization'],
      order: { createdAt: 'ASC' },
    });

    // If user has no organizations, create a default one
    if (members.length === 0) {
      console.log(
        `📦 User ${userId} has no organizations, creating default organization...`,
      );
      const defaultOrg = await this.migrateUserToOrganization(userId);

      // Fetch the member record for the new organization
      const newMember = await this.memberRepository.findOne({
        where: { userId, organizationId: defaultOrg.id },
        relations: ['organization'],
      });

      if (newMember) {
        console.log(
          `✅ Default organization created for user ${userId}: ${defaultOrg.name}`,
        );
        return [
          {
            organization: newMember.organization,
            role: newMember.role,
          },
        ];
      }
    }

    return members.map((member) => ({
      organization: member.organization,
      role: member.role,
    }));
  }

  async getUserRoleInOrganization(
    organizationId: string,
    userId: string,
  ): Promise<Role | null> {
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

    return this.create(
      {
        name: organizationName,
        plan: Plan.STARTER,
      },
      userId,
    );
  }

  async getMembershipStats(
    organizationId: string,
    userId: string,
  ): Promise<{
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

    // Organizasyon planını normalize et
    let normalizedPlan: Plan = (organization.plan === 'PRO' || organization.plan === 'BUSINESS' || organization.plan === 'STARTER')
      ? organization.plan
      : Plan.STARTER;
    let effectiveMax = PlanLimitService.getMaxMembers(normalizedPlan);

    // Kullanıcının tenant aboneliğine göre override
    const userWithTenant = await this.userRepository.findOne({ where: { id: userId }, relations: ['tenant'] });
    if (userWithTenant?.tenant) {
      const subPlan = userWithTenant.tenant.subscriptionPlan;
      const tenantMaxUsers = userWithTenant.tenant.maxUsers;
      const mapTenantPlanToOrgPlan = (p: SubscriptionPlan): Plan => {
        if (p === SubscriptionPlan.PROFESSIONAL) return Plan.PRO;
        if (p === SubscriptionPlan.ENTERPRISE) return Plan.BUSINESS;
        return Plan.STARTER;
      };
      const mappedOrgPlan = mapTenantPlanToOrgPlan(subPlan);
      const rank = (p: Plan) => (p === Plan.STARTER ? 1 : p === Plan.PRO ? 2 : 3);
      if (rank(mappedOrgPlan) > rank(normalizedPlan)) {
        normalizedPlan = mappedOrgPlan;
      }
      if (tenantMaxUsers === -1) {
        effectiveMax = -1;
      } else if (tenantMaxUsers > effectiveMax) {
        effectiveMax = tenantMaxUsers;
      }
    }

    const canAddMore = effectiveMax === -1 ? true : currentMembers < effectiveMax;

    return { currentMembers, maxMembers: effectiveMax, canAddMore, plan: normalizedPlan };
  }

  async cancelInvite(
    organizationId: string,
    inviteId: string,
    userId: string,
  ): Promise<void> {
    // Check if user has permission (OWNER or ADMIN)
    const userMember = await this.memberRepository.findOne({
      where: { organizationId, userId },
    });

    if (
      !userMember ||
      (userMember.role !== Role.OWNER && userMember.role !== Role.ADMIN)
    ) {
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

  async resendInvite(
    organizationId: string,
    inviteId: string,
    userId: string,
  ): Promise<Invite> {
    // Check if user has permission (OWNER or ADMIN)
    const userMember = await this.memberRepository.findOne({
      where: { organizationId, userId },
    });

    if (
      !userMember ||
      (userMember.role !== Role.OWNER && userMember.role !== Role.ADMIN)
    ) {
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
        `,
      });

      console.log(`📧 Resent invitation email to ${invite.email}`);
    } catch (error) {
      console.error(
        `❌ Failed to resend invitation email to ${invite.email}:`,
        error,
      );
      // Do not fail the request if email fails
    }

    return updated;
  }
}
