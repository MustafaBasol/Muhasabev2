import apiClient from './client';

export interface AuditLogEntry {
  id: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  entity: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  diff: Record<string, unknown>;
  ip: string;
  userAgent: string;
  createdAt: string;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditEntitiesResponse {
  entities: string[];
}

export interface AuditLogQuery {
  entity?: string;
  action?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

const auditApi = {
  async listLogs(params: AuditLogQuery = {}): Promise<AuditLogResponse> {
    const response = await apiClient.get<AuditLogResponse>('/audit/logs', {
      params,
    });
    return response.data;
  },
  async listEntities(): Promise<AuditEntitiesResponse> {
    const response = await apiClient.get<AuditEntitiesResponse>('/audit/entities');
    return response.data;
  },
};

export default auditApi;
