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
import type { AuthenticatedRequest } from '../types/authenticated-request';

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
    const user = request.user;
    const rawBody: unknown = request.body;
    const rawParams: unknown = request.params;
    const bodyPayload = this.isRecord(rawBody) ? rawBody : undefined;
    const paramsPayload = this.isRecord(rawParams) ? rawParams : undefined;
    const targetId = this.extractId(paramsPayload);

    if (!user?.tenantId) {
      return true; // Let other guards handle authentication
    }

    let dateToCheck: Date | null = null;
    const routePath = this.getRoutePath(request);
    const path = routePath ?? request.url;

    // For DELETE requests, fetch the record to get its date
    if (request.method === 'DELETE' && targetId) {
      if (path.includes('/invoices/')) {
        const invoice = await this.invoiceRepository.findOne({
          where: { id: targetId, tenantId: user.tenantId },
        });
        if (invoice) {
          dateToCheck = new Date(invoice.issueDate);
        }
      } else if (path.includes('/expenses/')) {
        const expense = await this.expenseRepository.findOne({
          where: { id: targetId, tenantId: user.tenantId },
        });
        if (expense) {
          dateToCheck = new Date(expense.expenseDate);
        }
      }
    } else {
      // For other requests, extract date from body
      dateToCheck = this.extractDate(bodyPayload);
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

  private extractDate(body?: Record<string, unknown>): Date | null {
    // Check common date fields
    const dateFields = [
      'date',
      'invoiceDate',
      'expenseDate',
      'transactionDate',
    ];

    for (const field of dateFields) {
      const value = body?.[field];
      if (typeof value === 'string' || value instanceof Date) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  }

  private extractId(params?: Record<string, unknown>): string | undefined {
    const id = params?.id;
    return typeof id === 'string' ? id : undefined;
  }

  private getRoutePath(request: AuthenticatedRequest): string | undefined {
    const routeHolder: unknown = (
      request as {
        route?: unknown;
      }
    ).route;

    if (this.isRecord(routeHolder)) {
      const pathCandidate = routeHolder.path;
      if (typeof pathCandidate === 'string') {
        return pathCandidate;
      }
    }

    return undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
