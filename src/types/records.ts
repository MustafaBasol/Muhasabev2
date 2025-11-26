import type { Customer as CustomerDto } from '../api/customers';
import type { Supplier as SupplierDto } from '../api/suppliers';
import type { Expense as ExpenseDto } from '../api/expenses';
import type { Invoice } from './index';

export type CustomerRecord = CustomerDto;

export type SupplierRecord = SupplierDto & {
  category?: string;
};

export type InvoiceRecord = Invoice & {
  customer?: Partial<CustomerRecord> | null;
};

export type ExpenseRecord = ExpenseDto & {
  supplier?: ExpenseDto['supplier'] | { name?: string; email?: string } | string | null;
  expenseDate?: string;
};

export type SupplierExpenseHint = {
  name: string;
  category?: string;
};
