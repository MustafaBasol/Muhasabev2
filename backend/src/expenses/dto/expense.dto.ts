import { ExpenseCategory, ExpenseStatus } from '../entities/expense.entity';

export type NumericString = `${number}`;

export interface ExpenseAuditMetadata {
  createdById?: string | null;
  createdByName?: string | null;
  updatedById?: string | null;
  updatedByName?: string | null;
}

export interface BaseExpenseDto extends ExpenseAuditMetadata {
  expenseNumber?: string;
  supplierId?: string | null;
  description?: string;
  expenseDate?: string;
  date?: string;
  amount?: number | NumericString;
  category?: ExpenseCategory;
  status?: ExpenseStatus;
  notes?: string | null;
  receiptUrl?: string | null;
}

export interface CreateExpenseDto extends BaseExpenseDto {
  description: string;
  amount: number | NumericString;
}

export type UpdateExpenseDto = BaseExpenseDto & {
  isVoided?: boolean;
  voidReason?: string | null;
  voidedAt?: string | Date | null;
  voidedBy?: string | null;
};

export interface ExpenseStatistics {
  total: number;
  paid: number;
  pending: number;
  byCategory: Record<ExpenseCategory, number>;
  count: number;
}
