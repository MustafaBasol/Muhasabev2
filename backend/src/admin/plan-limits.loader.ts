import { Injectable, OnModuleInit } from '@nestjs/common';
import { PlanLimitsService } from './plan-limits.service';

@Injectable()
export class PlanLimitsLoader implements OnModuleInit {
  constructor(private readonly planLimitsService: PlanLimitsService) {}

  onModuleInit() {
    // Uygulama başlatılırken override'ları uygula
    try {
      this.planLimitsService.applyOverridesOnBootstrap();

      console.log(
        '✅ Plan limit overrides applied from config/plan-limits.json',
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn('⚠️ Failed to apply plan limit overrides:', reason);
    }
  }
}
