import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';
import { FiscalPeriodsService } from '../../fiscal-periods/fiscal-periods.service';

interface AuthenticatedRequest {
  user: {
    userId: string;
    tenantId: string;
  };
  body: {
    date?: string | Date;
    invoiceDate?: string | Date;
    expenseDate?: string | Date;
  };
}

@Injectable()
export class PeriodLockGuard implements CanActivate {
  constructor(private readonly fiscalPeriodsService: FiscalPeriodsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { user, body } = request;

    if (!user?.tenantId) {
      return true; // Let other guards handle authentication
    }

    // Extract date from various possible fields
    const dateToCheck = this.extractDate(body);
    
    if (!dateToCheck) {
      return true; // No date to check
    }

    const lockedPeriod = await this.fiscalPeriodsService.getLockedPeriodForDate(
      dateToCheck,
      user.tenantId
    );

    if (lockedPeriod) {
      throw new BadRequestException(
        `Cannot modify records in locked period "${lockedPeriod.name}" (${lockedPeriod.periodStart} - ${lockedPeriod.periodEnd})`
      );
    }

    return true;
  }

  private extractDate(body: any): Date | null {
    // Check common date fields
    const dateFields = ['date', 'invoiceDate', 'expenseDate', 'transactionDate'];
    
    for (const field of dateFields) {
      if (body[field]) {
        const date = new Date(body[field]);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  }
}