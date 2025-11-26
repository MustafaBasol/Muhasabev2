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

interface OrganizationWithRole {
  organization: Organization;
  role: keyof Role;
}

interface InviteValidationStatus {
  status?: string;
}

type AxiosLikeError = {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
} | Error;

const isOrganizationWithRoleArray = (data: unknown): data is OrganizationWithRole[] => (
  Array.isArray(data) &&
  data.every((item) => (
    typeof item === 'object' &&
    item !== null &&
    'organization' in item &&
    typeof (item as { organization?: unknown }).organization === 'object'
  ))
);

const isInvite = (data: unknown): data is Invite => (
  typeof data === 'object' &&
  data !== null &&
  'id' in data &&
  'email' in data &&
  'role' in data
);

const getStatus = (data: unknown): string | undefined => {
  if (typeof data === 'object' && data !== null && 'status' in data) {
    const status = (data as InviteValidationStatus).status;
    return typeof status === 'string' ? status : undefined;
  }
  return undefined;
};

const getErrorMessage = (error: unknown): string | undefined => {
  if (error && typeof error === 'object') {
    const axiosError = error as AxiosLikeError;
    return axiosError.response?.data?.message ?? axiosError.message;
  }
  return undefined;
};

type PublicInviteResponse = Invite | (Partial<Invite> & InviteValidationStatus);

export const organizationsApi = {
  // Organization CRUD
  async create(data: CreateOrganizationData): Promise<Organization> {
    const response = await apiClient.post<Organization>('/organizations', data);
    return response.data;
  },

  async getAll(): Promise<Organization[]> {
    const response = await apiClient.get<Organization[] | OrganizationWithRole[]>('/organizations');
    const payload = response.data;

    if (isOrganizationWithRoleArray(payload)) {
      return payload.map((item) => item.organization);
    }

    return payload;
  },

  async getById(id: string): Promise<Organization> {
    const response = await apiClient.get<Organization>(`/organizations/${id}`);
    return response.data;
  },

  async update(id: string, data: UpdateOrganizationData): Promise<Organization> {
    const response = await apiClient.patch<Organization>(`/organizations/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/organizations/${id}`);
  },

  // Member Management
  async getMembers(organizationId: string): Promise<OrganizationMember[]> {
    const response = await apiClient.get<OrganizationMember[]>(`/organizations/${organizationId}/members`);
    return response.data;
  },

  async updateMemberRole(
    organizationId: string, 
    memberId: string, 
    data: UpdateMemberRoleData
  ): Promise<OrganizationMember> {
    const response = await apiClient.patch<OrganizationMember>(`/organizations/${organizationId}/members/${memberId}`, data);
    return response.data;
  },

  async removeMember(organizationId: string, memberId: string): Promise<void> {
    await apiClient.delete(`/organizations/${organizationId}/members/${memberId}`);
  },

  // Invitation System
  async inviteMember(organizationId: string, data: InviteMemberData): Promise<Invite> {
    const response = await apiClient.post<Invite>(`/organizations/${organizationId}/invite`, data);
    return response.data;
  },

  async getPendingInvites(organizationId: string): Promise<Invite[]> {
    const response = await apiClient.get<Invite[]>(`/organizations/${organizationId}/invites`);
    return response.data;
  },

  async acceptInvite(data: AcceptInviteData): Promise<{ organization: Organization; member: OrganizationMember }> {
    const response = await apiClient.post<{ organization: Organization; member: OrganizationMember }>(
      '/organizations/accept-invite',
      data,
    );
    return response.data;
  },

  async cancelInvite(organizationId: string, inviteId: string): Promise<void> {
    await apiClient.delete(`/organizations/${organizationId}/invites/${inviteId}`);
  },

  async resendInvite(organizationId: string, inviteId: string): Promise<Invite> {
    const response = await apiClient.post<Invite>(`/organizations/${organizationId}/invites/${inviteId}/resend`);
    return response.data;
  },

  // Plan Limits & Stats
  async getMembershipStats(organizationId: string): Promise<MembershipStats> {
    const response = await apiClient.get<MembershipStats>(`/organizations/${organizationId}/membership-stats`);
    return response.data;
  },

  // Validation
  async validateInviteToken(token: string, turnstileToken?: string): Promise<{
    valid: boolean;
    invite?: Invite;
    error?: string;
  }> {
    // Public endpoint'i doğrudan kullan: 401 gürültüsünü engelle
    try {
      const pub = await apiClient.get<PublicInviteResponse>(`/public/invites/${token}`, {
        params: turnstileToken ? { turnstileToken } : undefined,
      });

      const status = getStatus(pub.data);
      if (status && status !== 'valid' && status !== 'accepted') {
        return { valid: false, error: 'Invalid or expired invite token' };
      }

      if (isInvite(pub.data)) {
        return { valid: true, invite: pub.data };
      }

      return { valid: true };
    } catch (error: unknown) {
      return {
        valid: false,
        error: getErrorMessage(error) || 'Invalid or expired invite token',
      };
    }
  },

  async completeInviteWithPassword(token: string, password: string, turnstileToken?: string): Promise<{ success: boolean; email: string }> {
    const response = await apiClient.post<{ success: boolean; email: string }>(
      `/public/invites/${token}/register`,
      {
        password,
        turnstileToken,
      },
    );
    return response.data;
  }
};

export default organizationsApi;