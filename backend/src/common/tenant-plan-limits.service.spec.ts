import { TenantPlanLimitService } from './tenant-plan-limits.service';
import { SubscriptionPlan } from '../tenants/entities/tenant.entity';

describe('TenantPlanLimitService', () => {
  it('FREE: kullanıcı, müşteri, tedarikçi limitleri uygulanmalı', () => {
    expect(TenantPlanLimitService.canAddUser(0, SubscriptionPlan.FREE)).toBe(true);
    expect(TenantPlanLimitService.canAddUser(1, SubscriptionPlan.FREE)).toBe(false);

    expect(TenantPlanLimitService.canAddCustomer(0, SubscriptionPlan.FREE)).toBe(true);
    expect(TenantPlanLimitService.canAddCustomer(1, SubscriptionPlan.FREE)).toBe(false);

    expect(TenantPlanLimitService.canAddSupplier(0, SubscriptionPlan.FREE)).toBe(true);
    expect(TenantPlanLimitService.canAddSupplier(1, SubscriptionPlan.FREE)).toBe(false);
  });

  it('FREE: banka hesabı limiti uygulanmalı (max 1)', () => {
    expect(TenantPlanLimitService.canAddBankAccount(0, SubscriptionPlan.FREE)).toBe(true);
    expect(TenantPlanLimitService.canAddBankAccount(1, SubscriptionPlan.FREE)).toBe(false);
  });

  it('FREE: aylık 5 fatura ve 5 gider limiti uygulanmalı', () => {
    expect(TenantPlanLimitService.canAddInvoiceThisMonth(4, SubscriptionPlan.FREE)).toBe(true);
    expect(TenantPlanLimitService.canAddInvoiceThisMonth(5, SubscriptionPlan.FREE)).toBe(false);

    expect(TenantPlanLimitService.canAddExpenseThisMonth(4, SubscriptionPlan.FREE)).toBe(true);
    expect(TenantPlanLimitService.canAddExpenseThisMonth(5, SubscriptionPlan.FREE)).toBe(false);
  });

  it('PRO (BASIC/PROFESSIONAL): max 3 kullanıcı, diğerleri sınırsız', () => {
    expect(TenantPlanLimitService.canAddUser(2, SubscriptionPlan.BASIC)).toBe(true);
    expect(TenantPlanLimitService.canAddUser(3, SubscriptionPlan.BASIC)).toBe(false);
    expect(TenantPlanLimitService.canAddCustomer(999, SubscriptionPlan.BASIC)).toBe(true);
  expect(TenantPlanLimitService.canAddSupplier(999, SubscriptionPlan.PROFESSIONAL)).toBe(true);
  expect(TenantPlanLimitService.canAddBankAccount(999, SubscriptionPlan.PROFESSIONAL)).toBe(true);
    expect(TenantPlanLimitService.canAddInvoiceThisMonth(100, SubscriptionPlan.PROFESSIONAL)).toBe(true);
    expect(TenantPlanLimitService.canAddExpenseThisMonth(100, SubscriptionPlan.PROFESSIONAL)).toBe(true);
  });

  it('BUSINESS (ENTERPRISE): tüm limitler sınırsız', () => {
    expect(TenantPlanLimitService.canAddUser(1000, SubscriptionPlan.ENTERPRISE)).toBe(true);
    expect(TenantPlanLimitService.canAddCustomer(1000, SubscriptionPlan.ENTERPRISE)).toBe(true);
    expect(TenantPlanLimitService.canAddSupplier(1000, SubscriptionPlan.ENTERPRISE)).toBe(true);
  expect(TenantPlanLimitService.canAddBankAccount(1000, SubscriptionPlan.ENTERPRISE)).toBe(true);
    expect(TenantPlanLimitService.canAddInvoiceThisMonth(1000, SubscriptionPlan.ENTERPRISE)).toBe(true);
    expect(TenantPlanLimitService.canAddExpenseThisMonth(1000, SubscriptionPlan.ENTERPRISE)).toBe(true);
  });
});
