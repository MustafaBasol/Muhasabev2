import { Plan } from './enums/organization.enum';

export interface PlanLimits {
  maxMembers: number;
  features: string[];
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  [Plan.STARTER]: {
    maxMembers: 1,
    features: ['Basic invoicing', 'Expense tracking', 'Basic reports'],
  },
  [Plan.PRO]: {
    maxMembers: 3,
    features: [
      'All Starter features',
      'Advanced reports',
      'Multi-currency',
      'API access',
    ],
  },
  [Plan.BUSINESS]: {
    maxMembers: 10, // Business: 10 üye dahil
    features: [
      'All Pro features',
      'Custom integrations',
      'Priority support',
      'Advanced permissions',
    ],
  },
};

export class PlanLimitService {
  static getMaxMembers(plan: Plan): number {
    return PLAN_LIMITS[plan].maxMembers;
  }

  static canAddMember(currentMemberCount: number, plan: Plan): boolean {
    const maxMembers = this.getMaxMembers(plan);

    // -1 means unlimited
    if (maxMembers === -1) {
      return true;
    }

    return currentMemberCount < maxMembers;
  }

  static getPlanFeatures(plan: Plan): string[] {
    return PLAN_LIMITS[plan].features;
  }

  static isUnlimited(plan: Plan): boolean {
    return PLAN_LIMITS[plan].maxMembers === -1;
  }

  static getMemberLimitError(plan: Plan): string {
    const maxMembers = this.getMaxMembers(plan);

    if (maxMembers === -1) {
      return 'No member limit for Business plan';
    }

    return `${plan} plan is limited to ${maxMembers} member${maxMembers !== 1 ? 's' : ''}. Please upgrade your plan to add more members.`;
  }
}
