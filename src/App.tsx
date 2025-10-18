import React, { useEffect, useMemo, useState } from "react";
import { Users, FileText, CreditCard, TrendingUp } from "lucide-react";
import { useAuth } from "./contexts/AuthContext";

import type { CompanyProfile } from "./utils/pdfGenerator";
import type { 
  Customer, 
  User,
} from "./types";
import { secureStorage } from "./utils/storage";

// API imports
import * as customersApi from "./api/customers";
import * as productsApi from "./api/products";
import * as invoicesApi from "./api/invoices";
import * as expensesApi from "./api/expenses";
import * as suppliersApi from "./api/suppliers";

// components
import Header, { HeaderNotification } from "./components/Header";
import Sidebar from "./components/Sidebar";
import StatsCard from "./components/StatsCard";
import ChartCard from "./components/ChartCard";
import RecentTransactions from "./components/RecentTransactions";
import QuickActions from "./components/QuickActions";
import DashboardAlerts from "./components/DashboardAlerts";

// modals
import CustomerModal from "./components/CustomerModal";
import ProductModal from "./components/ProductModal";
import ProductCategoryModal from "./components/ProductCategoryModal";
import SupplierModal from "./components/SupplierModal";
import InvoiceModal from "./components/InvoiceModal";
import ExpenseModal from "./components/ExpenseModal";
import SaleModal from "./components/SaleModal";
import BankModal from "./components/BankModal";
import SettingsPage from "./components/SettingsPage";

// view modals
import CustomerViewModal from "./components/CustomerViewModal";
import ProductViewModal from "./components/ProductViewModal";
import SupplierViewModal from "./components/SupplierViewModal";
import InvoiceViewModal from "./components/InvoiceViewModal";
import ExpenseViewModal from "./components/ExpenseViewModal";
import SaleViewModal from "./components/SaleViewModal";
import BankViewModal from "./components/BankViewModal";

// history modals
import CustomerHistoryModal from "./components/CustomerHistoryModal";
import SupplierHistoryModal from "./components/SupplierHistoryModal";

// pages
import CustomerList from "./components/CustomerList";
import ProductList, { type Product, type ProductBulkAction } from "./components/ProductList";
import SupplierList from "./components/SupplierList";
import InvoiceList from "./components/InvoiceList";
import ExpenseList from "./components/ExpenseList";
import BankList from "./components/BankList";
import ReportsPage from "./components/ReportsPage";
import ChartOfAccountsPage from "./components/ChartOfAccountsPage";
import ArchivePage from "./components/ArchivePage";
import GeneralLedger from "./components/GeneralLedger";
import SimpleSalesPage from "./components/SimpleSalesPage";
import LoginPage from "./components/LoginPage";
import * as ExcelJS from 'exceljs';

const defaultCompany: CompanyProfile = {
  name: "MoneyFlow Muhasebe",
  address: "Istanbul, Türkiye",
  taxNumber: "1234567890",
  taxOffice: "",
  phone: "+90 212 123 45 67",
  email: "info@moneyflow.com",
  website: "www.moneyflow.com",
  logoDataUrl: "",
  iban: "",
  bankAccountId: undefined,
};

const initialNotifications: HeaderNotification[] = [
  {
    id: "notif-1",
    title: "Yeni fatura olusturuldu",
    description: "INV-2024-001 numarali fatura PDF olarak hazir.",
    time: "5 dk önce",
    type: "success",
    read: false,
  },
  {
    id: "notif-2",
    title: "Geciken ödeme uyarisi",
    description: "EXP-2024-001 gideri için ödeme tarihi geçti.",
    time: "1 gün önce",
    type: "warning",
    read: false,
  },
  {
    id: "notif-3",
    title: "Banka hareketi",
    description: "Ana hesap bakiyesi güncellendi.",
    time: "2 gün önce",
    type: "info",
    read: true,
  },
];

const initialCustomers = [
  {
    id: 1,
    name: "Ahmet Yilmaz",
    email: "ahmet@email.com",
    phone: "0532 123 4567",
    address: "Istanbul",
    taxNumber: "1234567890",
    company: "Yilmaz Teknoloji",
    createdAt: "2024-12-15",
    balance: 15000,
  },
];

const initialSuppliers = [
  {
    id: 1,
    name: "ABC Tedarik Ltd.",
    email: "info@abc.com",
    phone: "0212 123 4567",
    address: "Istanbul",
    taxNumber: "1111111111",
    company: "ABC Tedarik Ltd.",
    category: "Ofis Malzemeleri",
    createdAt: "2024-11-01",
    balance: 25000,
  },
];

const initialInvoices = [
  {
    id: "1",
    invoiceNumber: "INV-2024-001",
    customerName: "Ahmet Yilmaz",
    customerEmail: "ahmet@email.com",
    customerAddress: "Istanbul",
    total: 5000,
    subtotal: 4237.29,
    taxAmount: 762.71,
    status: "paid",
    issueDate: "2024-12-15",
    dueDate: "2025-01-15",
    items: [
      {
        id: "1",
        description: "Web Tasarim Hizmeti",
        quantity: 1,
        unitPrice: 4237.29,
        total: 4237.29,
      },
    ],
  },
];

const initialExpenses = [
  {
    id: 1,
    expenseNumber: "EXP-2024-001",
    description: "Ofis kirasi - Aralik",
    supplier: "Gayrimenkul A.S.",
    amount: 8000,
    category: "Kira",
    expenseDate: "2024-12-01",
    dueDate: "2024-12-01",
    status: "paid",
  },
];

const initialSales = [
  {
    id: 1,
    saleNumber: "SAL-2024-001",
    customerName: "Ahmet Yilmaz",
    customerEmail: "ahmet@email.com",
    productName: "Web Tasarim Hizmeti",
    quantity: 1,
    unitPrice: 5000,
    amount: 5000,
    status: "completed",
    date: "2024-12-15",
    paymentMethod: "transfer",
  },
];

const initialProducts = [
  {
    id: 1,
    name: "Kablosuz Kulaklik",
    sku: "PRD-001",
    category: "Elektronik",
    unitPrice: 1499,
    costPrice: 950,
    stockQuantity: 45,
    reorderLevel: 10,
    unit: "adet",
    description: "Bluetooth 5.3 destekli gürültü engelleme",
    status: "active",
    createdAt: "2024-11-20",
  },
  {
    id: 2,
    name: "Ofis Sandalyesi",
    sku: "PRD-002",
    category: "Ofis",
    unitPrice: 3299,
    costPrice: 2100,
    stockQuantity: 18,
    reorderLevel: 5,
    unit: "adet",
    description: "Ergonomik destekli, ayarlanabilir yükseklik",
    status: "active",
    createdAt: "2024-10-05",
  },
  {
    id: 3,
    name: "A4 Fotokopi Kagidi",
    sku: "PRD-003",
    category: "Kirtasiye",
    unitPrice: 129,
    costPrice: 78,
    stockQuantity: 220,
    reorderLevel: 50,
    unit: "kutu",
    description: "80 gr beyaz fotokopi kagidi",
    status: "active",
    createdAt: "2025-01-02",
  },
  {
    id: 4,
    name: "Bulut Yazilim Lisansi",
    sku: "PRD-004",
    category: "Hizmet",
    unitPrice: 899,
    costPrice: 420,
    stockQuantity: 0,
    reorderLevel: 5,
    unit: "adet",
    description: "Yillik abonelik, 10 kullanici hakki",
    status: "out-of-stock",
    createdAt: "2024-09-12",
  },
];

const initialProductCategories = Array.from(
  new Set(
    [
      "Genel",
      ...initialProducts
        .map(product => product.category)
        .filter((category): category is string => Boolean(category && category.trim())),
    ].map(category => category.trim())
  )
).sort((a, b) => a.localeCompare(b, "tr-TR"));

interface ImportedCustomer {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  company?: string;
  createdAt?: string;
}

const toastToneClasses = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  info: "border-indigo-200 bg-indigo-50 text-indigo-900",
  error: "border-red-200 bg-red-50 text-red-900",
} as const;

type ToastTone = keyof typeof toastToneClasses;

interface ToastMessage {
  id: string;
  message: string;
  tone: ToastTone;
}

const initialBankAccounts = [
  {
    id: "1",
    bankName: "Ziraat Bankasi",
    accountName: "Ana Hesap",
    accountNumber: "1234567890",
    iban: "TR330006100519786457841326",
    balance: 125000,
    currency: "TRY",
    accountType: "business",
    isActive: true,
    createdAt: "2024-01-01",
  },
  {
    id: "2",
    bankName: "Is Bankasi",
    accountName: "Ticari Hesap",
    accountNumber: "0987654321",
    iban: "TR640006400000011709426117",
    balance: 85000,
    currency: "TRY",
    accountType: "checking",
    isActive: true,
    createdAt: "2024-01-02",
  },
  {
    id: "3",
    bankName: "Garanti BBVA",
    accountName: "Vadeli Hesap",
    accountNumber: "1122334455",
    iban: "TR620006200046200006678001",
    balance: 45000,
    currency: "TRY",
    accountType: "savings",
    isActive: true,
    createdAt: "2024-01-03",
  },
];

const formatCurrency = (value: number) =>
  `₺${value.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
const formatPercentage = (value: number) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;


const App: React.FC = () => {
  const { isAuthenticated, user: authUser, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [user, setUser] = useState<User>({ name: authUser?.firstName || "User", email: authUser?.email || "" });
  const [accounts, setAccounts] = useState<any[]>([]);
  const [company, setCompany] = useState<CompanyProfile>(() => {
    const stored = secureStorage.getJSON<CompanyProfile>("companyProfile");
    return stored ? { ...defaultCompany, ...stored } : defaultCompany;
  });
  const [notifications, setNotifications] = useState<HeaderNotification[]>(initialNotifications);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [language, setLanguage] = useState<"tr" | "en" | "fr">("tr");

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showProductCategoryModal, setShowProductCategoryModal] = useState(false);
  const [showProductViewModal, setShowProductViewModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showCustomerViewModal, setShowCustomerViewModal] = useState(false);
  const [showSupplierViewModal, setShowSupplierViewModal] = useState(false);
  const [showInvoiceViewModal, setShowInvoiceViewModal] = useState(false);
  const [showExpenseViewModal, setShowExpenseViewModal] = useState(false);
  const [showSaleViewModal, setShowSaleViewModal] = useState(false);
  const [showBankViewModal, setShowBankViewModal] = useState(false);
  const [showCustomerHistoryModal, setShowCustomerHistoryModal] = useState(false);
  const [showSupplierHistoryModal, setShowSupplierHistoryModal] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [supplierForExpense, setSupplierForExpense] = useState<any>(null);

  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>(() => initialSales.map(sale => ({ ...sale, id: String(sale.id) })));
  const [products, setProducts] = useState<Product[]>([]);
  const [productCategories, setProductCategories] = useState<string[]>(() => initialProductCategories);
  const [bankAccounts, setBankAccounts] = useState<any[]>(() => initialBankAccounts.map(account => ({ ...account, id: String(account.id) })));
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Load data from backend on mount
  useEffect(() => {
    const loadData = async () => {
      if (!isAuthenticated) return;
      
      try {
        setIsLoadingData(true);
        
        const [customersData, suppliersData, productsData, invoicesData, expensesData] = await Promise.all([
          customersApi.getCustomers(),
          suppliersApi.getSuppliers(),
          productsApi.getProducts(),
          invoicesApi.getInvoices(),
          expensesApi.getExpenses(),
        ]);

        setCustomers(customersData);
        setSuppliers(suppliersData);
        
        // Map backend product fields to frontend format
        const mappedProducts = productsData.map((p: any) => ({
          ...p,
          sku: p.code,
          unitPrice: p.price,
          costPrice: p.cost || 0,
          stockQuantity: p.stock,
          reorderLevel: p.minStock,
          status: p.stock === 0 ? 'out-of-stock' : p.stock <= p.minStock ? 'low' : 'active'
        }));
        setProducts(mappedProducts);
        
        setInvoices(invoicesData);
        setExpenses(expensesData);
      } catch (error) {
        console.error('Error loading data:', error);
        showToast('Veriler yüklenirken hata oluştu', 'error');
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
  }, [isAuthenticated]);

  // Save Bank and Sales to localStorage (no backend module)
  useEffect(() => {
    if (bankAccounts.length > 0) {
      localStorage.setItem('bankAccounts', JSON.stringify(bankAccounts));
    }
  }, [bankAccounts]);

  useEffect(() => {
    if (sales.length > 0) {
      localStorage.setItem('sales', JSON.stringify(sales));
    }
  }, [sales]);

  // Load Bank and Sales from localStorage on mount
  useEffect(() => {
    const savedBanks = localStorage.getItem('bankAccounts');
    const savedSales = localStorage.getItem('sales');
    
    if (savedBanks) {
      try {
        setBankAccounts(JSON.parse(savedBanks));
      } catch (e) {
        console.error('Error loading banks:', e);
      }
    }
    
    if (savedSales) {
      try {
        setSales(JSON.parse(savedSales));
      } catch (e) {
        console.error('Error loading sales:', e);
      }
    }
  }, []);

  const unreadNotificationCount = useMemo(
    () => notifications.filter(notification => !notification.read).length,
    [notifications]
  );

  const normalizeId = (value?: string | number) => String(value ?? Date.now());

  const dismissToast = React.useCallback((toastId: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== toastId));
  }, []);

  const showToast = React.useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts(prev => [...prev, { id, message, tone }]);
      if (typeof window !== "undefined") {
        window.setTimeout(() => dismissToast(id), 3600);
      }
      return id;
    },
    [dismissToast]
  );

  const confirmAction = (message: string) => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.confirm(message);
  };

  const handleCompanyUpdate = (updated: CompanyProfile) => {
    setCompany(updated);
    secureStorage.setJSON("companyProfile", updated);
  };

  const handleToggleNotifications = () => {
    setIsNotificationsOpen(prev => {
      const next = !prev;
      if (!prev) {
        setNotifications(current =>
          current.map(notification =>
            notification.read ? notification : { ...notification, read: true }
          )
        );
      }
      return next;
    });
  };

  const handleCloseNotifications = () => setIsNotificationsOpen(false);

  const navigateTo = (page: string) => {
    setCurrentPage(page);
    setIsSidebarOpen(false);
    setIsNotificationsOpen(false);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleLogin = (email: string, password: string) => {
    // This is now handled by AuthContext in LoginPage
    // Keep for compatibility
    return true;
  };

  const handleLogout = () => {
    setCurrentPage('dashboard');
    handleCloseNotifications();
    logout();
  };

  const handleToggleSidebar = () => setIsSidebarOpen(prev => !prev);
  const handleCloseSidebar = () => setIsSidebarOpen(false);

  const upsertCustomer = async (customerData: Partial<Customer>) => {
    try {
      // Clean data - remove empty strings
      const cleanData = {
        name: customerData.name || '',
        email: customerData.email?.trim() || undefined,
        phone: customerData.phone?.trim() || undefined,
        address: customerData.address?.trim() || undefined,
        taxNumber: customerData.taxNumber?.trim() || undefined,
      };
      
      if (customerData.id) {
        // Update existing
        const updated = await customersApi.updateCustomer(String(customerData.id), cleanData);
        setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
        showToast('Müşteri güncellendi', 'success');
      } else {
        // Create new
        const created = await customersApi.createCustomer(cleanData);
        setCustomers(prev => [...prev, created]);
        showToast('Müşteri eklendi', 'success');
      }
    } catch (error: any) {
      console.error('Customer upsert error:', error);
      console.error('Error details:', error.response?.data);
      const errorMsg = error.response?.data?.message || error.message || 'Müşteri kaydedilemedi';
      showToast(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg, 'error');
    }
  };

  const deleteCustomer = async (customerId: string | number) => {
    if (typeof window !== "undefined" && !window.confirm("Bu müşteriyi silmek istediğinizden emin misiniz?")) {
      return;
    }
    try {
      await customersApi.deleteCustomer(String(customerId));
      setCustomers(prev => prev.filter(customer => String(customer.id) !== String(customerId)));
      showToast('Müşteri silindi', 'success');
    } catch (error: any) {
      console.error('Customer delete error:', error);
      showToast(error.response?.data?.message || 'Müşteri silinemedi', 'error');
    }
  };

  const handleImportCustomers = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(data);
      
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        if (typeof window !== "undefined") {
          window.alert("Dosyada veri bulunamadi.");
        }
        return;
      }
      
      const rows: Record<string, unknown>[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header
        const rowData: Record<string, unknown> = {};
        row.eachCell((cell, colNumber) => {
          const header = worksheet.getRow(1).getCell(colNumber).value?.toString() || `col${colNumber}`;
          rowData[header] = cell.value;
        });
        rows.push(rowData);
      });

      const normalizeKey = (value: unknown) =>
        String(value ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/gi, "")
          .toLowerCase();

      const normalizeDate = (value: unknown) => {
        if (!value) {
          return undefined;
        }
        if (value instanceof Date) {
          return value.toISOString().split("T")[0];
        }
        if (typeof value === "number") {
          // Excel date serial number to Date
          const excelEpoch = new Date(1899, 11, 30);
          const excelDate = new Date(excelEpoch.getTime() + value * 86400000);
          return excelDate.toISOString().split("T")[0];
        }
        const str = String(value).trim();
        if (!str) {
          return undefined;
        }
        const parsed = new Date(str);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed.toISOString().split("T")[0];
        }
        return undefined;
      };

      const imported = rows
        .map<ImportedCustomer | null>(row => {
          if (!row || typeof row !== "object") {
            return null;
          }

          const entries = Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
            acc[normalizeKey(key)] = value;
            return acc;
          }, {});

          const getValue = (...keys: string[]) => {
            for (const key of keys) {
              if (entries[key] !== undefined && entries[key] !== "") {
                return entries[key];
              }
            }
            return undefined;
          };

          const rawName = getValue("name", "musteriadi", "musteriad", "musteri", "adsoyad", "ad");
          const name = rawName ? String(rawName).trim() : "";
          if (!name) {
            return null;
          }

          const email = getValue("email", "eposta", "mail");
          const phone = getValue("phone", "telefon", "tel", "gsm");
          const address = getValue("address", "adres");
          const taxNumber = getValue("taxnumber", "vergino", "vkn", "tc", "tcno");
          const company = getValue("company", "firma", "sirket", "unvan");
          const createdAtRaw = getValue("createdat", "kayittarihi", "olusturmatarihi", "tarih");
          const idValue = getValue("id", "musteriid");

          return {
            id: idValue ? String(idValue) : undefined,
            name,
            email: email ? String(email).trim() : "",
            phone: phone ? String(phone).trim() : "",
            address: address ? String(address).trim() : "",
            taxNumber: taxNumber ? String(taxNumber).trim() : "",
            company: company ? String(company).trim() : "",
            createdAt: normalizeDate(createdAtRaw),
          };
        })
        .filter((item): item is ImportedCustomer => Boolean(item));

      if (imported.length === 0) {
        if (typeof window !== "undefined") {
          window.alert("Dosyada aktarilacak müsteri bulunamadi.");
        }
        return;
      }

      setCustomers((prev) => {
        const next = [...prev];
        imported.forEach((customer, index) => {
          const emailKey = customer.email ? customer.email.toLowerCase() : undefined;
          const taxKey = customer.taxNumber || undefined;
          const nameKey = customer.name.toLowerCase();

          const existingIndex = next.findIndex((current) => {
            const currentEmail = current.email ? current.email.toLowerCase() : undefined;
            const currentTax = current.taxNumber || undefined;
            const currentName = current.name ? current.name.toLowerCase() : undefined;

            if (emailKey && currentEmail === emailKey) {
              return true;
            }
            if (taxKey && currentTax === taxKey) {
              return true;
            }
            return Boolean(currentName && currentName === nameKey);
          });

          if (existingIndex >= 0) {
            next[existingIndex] = {
              ...next[existingIndex],
              ...customer,
              id: next[existingIndex].id,
              createdAt: customer.createdAt || next[existingIndex].createdAt,
            };
          } else {
            next.push({
              ...customer,
              id: normalizeId(customer.id ?? `${Date.now()}-${index}`),
              balance: 0,
              createdAt: customer.createdAt || new Date().toISOString().split("T")[0],
            });
          }
        });
        return next;
      });

      if (typeof window !== "undefined") {
        window.alert(imported.length + " müsteri basariyla içe aktarildi.");
      }
    } catch (error) {
      console.error("Customer import failed", error);
      if (typeof window !== "undefined") {
        window.alert("Dosya içe aktarilirken bir sorun olustu. Lütfen formati kontrol edin.");
      }
    }
  };

  const upsertSupplier = async (supplierData: any) => {
    try {
      const cleanData = {
        name: supplierData.name || '',
        email: supplierData.email?.trim() || undefined,
        phone: supplierData.phone?.trim() || undefined,
        address: supplierData.address?.trim() || undefined,
        taxNumber: supplierData.taxNumber?.trim() || undefined,
      };
      
      if (supplierData.id) {
        const updated = await suppliersApi.updateSupplier(String(supplierData.id), cleanData);
        setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s));
        showToast('Tedarikçi güncellendi', 'success');
      } else {
        const created = await suppliersApi.createSupplier(cleanData);
        setSuppliers(prev => [...prev, created]);
        showToast('Tedarikçi eklendi', 'success');
      }
    } catch (error: any) {
      console.error('Supplier upsert error:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Tedarikçi kaydedilemedi';
      showToast(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg, 'error');
    }
  };

  const deleteSupplier = async (supplierId: string | number) => {
    if (typeof window !== "undefined" && !window.confirm("Bu tedarikçiyi silmek istediğinizden emin misiniz?")) {
      return;
    }
    try {
      await suppliersApi.deleteSupplier(String(supplierId));
      setSuppliers(prev => prev.filter(supplier => String(supplier.id) !== String(supplierId)));
      showToast('Tedarikçi silindi', 'success');
    } catch (error: any) {
      console.error('Supplier delete error:', error);
      showToast(error.response?.data?.message || 'Tedarikçi silinemedi', 'error');
    }
  };

  const upsertInvoice = async (invoiceData: any) => {
    try {
      const cleanData: any = {
        customerId: invoiceData.customerId,
        issueDate: invoiceData.issueDate || new Date().toISOString().split('T')[0],
        dueDate: invoiceData.dueDate,
        lineItems: invoiceData.items || invoiceData.lineItems || [],
        taxAmount: Number(invoiceData.taxAmount || 0),
        notes: invoiceData.notes,
      };
      
      if (invoiceData.status) {
        cleanData.status = invoiceData.status;
      }
      
      if (invoiceData.id) {
        const updated = await invoicesApi.updateInvoice(String(invoiceData.id), cleanData);
        setInvoices(prev => prev.map(i => i.id === updated.id ? updated : i));
        showToast('Fatura güncellendi', 'success');
      } else {
        const created = await invoicesApi.createInvoice(cleanData);
        setInvoices(prev => [...prev, created]);
        showToast('Fatura eklendi', 'success');
      }
    } catch (error: any) {
      console.error('Invoice upsert error:', error);
      console.error('Error details:', error.response?.data);
      const errorMsg = error.response?.data?.message || error.message || 'Fatura kaydedilemedi';
      showToast(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg, 'error');
    }
  };

  const deleteInvoice = async (invoiceId: string | number) => {
    if (!confirmAction("Bu faturayı silmek istediğinizden emin misiniz?")) return;
    try {
      await invoicesApi.deleteInvoice(String(invoiceId));
      setInvoices(prev => prev.filter(invoice => String(invoice.id) !== String(invoiceId)));
      showToast('Fatura silindi', 'success');
    } catch (error: any) {
      console.error('Invoice delete error:', error);
      showToast(error.response?.data?.message || 'Fatura silinemedi', 'error');
    }
  };

  const upsertExpense = async (expenseData: any) => {
    try {
      const cleanData = {
        description: expenseData.description || '',
        amount: Number(expenseData.amount || 0),
        category: expenseData.category || 'Genel',
        date: expenseData.date || expenseData.expenseDate || new Date().toISOString().split('T')[0],
        supplierId: expenseData.supplierId || undefined,
        notes: expenseData.notes,
      };
      
      if (expenseData.id) {
        const updated = await expensesApi.updateExpense(String(expenseData.id), cleanData);
        setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e));
        showToast('Gider güncellendi', 'success');
      } else {
        const created = await expensesApi.createExpense(cleanData);
        setExpenses(prev => [...prev, created]);
        showToast('Gider eklendi', 'success');
      }
    } catch (error: any) {
      console.error('Expense upsert error:', error);
      console.error('Error details:', error.response?.data);
      const errorMsg = error.response?.data?.message || error.message || 'Gider kaydedilemedi';
      showToast(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg, 'error');
    }
  };

  const deleteExpense = async (expenseId: string | number) => {
    if (!confirmAction("Bu gideri silmek istediğinizden emin misiniz?")) return;
    try {
      await expensesApi.deleteExpense(String(expenseId));
      setExpenses(prev => prev.filter(expense => String(expense.id) !== String(expenseId)));
      showToast('Gider silindi', 'success');
    } catch (error: any) {
      console.error('Expense delete error:', error);
      showToast(error.response?.data?.message || 'Gider silinemedi', 'error');
    }
  };

  const upsertSale = (saleData: any) => {
    const id = normalizeId(saleData?.id);
    const normalized = {
      ...saleData,
      id,
      saleNumber: saleData?.saleNumber || "SAL-" + new Date().getFullYear() + "-" + String(sales.length + 1).padStart(3, "0"),
      date: saleData?.date || saleData?.saleDate || new Date().toISOString().split("T")[0],
    };
    setSales(prev => {
      const exists = prev.some(sale => String(sale.id) === id);
      return exists
        ? prev.map(sale => (String(sale.id) === id ? { ...sale, ...normalized } : sale))
        : [...prev, normalized];
    });
  };

  const upsertProduct = async (productData: Partial<Product>) => {
    try {
      const categoryName = (productData?.category ? String(productData.category) : "").trim() || "Genel";
      addProductCategory(categoryName);

      // Map frontend fields to backend fields
      const backendData = {
        name: productData.name || '',
        code: productData.sku || `PROD-${Date.now()}`,
        description: productData.description || undefined,
        price: Number(productData.unitPrice ?? 0),
        cost: Number(productData.costPrice ?? 0),
        stock: Number(productData.stockQuantity ?? 0),
        minStock: Number(productData.reorderLevel ?? 0),
        unit: productData.unit || 'adet',
        category: categoryName,
      };

      if (productData?.id) {
        // Update existing
        const updated = await productsApi.updateProduct(String(productData.id), backendData);
        setProducts(prev => prev.map(p => p.id === updated.id ? { 
          ...updated,
          sku: updated.code,
          unitPrice: updated.price,
          costPrice: updated.cost,
          stockQuantity: updated.stock,
          reorderLevel: updated.minStock,
          status: updated.stock === 0 ? 'out-of-stock' : updated.stock <= updated.minStock ? 'low' : 'active'
        } as Product : p));
        showToast('Ürün güncellendi', 'success');
      } else {
        // Create new
        const created = await productsApi.createProduct(backendData);
        setProducts(prev => [...prev, { 
          ...created,
          sku: created.code,
          unitPrice: created.price,
          costPrice: created.cost,
          stockQuantity: created.stock,
          reorderLevel: created.minStock,
          status: created.stock === 0 ? 'out-of-stock' : created.stock <= created.minStock ? 'low' : 'active'
        } as Product]);
        showToast('Ürün eklendi', 'success');
      }
    } catch (error: any) {
      console.error('Product upsert error:', error);
      console.error('Error details:', error.response?.data);
      const errorMsg = error.response?.data?.message || error.message || 'Ürün kaydedilemedi';
      showToast(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg, 'error');
    }
  };

  const deleteProduct = async (productId: string | number) => {
    if (!confirmAction("Bu ürünü silmek istediğinizden emin misiniz?")) {
      return;
    }
    try {
      await productsApi.deleteProduct(String(productId));
      setProducts(prev => prev.filter(product => product.id !== String(productId)));
      showToast('Ürün silindi', 'success');
    } catch (error: any) {
      console.error('Product delete error:', error);
      showToast(error.response?.data?.message || 'Ürün silinemedi', 'error');
    }
  };

  const categoriesEqual = (left: string, right: string) =>
    left.localeCompare(right, "tr-TR", { sensitivity: "accent" }) === 0;

  const addProductCategory = (categoryName: string) => {
    const normalized = categoryName.trim();
    if (!normalized) {
      return;
    }
    setProductCategories(prev => {
      const exists = prev.some(existing => categoriesEqual(existing, normalized));
      if (exists) {
        return prev;
      }
      return [...prev, normalized].sort((a, b) => a.localeCompare(b, "tr-TR"));
    });
  };

  const renameProductCategory = (currentName: string, nextName: string) => {
    const current = currentName.trim();
    const updated = nextName.trim();
    if (!current || !updated) {
      return;
    }

    let renamed = false;
    setProductCategories(prev => {
      if (!prev.some(existing => categoriesEqual(existing, current))) {
        return prev;
      }
      if (prev.some(existing => !categoriesEqual(existing, current) && categoriesEqual(existing, updated))) {
        return prev;
      }
      renamed = true;
      return prev
        .map(existing => (categoriesEqual(existing, current) ? updated : existing))
        .sort((a, b) => a.localeCompare(b, "tr-TR"));
    });

    if (!renamed) {
      return;
    }

    setProducts(prev =>
      prev.map(product =>
        product?.category && categoriesEqual(product.category, current)
          ? { ...product, category: updated }
          : product
      )
    );
    showToast("Kategori guncellendi", "success");
  };

  const deleteProductCategory = (categoryName: string) => {
    const target = categoryName.trim();
    if (!target) {
      return;
    }

    const fallbackCategory = "Genel";
    if (categoriesEqual(target, fallbackCategory)) {
      return;
    }

    let removed = false;
    setProductCategories(prev => {
      const filtered = prev.filter(existing => !categoriesEqual(existing, target));
      if (filtered.length === prev.length) {
        return prev;
      }
      removed = true;
      if (!filtered.some(existing => categoriesEqual(existing, fallbackCategory))) {
        filtered.push(fallbackCategory);
      }
      return Array.from(new Set(filtered)).sort((a, b) => a.localeCompare(b, "tr-TR"));
    });

    if (!removed) {
      return;
    }

    setProducts(prev =>
      prev.map(product =>
        product?.category && categoriesEqual(product.category, target)
          ? { ...product, category: fallbackCategory }
          : product
      )
    );
    showToast("Kategori silindi", "success");
  };

  const handleProductBulkAction = (action: ProductBulkAction, productIds: string[]) => {
    if (!productIds.length) {
      return;
    }

    if (action === "delete") {
      if (!confirmAction(`${productIds.length} urunu silmek istiyor musunuz?`)) {
        return;
      }
      setProducts(prev => {
        const next = prev.filter(product => !productIds.includes(product.id));
        const removedCount = prev.length - next.length;
        if (removedCount > 0) {
          showToast(`${removedCount} urun silindi`, "success");
        } else {
          showToast("Secilen urunler bulunamadi", "info");
        }
        return next;
      });
      return;
    }

    if (action === "archive") {
      setProducts(prev => {
        let changed = 0;
        const next = prev.map(product => {
          if (productIds.includes(product.id)) {
            changed += 1;
            return { ...product, status: "archived" };
          }
          return product;
        });
        if (changed > 0) {
          showToast(`${changed} urun arsivlendi`, "success");
        } else {
          showToast("Secilen urunler zaten arsivde", "info");
        }
        return next;
      });
      return;
    }

    if (action === "update-price") {
      showToast("Toplu fiyat guncelleme icin seciminizi kaydettik. Duzenlemeyi urun detayinda yapabilirsiniz.", "info");
      return;
    }

    if (action === "assign-category") {
      showToast("Kategori atamasi icin sol paneldeki kategori duzenini kullanabilirsiniz.", "info");
    }
  };

  const upsertBank = (bankData: any) => {
    if (bankData.id) {
      // Update existing
      setBankAccounts(prev => prev.map(bank => 
        String(bank.id) === String(bankData.id) ? { ...bank, ...bankData } : bank
      ));
      showToast('Banka hesabı güncellendi', 'success');
    } else {
      // Create new
      const newBank = {
        ...bankData,
        id: Date.now().toString(),
        balance: Number(bankData.balance ?? 0),
        createdAt: new Date().toISOString().split("T")[0],
      };
      setBankAccounts(prev => [...prev, newBank]);
      showToast('Banka hesabı eklendi', 'success');
    }
  };

  const deleteBank = (bankId: string | number) => {
    if (!confirmAction("Bu banka hesabını silmek istediğinizden emin misiniz?")) return;
    setBankAccounts(prev => prev.filter(bank => String(bank.id) !== String(bankId)));
    showToast('Banka hesabı silindi', 'success');
  };

  const openCustomerModal = (customer?: any) => {
    setSelectedCustomer(customer ?? null);
    setShowCustomerModal(true);
  };

  const openSupplierModal = (supplier?: any) => {
    setSelectedSupplier(supplier ?? null);
    setShowSupplierModal(true);
  };

  const openInvoiceModal = (invoice?: any) => {
    setSelectedInvoice(invoice ?? null);
    setShowInvoiceModal(true);
  };

  const openExpenseModal = (expense?: any, supplierHint?: any) => {
    setSelectedExpense(expense ?? null);
    setSupplierForExpense(supplierHint ?? null);
    setShowExpenseModal(true);
  };

  const openSaleModal = (sale?: any) => {
    setSelectedSale(sale ?? null);
    setShowSaleModal(true);
  };

  const openProductModal = (product?: any) => {
    setSelectedProduct(product ?? null);
    setShowProductModal(true);
  };

  const openProductCategoryModal = () => {
    setShowProductCategoryModal(true);
  };

  const openProductViewModal = (product: any) => {
    setSelectedProduct(product);
    setShowProductViewModal(true);
  };

  const openBankModal = (bank?: any) => {
    setSelectedBank(bank ?? null);
    setShowBankModal(true);
  };

  const closeCustomerModal = () => {
    setShowCustomerModal(false);
    setSelectedCustomer(null);
  };

  const closeSupplierModal = () => {
    setShowSupplierModal(false);
    setSelectedSupplier(null);
  };

  const closeInvoiceModal = () => {
    setShowInvoiceModal(false);
    setSelectedInvoice(null);
  };

  const closeExpenseModal = () => {
    setShowExpenseModal(false);
    setSelectedExpense(null);
    setSupplierForExpense(null);
  };

  const closeSaleModal = () => {
    setShowSaleModal(false);
    setSelectedSale(null);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setSelectedProduct(null);
  };

  const closeProductCategoryModal = () => {
    setShowProductCategoryModal(false);
  };

  const closeBankModal = () => {
    setShowBankModal(false);
    setSelectedBank(null);
  };

  const closeCustomerViewModal = () => setShowCustomerViewModal(false);
  const closeSupplierViewModal = () => setShowSupplierViewModal(false);
  const closeInvoiceViewModal = () => setShowInvoiceViewModal(false);
  const closeExpenseViewModal = () => setShowExpenseViewModal(false);
  const closeSaleViewModal = () => setShowSaleViewModal(false);
  const closeProductViewModal = () => {
    setShowProductViewModal(false);
    setSelectedProduct(null);
  };
  const closeBankViewModal = () => setShowBankViewModal(false);
  const closeCustomerHistoryModal = () => setShowCustomerHistoryModal(false);
  const closeSupplierHistoryModal = () => setShowSupplierHistoryModal(false);

  const handleCreateInvoiceFromCustomer = (customer: any) => {
    setSelectedInvoice({
      id: normalizeId(customer?.id),
      customerName: customer?.name,
      customerEmail: customer?.email,
      customerAddress: customer?.address,
      status: "draft",
      issueDate: new Date().toISOString().split("T")[0],
    });
    setShowInvoiceModal(true);
  };

  const handleRecordPaymentForCustomer = (customer: any) => {
    setInvoices(prev => prev.map(invoice => {
      if (invoice.customerName === customer.name && invoice.status !== "paid") {
        return { ...invoice, status: "paid" };
      }
      return invoice;
    }));
  };

  const handleCreateExpenseFromSupplier = (supplier: any) => {
    openExpenseModal(null, { name: supplier?.name, category: supplier?.category });
    setShowSupplierViewModal(false);
    setShowSupplierHistoryModal(false);
  };

  const handleDownloadInvoice = async (invoice: any) => {
    try {
      const module = await import("./utils/pdfGenerator");
      await module.generateInvoicePDF(invoice, { company });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDownloadExpense = async (expense: any) => {
    try {
      const module = await import("./utils/pdfGenerator");
      await module.generateExpensePDF(expense, { company });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDownloadSale = async (sale: any) => {
    try {
      const module = await import("./utils/pdfGenerator");
      await module.generateSalePDF(sale, { company });
    } catch (error) {
      console.error(error);
    }
  };

  const metrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const previous = new Date(currentYear, currentMonth - 1, 1);
    const previousMonth = previous.getMonth();
    const previousYear = previous.getFullYear();

    const isInMonth = (value: string | undefined, month: number, year: number) => {
      if (!value) return false;
      const date = new Date(value);
      return !isNaN(date.getTime()) && date.getMonth() === month && date.getFullYear() === year;
    };

    const saleAmount = (sale: any) => Number(sale?.amount ?? (sale?.quantity || 0) * (sale?.unitPrice || 0));
    const expenseAmount = (expense: any) => Number(expense?.amount ?? 0);
    const invoiceAmount = (invoice: any) => Number(invoice?.total ?? 0);

    const sum = (items: any[], selector: (item: any) => number) => items.reduce((total, item) => total + selector(item), 0);

    const totalRevenue = sum(sales, saleAmount);
    const revenueCurrent = sum(sales.filter(sale => isInMonth(sale?.date || sale?.saleDate, currentMonth, currentYear)), saleAmount);
    const revenuePrevious = sum(sales.filter(sale => isInMonth(sale?.date || sale?.saleDate, previousMonth, previousYear)), saleAmount);

    const totalExpense = sum(expenses, expenseAmount);
    const expenseCurrent = sum(expenses.filter(expense => isInMonth(expense?.expenseDate, currentMonth, currentYear)), expenseAmount);
    const expensePrevious = sum(expenses.filter(expense => isInMonth(expense?.expenseDate, previousMonth, previousYear)), expenseAmount);

    const outstandingInvoices = invoices.filter(invoice => invoice.status !== "paid");
    const outstandingAmount = sum(outstandingInvoices, invoiceAmount);
    const outstandingCurrent = outstandingInvoices.filter(invoice => isInMonth(invoice?.dueDate || invoice?.issueDate, currentMonth, currentYear)).length;
    const outstandingPrevious = outstandingInvoices.filter(invoice => isInMonth(invoice?.dueDate || invoice?.issueDate, previousMonth, previousYear)).length;

    const customersCurrent = customers.filter(customer => isInMonth(customer?.createdAt, currentMonth, currentYear)).length;
    const customersPrevious = customers.filter(customer => isInMonth(customer?.createdAt, previousMonth, previousYear)).length;

    const totalCash = bankAccounts.reduce((total, account) => account?.currency && account.currency !== "TRY" ? total : total + Number(account?.balance ?? 0), 0);

    const percentChange = (before: number, current: number) => {
      if (before === 0) {
        return current === 0 ? 0 : 100;
      }
      return ((current - before) / before) * 100;
    };

    const changeDirection = (before: number, current: number): "increase" | "decrease" =>
      percentChange(before, current) >= 0 ? "increase" : "decrease";

    const statsCards = [
      {
        title: "Toplam Gelir",
        value: formatCurrency(totalRevenue),
        change: formatPercentage(percentChange(revenuePrevious, revenueCurrent)),
        changeType: changeDirection(revenuePrevious, revenueCurrent),
        icon: TrendingUp,
        color: "green" as const,
      },
      {
        title: "Toplam Gider",
        value: formatCurrency(totalExpense),
        change: formatPercentage(percentChange(expensePrevious, expenseCurrent)),
        changeType: changeDirection(expensePrevious, expenseCurrent),
        icon: CreditCard,
        color: "red" as const,
      },
      {
        title: "Bekleyen Faturalar",
        value: formatCurrency(outstandingAmount),
        change: formatPercentage(percentChange(outstandingPrevious, outstandingCurrent)),
        changeType: changeDirection(outstandingPrevious, outstandingCurrent),
        icon: FileText,
        color: "purple" as const,
      },
      {
        title: "Aktif Müsteri",
        value: String(customers.length),
        change: formatPercentage(percentChange(customersPrevious, customersCurrent)),
        changeType: changeDirection(customersPrevious, customersCurrent),
        icon: Users,
        color: "blue" as const,
      },
    ];

    return {
      statsCards,
      outstandingAmount,
      totalCash,
    };
  }, [invoices, expenses, sales, customers, bankAccounts]);

  const handleExportData = () => {
    const payload = {
      customers,
      suppliers,
      invoices,
      expenses,
      sales,
      products,
      bankAccounts,
      company,
    };
    console.info("Exported data", payload);
  };

  const handleImportData = (payload: any) => {
    if (!payload) return;
    if (Array.isArray(payload.customers)) {
      setCustomers(payload.customers.map((customer: any) => ({ ...customer, id: String(customer.id) })));
    }
    if (Array.isArray(payload.suppliers)) {
      setSuppliers(payload.suppliers.map((supplier: any) => ({ ...supplier, id: String(supplier.id) })));
    }
    if (Array.isArray(payload.invoices)) {
      setInvoices(payload.invoices.map((invoice: any) => ({ ...invoice, id: String(invoice.id) })));
    }
    if (Array.isArray(payload.expenses)) {
      setExpenses(payload.expenses.map((expense: any) => ({ ...expense, id: String(expense.id) })));
    }
    if (Array.isArray(payload.sales)) {
      setSales(payload.sales.map((sale: any) => ({ ...sale, id: String(sale.id) })));
    }
    if (Array.isArray(payload.products)) {
      const normalizedProducts: Product[] = payload.products.map((product: Product) => ({
        ...product,
        id: String(product.id),
        category: product.category || "Genel",
      }));
      setProducts(normalizedProducts);
      const importedCategories: string[] = normalizedProducts
        .map(product => (product.category ? String(product.category).trim() : ""))
        .filter((category): category is string => Boolean(category));
      if (importedCategories.length) {
        setProductCategories(prev => {
          const merged = new Set<string>(prev);
          importedCategories.forEach((category: string) => {
            merged.add(category);
          });
          return Array.from(merged).sort((a, b) => a.localeCompare(b, "tr-TR"));
        });
      }
    }
    if (Array.isArray(payload.bankAccounts)) {
      setBankAccounts(payload.bankAccounts.map((account: any) => ({ ...account, id: String(account.id) })));
    }
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.statsCards.map(card => (
          <StatsCard
            key={card.title}
            title={card.title}
            value={card.value}
            change={card.change}
            changeType={card.changeType}
            icon={card.icon}
            color={card.color}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ChartCard sales={sales} expenses={expenses} invoices={invoices} />
          <RecentTransactions
            invoices={invoices}
            expenses={expenses}
            sales={sales}
            onViewInvoice={invoice => {
              setSelectedInvoice(invoice);
              setShowInvoiceViewModal(true);
            }}
            onEditInvoice={invoice => openInvoiceModal(invoice)}
            onDownloadInvoice={handleDownloadInvoice}
            onViewExpense={expense => {
              setSelectedExpense(expense);
              setShowExpenseViewModal(true);
            }}
            onEditExpense={expense => openExpenseModal(expense)}
            onDownloadExpense={handleDownloadExpense}
            onViewSale={sale => {
              setSelectedSale(sale);
              setShowSaleViewModal(true);
            }}
            onEditSale={sale => openSaleModal(sale)}
            onDownloadSale={handleDownloadSale}
            onViewAllTransactions={() => navigateTo("general-ledger")}
          />
        </div>
        <div className="space-y-6">
          <QuickActions
            onNewInvoice={() => openInvoiceModal()}
            onNewExpense={() => openExpenseModal()}
            onNewSale={() => openSaleModal()}
            onNewCustomer={() => openCustomerModal()}
            onViewCustomers={() => navigateTo("customers")}
            onViewSuppliers={() => navigateTo("suppliers")}
            onViewBanks={() => navigateTo("banks")}
            onViewProducts={() => navigateTo("products")}
            customers={customers}
            suppliers={suppliers}
            banks={bankAccounts}
            products={products}
          />
          <DashboardAlerts
            invoices={invoices}
            expenses={expenses}
            onViewOverdueInvoices={() => navigateTo("invoices")}
            onViewPendingExpenses={() => navigateTo("expenses")}
          />
        </div>
      </div>
    </div>
  );

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return renderDashboard();
      case "customers":
        return (
          <CustomerList
            customers={customers}
            onAddCustomer={() => openCustomerModal()}
            onEditCustomer={customer => openCustomerModal(customer)}
            onDeleteCustomer={customerId => deleteCustomer(customerId)}
            onViewCustomer={customer => {
              setSelectedCustomer(customer);
              setShowCustomerViewModal(true);
            }}
            onImportCustomers={handleImportCustomers}
          />
        );
      case "products":
        return (
          <ProductList
            products={products}
            categories={productCategories}
            onAddProduct={() => openProductModal()}
            onEditProduct={product => openProductModal(product)}
            onDeleteProduct={productId => deleteProduct(productId)}
            onViewProduct={product => openProductViewModal(product)}
            onAddCategory={openProductCategoryModal}
            onEditCategory={renameProductCategory}
            onDeleteCategory={deleteProductCategory}
            onBulkAction={handleProductBulkAction}
          />
        );

      case "suppliers":
        return (
          <SupplierList
            suppliers={suppliers}
            onAddSupplier={() => openSupplierModal()}
            onEditSupplier={supplier => openSupplierModal(supplier)}
            onDeleteSupplier={deleteSupplier}
            onViewSupplier={supplier => {
              setSelectedSupplier(supplier);
              setShowSupplierViewModal(true);
            }}
          />
        );
      case "invoices":
        return (
          <InvoiceList
            invoices={invoices}
            onAddInvoice={() => openInvoiceModal()}
            onEditInvoice={invoice => openInvoiceModal(invoice)}
            onDeleteInvoice={deleteInvoice}
            onViewInvoice={invoice => {
              setSelectedInvoice(invoice);
              setShowInvoiceViewModal(true);
            }}
            onUpdateInvoice={updated => setInvoices(prev => prev.map(invoice => (invoice.id === updated.id ? updated : invoice)))}
            onDownloadInvoice={handleDownloadInvoice}
          />
        );
      case "expenses":
        return (
          <ExpenseList
            expenses={expenses}
            onAddExpense={() => openExpenseModal()}
            onEditExpense={expense => openExpenseModal(expense)}
            onDeleteExpense={expenseId => deleteExpense(expenseId)}
            onViewExpense={expense => {
              setSelectedExpense(expense);
              setShowExpenseViewModal(true);
            }}
            onUpdateExpense={updated => setExpenses(prev => prev.map(expense => (expense.id === updated.id ? updated : expense)))}
            onDownloadExpense={handleDownloadExpense}
          />
        );
      case "banks":
        return (
          <BankList
            bankAccounts={bankAccounts}
            onAddBank={() => openBankModal()}
            onEditBank={bank => openBankModal(bank)}
            onDeleteBank={bankId => deleteBank(bankId)}
            onViewBank={bank => {
              setSelectedBank(bank);
              setShowBankViewModal(true);
            }}
          />
        );
      case "sales":
        return (
          <SimpleSalesPage
            customers={customers}
            sales={sales}
            invoices={invoices}
            products={products}
            onSalesUpdate={setSales}
            onCreateInvoice={upsertInvoice}
            onViewInvoice={invoice => {
              setSelectedInvoice(invoice);
              setShowInvoiceViewModal(true);
            }}
            onEditInvoice={invoice => openInvoiceModal(invoice)}
            onDownloadSale={handleDownloadSale}
          />
        );
      case "reports":
        return <ReportsPage invoices={invoices} expenses={expenses} sales={sales} customers={customers} />;
      case "general-ledger":
        return (
          <GeneralLedger
            invoices={invoices}
            expenses={expenses}
            sales={sales}
            onViewInvoice={invoice => {
              setSelectedInvoice(invoice);
              setShowInvoiceViewModal(true);
            }}
            onEditInvoice={invoice => openInvoiceModal(invoice)}
            onViewExpense={expense => {
              setSelectedExpense(expense);
              setShowExpenseViewModal(true);
            }}
            onEditExpense={expense => openExpenseModal(expense)}
            onViewSale={sale => {
              setSelectedSale(sale);
              setShowSaleViewModal(true);
            }}
            onEditSale={sale => openSaleModal(sale)}
            onInvoicesUpdate={setInvoices}
            onExpensesUpdate={setExpenses}
            onSalesUpdate={setSales}
          />
        );
      case "chart-of-accounts":
        return (
          <ChartOfAccountsPage
            accounts={accounts}
            onAccountsUpdate={setAccounts}
            invoices={invoices}
            expenses={expenses}
            sales={sales}
            customers={customers}
          />
        );
      case "archive":
        return (
          <ArchivePage
            invoices={invoices}
            expenses={expenses}
            sales={sales}
            customers={customers}
            suppliers={suppliers}
            onViewInvoice={invoice => {
              setSelectedInvoice(invoice);
              setShowInvoiceViewModal(true);
            }}
            onViewExpense={expense => {
              setSelectedExpense(expense);
              setShowExpenseViewModal(true);
            }}
            onViewSale={sale => {
              setSelectedSale(sale);
              setShowSaleViewModal(true);
            }}
            onViewCustomer={customer => {
              setSelectedCustomer(customer);
              setShowCustomerViewModal(true);
            }}
            onViewSupplier={supplier => {
              setSelectedSupplier(supplier);
              setShowSupplierViewModal(true);
            }}
            onDownloadInvoice={handleDownloadInvoice}
            onDownloadExpense={handleDownloadExpense}
            onDownloadSale={handleDownloadSale}
          />
        );
      case "settings":
        return (
          <SettingsPage
            user={user}
            company={company}
            bankAccounts={bankAccounts}
            onUserUpdate={setUser}
            onCompanyUpdate={handleCompanyUpdate}
            onExportData={handleExportData}
            onImportData={handleImportData}
            language={language}
          />
        );
      default:
        return renderDashboard();
    }
  };

  const renderToasts = () => {
    if (toasts.length === 0) {
      return null;
    }

    return (
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-80 flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-lg border px-4 py-3 shadow-lg ${toastToneClasses[toast.tone]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-medium">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded text-xs font-semibold text-current transition-opacity hover:opacity-75"
              >
                X
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderModals = () => (
    <>
      {showCustomerModal && (
        <CustomerModal
          isOpen={showCustomerModal}
          onClose={closeCustomerModal}
          onSave={customer => {
            upsertCustomer(customer);
            closeCustomerModal();
          }}
          customer={selectedCustomer}
        />
      )}

      {showSupplierModal && (
        <SupplierModal
          isOpen={showSupplierModal}
          onClose={closeSupplierModal}
          onSave={supplier => {
            upsertSupplier(supplier);
            closeSupplierModal();
          }}
          supplier={selectedSupplier}
        />
      )}

      {showInvoiceModal && (
        <InvoiceModal
          onClose={closeInvoiceModal}
          onSave={invoice => {
            upsertInvoice(invoice);
            closeInvoiceModal();
          }}
          invoice={selectedInvoice}
          customers={customers}
          products={products}
        />
      )}

      {showExpenseModal && (
        <ExpenseModal
          isOpen={showExpenseModal}
          onClose={closeExpenseModal}
          onSave={expense => {
            upsertExpense(expense);
            closeExpenseModal();
          }}
          expense={selectedExpense}
          supplierInfo={supplierForExpense}
        />
      )}

      {showProductModal && (
        <ProductModal
          isOpen={showProductModal}
          onClose={closeProductModal}
          onSave={product => {
            upsertProduct(product);
            closeProductModal();
          }}
          categories={productCategories}
          product={selectedProduct}
        />
      )}

      {showSaleModal && (
        <SaleModal
          isOpen={showSaleModal}
          onClose={closeSaleModal}
          onSave={sale => {
            upsertSale(sale);
            closeSaleModal();
          }}
          sale={selectedSale}
          customers={customers}
          products={products}
        />
      )}

      {showBankModal && (
        <BankModal
          isOpen={showBankModal}
          onClose={closeBankModal}
          onSave={bank => {
            upsertBank(bank);
            closeBankModal();
          }}
          bank={selectedBank}
          bankAccount={selectedBank}
        />
      )}

      <CustomerViewModal
        isOpen={showCustomerViewModal}
        onClose={closeCustomerViewModal}
        customer={selectedCustomer}
        onEdit={customer => openCustomerModal(customer)}
        onCreateInvoice={handleCreateInvoiceFromCustomer}
        onRecordPayment={handleRecordPaymentForCustomer}
        onViewHistory={customer => {
          setSelectedCustomer(customer);
          setShowCustomerHistoryModal(true);
        }}
      />

      <SupplierViewModal
        isOpen={showSupplierViewModal}
        onClose={closeSupplierViewModal}
        supplier={selectedSupplier}
        onEdit={supplier => openSupplierModal(supplier)}
        onCreateExpense={handleCreateExpenseFromSupplier}
        onViewHistory={supplier => {
          setSelectedSupplier(supplier);
          setShowSupplierHistoryModal(true);
        }}
      />

      <InvoiceViewModal
        isOpen={showInvoiceViewModal}
        onClose={closeInvoiceViewModal}
        invoice={selectedInvoice}
        onEdit={invoice => openInvoiceModal(invoice)}
        onDownload={handleDownloadInvoice}
      />

      <ExpenseViewModal
        isOpen={showExpenseViewModal}
        onClose={closeExpenseViewModal}
        expense={selectedExpense}
        onEdit={expense => openExpenseModal(expense)}
        onDownload={handleDownloadExpense}
      />

      <SaleViewModal
        isOpen={showSaleViewModal}
        onClose={closeSaleViewModal}
        sale={selectedSale}
        onEdit={sale => openSaleModal(sale)}
        onDownload={handleDownloadSale}
      />

      <ProductViewModal
        isOpen={showProductViewModal}
        onClose={closeProductViewModal}
        product={selectedProduct}
        onEdit={product => openProductModal(product)}
      />

      <ProductCategoryModal
        isOpen={showProductCategoryModal}
        onClose={closeProductCategoryModal}
        onSubmit={addProductCategory}
        categories={productCategories}
      />

      <BankViewModal
        isOpen={showBankViewModal}
        onClose={closeBankViewModal}
        bankAccount={selectedBank}
        onEdit={bank => openBankModal(bank)}
      />

      <CustomerHistoryModal
        isOpen={showCustomerHistoryModal}
        onClose={closeCustomerHistoryModal}
        customer={selectedCustomer}
        invoices={invoices.filter(invoice => invoice.customerName === selectedCustomer?.name)}
        sales={sales.filter(sale => sale.customerName === selectedCustomer?.name)}
        onViewInvoice={invoice => {
          setSelectedInvoice(invoice);
          setShowInvoiceViewModal(true);
        }}
        onCreateInvoice={handleCreateInvoiceFromCustomer}
      />

      <SupplierHistoryModal
        isOpen={showSupplierHistoryModal}
        onClose={closeSupplierHistoryModal}
        supplier={selectedSupplier}
        expenses={expenses.filter(expense => expense.supplier === selectedSupplier?.name)}
        onViewExpense={expense => {
          setSelectedExpense(expense);
          setShowExpenseViewModal(true);
        }}
        onCreateExpense={handleCreateExpenseFromSupplier}
      />
    </>
  );

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar
          currentPage={currentPage}
          onPageChange={navigateTo}
          invoices={invoices}
          expenses={expenses}
          isOpen={isSidebarOpen}
          onClose={handleCloseSidebar}
        />

        <div className="flex flex-1 flex-col">
          <Header
            user={user}
            onLogout={handleLogout}
            onNewInvoice={() => openInvoiceModal()}
            onNewSale={() => openSaleModal()}
            language={language}
            onLanguageChange={setLanguage}
            activePage={currentPage}
            onToggleSidebar={handleToggleSidebar}
            notifications={notifications}
            unreadCount={unreadNotificationCount}
            isNotificationsOpen={isNotificationsOpen}
            onToggleNotifications={handleToggleNotifications}
            onCloseNotifications={handleCloseNotifications}
          />

          <main className="flex-1 px-3 py-6 sm:px-6 lg:px-8">
            {renderPage()}
          </main>
        </div>
      </div>

      {renderToasts()}
      {renderModals()}
    </div>
  );
};

export default App;















































