import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SubscriptionPlan } from '../tenants/entities/tenant.entity';
import {
  TenantPlanLimitService,
  TenantPlanLimits,
  UpdateTenantPlanLimits,
} from '../common/tenant-plan-limits.service';

type PlanOverrideMap = Partial<Record<SubscriptionPlan, TenantPlanLimits>>;

const PLAN_VALUES: SubscriptionPlan[] = Object.values(SubscriptionPlan);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isTenantPlanLimits = (value: unknown): value is TenantPlanLimits => {
  if (!isRecord(value)) {
    return false;
  }
  if (
    typeof value.maxUsers !== 'number' ||
    typeof value.maxCustomers !== 'number' ||
    typeof value.maxSuppliers !== 'number' ||
    typeof value.maxBankAccounts !== 'number'
  ) {
    return false;
  }
  if (!isRecord(value.monthly)) {
    return false;
  }
  if (
    typeof value.monthly.maxInvoices !== 'number' ||
    typeof value.monthly.maxExpenses !== 'number'
  ) {
    return false;
  }
  return true;
};

const normalizeOverrides = (candidate: unknown): PlanOverrideMap => {
  if (!isRecord(candidate)) {
    return {};
  }

  const result: PlanOverrideMap = {};
  const record = candidate;
  for (const plan of PLAN_VALUES) {
    const raw = record[plan];
    if (isTenantPlanLimits(raw)) {
      result[plan] = raw;
    }
  }
  return result;
};

// Dosya-tabanlı kalıcı plan limitleri yönetimi
// Üretimde merkezi bir config servisine veya veritabanına taşınabilir.
@Injectable()
export class PlanLimitsService {
  private readonly configPath = path.join(
    process.cwd(),
    'config',
    'plan-limits.json',
  );

  private ensureConfigDir() {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Dosyadaki override'ları oku (yoksa boş döner)
  readOverrides(): PlanOverrideMap {
    try {
      if (!fs.existsSync(this.configPath)) return {};
      const raw = fs.readFileSync(this.configPath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      return normalizeOverrides(parsed);
    } catch {
      // Bozuk dosya durumunda güvenli davran
      return {};
    }
  }

  // Override'ları dosyaya yaz
  writeOverrides(data: PlanOverrideMap) {
    this.ensureConfigDir();
    fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2), 'utf8');
  }

  // Tüm plan limitlerini (mevcut runtime) birlikte döndür
  getCurrentLimits() {
    return TenantPlanLimitService.getAllLimits();
  }

  // Bir plan için limitleri güncelle: runtime + dosya
  updatePlanLimits(plan: SubscriptionPlan, patch: UpdateTenantPlanLimits) {
    // Runtime güncelle
    const merged = TenantPlanLimitService.setLimits(plan, patch);

    // Dosya override'ını güncelle
    const currentFile = this.readOverrides();
    const nextFile: PlanOverrideMap = {
      ...currentFile,
      [plan]: {
        ...(currentFile?.[plan] || {}),
        ...patch,
        monthly: {
          ...(currentFile?.[plan]?.monthly || {}),
          ...(patch.monthly || {}),
        },
      },
    };
    this.writeOverrides(nextFile);

    return merged;
  }

  // Uygulama başlarken dosyadaki override'ları runtime'a uygula
  applyOverridesOnBootstrap() {
    const overrides = this.readOverrides();
    const plans = Object.keys(overrides || {}) as SubscriptionPlan[];
    for (const plan of plans) {
      const p = overrides[plan];
      if (!p) continue;
      TenantPlanLimitService.setLimits(plan, p);
    }
  }
}
