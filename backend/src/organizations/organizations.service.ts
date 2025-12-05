import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationMember } from './entities/organization-member.entity';
import { Invite } from './entities/invite.entity';
import { User, UserRole } from '../users/entities/user.entity';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { InviteUserDto, UpdateMemberRoleDto } from './dto/member.dto';
import { Role, Plan } from '../common/enums/organization.enum';
import { SubscriptionPlan } from '../tenants/entities/tenant.entity';
import { PlanLimitService } from '../common/plan-limits.service';
import { TenantPlanLimitService } from '../common/tenant-plan-limits.service';
import { EmailService } from '../services/email.service';
import { TenantsService } from '../tenants/tenants.service';
import { randomBytes } from 'crypto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

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
    private tenantsService: TenantsService,
  ) {}

  private normalizeBaseUrl(value?: string | null): string | undefined {
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const tryParse = (candidate: string) => {
      try {
        const url = new URL(candidate);
        return url.origin;
      } catch {
        return undefined;
      }
    };
    return (
      tryParse(trimmed) ||
      (trimmed.startsWith('http') ? undefined : tryParse(`https://${trimmed}`))
    );
  }

  private detectCodespaceFrontendOrigin(): string | undefined {
    const name = process.env.CODESPACE_NAME;
    const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
    if (name && domain) {
      const port =
        process.env.CODESPACE_FRONTEND_PORT ||
        process.env.FRONTEND_PORT ||
        process.env.VITE_PORT ||
        '5174';
      return `https://${name}-${port}.${domain}`;
    }
    return undefined;
  }

  private resolveFrontendBaseUrl(preferredOrigin?: string): string {
    return (
      this.normalizeBaseUrl(preferredOrigin) ||
      this.normalizeBaseUrl(process.env.FRONTEND_PUBLIC_URL) ||
      this.normalizeBaseUrl(process.env.APP_URL) ||
      this.normalizeBaseUrl(process.env.FRONTEND_URL) ||
      this.detectCodespaceFrontendOrigin() ||
      'http://localhost:5174'
    );
  }

  private buildInviteUrl(token: string, preferredOrigin?: string): string {
    const base = this.resolveFrontendBaseUrl(preferredOrigin);
    return `${base}/#join?token=${token}`;
  }

  private buildInviteEmailContent(options: {
    organizationName: string;
    role: Role;
    inviteUrl: string;
    expiryDate: Date;
    isReminder?: boolean;
  }): { subject: string; html: string; text: string } {
    const { organizationName, role, inviteUrl, expiryDate, isReminder } =
      options;
    const expiryLabel = expiryDate.toLocaleString();
    const subject = isReminder
      ? `Reminder: Invitation to join ${organizationName}`
      : `Invitation to join ${organizationName}`;
    const enIntro = isReminder
      ? `You still have a pending invitation to join <strong>${organizationName}</strong> as a <strong>${role}</strong>.`
      : `You have been invited to join <strong>${organizationName}</strong> as a <strong>${role}</strong>.`;
    const enNote = `<p><strong>Note:</strong> This invitation will expire on ${expiryLabel}.</p>`;
    const trIntro = isReminder
      ? `<p><strong>${organizationName}</strong> organizasyonuna <strong>${role}</strong> olarak katılmanız için bekleyen bir davetiniz var.</p>`
      : `<p><strong>${organizationName}</strong> organizasyonuna <strong>${role}</strong> rolüyle katılmanız için davet edildiniz.</p>`;
    const trNote = `<p><em>Not:</em> Davetin son geçerlilik tarihi: ${expiryLabel}.</p>`;

    return {
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">${isReminder ? 'Invitation Reminder' : 'Organization Invitation'}</h2>
          <p>${enIntro}</p>
          <div style="background-color: #ecfdf5; border: 1px solid #10b981; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;">Click the link below to accept the invitation:</p>
            <a href="${inviteUrl}" style="color: #059669; text-decoration: none; font-weight: bold;">${inviteUrl}</a>
          </div>
          ${enNote}
          <hr style="margin: 24px 0; border:none; border-top: 1px solid #e5e7eb;" />
          <h3 style="color:#374151; margin-top:0;">TR</h3>
          ${trIntro}
          <p>Daveti kabul etmek için bağlantıya tıklayın: <a href="${inviteUrl}">${inviteUrl}</a></p>
          ${trNote}
        </div>
      `,
      text: `
${isReminder ? 'You still have a pending invitation' : 'You have been invited'} to join ${organizationName} as a ${role}.

Accept invitation: ${inviteUrl}

This invitation will expire on ${expiryLabel}.
      `,
    };
  }

  private resolveTenantSeatLimit(tenant?: User['tenant'] | null): number {
    if (!tenant) {
      return PlanLimitService.getMaxMembers(Plan.STARTER);
    }
    const tenantLimits = TenantPlanLimitService.getLimitsForTenant(tenant);
    const planMaxUsers = tenantLimits.maxUsers;
    const storedMaxUsers =
      typeof tenant.maxUsers === 'number' && Number.isFinite(tenant.maxUsers)
        ? tenant.maxUsers
        : undefined;

    if (planMaxUsers === -1 || storedMaxUsers === -1) {
      return -1;
    }
    if (typeof storedMaxUsers === 'number') {
      return Math.max(planMaxUsers, storedMaxUsers);
    }
    return planMaxUsers;
  }

  private queueInviteEmail(options: {
    invite: Invite;
    organizationName: string;
    role: Role;
    requestOrigin?: string;
    isReminder?: boolean;
    expiresAt?: Date;
  }): void {
    const {
      invite,
      organizationName,
      role,
      requestOrigin,
      isReminder,
      expiresAt,
    } = options;
    const expiryDate =
      expiresAt ??
      (invite.expiresAt instanceof Date
        ? invite.expiresAt
        : new Date(invite.expiresAt));
    const inviteUrl = this.buildInviteUrl(invite.token, requestOrigin);
    const { subject, html, text } = this.buildInviteEmailContent({
      organizationName,
      role,
      inviteUrl,
      expiryDate,
      isReminder,
    });

    // Defer to the next tick so slow providers cannot block the API response.
    const dispatchEmail = () => {
      this.emailService
        .sendEmail({
          to: invite.email,
          subject,
          html,
          text,
          meta: {
            tenantId: invite.organizationId,
            type: isReminder ? 'verify-resend' : 'verify',
          },
        })
        .then(() => {
          this.logger.log(
            `📧 ${isReminder ? 'Resent' : 'Sent'} invitation email to ${invite.email}`,
          );
        })
        .catch((error: unknown) => {
          let message: string;
          if (error instanceof Error) {
            message = error.message;
          } else if (typeof error === 'string') {
            message = error;
          } else {
            try {
              message = JSON.stringify(error);
            } catch {
              message = String(error);
            }
          }
          this.logger.error(
            `❌ Failed to ${isReminder ? 'resend' : 'send'} invitation email to ${invite.email}: ${message}`,
          );
        });
    };

    if (typeof setImmediate === 'function') {
      setImmediate(dispatchEmail);
    } else {
      // Fallback for environments without setImmediate (shouldn't happen in Node)
      void Promise.resolve().then(dispatchEmail);
    }
  }

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
    requestOrigin?: string,
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
    const currentMemberCount = await this.memberRepository.count({
      where: { organizationId },
    });
    const pendingInviteCount = await this.inviteRepository.count({
      where: { organizationId, acceptedAt: IsNull() },
    });
    const totalCount = currentMemberCount + pendingInviteCount;

    // Organizasyon düzeyi planı normalize et
    let normalizedPlan: Plan =
      organization.plan === Plan.PRO ||
      organization.plan === Plan.BUSINESS ||
      organization.plan === Plan.STARTER
        ? organization.plan
        : Plan.STARTER;

    // Organizasyon planından gelen temel limit
    let effectiveMax = PlanLimitService.getMaxMembers(normalizedPlan);

    // Davet eden kullanıcının tenant abonelik planını al (daha yüksek ise override)
    const inviterUser = await this.userRepository.findOne({
      where: { id: inviterId },
      relations: ['tenant'],
    });
    if (inviterUser?.tenant) {
      const subPlan = inviterUser.tenant.subscriptionPlan;
      const tenantMaxUsers = this.resolveTenantSeatLimit(inviterUser.tenant);

      // Tenant planını organizasyon planına map et (sadece görünür plan değil, limit amacıyla)
      const mapTenantPlanToOrgPlan = (p: SubscriptionPlan): Plan => {
        if (p === SubscriptionPlan.PROFESSIONAL) return Plan.PRO;
        if (p === SubscriptionPlan.ENTERPRISE) return Plan.BUSINESS;
        return Plan.STARTER; // FREE / BASIC => STARTER
      };

      const mappedOrgPlan = mapTenantPlanToOrgPlan(subPlan);
      // Eğer mapped plan organizasyon planından daha üst ise güncelle
      const planRank = (p: Plan) =>
        p === Plan.STARTER ? 1 : p === Plan.PRO ? 2 : 3;
      if (planRank(mappedOrgPlan) > planRank(normalizedPlan)) {
        normalizedPlan = mappedOrgPlan;
        // Organizasyon kaydını geriye dönük güncellemiyoruz (görsel override) fakat limit hesaplamasında kullanıyoruz
      }

      // Tenant maxUsers değeri organizasyon limitinden büyükse override et
      if (tenantMaxUsers === -1) {
        effectiveMax = -1; // sınırsız
      } else if (
        typeof tenantMaxUsers === 'number' &&
        tenantMaxUsers > effectiveMax
      ) {
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
      throw new BadRequestException(
        `${normalizedPlan} plan is limited to ${effectiveMax} member${effectiveMax !== 1 ? 's' : ''}. Please upgrade your plan to add more members.`,
      );
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

    // Fire-and-forget email so HTTP response is not blocked by SMTP/SES latency
    this.queueInviteEmail({
      invite: savedInvite,
      organizationName: organization.name,
      role: inviteUserDto.role,
      requestOrigin,
    });

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
    let normalizedPlan: Plan =
      invite.organization.plan === Plan.PRO ||
      invite.organization.plan === Plan.BUSINESS ||
      invite.organization.plan === Plan.STARTER
        ? invite.organization.plan
        : Plan.STARTER;
    let effectiveMax = PlanLimitService.getMaxMembers(normalizedPlan);

    // Try to override using the tenant of an organization owner (represents subscription)
    const ownerMember = await this.memberRepository.findOne({
      where: { organizationId: invite.organizationId, role: Role.OWNER },
    });
    if (ownerMember) {
      const ownerUser = await this.userRepository.findOne({
        where: { id: ownerMember.userId },
        relations: ['tenant'],
      });
      if (ownerUser?.tenant) {
        const subPlan = ownerUser.tenant.subscriptionPlan;
        const tenantMaxUsers = this.resolveTenantSeatLimit(ownerUser.tenant);

        const mapTenantPlanToOrgPlan = (p: SubscriptionPlan): Plan => {
          if (p === SubscriptionPlan.PROFESSIONAL) return Plan.PRO;
          if (p === SubscriptionPlan.ENTERPRISE) return Plan.BUSINESS;
          return Plan.STARTER; // FREE/BASIC
        };

        const mapped = mapTenantPlanToOrgPlan(subPlan);
        const rank = (p: Plan) =>
          p === Plan.STARTER ? 1 : p === Plan.PRO ? 2 : 3;
        if (rank(mapped) > rank(normalizedPlan)) {
          normalizedPlan = mapped;
        }
        if (tenantMaxUsers === -1) {
          effectiveMax = -1;
        } else if (
          typeof tenantMaxUsers === 'number' &&
          tenantMaxUsers > effectiveMax
        ) {
          effectiveMax = tenantMaxUsers;
        }
      }
    }

    const canAdd =
      effectiveMax === -1 ? true : currentMemberCount < effectiveMax;
    if (!canAdd) {
      if (effectiveMax === -1) {
        throw new BadRequestException('No member limit for Business plan');
      }
      throw new BadRequestException(
        `${normalizedPlan} plan is limited to ${effectiveMax} member${effectiveMax !== 1 ? 's' : ''}. Please upgrade your plan to add more members.`,
      );
    }

    // === Tenant eşitleme (organizasyon sahibi tenant'ı) ===
    // Davet edilen kullanıcı farklı bir kişisel tenant ile gelmiş olabilir.
    // İş gereksinimine göre: organizasyona katıldığında aynı muhasebe verilerini görmesi için
    // sahibin (OWNER) tenant'ına taşınır.
    try {
      const ownerMember = await this.memberRepository.findOne({
        where: { organizationId: invite.organizationId, role: Role.OWNER },
      });
      if (ownerMember) {
        const ownerUser = await this.userRepository.findOne({
          where: { id: ownerMember.userId },
        });
        if (
          ownerUser &&
          ownerUser.tenantId &&
          user.tenantId !== ownerUser.tenantId
        ) {
          // Kullanıcının tenantId'sini OWNER'ın tenantId'sine güncelle
          await this.userRepository.update(user.id, {
            tenantId: ownerUser.tenantId,
          });
          // Güncel user nesnesini yeniden çek (ilişki verisi gerekirse)
          user = await this.userRepository.findOne({ where: { id: user.id } });
        }
      }
    } catch {
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

  async attachUserToTenantOrganization(
    tenantId: string,
    userId: string,
    options?: { role?: Role },
  ): Promise<Organization | null> {
    try {
      const ownerUser = await this.userRepository.findOne({
        where: { tenantId, role: UserRole.TENANT_ADMIN },
        order: { createdAt: 'ASC' },
      });

      if (!ownerUser) {
        this.logger.warn(
          `attachUserToTenantOrganization: owner not found for tenant ${tenantId}`,
        );
        return null;
      }

      const ownerOrg = await this.resolveOwnerOrganization(ownerUser.id);
      if (!ownerOrg) {
        this.logger.warn(
          `attachUserToTenantOrganization: organization missing for tenant owner ${ownerUser.id}`,
        );
        return null;
      }

      const desiredRole = options?.role ?? Role.MEMBER;
      const existingMembership = await this.memberRepository.findOne({
        where: { organizationId: ownerOrg.id, userId },
      });

      if (existingMembership) {
        if (options?.role && existingMembership.role !== options.role) {
          existingMembership.role = options.role;
          await this.memberRepository.save(existingMembership);
        }
        await this.ensureUserCurrentOrg(userId, ownerOrg.id);
        return ownerOrg;
      }

      const member = this.memberRepository.create({
        organizationId: ownerOrg.id,
        userId,
        role: desiredRole,
      });
      await this.memberRepository.save(member);
      await this.ensureUserCurrentOrg(userId, ownerOrg.id);
      return ownerOrg;
    } catch (error) {
      this.logger.warn(
        `attachUserToTenantOrganization failed for tenant ${tenantId}, user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
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
    await this.handleTenantDetachmentAfterRemoval(
      organizationId,
      targetMember.userId,
    );
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

  private async ensureUserCurrentOrg(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;
    if (user.currentOrgId === organizationId) {
      return;
    }
    await this.userRepository.update(userId, { currentOrgId: organizationId });
  }

  private async resolveOwnerOrganization(
    ownerUserId: string,
  ): Promise<Organization | null> {
    const membership = await this.memberRepository.findOne({
      where: { userId: ownerUserId, role: Role.OWNER },
      relations: ['organization'],
      order: { createdAt: 'ASC' },
    });
    if (membership?.organization) {
      return membership.organization;
    }
    try {
      return await this.migrateUserToOrganization(ownerUserId);
    } catch (error) {
      this.logger.warn(
        `resolveOwnerOrganization failed for user ${ownerUserId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private buildPersonalTenantName(user: User): string {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    if (fullName) {
      return `${fullName} Workspace`;
    }
    const localPart = (user.email || '').split('@')[0] || 'workspace';
    return `${localPart} Workspace`;
  }

  private async createPersonalTenantForUser(user: User) {
    try {
      return await this.tenantsService.create({
        name: this.buildPersonalTenantName(user),
        companyName:
          `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
        email: user.email,
      });
    } catch (error) {
      this.logger.warn(
        `createPersonalTenantForUser failed for user ${user.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async userSharesTenantAcrossMemberships(
    userId: string,
    tenantId: string,
  ): Promise<boolean> {
    const memberships = await this.memberRepository.find({ where: { userId } });
    if (memberships.length === 0) {
      return false;
    }

    for (const membership of memberships) {
      const ownerTenantId = await this.getOwnerTenantId(
        membership.organizationId,
      );
      if (ownerTenantId === tenantId) {
        return true;
      }
    }
    return false;
  }

  private async handleTenantDetachmentAfterRemoval(
    organizationId: string,
    removedUserId: string,
  ): Promise<void> {
    try {
      const ownerTenantId = await this.getOwnerTenantId(organizationId);
      if (!ownerTenantId) {
        return;
      }

      const removedUser = await this.userRepository.findOne({
        where: { id: removedUserId },
      });
      if (!removedUser || removedUser.tenantId !== ownerTenantId) {
        return;
      }

      const stillShares = await this.userSharesTenantAcrossMemberships(
        removedUserId,
        ownerTenantId,
      );
      if (stillShares) {
        return;
      }

      const fallbackTenant = await this.createPersonalTenantForUser(
        removedUser,
      );
      if (!fallbackTenant) {
        return;
      }

      await this.userRepository.update(removedUser.id, {
        tenantId: fallbackTenant.id,
        currentOrgId: null,
        role:
          removedUser.role === UserRole.TENANT_ADMIN
            ? removedUser.role
            : UserRole.USER,
      });

      try {
        const personalOrg = await this.migrateUserToOrganization(
          removedUser.id,
        );
        await this.ensureUserCurrentOrg(removedUser.id, personalOrg.id);
      } catch (error) {
        this.logger.warn(
          `Failed to create default organization for removed user ${removedUser.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `handleTenantDetachmentAfterRemoval failed for organization ${organizationId}, user ${removedUserId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
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
    let normalizedPlan: Plan =
      organization.plan === Plan.PRO ||
      organization.plan === Plan.BUSINESS ||
      organization.plan === Plan.STARTER
        ? organization.plan
        : Plan.STARTER;
    let effectiveMax = PlanLimitService.getMaxMembers(normalizedPlan);

    // Kullanıcının tenant aboneliğine göre override
    const userWithTenant = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['tenant'],
    });
    if (userWithTenant?.tenant) {
      const subPlan = userWithTenant.tenant.subscriptionPlan;
      const tenantMaxUsers = this.resolveTenantSeatLimit(userWithTenant.tenant);
      const mapTenantPlanToOrgPlan = (p: SubscriptionPlan): Plan => {
        if (p === SubscriptionPlan.PROFESSIONAL) return Plan.PRO;
        if (p === SubscriptionPlan.ENTERPRISE) return Plan.BUSINESS;
        return Plan.STARTER;
      };
      const mappedOrgPlan = mapTenantPlanToOrgPlan(subPlan);
      const rank = (p: Plan) =>
        p === Plan.STARTER ? 1 : p === Plan.PRO ? 2 : 3;
      if (rank(mappedOrgPlan) > rank(normalizedPlan)) {
        normalizedPlan = mappedOrgPlan;
      }
      if (tenantMaxUsers === -1) {
        effectiveMax = -1;
      } else if (
        typeof tenantMaxUsers === 'number' &&
        tenantMaxUsers > effectiveMax
      ) {
        effectiveMax = tenantMaxUsers;
      }
    }

    const canAddMore =
      effectiveMax === -1 ? true : currentMembers < effectiveMax;

    return {
      currentMembers,
      maxMembers: effectiveMax,
      canAddMore,
      plan: normalizedPlan,
    };
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
    requestOrigin?: string,
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

    // Send reminder asynchronously so slow email providers do not block the API
    this.queueInviteEmail({
      invite: updated,
      organizationName: invite.organization.name,
      role: invite.role,
      requestOrigin,
      isReminder: true,
      expiresAt: newExpiryDate,
    });

    return updated;
  }
}
