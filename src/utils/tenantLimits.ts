import type { Tenant } from '../contexts/AuthContext';

export const getEffectiveTenantMaxUsers = (
  tenant?: Tenant | null,
): number | undefined => {
  if (!tenant) return undefined;

  const effective =
    typeof tenant.effectiveMaxUsers === 'number'
      ? tenant.effectiveMaxUsers
      : undefined;
  const stored =
    typeof tenant.maxUsers === 'number' ? tenant.maxUsers : undefined;

  if (effective === undefined) {
    return stored;
  }
  if (effective === -1 || stored === -1) {
    return -1;
  }
  if (stored === undefined) {
    return effective;
  }
  return Math.max(effective, stored);
};
