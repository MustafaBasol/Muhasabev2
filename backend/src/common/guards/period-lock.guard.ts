import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { FiscalPeriodsService } from '../../fiscal-periods/fiscal-periods.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { Expense } from '../../expenses/entities/expense.entity';

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
  params: {
    id?: string;
  };
}

@Injectable()
export class PeriodLockGuard implements CanActivate {
  constructor(
    private readonly fiscalPeriodsService: FiscalPeriodsService,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { user, body, params } = request;
    const httpContext = context.switchToHttp();
    const httpRequest = httpContext.getRequest();

    if (!user?.tenantId) {
      return true; // Let other guards handle authentication
    }

    let dateToCheck: Date | null = null;

    // For DELETE requests, fetch the record to get its date
    if (httpRequest.method === 'DELETE' && params?.id) {
      const path = httpRequest.route?.path || httpRequest.url;

      if (path.includes('/invoices/')) {
        const invoice = await this.invoiceRepository.findOne({
          where: { id: params.id, tenantId: user.tenantId },
        });
        if (invoice) {
          dateToCheck = new Date(invoice.issueDate);
        }
      } else if (path.includes('/expenses/')) {
        const expense = await this.expenseRepository.findOne({
          where: { id: params.id, tenantId: user.tenantId },
        });
        if (expense) {
          dateToCheck = new Date(expense.expenseDate);
        }
      }
    } else {
      // For other requests, extract date from body
      dateToCheck = this.extractDate(body);
    }

    if (!dateToCheck) {
      return true; // No date to check
    }

    const lockedPeriod = await this.fiscalPeriodsService.getLockedPeriodForDate(
      dateToCheck,
      user.tenantId,
    );

    if (lockedPeriod) {
      throw new BadRequestException(
        `Cannot modify records in locked period "${lockedPeriod.name}" (${new Date(lockedPeriod.periodStart).toLocaleDateString()} - ${new Date(lockedPeriod.periodEnd).toLocaleDateString()})`,
      );
    }

    return true;
  }

  private extractDate(body: any): Date | null {
    // Check common date fields
    const dateFields = [
      'date',
      'invoiceDate',
      'expenseDate',
      'transactionDate',
    ];

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
