import apiClient from './client';

export enum ExpenseStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  PAID = 'paid',
  REJECTED = 'rejected',
}

export interface Expense {
  id: string;
  expenseNumber?: string;
  description: string;
  amount: number;
  category: string;
  date?: string; // Frontend uses this
  expenseDate?: string | Date; // Backend returns this
  dueDate?: string;
  status: ExpenseStatus;
  supplierId?: string;
  supplier?: {
    id: string;
    name: string;
    email: string;
  } | string;
  receiptUrl?: string;
  notes?: string;
  isVoided?: boolean;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseDto {
  description: string;
  amount: number;
  category: string;
  date: string;
  supplierId?: string;
  receiptUrl?: string;
  notes?: string;
}

export interface UpdateExpenseDto {
  description?: string;
  amount?: number;
  category?: string;
  date?: string;
  supplierId?: string;
  receiptUrl?: string;
  notes?: string;
}

/**
 * Tüm giderleri listele
 */
export const getExpenses = async (): Promise<Expense[]> => {
  const response = await apiClient.get<Expense[]>('/expenses');
  return response.data;
};

/**
 * Tek gider getir
 */
export const getExpense = async (id: string): Promise<Expense> => {
  const response = await apiClient.get<Expense>(`/expenses/${id}`);
  return response.data;
};

/**
 * Yeni gider oluştur
 */
export const createExpense = async (data: CreateExpenseDto): Promise<Expense> => {
  const response = await apiClient.post<Expense>('/expenses', data);
  return response.data;
};

/**
 * Gider güncelle
 */
export const updateExpense = async (
  id: string,
  data: UpdateExpenseDto
): Promise<Expense> => {
  const response = await apiClient.patch<Expense>(`/expenses/${id}`, data);
  return response.data;
};

/**
 * Gider durumu güncelle (onayla/reddet)
 */
export const updateExpenseStatus = async (
  id: string,
  status: ExpenseStatus
): Promise<Expense> => {
  const response = await apiClient.patch<Expense>(`/expenses/${id}/status`, { status });
  return response.data;
};

/**
 * Gider sil
 */
export const deleteExpense = async (id: string): Promise<void> => {
  await apiClient.delete(`/expenses/${id}`);
};

/**
 * Gider iptal et (void)
 */
export const voidExpense = async (id: string, reason: string): Promise<Expense> => {
  const response = await apiClient.patch<Expense>(`/expenses/${id}/void`, { reason });
  return response.data;
};

/**
 * Gider geri yükle (restore)
 */
export const restoreExpense = async (id: string): Promise<Expense> => {
  const response = await apiClient.patch<Expense>(`/expenses/${id}/restore`);
  return response.data;
};
