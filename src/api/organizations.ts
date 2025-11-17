import apiClient from './client';

export interface Role {
  OWNER: 'OWNER';
  ADMIN: 'ADMIN'; 
  MEMBER: 'MEMBER';
}

export interface Organization {
  id: string;
  name: string;
  plan: 'STARTER' | 'PRO' | 'BUSINESS';
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    lastLoginAt?: string | null;
    lastLoginTimeZone?: string | null;
  };
  role: keyof Role;
  createdAt: string;
}

export interface Invite {
  id: string;
  email: string;
  role: keyof Role;
  token: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
  organization: {
    id: string;
    name: string;
  };
}

export interface CreateOrganizationData {
  name: string;
  plan?: 'STARTER' | 'PRO' | 'BUSINESS';
}

export interface UpdateOrganizationData {
  name?: string;
  plan?: 'STARTER' | 'PRO' | 'BUSINESS';
}

export interface InviteMemberData {
  email: string;
  role: keyof Role;
}

export interface AcceptInviteData {
  token: string;
}

export interface UpdateMemberRoleData {
  role: keyof Role;
}

export interface MembershipStats {
  currentMembers: number;
  maxMembers: number;
  canAddMore: boolean;
  plan: 'STARTER' | 'PRO' | 'BUSINESS';
}

export const organizationsApi = {
  // Organization CRUD
  async create(data: CreateOrganizationData): Promise<Organization> {
    const response = await apiClient.post('/organizations', data);
    return response.data;
  },

  async getAll(): Promise<Organization[]> {
    const response = await apiClient.get('/organizations');
    console.log('🔍 Organizations API response:', response.data);
    
    // Backend returns { organization: Organization, role: Role }[]
    // Extract just the organizations
    if (Array.isArray(response.data) && response.data.length > 0 && response.data[0].organization) {
      console.log('✅ Converting backend format to frontend format');
      return response.data.map((item: any) => item.organization);
    }
    
    // Fallback for direct Organization[] format
    return response.data;
  },

  async getById(id: string): Promise<Organization> {
    const response = await apiClient.get(`/organizations/${id}`);
    return response.data;
  },

  async update(id: string, data: UpdateOrganizationData): Promise<Organization> {
    const response = await apiClient.patch(`/organizations/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/organizations/${id}`);
  },

  // Member Management
  async getMembers(organizationId: string): Promise<OrganizationMember[]> {
    const response = await apiClient.get(`/organizations/${organizationId}/members`);
    return response.data;
  },

  async updateMemberRole(
    organizationId: string, 
    memberId: string, 
    data: UpdateMemberRoleData
  ): Promise<OrganizationMember> {
    const response = await apiClient.patch(`/organizations/${organizationId}/members/${memberId}`, data);
    return response.data;
  },

  async removeMember(organizationId: string, memberId: string): Promise<void> {
    await apiClient.delete(`/organizations/${organizationId}/members/${memberId}`);
  },

  // Invitation System
  async inviteMember(organizationId: string, data: InviteMemberData): Promise<Invite> {
    const response = await apiClient.post(`/organizations/${organizationId}/invite`, data);
    return response.data;
  },

  async getPendingInvites(organizationId: string): Promise<Invite[]> {
    const response = await apiClient.get(`/organizations/${organizationId}/invites`);
    return response.data;
  },

  async acceptInvite(data: AcceptInviteData): Promise<{ organization: Organization; member: OrganizationMember }> {
    const response = await apiClient.post('/organizations/accept-invite', data);
    return response.data;
  },

  async cancelInvite(organizationId: string, inviteId: string): Promise<void> {
    await apiClient.delete(`/organizations/${organizationId}/invites/${inviteId}`);
  },

  async resendInvite(organizationId: string, inviteId: string): Promise<Invite> {
    const response = await apiClient.post(`/organizations/${organizationId}/invites/${inviteId}/resend`);
    return response.data;
  },

  // Plan Limits & Stats
  async getMembershipStats(organizationId: string): Promise<MembershipStats> {
    const response = await apiClient.get(`/organizations/${organizationId}/membership-stats`);
    return response.data;
  },

  // Validation
  async validateInviteToken(token: string): Promise<{
    valid: boolean;
    invite?: Invite;
    error?: string;
  }> {
    // Public endpoint'i doğrudan kullan: 401 gürültüsünü engelle
    try {
      const pub = await apiClient.get(`/public/invites/${token}`);
      if ((pub.data as any)?.status && (pub.data as any).status !== 'valid' && (pub.data as any).status !== 'accepted') {
        return { valid: false, error: 'Invalid or expired invite token' };
      }
      return { valid: true, invite: pub.data };
    } catch (e2: any) {
      return { valid: false, error: e2.response?.data?.message || 'Invalid or expired invite token' };
    }
  },

  async completeInviteWithPassword(token: string, password: string): Promise<{ success: boolean; email: string }> {
    const response = await apiClient.post(`/public/invites/${token}/register`, { password });
    return response.data;
  }
};

export default organizationsApi;