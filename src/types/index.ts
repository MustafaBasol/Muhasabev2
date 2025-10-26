// src/types/index.ts
// Merkezi tip tanımları

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  taxNumber?: string;
  company?: string;
}

export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  taxNumber?: string;
  company?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  description?: string;
  taxRate?: number; // KDV oranı (örn: 0.18 = %18)
  categoryTaxRateOverride?: number; // Ürüne özel KDV oranı (kategorinin KDV'sini override eder)
}

export interface ProductCategory {
  id: string;
  name: string;
  taxRate: number; // Varsayılan KDV oranı (örn: 18 = %18)
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  customerAddress?: string;
  total: number;
  subtotal: number;
  taxAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  notes?: string;
  type?: 'product' | 'service';
}

export interface InvoiceItem {
  id?: string;
  productId?: string | number;
  productName?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxRate?: number; // Her ürünün kendi KDV oranı
}

export interface Expense {
  id: string;
  expenseNumber: string;
  description: string;
  supplier: string;
  amount: number;
  category: string;
  status: 'draft' | 'approved' | 'paid';
  expenseDate: string;
  dueDate: string;
  receiptUrl?: string;
}

export interface Sale {
  id: string;
  saleNumber?: string;
  customerName: string;
  customerEmail?: string;
  productName: string; // Eski sistem için (tek ürün) veya çoklu ürün için özet
  quantity?: number;
  unitPrice?: number;
  amount: number;
  total?: number; // Toplam tutar (amount ile aynı olabilir)
  status: 'completed' | 'pending' | 'cancelled';
  date: string;
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'check';
  notes?: string;
  productId?: string;
  productUnit?: string;
  invoiceId?: string; // Fatura ID'si (fatura oluşturulduysa)
  items?: Array<{ // Çoklu ürün desteği
    productId?: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

export interface Bank {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban?: string;
  balance: number;
  currency: string;
  accountType: 'checking' | 'savings' | 'credit';
  isActive: boolean;
  createdAt: string;
}

export interface CompanyProfile {
  name: string;
  address: string;
  taxNumber: string;
  taxOffice: string;
  phone: string;
  email: string;
  website: string;
  logoDataUrl?: string;
  iban?: string;
  bankAccountId?: string;
}

export interface User {
  name: string;
  email: string;
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'success' | 'warning' | 'info' | 'error';
  read: boolean;
}

export interface Toast {
  id: string;
  message: string;
  tone: 'success' | 'error' | 'info' | 'warning';
}

export type ProductBulkAction = 'export' | 'delete' | 'updatePrice';

// Modal state types
export interface ModalState<T> {
  isOpen: boolean;
  data?: T;
}

// Excel import types
export interface ImportedCustomer {
  name: string;
  email: string;
  phone: string;
  address: string;
  taxNumber: string;
  company: string;
}
