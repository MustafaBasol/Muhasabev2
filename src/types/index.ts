// src/types/index.ts
// Merkezi tip tanımları

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  company?: string;
  balance?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  company?: string;
  balance?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  unitPrice: number;
  costPrice: number;
  stock: number;
  stockQuantity: number;
  reorderLevel: number;
  unit: string;
  createdAt: string;
  status?: string;
  description?: string;
  taxRate?: number; // KDV oranı (%).
  categoryTaxRateOverride?: number | null; // Ürüne özel KDV oranı (kategorinin KDV'sini override eder)
}

export interface ProductCategory {
  id: string;
  name: string;
  taxRate: number; // KDV oranı (%).
  isActive: boolean;
  parentId?: string; // Ana kategori ID'si (Hizmetler/Ürünler altında alt kategori için)
  isProtected?: boolean; // Silinemeyen/değiştirilemeyen ana kategoriler
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerAddress?: string;
  total?: number;
  amount?: number;
  subtotal?: number;
  taxAmount?: number;
  status?: string;
  issueDate: string;
  dueDate?: string;
  // Eski frontend alanı
  items?: InvoiceItem[];
  // Backend alanı
  lineItems?: InvoiceItem[];
  notes?: string;
  type?: 'product' | 'service';
  // Satış-fatura bağlantısı için opsiyonel alan
  saleId?: string;
}

export interface InvoiceItem {
  id?: string;
  productId?: string | number;
  productName?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total?: number;
  taxRate?: number; // Her ürünün kendi KDV oranı
}

export interface Expense {
  id: string;
  expenseNumber?: string;
  description: string;
  supplier?: string | { id?: string; name?: string; email?: string } | null;
  amount: number;
  category: string;
  status?: string;
  date?: string;
  expenseDate?: string | Date;
  dueDate?: string;
  receiptUrl?: string;
  notes?: string;
  isVoided?: boolean;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Sale {
  id: string;
  saleNumber?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  productName?: string; // Eski sistem için (tek ürün) veya çoklu ürün için özet
  quantity?: number;
  unitPrice?: number;
  amount?: number;
  total?: number; // Toplam tutar (amount ile aynı olabilir)
  subtotal?: number; // KDV hariç toplam
  taxAmount?: number;
  discountAmount?: number;
  status?: string;
  date?: string;
  saleDate?: string;
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'check';
  notes?: string;
  productId?: string;
  productUnit?: string;
  invoiceId?: string; // Fatura ID'si (fatura oluşturulduysa)
  items?: Array<{ // Çoklu ürün desteği
    productId?: string;
    productName?: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    total?: number;
    taxRate?: number;
  }>;
  createdAt?: string;
  updatedAt?: string;
  createdByName?: string;
  updatedByName?: string;
}

export interface Bank {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string;
  balance: number;
  currency: string;
  accountType: 'checking' | 'savings' | 'business';
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ChartAccount {
  id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parentId?: string;
  isActive: boolean;
  balance: number;
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
  currency?: 'TRY' | 'USD' | 'EUR' | 'GBP';
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
