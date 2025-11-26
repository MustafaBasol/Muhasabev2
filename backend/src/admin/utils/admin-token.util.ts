import type { IncomingHttpHeaders } from 'http';

const normalizeHeaderValue = (
  value?: string | string[],
): string | undefined => {
  if (Array.isArray(value)) {
    return value.find(Boolean);
  }
  return value;
};

export interface AdminHeaderMap extends IncomingHttpHeaders {
  'admin-token'?: string | string[];
  'Admin-Token'?: string | string[];
  'organization-id'?: string | string[];
  'Organization-Id'?: string | string[];
}

export type ResolvedAdminHeaders = {
  adminToken?: string;
  organizationId?: string;
};

export const resolveAdminHeaders = (
  headers?: IncomingHttpHeaders,
): ResolvedAdminHeaders => {
  if (!headers) {
    return {};
  }

  const typedHeaders = headers as AdminHeaderMap;
  const adminToken =
    normalizeHeaderValue(typedHeaders['admin-token']) ??
    normalizeHeaderValue(typedHeaders['Admin-Token']);
  const organizationId =
    normalizeHeaderValue(typedHeaders['organization-id']) ??
    normalizeHeaderValue(typedHeaders['Organization-Id']);

  return { adminToken, organizationId };
};
