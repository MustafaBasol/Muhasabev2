import apiClient from './client';

export interface BankAccount {
  id: string;
  name: string;
  iban: string;
  bankName?: string;
  currency: string; // ISO code
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankAccountDto {
  name: string;
  iban: string;
  bankName?: string;
  currency?: string;
}

export interface UpdateBankAccountDto {
  name?: string;
  iban?: string;
  bankName?: string;
  currency?: string;
}

export const bankAccountsApi = {
  async list(): Promise<BankAccount[]> {
    const res = await apiClient.get('/bank-accounts');
    return res.data;
  },
  async create(data: CreateBankAccountDto): Promise<BankAccount> {
    const res = await apiClient.post('/bank-accounts', data);
    return res.data;
  },
  async update(id: string, data: UpdateBankAccountDto): Promise<BankAccount> {
    const res = await apiClient.patch(`/bank-accounts/${id}`, data);
    return res.data;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/bank-accounts/${id}`);
  },
};
