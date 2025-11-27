import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import {
  InviteUserDto,
  UpdateMemberRoleDto,
  AcceptInviteDto,
} from './dto/member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';

const extractHeaderValue = (value?: string | string[]): string | undefined => {
  if (!value) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
};

const resolveRequestOrigin = (
  req: AuthenticatedRequest,
): string | undefined => {
  if (!req?.headers) {
    return undefined;
  }
  const directOrigin = extractHeaderValue(req.headers.origin as any);
  if (directOrigin) {
    return directOrigin;
  }
  const proto =
    extractHeaderValue(req.headers['x-forwarded-proto'] as any) || req.protocol;
  const host =
    extractHeaderValue(req.headers['x-forwarded-host'] as any) ||
    extractHeaderValue(req.headers.host as any);
  if (proto && host) {
    return `${proto}://${host}`;
  }
  return undefined;
};

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Organization created successfully',
  })
  create(
    @Body() createOrganizationDto: CreateOrganizationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.organizationsService.create(createOrganizationDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all organizations for the current user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of user organizations',
  })
  findAll(@Request() req: AuthenticatedRequest) {
    return this.organizationsService.getUserOrganizations(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Organization details' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Organization not found',
  })
  findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.organizationsService.findOne(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update organization' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Organization updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  update(
    @Param('id') id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.organizationsService.update(
      id,
      updateOrganizationDto,
      req.user.id,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete organization' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Organization deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only owners can delete organizations',
  })
  remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.organizationsService.remove(id, req.user.id);
  }

  @Post(':id/invite')
  @ApiOperation({ summary: 'Invite user to organization' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Invitation sent successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  inviteUser(
    @Param('id') id: string,
    @Body() inviteUserDto: InviteUserDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.organizationsService.inviteUser(
      id,
      inviteUserDto,
      req.user.id,
      resolveRequestOrigin(req),
    );
  }

  @Post('accept-invite')
  @ApiOperation({ summary: 'Accept organization invitation' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invitation accepted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invalid or expired invitation',
  })
  acceptInvite(
    @Body() acceptInviteDto: AcceptInviteDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.organizationsService.acceptInvite(
      acceptInviteDto.token,
      req.user.id,
    );
  }

  @Get('invites/validate/:token')
  @ApiOperation({
    summary: 'Validate invitation token and return invite details',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invite details returned',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invalid invite token',
  })
  validateInvite(@Param('token') token: string) {
    // Note: Guard requires auth; we do not enforce email match here.
    return this.organizationsService.validateInvite(token);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Get organization members' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of organization members',
  })
  getMembers(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.organizationsService.getMembers(id, req.user.id);
  }

  @Patch(':id/members/:memberId')
  @ApiOperation({ summary: 'Update member role' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Member role updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  updateMemberRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() updateMemberRoleDto: UpdateMemberRoleDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.organizationsService.updateMemberRole(
      id,
      memberId,
      updateMemberRoleDto,
      req.user.id,
    );
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Remove member from organization' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Member removed successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.organizationsService.removeMember(id, memberId, req.user.id);
  }

  @Get(':id/invites')
  @ApiOperation({ summary: 'Get pending invitations' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of pending invitations',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  getPendingInvites(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.organizationsService.getPendingInvites(id, req.user.id);
  }

  @Get(':id/membership-stats')
  @ApiOperation({ summary: 'Get organization membership statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Membership statistics including current/max members and plan limits',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  getMembershipStats(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.organizationsService.getMembershipStats(id, req.user.id);
  }

  @Delete(':id/invites/:inviteId')
  @ApiOperation({ summary: 'Cancel pending invitation' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invitation cancelled successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invitation not found',
  })
  cancelInvite(
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.organizationsService.cancelInvite(id, inviteId, req.user.id);
  }

  @Post(':id/invites/:inviteId/resend')
  @ApiOperation({ summary: 'Resend invitation' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invitation resent successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invitation not found',
  })
  resendInvite(
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.organizationsService.resendInvite(
      id,
      inviteId,
      req.user.id,
      resolveRequestOrigin(req),
    );
  }
}
