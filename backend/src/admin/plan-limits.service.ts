import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SubscriptionPlan } from '../tenants/entities/tenant.entity';
import {
  TenantPlanLimitService,
  TenantPlanLimits,
  UpdateTenantPlanLimits,
} from '../common/tenant-plan-limits.service';

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
  readOverrides(): Partial<Record<SubscriptionPlan, TenantPlanLimits>> {
    try {
      if (!fs.existsSync(this.configPath)) return {};
      const raw = fs.readFileSync(this.configPath, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed || {};
    } catch (e) {
      // Bozuk dosya durumunda güvenli davran
      return {};
    }
  }

  // Override'ları dosyaya yaz
  writeOverrides(data: Partial<Record<SubscriptionPlan, TenantPlanLimits>>) {
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
    const nextFile = {
      ...currentFile,
      [plan]: {
        ...(currentFile?.[plan] || {}),
        ...patch,
        monthly: {
          ...(currentFile?.[plan]?.monthly || {}),
          ...(patch.monthly || {}),
        },
      },
    } as Partial<Record<SubscriptionPlan, TenantPlanLimits>>;
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
