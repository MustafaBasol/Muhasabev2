import apiClient from './client';

export enum ExpenseStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
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
  const response = await apiClient.get('/expenses');
  return response.data;
};

/**
 * Tek gider getir
 */
export const getExpense = async (id: string): Promise<Expense> => {
  const response = await apiClient.get(`/expenses/${id}`);
  return response.data;
};

/**
 * Yeni gider oluştur
 */
export const createExpense = async (data: CreateExpenseDto): Promise<Expense> => {
  const response = await apiClient.post('/expenses', data);
  return response.data;
};

/**
 * Gider güncelle
 */
export const updateExpense = async (
  id: string,
  data: UpdateExpenseDto
): Promise<Expense> => {
  const response = await apiClient.patch(`/expenses/${id}`, data);
  return response.data;
};

/**
 * Gider durumu güncelle (onayla/reddet)
 */
export const updateExpenseStatus = async (
  id: string,
  status: ExpenseStatus
): Promise<Expense> => {
  const response = await apiClient.patch(`/expenses/${id}/status`, { status });
  return response.data;
};

/**
 * Gider sil
 */
export const deleteExpense = async (id: string): Promise<void> => {
  await apiClient.delete(`/expenses/${id}`);
};
