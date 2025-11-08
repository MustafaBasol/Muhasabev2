import React, { useEffect, useMemo, useState } from "react";
import { Users, FileText, CreditCard, TrendingUp } from "lucide-react";
import { useAuth } from "./contexts/AuthContext";
import { CurrencyProvider, useCurrency } from "./contexts/CurrencyContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { CookieConsentProvider } from "./contexts/CookieConsentContext";
import { NotificationPreferencesProvider, useNotificationPreferences } from "./contexts/NotificationPreferencesContext";
import { analyticsManager } from "./utils/analyticsManager";
import { useTranslation } from "react-i18next";

import type { CompanyProfile } from "./utils/pdfGenerator";
import type { 
  Customer, 
  User,
  Product,
  ProductCategory,
} from "./types";
import { secureStorage } from "./utils/storage";
import { getErrorMessage } from "./utils/errorHandler";

// API imports
import * as customersApi from "./api/customers";
import * as productsApi from "./api/products";
import * as invoicesApi from "./api/invoices";
import * as salesApi from "./api/sales";
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
import AdminPage from "./components/AdminPage";

// New Invoice Flow Modals
import InvoiceTypeSelectionModal from "./components/InvoiceTypeSelectionModal";
import ExistingSaleSelectionModal from "./components/ExistingSaleSelectionModal";
import InvoiceFromSaleModal from "./components/InvoiceFromSaleModal";

// view modals
import CustomerViewModal from "./components/CustomerViewModal";
import ProductViewModal from "./components/ProductViewModal";
import SupplierViewModal from "./components/SupplierViewModal";
import InvoiceViewModal from "./components/InvoiceViewModal";
import ExpenseViewModal from "./components/ExpenseViewModal";
import SaleViewModal from "./components/SaleViewModal";
import BankViewModal from "./components/BankViewModal";
import InfoModal from "./components/InfoModal";
import QuoteViewModal, { type Quote as QuoteModel } from "./components/QuoteViewModal";
import QuoteEditModal from "./components/QuoteEditModal";

// history modals
import CustomerHistoryModal from "./components/CustomerHistoryModal";
import SupplierHistoryModal from "./components/SupplierHistoryModal";
import DeleteWarningModal from "./components/DeleteWarningModal";

// pages
import CustomerList from "./components/CustomerList";
import ProductList, { type ProductBulkAction } from "./components/ProductList";
import SupplierList from "./components/SupplierList";
import InvoiceList from "./components/InvoiceList";
import ExpenseList from "./components/ExpenseList";
import BankList from "./components/BankList";
import ReportsPage from "./components/ReportsPage";
import ChartOfAccountsPage from "./components/ChartOfAccountsPage";
import ArchivePage from "./components/ArchivePage";
import GeneralLedger from "./components/GeneralLedger";
import SimpleSalesPage from "./components/SimpleSalesPage";
import QuotesPage from "./components/QuotesPage";
import QuoteCreateModal, { type QuoteCreatePayload } from "./components/QuoteCreateModal";
import FiscalPeriodsWidget from "./components/FiscalPeriodsWidget";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import ForgotPasswordPage from "./components/ForgotPasswordPage";
import ResetPasswordPage from "./components/ResetPasswordPage";
import VerifyEmailPage from "./components/VerifyEmailPage";
import VerifyNoticePage from "./components/VerifyNoticePage"; // Yeni: Kayıt sonrası doğrulama bilgilendirme sayfası
import LandingPage from "./components/landing/LandingPage";
import AboutPage from "./components/landing/AboutPage";
import ApiPage from "./components/landing/ApiPage";

// legal pages
import TermsOfService from "./components/legal/TermsOfService";
import PrivacyPolicy from "./components/legal/PrivacyPolicy";
import SubprocessorsList from "./components/legal/SubprocessorsList";
import DataProcessingAgreement from "./components/legal/DataProcessingAgreement";
import CookiePolicy from "./components/legal/CookiePolicy";
import HelpCenter from "./components/help/HelpCenter";
// StatusPage public değil; admin paneli sekmesi içinde kullanılacak

// cookie consent components
import CookieConsentBanner from "./components/CookieConsentBanner";
import CookiePreferencesModal from "./components/CookiePreferencesModal";

// legal header
import LegalHeader from "./components/LegalHeader";

// organization components
import JoinOrganizationPage from "./components/JoinOrganizationPage";
import PublicQuotePage from "./components/PublicQuotePage";
import * as quotesApi from "./api/quotes";

import * as ExcelJS from 'exceljs';

const defaultCompany: CompanyProfile = {
  name: "",
  address: "",
  taxNumber: "",
  taxOffice: "",
  phone: "",
  email: "",
  website: "",
  logoDataUrl: "",
  iban: "",
  bankAccountId: undefined,
};

// Bildirimler başlangıçta boş - backend'den veya işlemlerden dinamik oluşturulacak
const initialNotifications: HeaderNotification[] = [];

const initialProductCategories = ["Genel"]; // Boş başlangıç, backend'den yüklenecek
const initialProductCategoryObjects: ProductCategory[] = []; // Kategori nesneleri

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

const formatPercentage = (value: number) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;


const AppContent: React.FC = () => {
  const { isAuthenticated, user: authUser, logout, tenant } = useAuth();
  const { formatCurrency } = useCurrency();
  const { t, i18n } = useTranslation();
  const { prefs } = useNotificationPreferences();
  
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>(undefined);
  
  // Debug currentPage değişikliklerini
  useEffect(() => {
    console.log('CurrentPage değişti:', currentPage);
  }, [currentPage]);

  // Configure analytics on app startup
  useEffect(() => {
    analyticsManager.setConfig({
      googleAnalytics: {
        measurementId: 'G-XXXXXXXXXX', // Replace with your GA measurement ID
        enabled: true
      },
      matomo: {
        siteId: '1',
        url: 'https://your-matomo-domain.com', // Replace with your Matomo URL
        enabled: false // Enable if you use Matomo
      },
      hotjar: {
        hjid: '0000000', // Replace with your Hotjar ID
        hjsv: '6',
        enabled: false // Enable if you use Hotjar
      }
    });
  }, []);
  const [user, setUser] = useState<User>({ name: authUser?.firstName || "User", email: authUser?.email || "" });
  const [accounts, setAccounts] = useState<any[]>([]);
  // Şirket bilgisi: önce varsayılan, ardından asenkron olarak secureStorage/localStorage'dan yükle
  const [company, setCompany] = useState<CompanyProfile>(() => defaultCompany);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tid = (localStorage.getItem('tenantId') || '') as string;
        const secureKey = tid ? `companyProfile_${tid}` : 'companyProfile';
        const fromSecure = await secureStorage.getJSON<CompanyProfile>(secureKey);
        let loaded: CompanyProfile | null = fromSecure;
        if (!loaded) {
          try {
            const localKey = tid ? `companyProfile_${tid}` : 'companyProfile';
            const raw = localStorage.getItem(localKey) || localStorage.getItem(`${localKey}_plain`) || localStorage.getItem('company');
            loaded = raw ? (JSON.parse(raw) as CompanyProfile) : null;
          } catch {}
        }
        if (!cancelled && loaded) {
          setCompany({ ...defaultCompany, ...loaded! });
          // Eğer şifreli kayıt yoksa ama düz kayıt varsa, bir defaya mahsus migrate et
          if (!fromSecure) {
            try { await secureStorage.setJSON(secureKey, loaded); } catch {}
          }
        }
      } catch (e) {
        // yoksay
      }
    })();
    const handler = () => {
      // Diğer sekmelerden güncelleme geldiğinde tekrar yükle
      (async () => {
        try {
          const tid = (localStorage.getItem('tenantId') || '') as string;
          const secureKey = tid ? `companyProfile_${tid}` : 'companyProfile';
          const fromSecure = await secureStorage.getJSON<CompanyProfile>(secureKey);
          if (fromSecure) { setCompany({ ...defaultCompany, ...fromSecure }); return; }
          const localKey = tid ? `companyProfile_${tid}` : 'companyProfile';
          const raw = localStorage.getItem(localKey) || localStorage.getItem(`${localKey}_plain`) || localStorage.getItem('company');
          if (raw) {
            const parsed = JSON.parse(raw) as CompanyProfile;
            setCompany({ ...defaultCompany, ...parsed });
            // Not: Event sırasında secureStorage'a tekrar yazmıyoruz (gereksiz ağır işlem ve olası döngüler)
          }
        } catch {}
      })();
    };
    window.addEventListener('company-profile-updated', handler as EventListener);
    return () => { cancelled = true; window.removeEventListener('company-profile-updated', handler as EventListener); };
  }, []);

  // Backend'den tenant şirket profilini yükle ve local cache'i override et
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token || !isAuthenticated) return;
        const { tenantsApi } = await import('./api/tenants');
        const me = await tenantsApi.getMyTenant();
        if (!me) return;
        const brand = ((me.settings || {}) as any)?.brand || {};

        // One-time migration: If backend has empty brand/legal but we have richer local cache, push it to backend
        try {
          const tid = (localStorage.getItem('tenantId') || tenant?.id || '') as string;
          const secureKey = tid ? `companyProfile_${tid}` : 'companyProfile';
          const cached: CompanyProfile | null = await secureStorage.getJSON<CompanyProfile>(secureKey).catch(() => null);
          const cachedFallback = (() => {
            try {
              const localKey = tid ? `companyProfile_${tid}` : 'companyProfile';
              const raw = localStorage.getItem(localKey) || localStorage.getItem(`${localKey}_plain`) || localStorage.getItem('company');
              return raw ? (JSON.parse(raw) as CompanyProfile) : null;
            } catch { return null; }
          })();
          const localRich = cached || cachedFallback;

          const backendHasBrand = Boolean(brand?.logoDataUrl || brand?.bankAccountId || brand?.country);
          const backendHasLegal = Boolean(
            me?.taxNumber || me?.taxOffice || me?.address || me?.phone || me?.email || me?.website ||
            (me as any)?.siretNumber || (me as any)?.sirenNumber || (me as any)?.tvaNumber || (me as any)?.apeCode || (me as any)?.rcsNumber ||
            (me as any)?.steuernummer || (me as any)?.umsatzsteuerID || (me as any)?.handelsregisternummer || (me as any)?.geschaeftsfuehrer ||
            (me as any)?.einNumber || (me as any)?.taxId || (me as any)?.businessLicenseNumber || (me as any)?.stateOfIncorporation
          );

          const localHasUseful = Boolean(localRich && (
            localRich.logoDataUrl || localRich.taxNumber || localRich.taxOffice || localRich.address || localRich.phone || localRich.email || localRich.website ||
            (localRich as any).siretNumber || (localRich as any).sirenNumber || (localRich as any).tvaNumber || (localRich as any).apeCode || (localRich as any).rcsNumber ||
            (localRich as any).steuernummer || (localRich as any).umsatzsteuerID || (localRich as any).handelsregisternummer || (localRich as any).geschaeftsfuehrer ||
            (localRich as any).einNumber || (localRich as any).taxId || (localRich as any).businessLicenseNumber || (localRich as any).stateOfIncorporation
          ));

          if (localHasUseful && !backendHasBrand && !backendHasLegal) {
            // Push local → backend
            try {
              await tenantsApi.updateMyTenant({
                companyName: me?.companyName || localRich!.name || undefined,
                address: localRich!.address || undefined,
                taxNumber: localRich!.taxNumber || undefined,
                taxOffice: localRich!.taxOffice || undefined,
                phone: localRich!.phone || undefined,
                email: localRich!.email || undefined,
                website: localRich!.website || undefined,
                siretNumber: (localRich as any).siretNumber || undefined,
                sirenNumber: (localRich as any).sirenNumber || undefined,
                apeCode: (localRich as any).apeCode || undefined,
                tvaNumber: (localRich as any).tvaNumber || undefined,
                rcsNumber: (localRich as any).rcsNumber || undefined,
                steuernummer: (localRich as any).steuernummer || undefined,
                umsatzsteuerID: (localRich as any).umsatzsteuerID || undefined,
                handelsregisternummer: (localRich as any).handelsregisternummer || undefined,
                geschaeftsfuehrer: (localRich as any).geschaeftsfuehrer || undefined,
                einNumber: (localRich as any).einNumber || undefined,
                taxId: (localRich as any).taxId || undefined,
                businessLicenseNumber: (localRich as any).businessLicenseNumber || undefined,
                stateOfIncorporation: (localRich as any).stateOfIncorporation || undefined,
                settings: {
                  brand: {
                    logoDataUrl: localRich!.logoDataUrl || '',
                    bankAccountId: localRich!.bankAccountId || undefined,
                    country: (localRich as any).country || '',
                  }
                } as any,
              } as any);
              // Reload tenant after migration
              const me2 = await tenantsApi.getMyTenant();
              if (me2) {
                (me as any).settings = me2.settings;
                (me as any).address = me2.address; (me as any).taxNumber = me2.taxNumber; (me as any).taxOffice = me2.taxOffice;
                (me as any).phone = me2.phone; (me as any).email = me2.email; (me as any).website = me2.website;
                Object.assign(me, {
                  siretNumber: (me2 as any).siretNumber,
                  sirenNumber: (me2 as any).sirenNumber,
                  apeCode: (me2 as any).apeCode,
                  tvaNumber: (me2 as any).tvaNumber,
                  rcsNumber: (me2 as any).rcsNumber,
                  steuernummer: (me2 as any).steuernummer,
                  umsatzsteuerID: (me2 as any).umsatzsteuerID,
                  handelsregisternummer: (me2 as any).handelsregisternummer,
                  geschaeftsfuehrer: (me2 as any).geschaeftsfuehrer,
                  einNumber: (me2 as any).einNumber,
                  taxId: (me2 as any).taxId,
                  businessLicenseNumber: (me2 as any).businessLicenseNumber,
                  stateOfIncorporation: (me2 as any).stateOfIncorporation,
                });
              }
            } catch { /* migration best-effort */ }
          }
        } catch { /* ignore migration errors */ }

        const updated: CompanyProfile = {
          name: me.companyName || me.name || '',
          address: me.address || '',
          taxNumber: me.taxNumber || '',
          taxOffice: me.taxOffice || '',
          phone: me.phone || '',
          email: me.email || '',
          website: me.website || '',
          logoDataUrl: brand.logoDataUrl || '',
          bankAccountId: brand.bankAccountId || brand.defaultBankAccountId || undefined,
          country: brand.country || undefined,
          // Legal fields
          mersisNumber: (me as any).mersisNumber || '',
          kepAddress: (me as any).kepAddress || '',
          siretNumber: (me as any).siretNumber || '',
          sirenNumber: (me as any).sirenNumber || '',
          apeCode: (me as any).apeCode || '',
          tvaNumber: (me as any).tvaNumber || '',
          rcsNumber: (me as any).rcsNumber || '',
          steuernummer: (me as any).steuernummer || '',
          umsatzsteuerID: (me as any).umsatzsteuerID || '',
          handelsregisternummer: (me as any).handelsregisternummer || '',
          geschaeftsfuehrer: (me as any).geschaeftsfuehrer || '',
          einNumber: (me as any).einNumber || '',
          taxId: (me as any).taxId || '',
          businessLicenseNumber: (me as any).businessLicenseNumber || '',
          stateOfIncorporation: (me as any).stateOfIncorporation || '',
        } as any;
        if (!cancelled) {
          setCompany(updated);
          try {
            const tid = (localStorage.getItem('tenantId') || '') as string;
            const secureKey = tid ? `companyProfile_${tid}` : 'companyProfile';
            await secureStorage.setJSON(secureKey, updated);
            window.dispatchEvent(new Event('company-profile-updated'));
          } catch {}
        }
      } catch (e) {
        // Sessizce geç
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated]);
  const [notifications, setNotifications] = useState<HeaderNotification[]>(() => {
    // localStorage'dan (tenant'a özel) yükle, yoksa initialNotifications kullan
    const tid = localStorage.getItem('tenantId') || '';
    const key = tid ? `notifications_${tid}` : 'notifications';
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Eski notification'ların ID'lerini yeniden oluştur (duplicate key önleme)
        return parsed.map((notif: HeaderNotification, index: number) => ({
          ...notif,
          id: notif.relatedId 
            ? `${notif.relatedId}-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`
            : `notif-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`
        }));
      } catch (e) {
        console.error('Notifications parse error:', e);
      }
    }
    return initialNotifications;
  });
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
  const [showQuoteViewModal, setShowQuoteViewModal] = useState(false);
  const [showQuoteEditModal, setShowQuoteEditModal] = useState(false);
  const [showBankViewModal, setShowBankViewModal] = useState(false);
  const [showCustomerHistoryModal, setShowCustomerHistoryModal] = useState(false);
  const [showSupplierHistoryModal, setShowSupplierHistoryModal] = useState(false);
  const [showQuoteCreateModal, setShowQuoteCreateModal] = useState(false);

  // New Invoice Flow States
  const [showInvoiceTypeModal, setShowInvoiceTypeModal] = useState(false);
  const [showExistingSaleModal, setShowExistingSaleModal] = useState(false);
  const [showInvoiceFromSaleModal, setShowInvoiceFromSaleModal] = useState(false);
  // Müşteri detayından fatura akışına geçerken ön-seçili müşteri
  const [preselectedCustomerForInvoice, setPreselectedCustomerForInvoice] = useState<any | null>(null);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [deleteWarningData, setDeleteWarningData] = useState<{
    title: string;
    message: string;
    relatedItems: any[];
    itemType: 'invoice' | 'expense';
  } | null>(null);
  const [selectedSaleForInvoice, setSelectedSaleForInvoice] = useState<any>(null);

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [selectedQuote, setSelectedQuote] = useState<QuoteModel | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [supplierForExpense, setSupplierForExpense] = useState<any>(null);

  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productCategories, setProductCategories] = useState<string[]>(() => initialProductCategories);
  const [productCategoryObjects, setProductCategoryObjects] = useState<ProductCategory[]>(() => initialProductCategoryObjects);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [_isLoadingData, setIsLoadingData] = useState(true);
  const [infoModal, setInfoModal] = useState<{ title: string; message: string; tone?: 'success' | 'error' | 'info'; confirmLabel?: string; onConfirm?: () => void; cancelLabel?: string; onCancel?: () => void } | null>(null);
  const [publicQuoteId, setPublicQuoteId] = useState<string | null>(null);

  // Load data from backend on mount
  useEffect(() => {
    // Public link path detection (no auth required)
    try {
      const path = window.location.pathname || '';
      const match = path.match(/\/public\/quote\/(.+)$/);
      if (match && match[1]) {
        setPublicQuoteId(decodeURIComponent(match[1]));
      }
    } catch {}

    const loadData = async () => {
      // Check if we have auth token
      const token = localStorage.getItem('auth_token');
      if (!token || !isAuthenticated) {
        console.log('⚠️ Token yok veya authenticated değil, state temizleniyor');
        // Logout durumunda state'i temizle
        setCustomers([]);
        setSuppliers([]);
        setProducts([]);
        setInvoices([]);
        setExpenses([]);
        setIsLoadingData(false);
        return;
      }
      try {
        setIsLoadingData(true);
        console.log('🔄 Backend verisi yükleniyor...');
        
        // API isteklerini sıralı olarak gönder (rate limiting'i önlemek için)
        console.log('📊 Customers yükleniyor...');
        const customersData = await customersApi.getCustomers();
        
        console.log('🏭 Suppliers yükleniyor...');
        const suppliersData = await suppliersApi.getSuppliers();
        
        console.log('📦 Products yükleniyor...');
        const productsData = await productsApi.getProducts();
        
        console.log('🧾 Invoices yükleniyor...');
        const invoicesData = await invoicesApi.getInvoices();
        
        console.log('💸 Expenses yükleniyor...');
        const expensesData = await expensesApi.getExpenses();

        console.log('🛒 Sales yükleniyor...');
        let salesData: any[] = [];
        try {
          salesData = await salesApi.getSales();
        } catch (e) {
          console.warn('Sales yüklenemedi, offline cache kullanılacak:', e);
        }
        
        console.log('🏷️ Categories yükleniyor...');
        const categoriesData = await import('./api/product-categories').then(({ productCategoriesApi }) => productCategoriesApi.getAll());

        console.log('✅ Backend verisi yüklendi. Raw data:', {
          customers: customersData,
          suppliers: suppliersData,
          products: productsData,
          invoices: invoicesData,
          expenses: expensesData,
          categories: categoriesData,
          sales: salesData
        });

        // Verilerin array olduğundan emin olalım
        const safeCustomersData = Array.isArray(customersData) ? customersData : [];
        const safeSuppliersData = Array.isArray(suppliersData) ? suppliersData : [];
        const safeProductsData = Array.isArray(productsData) ? productsData : [];
        const safeInvoicesData = Array.isArray(invoicesData) ? invoicesData : [];
        const safeExpensesData = Array.isArray(expensesData) ? expensesData : [];
        const safeCategoriesData = Array.isArray(categoriesData) ? categoriesData : [];

        console.log('✅ Güvenli veri boyutları:', {
          customers: safeCustomersData.length,
          suppliers: safeSuppliersData.length,
          products: safeProductsData.length,
          invoices: safeInvoicesData.length,
          expenses: safeExpensesData.length,
          categories: safeCategoriesData.length
        });

        setCustomers(safeCustomersData);
        setSuppliers(safeSuppliersData);
        
        // Kategori objelerini state'e kaydet
        setProductCategoryObjects(safeCategoriesData);
        
        // String array kategorileri de güncelle (geriye uyumluluk için)
        const categoryNames = safeCategoriesData.map((c: ProductCategory) => c.name);
        setProductCategories(prev => {
          const combined = new Set([...prev, ...categoryNames]);
          return Array.from(combined);
        });
        
        // Map backend product fields to frontend format
        const mappedProducts = safeProductsData.map((p: any) => ({
          ...p,
          sku: p.code,
          unitPrice: Number(p.price) || 0,
          costPrice: Number(p.cost) || 0,
          stockQuantity: Number(p.stock) || 0,
          reorderLevel: Number(p.minStock) || 0,
          taxRate: Number(p.taxRate) || 0, // KDV oranı (decimal -> number)
          categoryTaxRateOverride: p.categoryTaxRateOverride ? Number(p.categoryTaxRateOverride) : null, // Özel KDV
          status: p.stock === 0 ? 'out-of-stock' : p.stock <= p.minStock ? 'low' : 'active'
        }));
        setProducts(mappedProducts);
        
        // Map backend expense fields to frontend format (supplier normalizasyonu dahil)
        const mappedExpenses = safeExpensesData.map((e: any) => {
          let supplier: any = null;
          if (e && typeof e.supplier === 'object' && e.supplier !== null) {
            supplier = e.supplier;
          } else if (typeof e?.supplier === 'string' && e.supplier.trim()) {
            supplier = { name: String(e.supplier).trim() };
          } else if (typeof e?.supplierName === 'string' && e.supplierName.trim()) {
            supplier = { name: String(e.supplierName).trim() };
          }
          const nameNorm = String(supplier?.name || '').trim().toLowerCase();
          if (['nosupplier','no supplier','tedarikçi yok','kein lieferant','aucun fournisseur'].includes(nameNorm)) {
            supplier = null;
          }
          return {
            ...e,
            supplier,
            expenseDate: typeof e.expenseDate === 'string' ? e.expenseDate : new Date(e.expenseDate).toISOString().split('T')[0],
            dueDate: e.dueDate || e.expenseDate,
          };
        });
        
        setInvoices(safeInvoicesData);
        setExpenses(mappedExpenses);
        if (Array.isArray(salesData)) {
          // Satışları haritalarken müşteri adını ve temel ürün alanlarını doldur
          // Öncelik: backend s.customer?.name -> s.customerName -> customers listesinden s.customerId eşleşmesi
          const mappedSales = salesData.map((s: any) => {
            const customerNameFromRel = s?.customer?.name;
            const customerNameFromSelf = s?.customerName;
            const customerFromList = s?.customerId
              ? (safeCustomersData.find((c: any) => String(c.id) === String(s.customerId)))
              : undefined;
            const customerName = customerNameFromRel || customerNameFromSelf || customerFromList?.name || '';
            const customerEmail = s?.customerEmail || customerFromList?.email || '';

            const firstItem = Array.isArray(s?.items) && s.items.length > 0 ? s.items[0] : undefined;
            const productId = s?.productId || firstItem?.productId;
            const productName = s?.productName || firstItem?.productName || firstItem?.description || '';
            const quantity = Number(s?.quantity ?? firstItem?.quantity ?? 1);
            let unitPrice = Number(s?.unitPrice ?? firstItem?.unitPrice ?? 0);
            // Ürün birimini ürün listemizden bulmaya çalış
            const productObj = productId ? mappedProducts.find((p: any) => String(p.id) === String(productId)) : undefined;
            const productUnit = s?.productUnit || productObj?.unit || '';
            // unitPrice yoksa subtotal/quantity ile tahmin et
            if ((!Number.isFinite(unitPrice) || unitPrice === 0) && Number.isFinite(Number(s?.subtotal)) && quantity > 0) {
              unitPrice = Number(s.subtotal) / quantity;
            }

            const normalizedStatus = (() => {
              const raw = String(s?.status || '').toLowerCase();
              if (raw === 'created' || raw === 'invoiced') return 'completed';
              if (raw === 'refunded') return 'cancelled';
              if (raw === 'cancelled' || raw === 'completed' || raw === 'pending') return raw;
              return 'completed';
            })();

            return {
              ...s,
              customerName,
              customerEmail,
              productId,
              productName,
              productUnit,
              quantity,
              unitPrice,
              date: s.saleDate ? String(s.saleDate).slice(0, 10) : s.date,
              amount: Number(s.total ?? s.amount ?? 0),
              status: normalizedStatus,
            };
          });
          setSales(mappedSales);
        }
        // Debug: log a sample of expenses to inspect status/amount values
        console.log('🔎 Loaded expenses sample (first 10):', mappedExpenses.slice(0, 10).map(e => ({ id: e.id, amount: e.amount, status: e.status, expenseDate: e.expenseDate })));
        
        // Cache all data to localStorage for persistence
        localStorage.setItem('customers_cache', JSON.stringify(safeCustomersData));
        localStorage.setItem('suppliers_cache', JSON.stringify(safeSuppliersData));
        localStorage.setItem('products_cache', JSON.stringify(mappedProducts));
        localStorage.setItem('invoices_cache', JSON.stringify(safeInvoicesData));
        localStorage.setItem('expenses_cache', JSON.stringify(safeExpensesData));
        if (Array.isArray(salesData)) {
          const tid = localStorage.getItem('tenantId') || '';
          const cacheKey = tid ? `sales_cache_${tid}` : 'sales_cache';
          try { localStorage.setItem(cacheKey, JSON.stringify(salesData)); } catch {}
        }
        
        console.log('💾 Tüm veriler localStorage\'a kaydedildi');
      } catch (error) {
        console.error('❌ Backend veri yükleme hatası:', error);
        showToast('Veriler yüklenirken hata oluştu', 'error');
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
  }, [isAuthenticated]); // isAuthenticated değiştiğinde tekrar yükle

  // Save Bank, Sales, and Invoices cache to localStorage
  useEffect(() => {
    if (bankAccounts.length > 0) {
      localStorage.setItem('bankAccounts', JSON.stringify(bankAccounts));
    }
  }, [bankAccounts]);

  // Logout sırasında storage'ı yanlışlıkla boş listeyle ezmemek için bayrak
  const suppressSalesPersistenceRef = React.useRef(false);

  useEffect(() => {
    // Her değişimde localStorage'ı güncelle (boş liste dahil)
    // Ancak logout akışında state temizlenirken storage'ı EZME!
    if (suppressSalesPersistenceRef.current) return;
    try {
      const tid = (tenant?.id || authUser?.tenantId || localStorage.getItem('tenantId') || '') as string;
      const key = tid ? `sales_${tid}` : 'sales';
      const keyBackup = tid ? `sales_backup_${tid}` : 'sales_backup';
      const keyTs = tid ? `sales_last_seen_ts_${tid}` : 'sales_last_seen_ts';
      localStorage.setItem(key, JSON.stringify(sales));
      // Yedeği HER ZAMAN mevcut state ile senkron tut (boş liste dahil)
      localStorage.setItem(keyBackup, JSON.stringify(Array.isArray(sales) ? sales : []));
      localStorage.setItem(keyTs, String(Date.now()));
    } catch {}
  }, [sales, tenant?.id, authUser?.tenantId]);

  // Satışlar için geriye dönük göç: mevcut tenant anahtarında veri yoksa diğer anahtarlardaki satışları içeri al
  useEffect(() => {
    try {
      const tid = (tenant?.id || authUser?.tenantId || localStorage.getItem('tenantId') || '') as string;
      const currentKey = tid ? `sales_${tid}` : 'sales';
      const currentCacheKey = tid ? `sales_cache_${tid}` : 'sales_cache';
      const hasCurrent = (() => {
        const a = localStorage.getItem(currentKey);
        const b = localStorage.getItem(currentCacheKey);
        const arrA = a ? JSON.parse(a) : [];
        const arrB = b ? JSON.parse(b) : [];
        return (Array.isArray(arrA) && arrA.length > 0) || (Array.isArray(arrB) && arrB.length > 0);
      })();
      if (hasCurrent) return; // mevcut tenant için veri var

      const collected: any[] = [];
      // Eski genel anahtarlar
      try {
        const legacyA = localStorage.getItem('sales');
        if (legacyA) {
          const arr = JSON.parse(legacyA);
          if (Array.isArray(arr)) collected.push(...arr);
        }
      } catch {}
      try {
        const legacyB = localStorage.getItem('sales_cache');
        if (legacyB) {
          const arr = JSON.parse(legacyB);
          if (Array.isArray(arr)) collected.push(...arr);
        }
      } catch {}
      // Diğer tenant anahtarları
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || '';
        if (!(k.startsWith('sales_') || k.startsWith('sales_cache_'))) continue;
        if (k === currentKey || k === currentCacheKey) continue;
        try {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) collected.push(...arr);
        } catch {}
      }
      if (collected.length === 0) return;
      // Tekilleştir (saleNumber,id)
      const uniq = new Map<string, any>();
      collected.forEach((s: any) => {
        const key = `${s?.saleNumber || ''}#${s?.id || ''}`;
        if (!uniq.has(key)) uniq.set(key, s);
      });
      const migrated = Array.from(uniq.values());
      // Mevcut tenant anahtarlarına yaz ve state'e yükle (eğer state boşsa)
      try { localStorage.setItem(currentCacheKey, JSON.stringify(migrated)); } catch {}
      if (!Array.isArray(sales) || sales.length === 0) {
        setSales(migrated);
      }
    } catch {}
  // Bu efekt sadece tenant veya auth kullanıcısı değiştiğinde çalışsın
  }, [tenant?.id, authUser?.tenantId]);
  
  useEffect(() => {
    if (invoices.length > 0) {
      localStorage.setItem('invoices_cache', JSON.stringify(invoices));
    }
  }, [invoices]);

  // � Bildirimleri localStorage'a kaydet
  useEffect(() => {
    const tid = localStorage.getItem('tenantId') || '';
    const key = tid ? `notifications_${tid}` : 'notifications';
    try { localStorage.setItem(key, JSON.stringify(notifications)); } catch {}
  }, [notifications]);

  // �🔄 AuthContext'deki user değiştiğinde App.tsx'deki user state'ini güncelle
  useEffect(() => {
    if (authUser) {
      // Display name için daha sağlam fallback: firstName/lastName yoksa eski adı koru
      const fullNameRaw = `${authUser.firstName || ''} ${authUser.lastName || ''}`.trim();
      let displayName = fullNameRaw;
      if (!displayName) {
        // localStorage'daki user objesinden birleştir (varsa)
        try {
          const lsUser = localStorage.getItem('user');
          if (lsUser) {
            const parsed = JSON.parse(lsUser);
            const fromLs = `${parsed?.firstName || ''} ${parsed?.lastName || ''}`.trim() || parsed?.name || '';
            if (fromLs) displayName = fromLs;
          }
        } catch {}
      }
      setUser(prev => ({
        name: displayName || prev.name || 'User',
        email: authUser.email || prev.email || '',
      }));
      console.log('🔄 authUser değişti, App.tsx user state güncelleniyor:', {
        name: displayName || 'User',
        email: authUser.email || '',
      });
      // Tenant bilgisini localStorage'a da yaz (fallback için)
      try {
        if (authUser.tenantId != null) {
          localStorage.setItem('tenantId', String(authUser.tenantId));
        }
      } catch {}
    }
  }, [authUser]);

  // Cross-tab senkron: başka sekmede sales değişirse state'i güncelle
    React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      const tid = (tenant?.id || authUser?.tenantId || localStorage.getItem('tenantId') || '') as string;
      const key = tid ? `sales_${tid}` : 'sales';
      const cacheKey = tid ? `sales_cache_${tid}` : 'sales_cache';
      // backupKey kullanılmıyor: bilinçli silmelerin geri gelmesini engelle
      if (e.key === key || e.key === cacheKey) {
        try {
          const a = localStorage.getItem(key);
          const b = localStorage.getItem(cacheKey);
          const arrA = a ? JSON.parse(a) : [];
          const arrB = b ? JSON.parse(b) : [];
          const merged = [...(Array.isArray(arrA) ? arrA : []), ...(Array.isArray(arrB) ? arrB : [])];
          // Önce (saleNumber,id) ile tekilleştir
          const uniq = new Map<string, any>();
          merged.forEach((s: any) => {
            const k = `${s.saleNumber || ''}#${s.id || ''}`;
            if (!uniq.has(k)) uniq.set(k, s);
          });
              const next = Array.from(uniq.values());
              // Artık boş liste gelirse yedekten RESTORE ETME — kullanıcı silmiş olabilir
              setSales(next);
        } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Cache yükleme: Auth yoksa da satışları kaybetmemek için en azından sales'i yükle
    useEffect(() => {
    // Authentication kontrolü - token yoksa veya authenticated değilse ÇIKIŞ
    const token = localStorage.getItem('auth_token');
    if (!token || !isAuthenticated) {
      console.log('🔒 Kullanıcı authenticated değil - offline sales yükleniyor');
      try {
        const savedSales = localStorage.getItem('sales');
        if (savedSales) {
          const salesData = JSON.parse(savedSales);
          if (Array.isArray(salesData)) {
            setSales(salesData);
            console.log('✅ Offline satışlar yüklendi:', salesData.length);
          }
        }
      } catch (e) {
        console.error('Offline sales load error:', e);
      }
      setIsLoadingData(false);
      return;
    }

  console.log('📂 localStorage cache yükleniyor (authenticated user)...');
  const savedBanks = localStorage.getItem('bankAccounts');
  const tid = (tenant?.id || authUser?.tenantId || localStorage.getItem('tenantId') || '') as string;
  const salesKey = tid ? `sales_${tid}` : 'sales';
  const salesCacheKey = tid ? `sales_cache_${tid}` : 'sales_cache';
  // Authenticated kullanıcıda backup'tan otomatik geri yükleme yapmayacağız
  const savedSales = localStorage.getItem(salesKey);
  const savedSalesCache = localStorage.getItem(salesCacheKey);
    const savedCustomers = localStorage.getItem('customers_cache');
    const savedSuppliers = localStorage.getItem('suppliers_cache');
    const savedProducts = localStorage.getItem('products_cache');
  const savedInvoices = localStorage.getItem('invoices_cache');
  const savedExpenses = localStorage.getItem('expenses_cache');
    
    if (savedBanks) {
      try {
        const banks = JSON.parse(savedBanks);
        console.log('✅ Bankalar cache\'den yüklendi:', banks.length);
        setBankAccounts(banks);
      } catch (e) {
        console.error('Error loading banks:', e);
      }
    }
    
    if (savedSales || savedSalesCache) {
      try {
        const salesDataA = savedSales ? JSON.parse(savedSales) : [];
        const salesDataB = savedSalesCache ? JSON.parse(savedSalesCache) : [];
        const salesData = Array.isArray(salesDataA) || Array.isArray(salesDataB)
          ? [...(Array.isArray(salesDataA)? salesDataA: []), ...(Array.isArray(salesDataB)? salesDataB: [])]
          : [];
        // Not: Artık yalnızca tenant'a özel anahtarlardan okuyoruz; ek filtre veya migrasyona gerek yok
        let filteredSales = salesData;

        // Aynı (saleNumber,id) kombinasyonlarına göre birleştir (union)
        const byKey = new Map<string, any>();
        for (const s of filteredSales) {
          const k = `${s.saleNumber || ''}#${s.id || ''}`;
          if (!byKey.has(k)) byKey.set(k, s);
        }
        filteredSales = Array.from(byKey.values());

        // Aynı ID ile birden fazla kayıt varsa benzersiz ID üret
        const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        const seen = new Set<string>();
        const deduped = filteredSales.map((s: any) => {
          const sid = String(s?.id ?? '');
          if (!sid || seen.has(sid)) {
            const newId = genId();
            return { ...s, id: newId };
          }
          seen.add(sid);
          return { ...s, id: sid };
        });

        // Cache'ten yüklenen satışları da müşteri adı ile zenginleştir
        let customersFromCache: any[] = [];
        try {
          customersFromCache = savedCustomers ? JSON.parse(savedCustomers) : [];
          if (!Array.isArray(customersFromCache)) customersFromCache = [];
        } catch {
          customersFromCache = [];
        }
        const hydrated = deduped.map((s: any) => {
          const customerNameFromRel = s?.customer?.name;
          const customerNameFromSelf = s?.customerName;
          const customerNameFromList = s?.customerId
            ? (customersFromCache.find((c: any) => String(c.id) === String(s.customerId))?.name)
            : undefined;
          const customerEmailFromList = s?.customerId
            ? (customersFromCache.find((c: any) => String(c.id) === String(s.customerId))?.email)
            : undefined;
          const customerName = customerNameFromRel || customerNameFromSelf || customerNameFromList || '';
          const customerEmail = s?.customerEmail || customerEmailFromList || '';

          // Ürün alanlarını items üzerinden doldur
          const firstItem = Array.isArray(s?.items) && s.items.length > 0 ? s.items[0] : undefined;
          const productId = s?.productId || firstItem?.productId;
          const productName = s?.productName || firstItem?.productName || firstItem?.description || '';
          const quantity = Number(s?.quantity ?? firstItem?.quantity ?? 1);
          let unitPrice = Number(s?.unitPrice ?? firstItem?.unitPrice ?? 0);
          if ((!Number.isFinite(unitPrice) || unitPrice === 0) && Number.isFinite(Number(s?.subtotal)) && quantity > 0) {
            unitPrice = Number(s.subtotal) / quantity;
          }

          const normalizedStatus = (() => {
            const raw = String(s?.status || '').toLowerCase();
            if (raw === 'created' || raw === 'invoiced') return 'completed';
            if (raw === 'refunded') return 'cancelled';
            if (raw === 'cancelled' || raw === 'completed' || raw === 'pending') return raw;
            return 'completed';
          })();

          return { ...s, customerName, customerEmail, productId, productName, quantity, unitPrice, status: normalizedStatus };
        });

        console.log('✅ Satışlar cache\'den yüklendi:', {
          total: (salesData || []).length,
          filtered: (filteredSales || []).length,
          unique: deduped.length
        });
        // Artık backup'tan otomatik geri yükleme yok — doğrudan hydrated veriyi kullan
        setSales(hydrated);
        // Not: Burada storage'ı geriye yazmıyoruz (potansiyel veri kaybını önlemek için)
        // Dedup sonucu daha kısa olabilir; kullanıcı onayı olmadan overwrite etmeyelim.
      } catch (e) {
        console.error('Error loading sales:', e);
      }
    }
    // Not: authenticated kullanıcıda backup'tan otomatik geri dönüş devre dışı
    
    if (savedCustomers) {
      try {
        const customersData = JSON.parse(savedCustomers);
        console.log('✅ Müşteriler cache\'den yüklendi:', customersData.length);
        setCustomers(customersData);
      } catch (e) {
        console.error('Error loading customers cache:', e);
      }
    }
    
    if (savedSuppliers) {
      try {
        const suppliersData = JSON.parse(savedSuppliers);
        console.log('✅ Tedarikçiler cache\'den yüklendi:', suppliersData.length);
        setSuppliers(suppliersData);
      } catch (e) {
        console.error('Error loading suppliers cache:', e);
      }
    }
    
    if (savedProducts) {
      try {
        const productsData = JSON.parse(savedProducts);
        // Ensure it's an array
        const safeProductsData = Array.isArray(productsData) ? productsData : [];
        console.log('✅ Ürünler cache\'den yüklendi:', safeProductsData.length);
        // Ensure numeric values
        const normalizedProducts = safeProductsData.map((p: any) => ({
          ...p,
          unitPrice: Number(p.unitPrice) || 0,
          costPrice: Number(p.costPrice) || 0,
          stockQuantity: Number(p.stockQuantity) || 0,
          reorderLevel: Number(p.reorderLevel) || 0,
        }));
        setProducts(normalizedProducts);
      } catch (e) {
        console.error('Error loading products cache:', e);
      }
    }
    
    if (savedInvoices) {
      try {
        const invoicesData = JSON.parse(savedInvoices);
        console.log('✅ Faturalar cache\'den yüklendi:', invoicesData.length);
        setInvoices(invoicesData);
      } catch (e) {
        console.error('Error loading invoices cache:', e);
      }
    }
    
    if (savedExpenses) {
      try {
        const expensesData = JSON.parse(savedExpenses);
        console.log('✅ Giderler cache\'den yüklendi:', expensesData.length);
        // Ensure proper format for expenseDate
        const mappedExpenses = expensesData.map((e: any) => {
          const expenseDate = typeof e.expenseDate === 'string' ? e.expenseDate : 
            (e.expenseDate ? new Date(e.expenseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
          const dueDate = e.dueDate || e.expenseDate;
          // Supplier nesnesini koru; string geldiyse { name } şekline dönüştür
          let supplier: any = null;
          if (e && typeof e.supplier === 'object' && e.supplier !== null) {
            supplier = e.supplier;
          } else if (typeof e?.supplier === 'string' && e.supplier.trim()) {
            supplier = { name: String(e.supplier).trim() };
          } else if (typeof e?.supplierName === 'string' && e.supplierName.trim()) {
            supplier = { name: String(e.supplierName).trim() };
          }
          // 'noSupplier' gibi placeholder ise supplier'ı null yap
          const nameNorm = String(supplier?.name || '').trim().toLowerCase();
          if (['nosupplier','no supplier','tedarikçi yok','kein lieferant','aucun fournisseur'].includes(nameNorm)) {
            supplier = null;
          }
          return { ...e, expenseDate, dueDate, supplier };
        });
        setExpenses(mappedExpenses);
      } catch (e) {
        console.error('Error loading expenses cache:', e);
      }
    }
  }, [isAuthenticated]); // isAuthenticated değiştiğinde tekrar kontrol et

  // 🗑️ Okunmuş bildirimleri 1 gün sonra otomatik temizle (persistent olanları hariç)
  useEffect(() => {
    const cleanupOldNotifications = () => {
      const now = Date.now();
      const oneDayInMs = 24 * 60 * 60 * 1000; // 24 saat
      
      setNotifications(current => {
        const filtered = current.filter(n => {
          // Persistent bildirimleri asla silme
          if (n.persistent || n.repeatDaily) return true;
          
          // Okunmamış bildirimleri koru
          if (!n.read || !n.readAt) return true;
          
          // Okunma zamanından 1 gün geçmişse sil
          const ageInMs = now - n.readAt;
          return ageInMs < oneDayInMs;
        });
        
        // Persistent bildirimleri sıfırla (read: false yap) eğer 1 gün geçmişse
        const reset = filtered.map(n => {
          if ((n.persistent || n.repeatDaily) && n.read && n.readAt) {
            const ageInMs = now - n.readAt;
            if (ageInMs >= oneDayInMs) {
              console.log(`🔄 Kalıcı bildirim sıfırlandı: ${n.title}`);
              return { ...n, read: false, readAt: undefined };
            }
          }
          return n;
        });
        
        const removedCount = current.length - filtered.length;
        if (removedCount > 0) {
          console.log(`🗑️ ${removedCount} eski bildirim temizlendi`);
        }
        
        return reset;
      });
    };
    
    // Sayfa yüklendiğinde temizle
    cleanupOldNotifications();
    
    // Her 1 saatte bir kontrol et
    const interval = setInterval(cleanupOldNotifications, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const unreadNotificationCount = useMemo(
    () => notifications.filter(notification => !notification.read).length,
    [notifications]
  );

  // 🔔 Yaklaşan ve geçmiş ödemeler için bildirim kontrol et
  useEffect(() => {
    if (!isAuthenticated) return;
    const checkPaymentNotifications = () => {
      const allowInvoiceReminders = prefs.invoiceReminders !== false; // varsayılan: açık
      const allowExpenseAlerts = prefs.expenseAlerts !== false; // varsayılan: açık
      const allowLowStockAlerts = prefs.lowStockAlerts !== false; // varsayılan: açık

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayMs = today.getTime();
      const threeDaysLater = new Date(today);
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);
      
      // Faturaları kontrol et (tercih açık ise)
      if (allowInvoiceReminders) {
        invoices.forEach(invoice => {
          if (invoice.status === 'paid' || invoice.status === 'cancelled') return;
          
          const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
          if (!dueDate) return;
          
          dueDate.setHours(0, 0, 0, 0);
          const dueDateMs = dueDate.getTime();
          
          const customerName = invoice.customer?.name || 'Müşteri';
          const invoiceNumber = invoice.invoiceNumber || `#${invoice.id}`;
          
          if (dueDateMs < todayMs) {
            // Ödeme tarihi geçmiş
            const daysOverdue = Math.floor((todayMs - dueDateMs) / (1000 * 60 * 60 * 24));
            addNotification(
              'Gecikmiş fatura ödemesi',
              `${invoiceNumber} - ${customerName} (${daysOverdue} gün gecikmiş)`,
              'danger',
              'invoices',
              { persistent: true, repeatDaily: true, relatedId: `invoice-${invoice.id}` }
            );
          } else if (dueDateMs <= threeDaysLater.getTime()) {
            // 3 gün içinde ödeme
            const daysLeft = Math.ceil((dueDateMs - todayMs) / (1000 * 60 * 60 * 24));
            addNotification(
              'Yaklaşan fatura ödemesi',
              `${invoiceNumber} - ${customerName} (${daysLeft} gün kaldı)`,
              'warning',
              'invoices',
              { persistent: true, repeatDaily: true, relatedId: `invoice-${invoice.id}` }
            );
          }
        });
      }
      
      // Giderleri kontrol et (tercih açık ise)
      if (allowExpenseAlerts) {
        expenses.forEach(expense => {
          if (expense.status === 'paid' || expense.status === 'cancelled') return;
          
          const dueDate = expense.dueDate || expense.expenseDate ? new Date(expense.dueDate || expense.expenseDate) : null;
          if (!dueDate) return;
          
          dueDate.setHours(0, 0, 0, 0);
          const dueDateMs = dueDate.getTime();
          
          const supplierName = expense.supplier?.name || expense.supplier || 'Tedarikçi';
          const description = expense.description || 'Gider';
          
          if (dueDateMs < todayMs) {
            // Ödeme tarihi geçmiş
            const daysOverdue = Math.floor((todayMs - dueDateMs) / (1000 * 60 * 60 * 24));
            addNotification(
              'Gecikmiş gider ödemesi',
              `${description} - ${supplierName} (${daysOverdue} gün gecikmiş)`,
              'danger',
              'expenses',
              { persistent: true, repeatDaily: true, relatedId: `expense-${expense.id}` }
            );
          } else if (dueDateMs <= threeDaysLater.getTime()) {
            // 3 gün içinde ödeme
            const daysLeft = Math.ceil((dueDateMs - todayMs) / (1000 * 60 * 60 * 24));
            addNotification(
              'Yaklaşan gider ödemesi',
              `${description} - ${supplierName} (${daysLeft} gün kaldı)`,
              'warning',
              'expenses',
              { persistent: true, repeatDaily: true, relatedId: `expense-${expense.id}` }
            );
          }
        });
      }

      // Düşük stok kontrolü (ürün state'inden) - tercih açık ise
      if (allowLowStockAlerts) {
        try {
          const lowOrEmpty = products.filter(p => Number(p.stockQuantity || 0) <= Number(p.reorderLevel || 0));
          lowOrEmpty.forEach(p => {
            const stock = Number(p.stockQuantity || 0);
            const min = Number(p.reorderLevel || 0);
            if (stock <= 0) {
              addNotification('Stok tükendi', `${p.name} - Stok tükendi!`, 'danger', 'products', { persistent: true, repeatDaily: true, relatedId: `out-of-stock-${p.id}` });
            } else {
              addNotification('Düşük stok uyarısı', `${p.name} - Stok seviyesi minimum limitin altında! (${stock}/${min})`, 'warning', 'products', { persistent: true, repeatDaily: true, relatedId: `low-stock-${p.id}` });
            }
          });
        } catch {}
      }
    };
    
  // İlk yüklemede kontrol et
  checkPaymentNotifications();
    
    // Her gün sabah 9'da kontrol et
    const now = new Date();
    const tomorrow9am = new Date(now);
    tomorrow9am.setHours(9, 0, 0, 0);
    if (tomorrow9am <= now) {
      tomorrow9am.setDate(tomorrow9am.getDate() + 1);
    }
    
    const msUntil9am = tomorrow9am.getTime() - now.getTime();
    const timeout = setTimeout(() => {
      checkPaymentNotifications();
      // Her 24 saatte bir tekrarla
      setInterval(checkPaymentNotifications, 24 * 60 * 60 * 1000);
    }, msUntil9am);
    
    return () => clearTimeout(timeout);
  }, [invoices, expenses, products, isAuthenticated, prefs]);

  // Teklif (quote) hatırlatma bildirimi: süresi dolmak üzere / doldu
  useEffect(() => {
    if (!isAuthenticated) return;
    const loadAndNotifyQuotes = () => {
      try {
        const tid = (localStorage.getItem('tenantId') || 'default') as string;
        const key = tid ? `quotes_cache_${tid}` : 'quotes_cache';
        const raw = localStorage.getItem(key);
        const quotes = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(quotes)) return;
        if (prefs.quoteReminders === false) return;
        const today = new Date(); today.setHours(0,0,0,0);
        const todayMs = today.getTime();
        quotes.forEach((q: any) => {
          if (!q?.validUntil) return;
          const status = String(q.status || '').toLowerCase();
          if (['accepted','declined','expired'].includes(status)) return; // tamamlanmış veya geçersiz
          const due = new Date(q.validUntil); due.setHours(0,0,0,0);
          const dueMs = due.getTime();
          const diffDays = Math.ceil((dueMs - todayMs) / 86400000);
          if (dueMs < todayMs) {
            addNotification('Teklif süresi doldu', `${q.quoteNumber || 'Teklif'} - süre doldu`, 'danger', 'quotes', { persistent: true, repeatDaily: true, relatedId: `quote-expired-${q.id}` });
          } else if (diffDays <= 3) {
            addNotification('Teklif süresi yaklaşıyor', `${q.quoteNumber || 'Teklif'} - ${diffDays} gün kaldı`, 'warning', 'quotes', { persistent: true, repeatDaily: true, relatedId: `quote-due-${q.id}` });
          }
        });
      } catch (e) { /* sessiz */ }
    };
    loadAndNotifyQuotes();
    const interval = setInterval(loadAndNotifyQuotes, 6 * 60 * 60 * 1000); // 6 saatte bir
    return () => clearInterval(interval);
  }, [isAuthenticated, prefs]);

  const normalizeId = (value?: string | number) => String(value ?? Date.now());

  // URL hash routing for admin page
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      console.log('Hash değişti:', hash);
      if (hash === 'admin') {
        console.log('Admin sayfasına yönlendiriliyor...');
        setCurrentPage('admin');
      } else if (hash === 'register') {
        console.log('Kayıt sayfasına yönlendiriliyor...');
        setCurrentPage('register');
      } else if (hash === 'login') {
        console.log('Giriş sayfasına yönlendiriliyor...');
        setCurrentPage('login');
      } else if (hash === 'forgot-password') {
        console.log('Şifre sıfırlama isteği sayfasına yönlendiriliyor...');
        setCurrentPage('forgot-password');
      } else if (hash.startsWith('reset-password')) {
        console.log('Şifre sıfırlama sayfasına yönlendiriliyor...');
        // Keep token in hash; page will parse
        setCurrentPage('reset-password');
      } else if (hash.startsWith('verify-email')) {
        console.log('E-posta doğrulama sayfasına yönlendiriliyor...');
        setCurrentPage('verify-email');
      } else if (hash === 'verify-notice') {
        console.log('Doğrulama bilgilendirme sayfasına yönlendiriliyor...');
        setCurrentPage('verify-notice');
      } else if (hash === 'help') {
        console.log('Yardım Merkezi sayfasına yönlendiriliyor...');
        setCurrentPage('help');
      } else if (hash.startsWith('legal/')) {
        // Legal pages routing
        const legalPage = hash.replace('legal/', '');
        console.log('Legal sayfasına yönlendiriliyor:', legalPage);
        setCurrentPage(`legal-${legalPage}`);
      } else if (hash === 'settings/organization/members') {
        console.log('Organization members sayfasına yönlendiriliyor...');
        setCurrentPage('organization-members');
      } else if (hash.startsWith('join?token=')) {
        // Extract token from hash
        const token = hash.replace('join?token=', '');
        console.log('Join organization sayfasına yönlendiriliyor, token:', token);
        setCurrentPage(`join-organization:${token}`);
      } else if (hash === '') {
        // If no hash, show landing page for non-authenticated users, dashboard for authenticated
        if (isAuthenticated) {
          console.log('Authenticated user - Ana sayfaya yönlendiriliyor...');
          setCurrentPage('dashboard');
        } else {
          console.log('Non-authenticated user - Landing sayfasına yönlendiriliyor...');
          setCurrentPage('landing');
        }
      } else if (hash === 'about') {
        console.log('Hakkında sayfasına yönlendiriliyor...');
        setCurrentPage('about');
      } else if (hash === 'api') {
        console.log('API sayfasına yönlendiriliyor...');
        setCurrentPage('api');
      } else if (hash.startsWith('customer-history:')) {
        console.log('Müşteri geçmişi sayfasına yönlendiriliyor...');
        setCurrentPage(hash);
      }
    };

    // Check initial hash
    console.log('İlk hash kontrolü:', window.location.hash);
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [isAuthenticated]);

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

  // Global toast event listener (allows other modules to trigger toasts)
  useEffect(() => {
    const handler = (evt: Event) => {
      try {
        const ce = evt as CustomEvent<{ message?: string; tone?: ToastTone }>;
        const msg = ce?.detail?.message;
        const tone = (ce?.detail?.tone as ToastTone) || 'error';
        if (msg) {
          showToast(msg, tone);
        }
      } catch (e) {
        // no-op
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('showToast', handler as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('showToast', handler as EventListener);
      }
    };
  }, [showToast]);

  const confirmAction = (message: string) => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.confirm(message);
  };

  const handleCompanyUpdate = (updated: CompanyProfile) => {
    setCompany(updated);
    // Kalıcı saklama: secureStorage her zaman; düz localStorage yalnızca şifreleme kapalıysa
    try {
      const tid = (localStorage.getItem('tenantId') || '') as string;
      const secureKey = tid ? `companyProfile_${tid}` : 'companyProfile';
      void secureStorage.setJSON(secureKey, updated);
    } catch {}
    try {
      const encryptionEnabled = (import.meta as any)?.env?.VITE_ENABLE_ENCRYPTION === 'true';
      const tid = (localStorage.getItem('tenantId') || '') as string;
      const baseKey = tid ? `companyProfile_${tid}` : 'companyProfile';
      if (!encryptionEnabled) {
        localStorage.setItem(baseKey, JSON.stringify(updated));
      } else {
        // İsteğe bağlı: sade kopyayı ayrı anahtar altında tut (okumada fallback var)
        localStorage.setItem(`${baseKey}_plain`, JSON.stringify(updated));
      }
    } catch {}
    try { window.dispatchEvent(new Event('company-profile-updated')); } catch {}
  };

  // Plan bilgisi yardımcıları
  const getNormalizedPlan = React.useCallback(() => {
    const raw = String(tenant?.subscriptionPlan || '').toLowerCase();
    if (raw.includes('free')) return 'free';
    if (raw.includes('starter')) return 'free';
    if (raw.includes('basic')) return 'basic';
    if (raw.includes('pro')) return 'pro';
    if (raw.includes('professional')) return 'pro';
    return raw || 'free';
  }, [tenant?.subscriptionPlan]);

  const isFreePlan = React.useMemo(() => getNormalizedPlan() === 'free', [getNormalizedPlan]);

  const countInvoicesThisMonth = React.useCallback(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return invoices.filter((inv: any) => {
      if (inv?.isVoided) return false;
      const created = inv?.createdAt ? new Date(inv.createdAt) : (inv?.issueDate ? new Date(inv.issueDate) : null);
      if (!created || Number.isNaN(created.getTime())) return false;
      return created >= start && created <= end;
    }).length;
  }, [invoices]);

  const countExpensesThisMonth = React.useCallback(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return expenses.filter((exp: any) => {
      if (exp?.isVoided) return false;
      const created = exp?.createdAt ? new Date(exp.createdAt) : (exp?.expenseDate ? new Date(exp.expenseDate) : null);
      if (!created || Number.isNaN(created.getTime())) return false;
      return created >= start && created <= end;
    }).length;
  }, [expenses]);

  const handleToggleNotifications = () => {
    setIsNotificationsOpen(prev => {
      const next = !prev;
      if (!prev) {
        // Panel açılınca okunmamış bildirimleri okundu yap ve readAt ekle
        const now = Date.now();
        setNotifications(current =>
          current.map(notification =>
            notification.read 
              ? notification 
              : { ...notification, read: true, readAt: now }
          )
        );
      }
      return next;
    });
  };

  const handleCloseNotifications = () => setIsNotificationsOpen(false);

  const handleNotificationClick = (notification: HeaderNotification) => {
    console.log('🔔 Bildirime tıklandı:', notification);
    
    // Persistent/repeatDaily bildirimleri için özel işlem
    if (notification.persistent || notification.repeatDaily) {
      // Sadece okundu işaretle ama silme - ertesi gün tekrar gösterilecek
      const now = Date.now();
      setNotifications(current =>
        current.map(n =>
          n.id === notification.id 
            ? { ...n, read: true, readAt: now } 
            : n
        )
      );
      console.log('⏰ Kalıcı bildirim - ertesi gün tekrar görünecek');
    } else {
      // Normal bildirimleri okundu yap
      const now = Date.now();
      setNotifications(current =>
        current.map(n =>
          n.id === notification.id 
            ? { ...n, read: true, readAt: now } 
            : n
        )
      );
    }
    
    // Bildirim panelini kapat
    handleCloseNotifications();
    
    // Eğer link varsa o sayfaya git
    if (notification.link) {
      navigateTo(notification.link);
    }
  };

  const navigateTo = (page: string) => {
    setCurrentPage(page);
    setIsSidebarOpen(false);
    setIsNotificationsOpen(false);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Inline fatura güncellemelerini backend'e yaz ve cache'i güncelle
  const handleInlineUpdateInvoice = async (updated: any) => {
    try {
      const patch: any = {};
      if (typeof updated.status !== 'undefined') patch.status = updated.status;
      if (typeof updated.dueDate !== 'undefined') patch.dueDate = updated.dueDate;
      if (typeof updated.issueDate !== 'undefined') patch.issueDate = updated.issueDate;

      const saved = await invoicesApi.updateInvoice(String(updated.id), patch);
      setInvoices(prev => {
        const next = prev.map(inv => String(inv.id) === String(saved.id) ? saved : inv);
        // Cache'i güncelle
        try { localStorage.setItem('invoices_cache', JSON.stringify(next)); } catch {}
        return next;
      });
      showToast('Fatura güncellendi', 'success');
    } catch (error: any) {
      console.error('Inline invoice update error:', error);
      showToast(error?.response?.data?.message || 'Fatura güncellenemedi', 'error');
    }
  };

  const openSettingsOn = (tabId: string) => {
    setSettingsInitialTab(tabId);
    navigateTo('settings');
  };

  const handleLogout = () => {
    setCurrentPage('dashboard');
    handleCloseNotifications();
    // State'leri temizle
    // Storage'ı boş listeyle ezmemek için suppression aktif et
    suppressSalesPersistenceRef.current = true;
    setSales([]);
    setCustomers([]);
    setSuppliers([]);
    setProducts([]);
    setInvoices([]);
    setExpenses([]);
    setBankAccounts([]);
    logout();
    // Bir sonraki event loop'ta suppression'ı kaldır (UI state temiz ama storage korunur)
    setTimeout(() => { suppressSalesPersistenceRef.current = false; }, 0);
  };

  const handleToggleSidebar = () => setIsSidebarOpen(prev => !prev);
  const handleCloseSidebar = () => setIsSidebarOpen(false);

  // 🔔 Bildirim ekleme fonksiyonu
  const addNotification = (
    title: string,
    description: string,
    type: 'info' | 'warning' | 'success' | 'danger' = 'info',
    link?: string,
    options?: {
      persistent?: boolean;
      repeatDaily?: boolean;
      relatedId?: string;
    }
  ) => {
    // Kategori bazlı filtre: sadece talep edilenler
    const allowedCategories = new Set(['invoices', 'expenses', 'sales', 'products', 'quotes']);
    const category = link || '';
    const readPrefs = () => {
      try {
        const tid = (localStorage.getItem('tenantId') || 'default') as string;
        let uid = 'anon';
        const userRaw = localStorage.getItem('user');
        if (userRaw) {
          const u = JSON.parse(userRaw);
          uid = u?.id || u?._id || uid;
        }
        const key = `notif_prefs:${tid}:${uid}`;
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : {};
      } catch { return {}; }
    };

    // İzin verilmeyen kategorileri sessizce yoksay
    if (category && !allowedCategories.has(category)) {
      return;
    }
    // products: sadece low/out-of-stock ilgili bildirimlere izin ver
    if (category === 'products') {
      const rid = options?.relatedId || '';
      const isStockAlert = /^low-stock-|^out-of-stock-/.test(rid);
      if (!isStockAlert) {
        return; // yeni ürün vb. bildirimleri gösterme
      }
      const prefs = readPrefs();
      if (prefs?.lowStockAlerts === false) return;
    }
    if (category === 'sales') {
      const prefs = readPrefs();
      if (prefs?.salesNotifications === false) return;
    }
    if (category === 'quotes') {
      const prefs = readPrefs();
      if (prefs?.quoteReminders === false) return;
    }
    if (category === 'invoices') {
      const prefs = readPrefs();
      if (prefs?.invoiceReminders === false) return;
    }
    if (category === 'expenses') {
      const prefs = readPrefs();
      if (prefs?.expenseAlerts === false) return;
    }

    // Benzersiz ID oluştur (Date.now + random)
    const uniqueId = options?.relatedId 
      ? `${options.relatedId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` 
      : `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newNotification: HeaderNotification = {
      id: uniqueId,
      title,
      description,
      time: 'Şimdi',
      type,
      read: false,
      link,
      persistent: options?.persistent,
      repeatDaily: options?.repeatDaily,
      relatedId: options?.relatedId,
    };
    
    // Aynı relatedId'ye sahip eski bildirimi kaldır (tekrar gösterilmemesi için)
    setNotifications(prev => {
      if (options?.relatedId) {
        const filtered = prev.filter(n => n.relatedId !== options.relatedId);
        return [newNotification, ...filtered];
      }
      return [newNotification, ...prev];
    });
    console.log('🔔 Yeni bildirim eklendi:', newNotification);
  };

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
        // Duplicate email preflight (case-insensitive, trimmed)
        const normalizedEmail = (cleanData.email || '').trim().toLowerCase();
        if (normalizedEmail) {
          const existing = customers.find(c => (String(c?.email || '').trim().toLowerCase()) === normalizedEmail);
          if (existing) {
            setInfoModal({
              title: t('customers.duplicate.title') || 'Müşteri zaten kayıtlı',
              message: t('customers.duplicate.message', { email: cleanData.email, name: existing.name }) || `Bu e-posta (${cleanData.email}) ile bir müşteri zaten kayıtlı (${existing.name}). Lütfen listeden mevcut kaydı seçin.`,
              tone: 'error',
              confirmLabel: t('customers.duplicate.openExisting') || 'Mevcut müşteriyi aç',
              onConfirm: () => {
                // Müşteriler sayfasına gidip ilgili kaydı aç
                setSelectedCustomer(existing as any);
                setShowCustomerViewModal(true);
                navigateTo('customers');
                setInfoModal(null);
              },
            });
            return;
          }
        }
        // Create new
        const created = await customersApi.createCustomer(cleanData);
        setCustomers(prev => [...prev, created]);
        showToast('Müşteri eklendi', 'success');
        
        // 🔔 Bildirim ekle
        addNotification(
          'Yeni müşteri eklendi',
          `${created.name} sisteme kaydedildi.`,
          'success',
          'customers'
        );
      }
    } catch (error: any) {
      console.error('Customer upsert error:', error);
      console.error('Error details:', error.response?.data);
      const status = error?.response?.status;
      const serverMsg: string | string[] | undefined = error?.response?.data?.message;
      const msg = Array.isArray(serverMsg) ? serverMsg.join(', ') : (serverMsg || error.message || 'Müşteri kaydedilemedi');

      // Backend duplicate guard: show actionable modal instead of toast
      const attemptedEmail = String(customerData?.email || '').trim().toLowerCase();
      if (status === 400 && typeof msg === 'string' && (msg.toLowerCase().includes('zaten bir müşteri') || msg.toLowerCase().includes('duplicate'))) {
        const existing = customers.find(c => (String(c?.email || '').trim().toLowerCase()) === attemptedEmail);
        if (existing) {
          setInfoModal({
            title: t('customers.duplicate.title') || 'Müşteri zaten kayıtlı',
            message: t('customers.duplicate.message', { email: customerData.email, name: existing.name }) || msg,
            tone: 'error',
            confirmLabel: t('customers.duplicate.openExisting') || 'Mevcut müşteriyi aç',
            onConfirm: () => {
              setSelectedCustomer(existing as any);
              setShowCustomerViewModal(true);
              navigateTo('customers');
              setInfoModal(null);
            },
          });
          return;
        }
      }

      showToast(msg, 'error');
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
      
      // Bağlı fatura kontrolü
      if (error.response?.data?.relatedInvoices) {
        setDeleteWarningData({
          title: 'Müşteri Silinemez',
          message: error.response.data.message,
          relatedItems: error.response.data.relatedInvoices,
          itemType: 'invoice'
        });
        setShowDeleteWarning(true);
      } else {
        showToast(error.response?.data?.message || 'Müşteri silinemedi', 'error');
      }
    }
  };

  const handleImportCustomers = async (file: File) => {
    try {
      console.log('Starting customer import, file:', file.name, file.type);
      const data = await file.arrayBuffer();
      
      let rows: Record<string, unknown>[] = [];
      
      // Handle CSV files separately
      if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
        console.log('Processing as CSV file');
        const text = new TextDecoder('utf-8').decode(data);
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          console.log('CSV file has insufficient data');
          setInfoModal({ title: t('common.warning'), message: t('customers.import.noDataFound') });
          return;
        }
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        console.log('CSV headers:', headers);
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const rowData: Record<string, unknown> = {};
          headers.forEach((header, index) => {
            rowData[header] = values[index] || '';
          });
          rows.push(rowData);
        }
      } else {
        // Handle Excel files
        console.log('Processing as Excel file');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(data);
        
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          console.log('No worksheet found in file');
          setInfoModal({ title: t('common.warning'), message: t('customers.import.noDataFound') });
          return;
        }
        
        console.log('Worksheet found, row count:', worksheet.rowCount);
        
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header
          const rowData: Record<string, unknown> = {};
          row.eachCell((cell, colNumber) => {
            const header = worksheet.getRow(1).getCell(colNumber).value?.toString() || `col${colNumber}`;
            rowData[header] = cell.value;
          });
          rows.push(rowData);
        });
      }

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

      console.log('Processed customers:', imported.length, imported);
      
      if (imported.length === 0) {
        console.log('No valid customers found after processing');
        setInfoModal({ title: t('common.warning'), message: t('customers.import.noCustomersFound') });
        return;
      }

      // Persist imported customers to backend if possible
      try {
        console.log('Attempting to persist imported customers to backend...', imported);
        const results = await Promise.allSettled(
          imported.map((c, idx) => {
            console.log('Requesting createCustomer for index', idx, c);
            return customersApi.createCustomer({
              name: c.name,
              email: c.email || undefined,
              phone: c.phone || undefined,
              address: c.address || undefined,
              taxNumber: c.taxNumber || undefined,
              company: c.company || undefined,
            }).then(res => {
              console.log('createCustomer fulfilled for index', idx, res);
              return res;
            }).catch(err => {
              console.error('createCustomer rejected for index', idx, err);
              throw err;
            });
          })
        );

        const created: any[] = [];
        const failed: { index: number; reason: any }[] = [];

        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            created.push(r.value);
          } else {
            failed.push({ index: i, reason: r.reason });
          }
        });

        // Add created customers to local state (backend already handles duplicates)
        setCustomers(prev => {
          const next = [...prev];
          created.forEach((cust) => {
            // Since backend returns unique IDs, check only by ID to avoid duplicates
            const existingIndex = next.findIndex((current) => current.id === cust.id);
            
            if (existingIndex >= 0) {
              // Update existing record with backend data
              next[existingIndex] = { ...next[existingIndex], ...cust };
            } else {
              // Add new record
              next.push(cust);
            }
          });
          return next;
        });

        // Notify user about results
        if (failed.length === 0) {
          setInfoModal({ title: t('common.success'), message: t('customers.import.success', { count: created.length }) });
        } else {
          const msg = `${t('customers.import.success', { count: created.length })}\n${failed.length} kayıt başarısız.`;
          setInfoModal({ title: t('common.warning'), message: msg });
          console.error('Import failures:', failed);
        }
      } catch (err) {
        console.error('Error while persisting imported customers', err);
        setInfoModal({ title: t('common.error'), message: t('customers.import.error') + '\n\nDetay: ' + (err instanceof Error ? err.message : String(err)) });
      }
    } catch (error) {
      console.error("Customer import failed", error);
      setInfoModal({ title: t('common.error'), message: t('customers.import.error') + "\n\nDetay: " + (error instanceof Error ? error.message : String(error)) });
    }
  };

  const handleImportProducts = async (file: File) => {
    try {
      console.log('Starting product import, file:', file.name, file.type);
      const data = await file.arrayBuffer();

      let rows: Record<string, unknown>[] = [];

      // CSV işleme
      if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
        console.log('Processing as CSV file');
        const text = new TextDecoder('utf-8').decode(data);
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          setInfoModal({ title: t('common.warning'), message: t('customers.import.noDataFound') });
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const rowData: Record<string, unknown> = {};
          headers.forEach((header, index) => {
            rowData[header] = values[index] ?? '';
          });
          rows.push(rowData);
        }
      } else {
        // Excel işleme
        console.log('Processing as Excel file');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(data);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          setInfoModal({ title: t('common.warning'), message: t('customers.import.noDataFound') });
          return;
        }
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const rowData: Record<string, unknown> = {};
          row.eachCell((cell, colNumber) => {
            const header = worksheet.getRow(1).getCell(colNumber).value?.toString() || `col${colNumber}`;
            rowData[header] = cell.value;
          });
          rows.push(rowData);
        });
      }

      const normalizeKey = (value: unknown) =>
        String(value ?? '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/gi, '')
          .toLowerCase();

      const toNumber = (v: unknown) => {
        if (v == null || v === '') return undefined;
        if (typeof v === 'number') return v;
        const s = String(v).trim();
        // SQL/EN format: 2000.00
        if (/^\d+\.?\d*$/.test(s)) {
          const n = parseFloat(s);
          return Number.isFinite(n) ? n : undefined;
        }
        // TR format: 2.000,00 -> 2000.00
        if (s.includes(',')) {
          const cleaned = s.replace(/\./g, '').replace(/,/g, '.');
          const n = parseFloat(cleaned);
          return Number.isFinite(n) ? n : undefined;
        }
        const cleaned = s.replace(/\s/g, '');
        const n = parseFloat(cleaned);
        return Number.isFinite(n) ? n : undefined;
      };

      type ImportedProduct = {
        name: string;
        sku?: string;
        unitPrice?: number;
        costPrice?: number;
        taxRate?: number;
        stockQuantity?: number;
        reorderLevel?: number;
        unit?: string;
        category?: string;
        description?: string;
      };

      const imported = rows
        .map<ImportedProduct | null>(row => {
          if (!row || typeof row !== 'object') return null;
          const entries = Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
            acc[normalizeKey(key)] = value;
            return acc;
          }, {});

          const getValue = (...keys: string[]) => {
            for (const key of keys) {
              if (entries[key] !== undefined && entries[key] !== '') return entries[key];
            }
            return undefined;
          };

          const name = String(getValue('name', 'urunadi', 'urun', 'productname') ?? '').trim();
          if (!name) return null;

          const sku = String(getValue('sku', 'code', 'kod', 'barkod') ?? '').trim() || undefined;
          const unitPrice = toNumber(getValue('unitprice', 'price', 'satisfiyati', 'fiyat'));
          const costPrice = toNumber(getValue('costprice', 'cost', 'maliyet'));
          let taxRate = toNumber(getValue('taxrate', 'kdv', 'vergi'));
          if (taxRate != null) {
            // 0-100 aralığına sıkıştır
            taxRate = Math.max(0, Math.min(100, taxRate));
          }
          const stockQuantity = toNumber(getValue('stockquantity', 'stock', 'stok', 'adet'));
          const reorderLevel = toNumber(getValue('reorderlevel', 'minstock', 'kritikstok'));
          const unit = String(getValue('unit', 'birim') ?? '').trim() || undefined;
          const category = String(getValue('category', 'kategori') ?? '').trim() || 'Genel';
          const description = String(getValue('description', 'aciklama') ?? '').trim() || undefined;

          return {
            name,
            sku,
            unitPrice,
            costPrice,
            taxRate,
            stockQuantity,
            reorderLevel,
            unit,
            category,
            description,
          };
        })
        .filter((p): p is ImportedProduct => Boolean(p));

      if (imported.length === 0) {
        setInfoModal({ title: t('common.warning'), message: t('customers.import.noDataFound') });
        return;
      }

      // Backend'e kaydet
      try {
        const results = await Promise.allSettled(
          imported.map((p) => {
            const dto = {
              name: p.name,
              code: p.sku || p.name, // SKU yoksa isimden üret
              price: Number(p.unitPrice ?? 0),
              cost: p.costPrice != null ? Number(p.costPrice) : undefined,
              stock: p.stockQuantity != null ? Number(p.stockQuantity) : undefined,
              minStock: p.reorderLevel != null ? Number(p.reorderLevel) : undefined,
              unit: p.unit,
              category: p.category || 'Genel',
              description: p.description,
              taxRate: p.taxRate != null ? Number(p.taxRate) : undefined,
            } as const;
            return productsApi.createProduct(dto).then(res => res);
          })
        );

        const created: any[] = [];
        const failed: { index: number; reason: any }[] = [];
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') created.push(r.value);
          else failed.push({ index: i, reason: r.reason });
        });

        // Frontend state'i güncelle ve cache'e yaz
        if (created.length > 0) {
          // Backend Product -> Frontend Product mapping
          const mapped = created.map((p: any) => ({
            ...p,
            sku: p.code,
            unitPrice: Number(p.price) || 0,
            costPrice: Number(p.cost) || 0,
            stockQuantity: Number(p.stock) || 0,
            reorderLevel: Number(p.minStock) || 0,
            taxRate: Number(p.taxRate) || 0,
            status: p.stock === 0 ? 'out-of-stock' : p.stock <= p.minStock ? 'low' : 'active'
          }));
          setProducts(prev => {
            const next = [...prev, ...mapped];
            try { localStorage.setItem('products_cache', JSON.stringify(next)); } catch {}
            return next;
          });
        }

        if (failed.length === 0) {
          setInfoModal({ title: t('common.success'), message: `${created.length} ürün başarıyla içe aktarıldı!` });
        } else {
          setInfoModal({ title: t('common.warning'), message: `${created.length} ürün içe aktarıldı, ${failed.length} kayıt başarısız.` });
          console.error('Product import failures:', failed);
        }
      } catch (err) {
        console.error('Error while persisting imported products', err);
        setInfoModal({ title: t('common.error'), message: (t('customers.import.error') || 'İçe aktarma hatası') + '\n\nDetay: ' + (err instanceof Error ? err.message : String(err)) });
      }
    } catch (error) {
      console.error('Product import failed', error);
      setInfoModal({ title: t('common.error'), message: (t('customers.import.error') || 'İçe aktarma hatası') + '\n\nDetay: ' + (error instanceof Error ? error.message : String(error)) });
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
        
        // 🔔 Bildirim ekle
        addNotification(
          'Yeni tedarikçi eklendi',
          `${created.name} sisteme kaydedildi.`,
          'success',
          'suppliers'
        );
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
      
      // Bağlı gider kontrolü
      if (error.response?.data?.relatedExpenses) {
        setDeleteWarningData({
          title: 'Tedarikçi Silinemez',
          message: error.response.data.message,
          relatedItems: error.response.data.relatedExpenses,
          itemType: 'expense'
        });
        setShowDeleteWarning(true);
      } else {
        showToast(error.response?.data?.message || 'Tedarikçi silinemedi', 'error');
      }
    }
  };

  const upsertInvoice = async (invoiceData: any) => {
    try {
      console.log('📄 upsertInvoice çağrıldı:', {
        id: invoiceData.id,
        saleId: invoiceData.saleId,
        customerId: invoiceData.customerId,
        customerName: invoiceData.customerName,
        invoiceNumber: invoiceData.invoiceNumber
      });
      
      // Validate customerId
      if (!invoiceData.customerId) {
        console.error('❌ customerId eksik!', {
          customerName: invoiceData.customerName,
          availableCustomers: customers.map(c => ({ id: c.id, name: c.name }))
        });
        showToast('Müşteri seçilmedi! Lütfen geçerli bir müşteri seçin.', 'error');
        return;
      }
      
      const cleanData: any = {
        customerId: invoiceData.customerId,
        type: invoiceData.type || 'product', // Fatura türü
        issueDate: invoiceData.issueDate || new Date().toISOString().split('T')[0],
        dueDate: invoiceData.dueDate,
        items: (invoiceData.items || invoiceData.lineItems || []).map((item: any) => ({
          productId: item.productId,
          productName: item.description || item.productName,
          description: item.description || item.productName,
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
          total: Number(item.total) || 0,
          taxRate: Number(item.taxRate ?? 18), // KDV oranını ekle
        })),
        taxAmount: Number(invoiceData.taxAmount || 0),
        discountAmount: Number(invoiceData.discountAmount || 0),
        notes: invoiceData.notes || '',
        saleId: invoiceData.saleId, // Satış ID'sini ekle
        refundedInvoiceId: invoiceData.originalInvoiceId || undefined,
      };
      
      console.log('📤 Backend\'e gönderilecek data:', {
        customerId: cleanData.customerId,
        items: cleanData.items.length,
        firstItem: cleanData.items[0],
        taxAmount: cleanData.taxAmount,
        discountAmount: cleanData.discountAmount,
        saleId: cleanData.saleId
      });
      
      if (invoiceData.status) {
        cleanData.status = invoiceData.status;
      }
      
      // İstemci tarafı plan limiti kontrolü (sadece yeni oluşturma için)
      if (!invoiceData.id && isFreePlan) {
        const used = countInvoicesThisMonth();
        const MAX = 5;
        if (used >= MAX) {
          setInfoModal({
            title: 'Plan Limiti Aşıldı',
            message: 'Starter/Free planda bir ayda en fazla 5 fatura oluşturabilirsiniz. Daha fazla fatura için planınızı yükseltin.'
          });
          // İsteğe bağlı: Ayarlar sayfasını açmak isterseniz yorumdan çıkartın
          // openSettingsOn('organization');
          return;
        } else if (used === MAX - 1) {
          addNotification(
            'Plan limiti uyarısı',
            'Bu ay 5/5 limitine yaklaşmaktasınız (4/5).',
            'info',
            'invoices',
            { relatedId: 'plan-limit-invoices' }
          );
        }
      }

      if (invoiceData.id) {
        const updated = await invoicesApi.updateInvoice(String(invoiceData.id), cleanData);
        const newInvoices = invoices.map(i => i.id === updated.id ? updated : i);
        setInvoices(newInvoices);
        localStorage.setItem('invoices_cache', JSON.stringify(newInvoices));
        console.log('💾 Fatura cache güncellendi (update)');
        showToast('Fatura güncellendi', 'success');
        return updated; // Güncellenen faturayı return et
      } else {
        const created = await invoicesApi.createInvoice(cleanData);
        console.log('✅ Fatura oluşturuldu:', {
          id: created.id,
          invoiceNumber: created.invoiceNumber,
          type: created.type,
          customer: created.customer,
          items: (created as any).items,
          lineItems: (created as any).lineItems
        });
        
        // Eğer mevcut bir satış yoksa (saleId yok) otomatik satış oluştur
        if (!cleanData.saleId && cleanData.items && cleanData.items.length > 0) {
          try {
            console.log('🔄 Otomatik satış oluşturuluyor...');
            
            // Müşteri bilgilerini frontend'den al (daha güvenli)
            const customerInfo = customers.find(c => c.id === cleanData.customerId);
            const customerName = customerInfo?.name || invoiceData.customerName || 'N/A';
            const customerEmail = customerInfo?.email || invoiceData.customerEmail || '';
            
            console.log('👤 Müşteri bilgileri hazırlandı:', {
              customerId: cleanData.customerId,
              customerName: customerName,
              customerEmail: customerEmail,
              backendCustomer: created.customer?.name,
              frontendCustomer: customerInfo?.name
            });
            
            // Fatura kalemlerinden satış verisi hazırla
            // ✅ Tüm ürünleri items array olarak sakla
            const saleItems = cleanData.items.map((item: any) => ({
              productName: item.productName || item.description || 'Ürün/Hizmet',
              productId: item.productId,
              quantity: Number(item.quantity) || 1,
              unitPrice: Number(item.unitPrice) || 0,
              total: Number(item.total) || 0,
            }));
            
            // Toplam tutar hesaplama
            const saleAmount = Number(created.total) || saleItems.reduce((sum: number, item: any) => sum + item.total, 0);
            
            // İlk ürün bilgisini eski format uyumluluğu için tut
            const firstItem = saleItems[0];
            
            const saleData = {
              customerName: customerName,
              customerEmail: customerEmail,
              // Eski format uyumluluğu
              productName: saleItems.length === 1 
                ? firstItem.productName 
                : `${saleItems.length} ürün`,
              quantity: saleItems.length === 1 ? firstItem.quantity : saleItems.length,
              unitPrice: saleItems.length === 1 ? firstItem.unitPrice : saleAmount,
              // Yeni: Çoklu ürün desteği
              items: saleItems,
              amount: saleAmount,
              date: cleanData.issueDate,
              paymentMethod: 'card' as const,
              notes: `${created.invoiceNumber} numaralı faturadan otomatik oluşturuldu.`,
              invoiceId: created.id
            };
            
            console.log('💰 Satış oluşturuldu:', {
              itemCount: saleItems.length,
              items: saleItems,
              totalAmount: saleAmount
            });
            
            // 📦 Stok kontrolü ve düşürme
            for (const item of saleItems) {
              if (item.productId) {
                const product = products.find(p => String(p.id) === String(item.productId));
                if (product) {
                  const newStock = Number(product.stockQuantity || 0) - Number(item.quantity);
                  
                  // Stok negatife düşerse uyarı ver
                  if (newStock < 0) {
                    console.warn(`⚠️ Stok yetersiz: ${product.name} (Mevcut: ${product.stockQuantity}, İstenen: ${item.quantity})`);
                    showToast(`Uyarı: ${product.name} stoğu yetersiz!`, 'error');
                  }
                  
                  // Stoku güncelle
                  try {
                    const updateData = {
                      stock: newStock < 0 ? 0 : newStock, // Negatif stok olmasın
                    };
                    
                    await productsApi.updateProduct(String(product.id), updateData);
                    
                    // Frontend state'i güncelle
                    setProducts(prev => prev.map(p => 
                      String(p.id) === String(product.id) 
                        ? { 
                            ...p, 
                            stockQuantity: newStock < 0 ? 0 : newStock,
                            status: newStock <= 0 ? 'out-of-stock' : newStock <= (p.reorderLevel || 0) ? 'low' : 'active'
                          } 
                        : p
                    ));
                    
                    console.log(`📦 Stok güncellendi: ${product.name} (${product.stockQuantity} → ${newStock < 0 ? 0 : newStock})`);
                    
                    // Düşük stok uyarısı
                    if (newStock > 0 && newStock <= (product.reorderLevel || 0)) {
                      addNotification(
                        'Düşük stok uyarısı',
                        `${product.name} - Stok seviyesi minimum limitin altında! (${newStock}/${product.reorderLevel})`,
                        'info',
                        'products',
                        { persistent: true, repeatDaily: true, relatedId: `low-stock-${product.id}` }
                      );
                    }
                  } catch (stockError) {
                    console.error('Stok güncellenemedi:', stockError);
                  }
                }
              }
            }
            
            // Sıralı satış numarası oluştur (SAL-YYYY-MM-XXX formatı)
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const prefix = `SAL-${year}-${month}-`;
            
            // Mevcut ayın satışlarını bul
            const currentMonthSales = sales.filter(s => 
              s.saleNumber && s.saleNumber.startsWith(prefix)
            );
            
            // Sıra numarasını bul
            let nextSequence = 1;
            if (currentMonthSales.length > 0) {
              const sequences = currentMonthSales
                .map(s => {
                  const parts = s.saleNumber?.split('-');
                  return parts ? parseInt(parts[parts.length - 1] || '0', 10) : 0;
                })
                .filter(n => !isNaN(n));
              
              if (sequences.length > 0) {
                nextSequence = Math.max(...sequences) + 1;
              }
            }
            
            const saleNumber = `${prefix}${String(nextSequence).padStart(3, '0')}`;
            
            // Satış oluştur
            const tenantIdRaw = authUser?.tenantId ?? localStorage.getItem('tenantId') ?? undefined;
            const normalizedTenantId = tenantIdRaw != null ? String(tenantIdRaw) : undefined;
            const newSale = {
              ...saleData,
              id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
              saleNumber: saleNumber,
              status: 'completed' as const,
              invoiceId: created.id, // Fatura ID'sini satışa ekle
              tenantId: normalizedTenantId, // Tenant ID ekle (normalize + fallback)
            };
            
            const newSales = [...sales, newSale];
            setSales(newSales);
            localStorage.setItem('sales', JSON.stringify(newSales));
            
            console.log('✅ Otomatik satış oluşturuldu:', {
              id: newSale.id,
              saleNumber: newSale.saleNumber,
              customer: newSale.customerName,
              amount: newSale.amount,
              invoiceId: newSale.invoiceId
            });
            
            // 🔔 Satış bildirimi (tercihe tabi)
            try {
              const tid = (localStorage.getItem('tenantId') || 'default') as string;
              const userRaw = localStorage.getItem('user');
              let uid = 'anon';
              if (userRaw) { const u = JSON.parse(userRaw); uid = u?.id || u?._id || uid; }
              const key = `notif_prefs:${tid}:${uid}`;
              const prefs = JSON.parse(localStorage.getItem(key) || '{}');
              if (prefs?.salesNotifications !== false) {
                addNotification(
                  'Yeni satış gerçekleşti',
                  `${newSale.saleNumber} - ${newSale.customerName}: ${newSale.amount} TL`,
                  'success',
                  'sales'
                );
              }
            } catch {}
            
          } catch (saleError) {
            console.error('⚠️ Otomatik satış oluşturulamadı:', saleError);
            // Fatura başarılı oldu ama satış oluşturulamadı, kullanıcıyı uyar
          }
        }
        
        const newInvoices = [...invoices, created];
        setInvoices(newInvoices);
        localStorage.setItem('invoices_cache', JSON.stringify(newInvoices));
        console.log('💾 Fatura cache güncellendi (create)');
        showToast('Fatura ve satış oluşturuldu', 'success');
        
        // 🔔 Bildirim ekle
        const customerInfo = customers.find(c => c.id === cleanData.customerId);
        addNotification(
          'Yeni fatura oluşturuldu',
          `${created.invoiceNumber} - ${customerInfo?.name || 'Müşteri'} için fatura hazır.`,
          'success',
          'invoices'
        );
        
        return created; // Oluşturulan faturayı return et
      }
    } catch (error: any) {
      console.error('Invoice upsert error:', error);
      console.error('Error details:', error.response?.data);
      const errorMsg = getErrorMessage(error);
      showToast(errorMsg, 'error');
    }
  };

  const deleteInvoice = async (invoiceId: string | number) => {
    if (!confirmAction(t('invoices.deleteConfirm'))) return;
    
    try {
      // Backend'e silme isteği gönder
      await invoicesApi.deleteInvoice(String(invoiceId));
      
      // Sadece backend'den başarılı response gelirse cache'i güncelle
      const newInvoices = invoices.filter(invoice => String(invoice.id) !== String(invoiceId));
      setInvoices(newInvoices);
      localStorage.setItem('invoices_cache', JSON.stringify(newInvoices));
      console.log('💾 Fatura cache güncellendi (delete)');
      showToast(t('invoices.deleteSuccess'), 'success');
    } catch (error: any) {
      console.error('Invoice delete error:', error);
      const errorMessage = error.response?.data?.message || '';
      
      // Hata durumunda cache'i güncelleme - fatura listede kalacak
      console.log('❌ Fatura silinemedi, cache güncellenmedi');
      
      // Check if error is about locked period
      if (errorMessage.includes('locked period') || errorMessage.includes('kilitli dönem') || errorMessage.includes('Cannot modify records')) {
        showToast(t('common.periodLockedError'), 'error');
      } else {
        showToast(errorMessage || t('invoices.deleteError'), 'error');
      }
    }
  };

  const voidInvoice = async (invoiceId: string, reason: string) => {
    try {
      await invoicesApi.voidInvoice(invoiceId, reason);
      const updatedInvoices = invoices.map(invoice => 
        invoice.id === invoiceId 
          ? { ...invoice, isVoided: true, voidReason: reason, voidedAt: new Date().toISOString() }
          : invoice
      );
      setInvoices(updatedInvoices);
      localStorage.setItem('invoices_cache', JSON.stringify(updatedInvoices));
      showToast('Fatura iptal edildi', 'success');
    } catch (error: any) {
      console.error('Invoice void error:', error);
      showToast(error.response?.data?.message || 'Fatura iptal edilemedi', 'error');
    }
  };

  const restoreInvoice = async (invoiceId: string) => {
    try {
      await invoicesApi.restoreInvoice(invoiceId);
      const updatedInvoices = invoices.map(invoice => 
        invoice.id === invoiceId 
          ? { ...invoice, isVoided: false, voidReason: undefined, voidedAt: undefined }
          : invoice
      );
      setInvoices(updatedInvoices);
      localStorage.setItem('invoices_cache', JSON.stringify(updatedInvoices));
      showToast('Fatura geri yüklendi', 'success');
    } catch (error: any) {
      console.error('Invoice restore error:', error);
      showToast(error.response?.data?.message || 'Fatura geri yüklenemedi', 'error');
    }
  };

  const upsertExpense = async (expenseData: any) => {
    try {
      // İstemci tarafı plan limiti kontrolü (sadece yeni oluşturma için)
      if (!expenseData.id && isFreePlan) {
        const used = countExpensesThisMonth();
        const MAX = 5;
        if (used >= MAX) {
          setInfoModal({
            title: 'Plan Limiti Aşıldı',
            message: 'Starter/Free planda bir ayda en fazla 5 gider kaydı oluşturabilirsiniz. Daha fazlası için planınızı yükseltin.'
          });
          // openSettingsOn('organization');
          return;
        } else if (used === MAX - 1) {
          addNotification(
            'Plan limiti uyarısı',
            'Bu ay 5/5 limitine yaklaşmaktasınız (4/5).',
            'info',
            'expenses',
            { relatedId: 'plan-limit-expenses' }
          );
        }
      }

      const cleanData = {
        description: expenseData.description || '',
        amount: Number(expenseData.amount || 0),
        category: expenseData.category || 'other',
        status: expenseData.status || 'pending',
        date: expenseData.date || expenseData.expenseDate || new Date().toISOString().split('T')[0],
        supplierId: expenseData.supplierId === null ? null : (expenseData.supplierId || undefined),
        notes: expenseData.notes || '',
      };
      
      if (expenseData.id) {
        const updated = await expensesApi.updateExpense(String(expenseData.id), cleanData);
        const mappedUpdated: any = {
          ...updated,
          supplier: updated.supplier || null, // Supplier object'ini olduğu gibi koru
          expenseDate: updated.expenseDate ? (typeof updated.expenseDate === 'string' ? updated.expenseDate : new Date(updated.expenseDate).toISOString().split('T')[0]) : cleanData.date,
          dueDate: updated.dueDate || updated.expenseDate || cleanData.date,
        };
        const newExpenses = expenses.map(e => e.id === mappedUpdated.id ? mappedUpdated : e);
        setExpenses(newExpenses);
        localStorage.setItem('expenses_cache', JSON.stringify(newExpenses));
        showToast('Gider güncellendi', 'success');
      } else {
        const created = await expensesApi.createExpense(cleanData);
        const mappedCreated: any = {
          ...created,
          supplier: created.supplier || null, // Supplier object'ini olduğu gibi koru
          expenseDate: created.expenseDate ? (typeof created.expenseDate === 'string' ? created.expenseDate : new Date(created.expenseDate).toISOString().split('T')[0]) : cleanData.date,
          dueDate: created.dueDate || created.expenseDate || cleanData.date,
        };
        const newExpenses = [...expenses, mappedCreated];
        setExpenses(newExpenses);
        localStorage.setItem('expenses_cache', JSON.stringify(newExpenses));
        showToast('Gider eklendi', 'success');
        
        // 🔔 Bildirim ekle
        const supplierName = mappedCreated.supplier?.name || 'Tedarikçi';
        addNotification(
          'Yeni gider kaydedildi',
          `${supplierName} - ${mappedCreated.description}: ${mappedCreated.amount} TL`,
          'info',
          'expenses'
        );
      }
    } catch (error: any) {
      console.error('Expense upsert error:', error);
      console.error('Error details:', error.response?.data);
      const errorMsg = getErrorMessage(error);
      showToast(errorMsg, 'error');
    }
  };

  const deleteExpense = async (expenseId: string | number) => {
    if (!confirmAction(t('expenses.deleteConfirm'))) return;
    
    try {
      // Backend'e silme isteği gönder
      await expensesApi.deleteExpense(String(expenseId));
      
      // Sadece backend'den başarılı response gelirse cache'i güncelle
      const newExpenses = expenses.filter(expense => String(expense.id) !== String(expenseId));
      setExpenses(newExpenses);
      localStorage.setItem('expenses_cache', JSON.stringify(newExpenses));
      console.log('💾 Gider cache güncellendi (delete)');
      showToast(t('expenses.deleteSuccess'), 'success');
    } catch (error: any) {
      console.error('Expense delete error:', error);
      const errorMessage = error.response?.data?.message || '';
      
      // Hata durumunda cache'i güncelleme - gider listede kalacak
      console.log('❌ Gider silinemedi, cache güncellenmedi');
      
      // Check if error is about locked period
      if (errorMessage.includes('locked period') || errorMessage.includes('kilitli dönem') || errorMessage.includes('Cannot modify records')) {
        showToast(t('common.periodLockedError'), 'error');
      } else {
        showToast(errorMessage || t('expenses.deleteError'), 'error');
      }
    }
  };

  const voidExpense = async (expenseId: string, reason: string) => {
    try {
      await expensesApi.voidExpense(expenseId, reason);
      const updatedExpenses = expenses.map(expense => 
        expense.id === expenseId 
          ? { ...expense, isVoided: true, voidReason: reason, voidedAt: new Date().toISOString() }
          : expense
      );
      setExpenses(updatedExpenses);
      localStorage.setItem('expenses_cache', JSON.stringify(updatedExpenses));
      showToast('Gider iptal edildi', 'success');
    } catch (error: any) {
      console.error('Expense void error:', error);
      showToast(error.response?.data?.message || 'Gider iptal edilemedi', 'error');
    }
  };

  const restoreExpense = async (expenseId: string) => {
    try {
      await expensesApi.restoreExpense(expenseId);
      const updatedExpenses = expenses.map(expense => 
        expense.id === expenseId 
          ? { ...expense, isVoided: false, voidReason: undefined, voidedAt: undefined }
          : expense
      );
      setExpenses(updatedExpenses);
      localStorage.setItem('expenses_cache', JSON.stringify(updatedExpenses));
      showToast('Gider geri yüklendi', 'success');
    } catch (error: any) {
      console.error('Expense restore error:', error);
      showToast(error.response?.data?.message || 'Gider geri yüklenemedi', 'error');
    }
  };

  const upsertSale = async (saleData: any) => {
    // 📦 YENİ SATIŞ İÇİN STOK KONTROLÜ (tek ürün veya çoklu ürün)
    if (!saleData.id) {
      const lineItems = Array.isArray(saleData.items) && saleData.items.length > 0
        ? saleData.items
        : (saleData.productId ? [{ productId: saleData.productId, quantity: saleData.quantity || 0, productName: saleData.productName || '', unitPrice: saleData.unitPrice || 0, total: saleData.amount || 0 }] : []);

      for (const li of lineItems) {
        if (!li?.productId) continue;
        const product = products.find(p => String(p.id) === String(li.productId));
        if (!product) continue;
        const availableStock = Number(product.stockQuantity || 0);
        const requestedQty = Number(li.quantity || 0);
        if (availableStock < requestedQty) {
          showToast(`❌ Yetersiz stok! ${product.name} - Mevcut: ${availableStock}, İstenen: ${requestedQty}`,'error');
          return; // Satışı oluşturma
        }
      }
    }
    
    // Backend'e kaydet ve state'i güncelle
    let isNewSale = !saleData?.id;

    try {
      // Müşteri ID'sini bul (isim/email eşlemesi)
      let customerId: string | undefined = undefined;
      if (saleData.customerId) {
        customerId = String(saleData.customerId);
      } else if (saleData.customerName) {
        const nameLc = String(saleData.customerName).trim().toLowerCase();
        const emailLc = String(saleData.customerEmail || '').trim().toLowerCase();
        const found = customers.find(c => (c.name || '').toLowerCase() === nameLc || (c.email || '').toLowerCase() === emailLc);
        if (found) customerId = String(found.id);
      }

      // Ürün satırı oluştur (tek ürün akışı)
      const quantity = Number(saleData.quantity || 1);
      const unitPrice = Number(saleData.unitPrice || saleData.amount || 0);
      const productId = saleData.productId ? String(saleData.productId) : undefined;
      const productName = saleData.productName || products.find(p => String(p.id) === String(productId))?.name || 'Ürün/Hizmet';
      const productTax = (() => {
        const p = products.find(x => String(x.id) === String(productId));
        return p?.taxRate != null ? Number(p.taxRate) : 18;
      })();

      const dto: salesApi.CreateSaleDto = {
        customerId,
        saleDate: saleData?.date || saleData?.saleDate || new Date().toISOString().split('T')[0],
        items: [
          {
            productId,
            productName,
            quantity: Number.isFinite(quantity) ? quantity : 1,
            unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
            taxRate: productTax,
          },
        ],
        discountAmount: 0,
        notes: saleData?.notes || undefined,
        sourceQuoteId: saleData?.sourceQuoteId,
      };

      if (isNewSale) {
        const saved = await salesApi.createSale(dto);
        // Backend sale -> frontend sale mapping
        const mapped = {
          id: saved.id,
          saleNumber: saved.saleNumber || saleData.saleNumber || `SAL-${new Date().toISOString().slice(0,7)}-???`,
          customerName: saleData.customerName || saved.customer?.name || '',
          customerEmail: saleData.customerEmail || saved.customer?.email || '',
          items: Array.isArray(saved.items) ? saved.items : dto.items,
          productName: productName,
          quantity,
          unitPrice,
          amount: Number(saved.total ?? (quantity * unitPrice)) || 0,
          total: Number(saved.total ?? (quantity * unitPrice)) || 0,
          date: saved.saleDate ? String(saved.saleDate).slice(0, 10) : dto.saleDate,
          status: 'completed',
          paymentMethod: saleData.paymentMethod || 'cash',
          notes: dto.notes,
          invoiceId: saved.invoiceId,
        } as any;

        setSales(prev => {
          const next = [...prev, mapped];
          localStorage.setItem('sales', JSON.stringify(next));
          try { localStorage.setItem('sales_cache', JSON.stringify(next)); } catch {}
          return next;
        });
        showToast('Satış kaydedildi', 'success');
      } else {
        const id = String(saleData.id);
        const patch: salesApi.UpdateSaleDto = {
          customerId,
          saleDate: dto.saleDate,
          items: dto.items,
          discountAmount: dto.discountAmount,
          notes: dto.notes,
        };
        const updated = await salesApi.updateSale(id, patch);
        setSales(prev => {
          const next = prev.map(s => String(s.id) === id ? {
            ...s,
            saleNumber: updated.saleNumber || s.saleNumber,
            date: updated.saleDate ? String(updated.saleDate).slice(0,10) : s.date,
            amount: Number(updated.total ?? s.amount) || 0,
            total: Number(updated.total ?? s.total) || 0,
            items: Array.isArray(updated.items) ? updated.items : s.items,
            notes: updated.notes ?? s.notes,
          } : s);
          localStorage.setItem('sales', JSON.stringify(next));
          try { localStorage.setItem('sales_cache', JSON.stringify(next)); } catch {}
          return next;
        });
        showToast('Satış güncellendi', 'success');
      }
    } catch (err: any) {
      console.error('❌ Sales upsert error:', err);
      // Offline fallback: yerel kaydetmeye devam et
      setSales(prev => {
        const newItem = {
          ...saleData,
          id: saleData.id || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
          saleNumber: saleData.saleNumber || `SAL-${new Date().toISOString().slice(0,7)}-OFF`,
          date: saleData?.date || new Date().toISOString().split('T')[0],
          amount: saleData.amount || (Number(saleData.quantity||1) * Number(saleData.unitPrice||0)),
        };
        const existsIdx = prev.findIndex(p => String(p.id) === String(newItem.id));
        const next = existsIdx >= 0 ? prev.map((p, i) => i === existsIdx ? newItem : p) : [...prev, newItem];
        localStorage.setItem('sales', JSON.stringify(next));
        try { localStorage.setItem('sales_cache', JSON.stringify(next)); } catch {}
        return next;
      });
      showToast(getErrorMessage(err) || 'Satış yerel olarak kaydedildi (offline)', 'info');
    }
    
    // 📦 YENİ SATIŞ İÇİN STOK DÜŞÜR (çoklu ürün uyumlu)
    if (isNewSale) {
      const lineItems = Array.isArray(saleData.items) && saleData.items.length > 0
        ? saleData.items
        : (saleData.productId ? [{ productId: saleData.productId, quantity: saleData.quantity || 0 }] : []);
      for (const li of lineItems) {
        if (!li?.productId) continue;
        const product = products.find(p => String(p.id) === String(li.productId));
        if (!product) continue;
        const quantity = Number(li.quantity || 0);
        const newStock = Number(product.stockQuantity || 0) - quantity;
        try {
          const updateData = { stock: newStock < 0 ? 0 : newStock };
          await productsApi.updateProduct(String(product.id), updateData);
          // Frontend state güncelle
          setProducts(prev => prev.map(p => String(p.id) === String(product.id)
            ? { ...p, stockQuantity: newStock < 0 ? 0 : newStock, status: newStock <= 0 ? 'out-of-stock' : newStock <= (p.reorderLevel || 0) ? 'low' : 'active' }
            : p
          ));
          if (newStock > 0 && newStock <= (product.reorderLevel || 0)) {
            addNotification('Düşük stok uyarısı', `${product.name} - Stok seviyesi minimum limitin altında! (${newStock}/${product.reorderLevel})`, 'info', 'products', { persistent: true, repeatDaily: true, relatedId: `low-stock-${product.id}` });
          }
          if (newStock <= 0) {
            addNotification('Stok tükendi', `${product.name} - Stok tükendi!`, 'info', 'products', { persistent: true, repeatDaily: true, relatedId: `out-of-stock-${product.id}` });
          }
        } catch (stockError) {
          console.error('Manuel satış - Stok güncellenemedi:', stockError);
          showToast('Satış kaydedildi ancak stok güncellenemedi', 'error');
        }
      }
    }
    
    // 🔔 Yeni satış bildirimi
    if (isNewSale) {
      const summary = Array.isArray(saleData.items) && saleData.items.length > 0
        ? `${saleData.items[0]?.productName || 'Ürün'}${saleData.items.length > 1 ? ` +${saleData.items.length - 1}` : ''}`
        : `${saleData.productName}`;
      const totalAmount = (Array.isArray(saleData.items) && saleData.items.length > 0)
        ? saleData.items.reduce((s:number, it:any) => s + Number(it.total || (it.quantity * it.unitPrice) || 0), 0)
        : (saleData.amount || (saleData.quantity * saleData.unitPrice));
      addNotification('Yeni satış kaydedildi', `${saleData.customerName} - ${summary}: ${totalAmount} TL`, 'success', 'sales');
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    if (!confirm('Bu satışı silmek istediğinizden emin misiniz?')) {
      return;
    }
    
    console.log('🗑️ Satış siliniyor:', saleId);
    try {
      await salesApi.deleteSale(String(saleId));
    } catch (err) {
      console.warn('Backend silme başarısız, yerel silmeye devam:', err);
    }

    setSales(prev => {
      const filtered = prev.filter(sale => String(sale.id) !== String(saleId));
      const tid = localStorage.getItem('tenantId') || '';
      const key = tid ? `sales_${tid}` : 'sales';
      const cacheKey = tid ? `sales_cache_${tid}` : 'sales_cache';
      localStorage.setItem(key, JSON.stringify(filtered));
      try { localStorage.setItem(cacheKey, JSON.stringify(filtered)); } catch {}
      console.log('✅ Satış silindi, kalan satış sayısı:', filtered.length);
      return filtered;
    });
    
    showToast('Satış başarıyla silindi', 'success');
    setShowSaleViewModal(false);
    setSelectedSale(null);
  };

  // Sales state değiştiğinde cache'i senkron tut (çapraz sekme uyumu)
  React.useEffect(() => {
    if (suppressSalesPersistenceRef.current) return;
    try {
      localStorage.setItem('sales_cache', JSON.stringify(sales));
      window.dispatchEvent(new Event('sales-cache-updated'));
    } catch {}
  }, [sales]);

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
        taxRate: Number(productData.taxRate ?? 18), // Kategori KDV'si
        categoryTaxRateOverride: productData.categoryTaxRateOverride ? Number(productData.categoryTaxRateOverride) : undefined, // Özel KDV
      };

      console.log('🚀 Frontend: Backend\'e gönderiliyor:', {
        name: backendData.name,
        category: backendData.category,
        taxRate: backendData.taxRate,
        categoryTaxRateOverride: backendData.categoryTaxRateOverride
      });

      if (productData?.id) {
        // Update existing
        const updated = await productsApi.updateProduct(String(productData.id), backendData);
        setProducts(prev => prev.map(p => p.id === updated.id ? { 
          ...updated,
          sku: updated.code,
          unitPrice: Number(updated.price) || 0,
          costPrice: Number(updated.cost) || 0,
          stockQuantity: Number(updated.stock) || 0,
          reorderLevel: Number(updated.minStock) || 0,
          taxRate: Number(updated.taxRate) || 0,
          categoryTaxRateOverride: (updated as any).categoryTaxRateOverride ? Number((updated as any).categoryTaxRateOverride) : undefined,
          status: updated.stock === 0 ? 'out-of-stock' : updated.stock <= updated.minStock ? 'low' : 'active'
        } as Product : p));
        showToast('Ürün güncellendi', 'success');
      } else {
        // Create new
        const created = await productsApi.createProduct(backendData);
        setProducts(prev => [...prev, { 
          ...created,
          sku: created.code,
          unitPrice: Number(created.price) || 0,
          costPrice: Number(created.cost) || 0,
          stockQuantity: Number(created.stock) || 0,
          reorderLevel: Number(created.minStock) || 0,
          taxRate: Number(created.taxRate) || 0,
          categoryTaxRateOverride: (created as any).categoryTaxRateOverride ? Number((created as any).categoryTaxRateOverride) : undefined,
          status: created.stock === 0 ? 'out-of-stock' : created.stock <= created.minStock ? 'low' : 'active'
        } as Product]);
        showToast('Ürün eklendi', 'success');
        
        // Ürün eklendi bildirimi kaldırıldı (yalnızca düşük stok/tükenmiş stok bildirimleri gösterilecek)
        
        // ⚠️ Stok uyarısı
        if (created.stock <= created.minStock) {
          addNotification(
            'Düşük stok uyarısı',
            `${created.name} - Stok seviyesi minimum limitin altında! (${created.stock}/${created.minStock})`,
            'warning',
            'products'
          );
        }
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

  const addProductCategory = async (categoryName: string, taxRate?: number) => {
    const normalized = categoryName.trim();
    if (!normalized) {
      return;
    }

    try {
      // Backend'e kategori ekle
      if (taxRate !== undefined) {
        const { productCategoriesApi } = await import('./api/product-categories');
        const newCategory = await productCategoriesApi.create({
          name: normalized,
          taxRate: taxRate,
        });
        
        console.log('✅ Kategori backend\'e eklendi:', newCategory);
        
        // State'leri güncelle
        setProductCategoryObjects(prev => [...prev, newCategory]);
      }

      // String array'i de güncelle (geriye uyumluluk)
      setProductCategories(prev => {
        const exists = prev.some(existing => categoriesEqual(existing, normalized));
        if (exists) {
          return prev;
        }
        return [...prev, normalized].sort((a, b) => a.localeCompare(b, "tr-TR"));
      });

      if (taxRate !== undefined) {
        showToast(`${normalized} kategorisi eklendi (KDV: %${taxRate})`, 'success');
      }
    } catch (error: any) {
      console.error('Kategori ekleme hatası:', error);
      showToast(error.response?.data?.message || 'Kategori eklenemedi', 'error');
    }
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
        id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
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

  const openInvoiceModal = async (invoice?: any) => {
    // Eğer mevcut fatura düzenleniyor ise önce detayları (lineItems) gerekiyorsa çek
    if (invoice) {
      let full = invoice;
      const hasItems = Array.isArray(invoice.items) && invoice.items.length > 0;
      const hasLineItems = Array.isArray((invoice as any).lineItems) && (invoice as any).lineItems.length > 0;
      try {
        if (!hasItems && !hasLineItems && invoice.id) {
          full = await invoicesApi.getInvoice(String(invoice.id));
        }
      } catch (e) {
        console.warn('Fatura detayı alınamadı, mevcut veri kullanılacak:', e);
      }
      setSelectedInvoice(normalizeInvoiceForUi(full));
      setShowInvoiceModal(true);
    } else {
      // Yeni fatura için tip seçim modalını aç
      setShowInvoiceTypeModal(true);
    }
  };

  // Yeni fatura akışı handler'ları
  const handleNewSaleForInvoice = () => {
    setShowInvoiceTypeModal(false);
    // Direkt eski invoice modal'ını aç; müşteri seçiliyse ön doldur
    if (preselectedCustomerForInvoice) {
      setSelectedInvoice({
        id: normalizeId(preselectedCustomerForInvoice.id),
        customerName: preselectedCustomerForInvoice.name,
        customerEmail: preselectedCustomerForInvoice.email,
        customerAddress: preselectedCustomerForInvoice.address,
        status: 'draft',
        issueDate: new Date().toISOString().split('T')[0],
      });
    } else {
      setSelectedInvoice(null);
    }
    setShowInvoiceModal(true);
  };

  const handleExistingSaleForInvoice = () => {
    setShowInvoiceTypeModal(false);
    setShowExistingSaleModal(true);
  };

  const handleReturnInvoice = () => {
    setShowInvoiceTypeModal(false);
    // InvoiceModal'ı type='return' olarak aç
    if (preselectedCustomerForInvoice) {
      setSelectedInvoice({
        _isReturnInvoice: true,
        id: normalizeId(preselectedCustomerForInvoice.id),
        customerName: preselectedCustomerForInvoice.name,
        customerEmail: preselectedCustomerForInvoice.email,
        customerAddress: preselectedCustomerForInvoice.address,
        status: 'draft',
        issueDate: new Date().toISOString().split('T')[0],
      } as any);
    } else {
      setSelectedInvoice({ _isReturnInvoice: true } as any);
    }
    setShowInvoiceModal(true);
  };

  const handleSelectSaleForInvoice = (sale: any) => {
    setSelectedSaleForInvoice(sale);
    setShowExistingSaleModal(false);
    setShowInvoiceFromSaleModal(true);
  };

  const handleCreateInvoiceFromSale = async (invoiceData: any) => {
    try {
      console.log('🔍 Invoice data gönderilecek:', invoiceData);
      
      // customerId yoksa customerName'den bul veya saleId'den bul
      let customerId = invoiceData.customerId;
      
      // Eğer selectedSaleForInvoice varsa oradan customerId al
      if (!customerId && selectedSaleForInvoice) {
        const customer = customers.find(c => c.name === selectedSaleForInvoice.customerName);
        customerId = customer?.id;
        console.log('👤 Satıştan müşteri ID bulundu:', {
          saleCustomerName: selectedSaleForInvoice.customerName,
          foundCustomerId: customerId
        });
      }
      
      // customerName'den bul
      if (!customerId && invoiceData.customerName) {
        const customer = customers.find(c => c.name === invoiceData.customerName);
        customerId = customer?.id;
        console.log('👤 Müşteri adından ID bulundu:', {
          customerName: invoiceData.customerName,
          foundCustomerId: customerId,
          availableCustomers: customers.map(c => ({ id: c.id, name: c.name }))
        });
      }
      
      if (!customerId) {
        showToast('Müşteri bulunamadı! Lütfen önce müşteri oluşturun.', 'error');
        throw new Error('customerId gerekli');
      }
      
      // Frontend modaldan gelen veriyi backend formatına dönüştür
      const backendData: any = {
        customerId: customerId,
        issueDate: invoiceData.issueDate || new Date().toISOString().split('T')[0],
        dueDate: invoiceData.dueDate,
        type: invoiceData.type || 'service',
        lineItems: (invoiceData.items || []).map((item: any) => ({
          productId: item.productId,
          description: item.description || item.productName || 'Ürün/Hizmet',
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
          total: Number(item.total) || 0,
        })),
        taxAmount: Number(invoiceData.taxAmount) || 0,
        discountAmount: Number(invoiceData.discountAmount) || 0,
        notes: invoiceData.notes || '',
        status: invoiceData.status || 'draft',
      };

      // Satıştan fatura oluşturuluyorsa ilişkiyi payload'a ekle (backend destekliyorsa)
      if (selectedSaleForInvoice?.id) {
        backendData.saleId = selectedSaleForInvoice.id;
      }
      
      console.log('🚀 Backend formatında gönderilecek veri:', backendData);
      
      // Backend'e invoice oluştur
  const created = await invoicesApi.createInvoice(backendData);
      
      console.log('✅ Fatura oluşturuldu:', {
        id: created.id,
        invoiceNumber: created.invoiceNumber,
        lineItems: created.lineItems
      });
      
      // Frontend state'ini güncelle
      const createdWithLink = selectedSaleForInvoice?.id && !created.saleId
        ? { ...created, saleId: selectedSaleForInvoice.id }
        : created;
      const newInvoices = [...invoices, createdWithLink];
      setInvoices(newInvoices);
      localStorage.setItem('invoices_cache', JSON.stringify(newInvoices));
      
      // 🔗 Satışa invoiceId ekle
      if (selectedSaleForInvoice) {
        const updatedSale = {
          ...selectedSaleForInvoice,
          invoiceId: created.id,
        };
        
        const updatedSales = sales.map(s => 
          s.id === selectedSaleForInvoice.id ? updatedSale : s
        );
        setSales(updatedSales);
        localStorage.setItem('sales_cache', JSON.stringify(updatedSales));
        // Kalıcılık için ana anahtar olan 'sales' de güncellensin
        try { localStorage.setItem('sales', JSON.stringify(updatedSales)); } catch {}
        console.log('🔗 Satış fatura ile ilişkilendirildi:', {
          saleId: selectedSaleForInvoice.id,
          invoiceId: created.id
        });
      }
      
      // 🔔 Bildirimler
      const customerInfo = customers.find(c => c.id === customerId);
      addNotification(
        'Yeni fatura oluşturuldu',
        `${created.invoiceNumber} - ${customerInfo?.name || 'Müşteri'} için fatura hazır.`,
        'success',
        'invoices'
      );
      
      showToast('Fatura başarıyla oluşturuldu', 'success');
      
      // Modal'ları kapat
      setShowInvoiceFromSaleModal(false);
      setSelectedSaleForInvoice(null);
      
      // Oluşturulan faturayı döndür
      return created;
    } catch (error: any) {
      console.error('Invoice creation error:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Fatura oluşturulamadı';
      showToast(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg, 'error');
      throw error;
    }
  };

  const openExpenseModal = (expense?: any, supplierHint?: any) => {
    setSelectedExpense(expense ?? null);
    setSupplierForExpense(supplierHint ?? null);
    setShowExpenseModal(true);
  };

  const openSaleModal = (sale?: any) => {
    console.log('🚪 openSaleModal çağrıldı:', {
      modalAcikMi: showSaleModal,
      saleId: sale?.id,
      isNewSale: !sale
    });
    
    // Modal kapalıysa direkt aç
    if (!showSaleModal) {
      console.log('✅ Modal kapalı, direkt açılıyor');
      setSelectedSale(sale || null);
      setShowSaleModal(true);
      return;
    }
    
    // Modal açıksa: kapat → bekle → state güncelle → aç
    console.log('♻️ Modal açık, kapatıp yeniden açılacak');
    setShowSaleModal(false);
    setTimeout(() => {
      console.log('⏱️ 100ms sonra state güncelleniyor');
      setSelectedSale(sale || null);
      setTimeout(() => {
        console.log('⏱️ 50ms sonra modal açılıyor');
        setShowSaleModal(true);
      }, 50);
    }, 100);
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
    // Fatura akışı bittiğinde ön-seçili müşteriyi sıfırla
    setPreselectedCustomerForInvoice(null);
  };

  const closeExpenseModal = () => {
    setShowExpenseModal(false);
    setSelectedExpense(null);
    setSupplierForExpense(null);
  };

  const closeSaleModal = () => {
    console.log('🚪❌ closeSaleModal çağrıldı');
    setShowSaleModal(false);
    // Modal tamamen kapanana kadar bekle
    setTimeout(() => {
      console.log('⏱️ 100ms sonra selectedSale temizleniyor');
      setSelectedSale(null);
    }, 100);
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
  };
  const closeBankViewModal = () => setShowBankViewModal(false);
  const closeCustomerHistoryModal = () => setShowCustomerHistoryModal(false);
  const closeSupplierHistoryModal = () => setShowSupplierHistoryModal(false);

  const handleCreateInvoiceFromCustomer = (customer: any) => {
    // Üçlü menü akışını aç ve müşteri bağlamını taşı
    setPreselectedCustomerForInvoice(customer || null);
    setShowCustomerViewModal(false);
    setShowCustomerHistoryModal(false);
    setShowInvoiceTypeModal(true);
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

  

  // Invoice nesnesini UI için normalize et: lineItems -> items, müşteri alanlarını zenginleştir
  const normalizeInvoiceForUi = React.useCallback((inv: any) => {
    if (!inv || typeof inv !== 'object') return inv;
    const customerName = inv?.customer?.name || inv?.customerName || '';
    const customerEmail = inv?.customer?.email || inv?.customerEmail || '';
    const customerAddress = inv?.customer?.address || inv?.customerAddress || '';
    let items: any[] = Array.isArray(inv.items) ? inv.items : [];
    if ((!items || items.length === 0) && Array.isArray(inv.lineItems)) {
      items = inv.lineItems.map((li: any, idx: number) => ({
        id: li?.id || `${Date.now()}-${idx}-${Math.random().toString(36).slice(2,8)}`,
        description: li?.description || li?.productName || '',
        quantity: Number(li?.quantity) || 1,
        unitPrice: Number(li?.unitPrice) || 0,
        total: Number(li?.total) || ((Number(li?.quantity) || 1) * (Number(li?.unitPrice) || 0)),
        productId: li?.productId,
        unit: li?.unit,
        taxRate: Number(li?.taxRate ?? 18),
      }));
    }
    // Fatura türünü ürün/hizmet/genel olarak belirle (ürün kategorisi köküne göre)
    const detectType = (): 'product' | 'service' | 'general' | undefined => {
      try {
        if (!Array.isArray(items) || items.length === 0) return inv.type as any;
        const kinds = new Set<'product' | 'service'>();
        const byId = new Map<string, any>();
        products.forEach(p => byId.set(String(p.id), p));
        const catsByName = new Map<string, ProductCategory>();
        productCategoryObjects.forEach(c => catsByName.set((c.name || '').toLowerCase(), c));

        const getRootName = (catName?: string): string | undefined => {
          if (!catName) return undefined;
          const c = catsByName.get(String(catName).toLowerCase());
          if (!c) return String(catName);
          let cur: ProductCategory | undefined = c;
          const byIdLookup = new Map(productCategoryObjects.map(cc => [cc.id, cc] as const));
          while (cur && cur.parentId) {
            cur = byIdLookup.get(cur.parentId);
          }
          return cur?.name || c.name;
        };

        for (const it of items) {
          const p = (it.productId ? byId.get(String(it.productId)) : undefined) ||
                    products.find(pp => (pp.name || '').toLowerCase() === String(it.productName || it.description || '').toLowerCase());
          const catName = p?.category;
          const root = getRootName(catName)?.toLowerCase() || '';
          const normalized = root.normalize('NFD').replace(/\p{Diacritic}/gu, '');
          if (normalized.includes('hizmet') || root.includes('hizmet')) kinds.add('service');
          else if (normalized.includes('urun') || root.includes('ürün')) kinds.add('product');
        }
        if (kinds.size === 0) return inv.type as any;
        if (kinds.size > 1) return 'general';
        return kinds.values().next().value as any;
      } catch {
        return inv.type as any;
      }
    };

    const customer = inv.customer || (inv.customerId ? {
      id: String(inv.customerId),
      name: customerName || undefined,
      email: customerEmail || undefined,
      address: customerAddress || undefined,
    } : undefined);
    const derivedType = detectType();
    return { ...inv, items, customerName, customerEmail, customerAddress, customer, type: derivedType || inv.type };
  }, [products, productCategoryObjects]);

  const handleDownloadInvoice = async (invoice: any) => {
    try {
      // PDF için eksikse tam detay çek (lineItems)
      let full = invoice;
      const hasItems = Array.isArray(invoice?.items) && invoice.items.length > 0;
      const hasLineItems = Array.isArray(invoice?.lineItems) && invoice.lineItems.length > 0;
      if (!hasItems && !hasLineItems && invoice?.id) {
        try {
          full = await invoicesApi.getInvoice(String(invoice.id));
        } catch (e) {
          console.warn('PDF için fatura detayı alınamadı, mevcut veri kullanılacak:', e);
        }
      }
      const mappedInvoice = normalizeInvoiceForUi(full);
      
      const module = await import("./utils/pdfGenerator");
  await module.generateInvoicePDF(mappedInvoice, { company, lang: i18n.language });
    } catch (error) {
      console.error(error);
    }
  };

  // Güvenli görüntüleme: Fatura detayı eksikse (items/lineItems), önce tam veriyi çekip normalize ederek view modal'ı aç
  const openInvoiceView = React.useCallback(async (invoice: any) => {
    try {
      let full = invoice;
      const hasItems = Array.isArray(invoice?.items) && invoice.items.length > 0;
      const hasLineItems = Array.isArray((invoice as any)?.lineItems) && (invoice as any).lineItems.length > 0;
      if (!hasItems && !hasLineItems && invoice?.id) {
        try {
          full = await invoicesApi.getInvoice(String(invoice.id));
        } catch (e) {
          console.warn('Fatura görüntüleme: detay alınamadı, mevcut veri kullanılacak:', e);
        }
      }
      setSelectedInvoice(normalizeInvoiceForUi(full));
      setShowInvoiceViewModal(true);
    } catch (e) {
      console.error('openInvoiceView failed:', e);
      // yine de mevcut veriyi göster
      setSelectedInvoice(normalizeInvoiceForUi(invoice));
      setShowInvoiceViewModal(true);
    }
  }, [normalizeInvoiceForUi]);

  // Global köprü: Alt sayfalardan düzenleme/PDF indir tetiklemek için event dinleyicileri
  React.useEffect(() => {
    const onOpenInvoiceEdit = (e: Event) => {
      const ce = e as CustomEvent;
      const inv = (ce.detail && (ce.detail.invoice || ce.detail)) as any;
      if (inv) openInvoiceModal(inv);
    };
    const onDownloadInvoiceEvt = (e: Event) => {
      const ce = e as CustomEvent;
      const inv = (ce.detail && (ce.detail.invoice || ce.detail)) as any;
      if (inv) handleDownloadInvoice(inv);
    };
    const onOpenQuoteEdit = (e: Event) => {
      const ce = e as CustomEvent;
      const q = (ce.detail && (ce.detail.quote || ce.detail)) as any;
      if (!q) return;
      setSelectedQuote(q);
      setShowQuoteEditModal(true);
    };
    const onOpenSaleEdit = (e: Event) => {
      const ce = e as CustomEvent;
      const s = (ce.detail && (ce.detail.sale || ce.detail)) as any;
      if (s) openSaleModal(s);
    };
    window.addEventListener('open-invoice-edit', onOpenInvoiceEdit as any);
    window.addEventListener('download-invoice', onDownloadInvoiceEvt as any);
    window.addEventListener('open-quote-edit', onOpenQuoteEdit as any);
    window.addEventListener('open-sale-edit', onOpenSaleEdit as any);
    return () => {
      window.removeEventListener('open-invoice-edit', onOpenInvoiceEdit as any);
      window.removeEventListener('download-invoice', onDownloadInvoiceEvt as any);
      window.removeEventListener('open-quote-edit', onOpenQuoteEdit as any);
      window.removeEventListener('open-sale-edit', onOpenSaleEdit as any);
    };
  }, [openInvoiceModal, handleDownloadInvoice]);

  const handleDownloadExpense = async (expense: any) => {
    try {
      const module = await import("./utils/pdfGenerator");
  await module.generateExpensePDF(expense, { company, lang: i18n.language });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDownloadSale = async (sale: any) => {
    try {
      const module = await import("./utils/pdfGenerator");
  await module.generateSalePDF(sale, { company, lang: i18n.language });
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

    // Sadece ödenmiş giderler
    const paidExpenses = expenses.filter(exp => {
      const s = String(exp.status || '').toLowerCase();
      return s.includes('paid') || s.includes('öden') || s.includes('odendi') || s.includes('ödenendi');
    });

    const hasInvoiceForSale = (sale: any) =>
      Boolean(sale?.invoiceId) ||
      invoices.some(inv => String(inv?.saleId || '') === String(sale?.id || ''));

    // Gelir: Ödenmiş faturalar + faturaya dönüşmeyen tamamlanmış satışlar
    const paidInvoicesCurrent = invoices.filter(inv => inv.status === 'paid' && isInMonth(inv?.issueDate, currentMonth, currentYear));
    const paidInvoicesPrevious = invoices.filter(inv => inv.status === 'paid' && isInMonth(inv?.issueDate, previousMonth, previousYear));

    const completedSalesCurrent = sales.filter(sale =>
      String(sale?.status).toLowerCase() === 'completed' &&
      isInMonth(sale?.date || sale?.saleDate, currentMonth, currentYear) &&
      !hasInvoiceForSale(sale)
    );
    const completedSalesPrevious = sales.filter(sale =>
      String(sale?.status).toLowerCase() === 'completed' &&
      isInMonth(sale?.date || sale?.saleDate, previousMonth, previousYear) &&
      !hasInvoiceForSale(sale)
    );

    const revenueCurrent = sum(paidInvoicesCurrent, invoiceAmount) + sum(completedSalesCurrent, saleAmount);
    const revenuePrevious = sum(paidInvoicesPrevious, invoiceAmount) + sum(completedSalesPrevious, saleAmount);

  const expenseCurrent = sum(paidExpenses.filter(expense => isInMonth(expense?.expenseDate, currentMonth, currentYear)), expenseAmount);
    const expensePrevious = sum(paidExpenses.filter(expense => isInMonth(expense?.expenseDate, previousMonth, previousYear)), expenseAmount);

    const outstandingInvoices = invoices.filter(invoice => invoice.status !== "paid");
    const outstandingAmount = sum(outstandingInvoices, invoiceAmount);
    const outstandingCurrent = outstandingInvoices.filter(invoice => isInMonth(invoice?.dueDate || invoice?.issueDate, currentMonth, currentYear)).length;
    const outstandingPrevious = outstandingInvoices.filter(invoice => isInMonth(invoice?.dueDate || invoice?.issueDate, previousMonth, previousYear)).length;

    // Aktif müşteri tanımı: İlgili ayda en az bir işlem (fatura veya satış) yapan benzersiz müşteri
    const normalizeName = (name: any) => (typeof name === 'string' ? name.trim().toLowerCase() : '');

    const countActiveCustomersForPeriod = (month: number, year: number) => {
      const set = new Set<string>();

      // Faturalar (ayın içinde kesilen tüm faturalar)
      invoices.forEach(inv => {
        if (isInMonth(inv?.issueDate, month, year) && inv?.customerName) {
          set.add(normalizeName(inv.customerName));
        }
      });

      // Satışlar (ayın içinde yapılan tüm satışlar)
      sales.forEach(sale => {
        const saleDate = sale?.date || (sale as any)?.saleDate; // backward-compat
        if (isInMonth(saleDate, month, year) && sale?.customerName) {
          set.add(normalizeName(sale.customerName));
        }
      });

      return set.size;
    };

    const customersCurrent = countActiveCustomersForPeriod(currentMonth, currentYear);
    const customersPrevious = countActiveCustomersForPeriod(previousMonth, previousYear);

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
        title: t('dashboard.totalRevenue'),
        value: formatCurrency(revenueCurrent),
        change: formatPercentage(percentChange(revenuePrevious, revenueCurrent)),
        changeType: changeDirection(revenuePrevious, revenueCurrent),
        icon: TrendingUp,
        color: "green" as const,
      },
      {
        title: t('dashboard.totalExpense'),
        value: formatCurrency(expenseCurrent),
        change: formatPercentage(percentChange(expensePrevious, expenseCurrent)),
        changeType: changeDirection(expensePrevious, expenseCurrent),
        icon: CreditCard,
        color: "red" as const,
      },
      {
        title: t('dashboard.pendingInvoices'),
        value: formatCurrency(outstandingAmount),
        change: formatPercentage(percentChange(outstandingPrevious, outstandingCurrent)),
        changeType: changeDirection(outstandingPrevious, outstandingCurrent),
        icon: FileText,
        color: "purple" as const,
        subtitle: t('stats.all'),
      },
      {
        title: t('dashboard.activeCustomers'),
        value: String(customersCurrent),
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
  }, [invoices, expenses, sales, customers, bankAccounts, t]);

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
            subtitle={(card as any).subtitle}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ChartCard sales={sales} expenses={expenses} invoices={invoices} />
          {(() => {
            // Quotes: Son İşlemler için local cache'den oku (tenant scoped)
            let quotesForRecent: any[] = [];
            try {
              const tid = tenant?.id;
              const key = tid ? `quotes_cache_${tid}` : 'quotes_cache';
              const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
              const list = raw ? JSON.parse(raw) : [];
              if (Array.isArray(list)) quotesForRecent = list;
            } catch {}
            return (
          <RecentTransactions
            invoices={invoices}
            expenses={expenses}
            sales={sales}
            quotes={quotesForRecent}
            onViewInvoice={(invoice) => { openInvoiceView(invoice); }}
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
            onViewQuote={quote => {
              setSelectedQuote(quote as any);
              setShowQuoteViewModal(true);
            }}
            onViewAllTransactions={() => navigateTo("general-ledger")}
          />
            );
          })()}
        </div>
        <div className="space-y-6">
          <QuickActions
            onNewInvoice={() => openInvoiceModal()}
            onNewExpense={() => openExpenseModal()}
            onNewSale={() => openSaleModal()}
            onNewQuote={() => setShowQuoteCreateModal(true)}
            onNewCustomer={() => openCustomerModal()}
            onNewProduct={() => openProductModal()}
            onViewCustomers={() => navigateTo("customers")}
            onViewSuppliers={() => navigateTo("suppliers")}
            onViewBanks={() => navigateTo("banks")}
            onViewProducts={() => navigateTo("products")}
            customers={customers}
            suppliers={suppliers}
            banks={bankAccounts}
            products={products}
          />
          <FiscalPeriodsWidget
            onNavigateToFiscalPeriods={() => navigateTo("fiscal-periods")}
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
    // Dinamik rota: customer-history:<id>
    if (currentPage.startsWith('customer-history:')) {
      const CustomerHistoryPage = React.lazy(() => import('./components/CustomerHistoryPage'));
      return (
        <React.Suspense fallback={<div className="p-6">Yükleniyor...</div>}>
          <CustomerHistoryPage />
        </React.Suspense>
      );
    }
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
            onImportProducts={handleImportProducts}
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
            onViewInvoice={(invoice) => { openInvoiceView(invoice); }}
            onUpdateInvoice={handleInlineUpdateInvoice}
            onDownloadInvoice={handleDownloadInvoice}
            onVoidInvoice={voidInvoice}
            onRestoreInvoice={restoreInvoice}
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
            onVoidExpense={voidExpense}
            onRestoreExpense={restoreExpense}
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
            onSalesUpdate={(updatedSales) => {
              // Her satış için upsertSale çağır
              console.log('📊 SimpleSalesPage sales güncelleme:', updatedSales.length);
              setSales(updatedSales);
            }}
            onUpsertSale={upsertSale}
            onCreateInvoice={upsertInvoice}
            onEditInvoice={invoice => openInvoiceModal(invoice)}
            onDownloadSale={handleDownloadSale}
          />
        );
      case "quotes":
        return <QuotesPage customers={customers} products={products} />;
      case "reports":
        return <ReportsPage invoices={invoices} expenses={expenses} sales={sales} customers={customers} />;
      case "general-ledger":
        return (
          <GeneralLedger
            invoices={invoices}
            expenses={expenses}
            sales={sales}
            onViewInvoice={(invoice) => { openInvoiceView(invoice); }}
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
            onViewInvoice={(invoice) => { openInvoiceView(invoice); }}
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
            initialTab={settingsInitialTab}
          />
        );
      case "fiscal-periods":
        return (
          <SettingsPage
            user={user}
            company={company}
            bankAccounts={bankAccounts}
            onUserUpdate={setUser}
            onCompanyUpdate={handleCompanyUpdate}
            onExportData={handleExportData}
            onImportData={handleImportData}
            initialTab={'fiscal-periods'}
          />
        );
      case "admin":
        return <AdminPage />;
      case "legal-terms":
        return <TermsOfService />;
      case "legal-privacy":
        return <PrivacyPolicy />;
      case "legal-subprocessors":
        return <SubprocessorsList />;
      case "legal-dpa":
        return <DataProcessingAgreement />;
      case "legal-cookies":
        return <CookiePolicy />;
      case "organization-members":
        return (
          <SettingsPage
            user={user}
            company={company}
            bankAccounts={bankAccounts}
            onUserUpdate={setUser}
            onCompanyUpdate={handleCompanyUpdate}
            onExportData={handleExportData}
            onImportData={handleImportData}
            initialTab={'organization'}
          />
        );
      default:
        // Handle join organization with token
        if (currentPage.startsWith('join-organization:')) {
          const token = currentPage.replace('join-organization:', '');
          return (
            <JoinOrganizationPage
              token={token}
              onJoinSuccess={() => {
                // Redirect to dashboard after successful join
                setCurrentPage('dashboard');
                window.location.hash = '';
              }}
              onNavigateHome={() => {
                // Redirect to home/landing
                setCurrentPage('landing');
                window.location.hash = '';
              }}
              onNavigateDashboard={() => {
                // Redirect to dashboard
                setCurrentPage('dashboard');
                window.location.hash = '';
              }}
            />
          );
        }
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
      {showQuoteCreateModal && (
        <QuoteCreateModal
          isOpen={showQuoteCreateModal}
          onClose={() => setShowQuoteCreateModal(false)}
          customers={customers}
          products={products}
          onCreate={(payload: QuoteCreatePayload) => {
            try {
              const tid = (authUser?.tenantId != null ? String(authUser.tenantId) : (localStorage.getItem('tenantId') || '')) as string;
              const key = tid ? `quotes_cache_${tid}` : 'quotes_cache';
              const raw = localStorage.getItem(key);
              const list = raw ? (JSON.parse(raw) as any[]) : [];
              const nextIndex = (Array.isArray(list) ? list.length : 0) + 1;
              const id = `q${Date.now()}`;
              const quoteNumber = `Q-${new Date().getFullYear()}-${String(nextIndex).padStart(4, '0')}`;
              const next = {
                id,
                quoteNumber,
                customerName: payload.customer.name,
                customerId: String(payload.customer.id ?? ''),
                issueDate: payload.issueDate,
                validUntil: payload.validUntil,
                currency: payload.currency,
                total: payload.total,
                status: 'draft',
                version: 1,
                items: payload.items,
              };
              const updated = [next, ...(Array.isArray(list) ? list : [])];
              localStorage.setItem(key, JSON.stringify(updated));
              setShowQuoteCreateModal(false);
              showToast('Teklif oluşturuldu', 'success');
            } catch (e) {
              console.error('Quote create (dashboard) failed:', e);
              showToast('Teklif oluşturulamadı', 'error');
            }
          }}
        />
      )}
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

      {/* Yeni Fatura Akışı Modal'ları */}
      {showInvoiceTypeModal && (
        <InvoiceTypeSelectionModal
          isOpen={showInvoiceTypeModal}
          onClose={() => setShowInvoiceTypeModal(false)}
          onSelectNewSale={handleNewSaleForInvoice}
          onSelectExistingSale={handleExistingSaleForInvoice}
          onSelectReturn={handleReturnInvoice}
        />
      )}

      {showExistingSaleModal && (
        <ExistingSaleSelectionModal
          isOpen={showExistingSaleModal}
          onClose={() => setShowExistingSaleModal(false)}
          onSelectSale={handleSelectSaleForInvoice}
          sales={preselectedCustomerForInvoice
            ? sales.filter(s =>
                (s.customerName && preselectedCustomerForInvoice?.name && String(s.customerName) === String(preselectedCustomerForInvoice.name)) ||
                (s.customerEmail && preselectedCustomerForInvoice?.email && String(s.customerEmail) === String(preselectedCustomerForInvoice.email))
              )
            : sales}
          existingInvoices={invoices}
        />
      )}

      {showInvoiceFromSaleModal && selectedSaleForInvoice && (
        <InvoiceFromSaleModal
          isOpen={showInvoiceFromSaleModal}
          onClose={() => {
            setShowInvoiceFromSaleModal(false);
            setSelectedSaleForInvoice(null);
          }}
          onSave={handleCreateInvoiceFromSale}
          sale={selectedSaleForInvoice}
        />
      )}

      {showInvoiceModal && (
        <InvoiceModal
          onClose={closeInvoiceModal}
          onSave={async (invoice) => {
            await upsertInvoice(invoice);
            closeInvoiceModal();
          }}
          invoice={selectedInvoice}
          customers={customers}
          products={products}
          invoices={invoices}
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
          suppliers={suppliers}
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
          categoryObjects={productCategoryObjects}
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
          country={company?.country as any}
        />
      )}

      <CustomerViewModal
        isOpen={showCustomerViewModal}
        onClose={closeCustomerViewModal}
        customer={selectedCustomer}
        onEdit={customer => {
          setShowCustomerViewModal(false);
          setTimeout(() => openCustomerModal(customer), 50);
        }}
        onCreateInvoice={handleCreateInvoiceFromCustomer}
        onRecordPayment={handleRecordPaymentForCustomer}
        onViewHistory={customer => {
          try {
            const url = `${window.location.origin}/#customer-history:${encodeURIComponent(String(customer?.id || ''))}`;
            window.open(url, '_blank');
          } catch {
            // Fallback: mevcut sekmede aç
            setCurrentPage(`customer-history:${String(customer?.id || '')}`);
          }
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
        onDelete={handleDeleteSale}
        onDownload={handleDownloadSale}
      />

      <QuoteViewModal
        isOpen={showQuoteViewModal}
        onClose={() => setShowQuoteViewModal(false)}
        quote={selectedQuote as any}
        onEdit={(q) => {
          setShowQuoteViewModal(false);
          setTimeout(() => {
            setSelectedQuote(q as any);
            setShowQuoteEditModal(true);
          }, 50);
        }}
      />

      {showQuoteEditModal && (
        <QuoteEditModal
          isOpen={showQuoteEditModal}
          onClose={() => setShowQuoteEditModal(false)}
          quote={selectedQuote as any}
          products={products}
          onSave={async (updated) => {
            try {
              const saved = await quotesApi.updateQuote(String(updated.id), {
                customerId: (updated as any).customerId,
                customerName: updated.customerName,
                issueDate: updated.issueDate,
                validUntil: updated.validUntil,
                currency: updated.currency as any,
                total: updated.total,
                items: (updated.items || []).map(it => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, total: it.total, productId: it.productId, unit: it.unit })),
                scopeOfWorkHtml: (updated as any).scopeOfWorkHtml || '',
                status: updated.status,
              } as any);

              // Local quotes cache'i güncelle (CustomerHistoryModal bu cache'i okuyor)
              try {
                const tid = (localStorage.getItem('tenantId') || '') as string;
                const key = tid ? `quotes_cache_${tid}` : 'quotes_cache';
                const raw = localStorage.getItem(key);
                const list: any[] = raw ? JSON.parse(raw) : [];
                const next = Array.isArray(list) ? list.map((q: any) => (
                  String(q.id) === String(saved.id)
                    ? {
                        ...q,
                        quoteNumber: saved.quoteNumber ?? q.quoteNumber,
                        customerName: saved.customer?.name || saved.customerName || updated.customerName,
                        customerId: saved.customerId ?? (q as any).customerId,
                        issueDate: String(saved.issueDate || updated.issueDate).slice(0,10),
                        validUntil: saved.validUntil ? String(saved.validUntil).slice(0,10) : (updated.validUntil || null),
                        currency: saved.currency ?? updated.currency,
                        total: Number(saved.total ?? updated.total) || 0,
                        status: saved.status ?? updated.status,
                        version: saved.version ?? q.version,
                        scopeOfWorkHtml: saved.scopeOfWorkHtml ?? (q as any).scopeOfWorkHtml,
                        items: Array.isArray(saved.items) ? saved.items : (q.items || updated.items || []),
                      }
                    : q
                )) : [];
                localStorage.setItem(key, JSON.stringify(next));
                try { window.dispatchEvent(new Event('quotes-cache-updated')); } catch {}
              } catch (e) {
                console.warn('Quotes cache update failed:', e);
              }
            } catch (e) {
              console.error('Quote update failed:', e);
            } finally {
              setShowQuoteEditModal(false);
            }
          }}
        />
      )}

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
        invoices={invoices.filter(inv => {
          const sel = selectedCustomer;
          if (!sel) return false;
          const invCustomerId = String(inv?.customerId || inv?.customer?.id || '');
          const selId = String(sel?.id || '');
          if (invCustomerId && selId) return invCustomerId === selId;
          // Fallback: isim eşleşmesi
          const invName = String(inv?.customer?.name || inv?.customerName || '').trim();
          const selName = String(sel?.name || '').trim();
          return invName && selName && invName === selName;
        })}
        sales={sales.filter(sale => sale.customerName === selectedCustomer?.name)}
        onViewInvoice={async invoice => {
          closeCustomerHistoryModal();
          setTimeout(async () => {
            let full = invoice;
            const hasItems = Array.isArray(invoice?.items) && invoice.items.length > 0;
            const hasLineItems = Array.isArray((invoice as any)?.lineItems) && (invoice as any).lineItems.length > 0;
            if (!hasItems && !hasLineItems && invoice?.id) {
              try {
                full = await invoicesApi.getInvoice(String(invoice.id));
              } catch (e) {
                console.warn('Geçmişten fatura görüntüleme: detay alınamadı, mevcut veri kullanılacak:', e);
              }
            }
            setSelectedInvoice(normalizeInvoiceForUi(full));
            setShowInvoiceViewModal(true);
          }, 50);
        }}
        onViewSale={sale => {
          closeCustomerHistoryModal();
          setTimeout(() => {
            setSelectedSale(sale);
            setShowSaleViewModal(true);
          }, 50);
        }}
        onViewQuote={quote => {
          closeCustomerHistoryModal();
          setTimeout(() => {
            setSelectedQuote(quote as any);
            setShowQuoteViewModal(true);
          }, 50);
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

      {deleteWarningData && (
        <DeleteWarningModal
          isOpen={showDeleteWarning}
          onClose={() => {
            setShowDeleteWarning(false);
            setDeleteWarningData(null);
          }}
          title={deleteWarningData.title}
          message={deleteWarningData.message}
          relatedItems={deleteWarningData.relatedItems}
          itemType={deleteWarningData.itemType}
        />
      )}

      {infoModal && (
        <InfoModal
          isOpen={true}
          title={infoModal.title}
          message={infoModal.message}
          tone={infoModal.tone}
          confirmLabel={infoModal.confirmLabel || t('common.ok')}
          onConfirm={infoModal.onConfirm}
          onClose={() => setInfoModal(null)}
        />
      )}
    </>
  );

  // Kabul edilen teklifleri satışa dönüştür (public sayfadan tetiklenebilir)
  React.useEffect(() => {
    const processAcceptedQuotes = async () => {
      try {
        const tid = (authUser?.tenantId != null ? String(authUser.tenantId) : (localStorage.getItem('tenantId') || '')) as string;
        const key = tid ? `quotes_cache_${tid}` : 'quotes_cache';
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const list: any[] = JSON.parse(raw);
        if (!Array.isArray(list) || list.length === 0) return;

        let changed = false;
        for (const q of list) {
          if (q && q.status === 'accepted') {
            // Çoklu sekme yarışı için basit bir kilit: pending:<token> → done
            const flagKey = `quote_converted_${q.id}`;
            const curr = localStorage.getItem(flagKey);
            if (curr === 'done' || q.convertedToSale) {
              continue;
            }
            if (curr && curr.startsWith('pending:')) {
              // Başka bir sekme çalışıyor; bu turda atla
              continue;
            }
            const token = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
            try { localStorage.setItem(flagKey, `pending:${token}`); } catch {}
            // Kilidi gerçekten aldık mı?
            const verify = localStorage.getItem(flagKey);
            if (verify !== `pending:${token}`) {
              continue;
            }
            const items = Array.isArray(q.items) ? q.items : [];
            const mappedItems = items.map((it: any) => ({
              productId: it?.productId,
              productName: it?.description || it?.productName || 'Ürün/Hizmet',
              quantity: Number(it?.quantity || 1),
              unitPrice: Number(it?.unitPrice || 0),
              total: Number(it?.total || (Number(it?.unitPrice || 0) * Number(it?.quantity || 1)))
            }));
            const totalAmount = mappedItems.reduce((s: number, li: any) => s + Number(li.total || 0), 0);
            // Backend'e idempotent istek: sourceQuoteId ile
            try {
              const saved = await salesApi.createSale({
                customerId: (q as any).customerId,
                saleDate: new Date().toISOString().split('T')[0],
                items: mappedItems.map((it: any) => ({
                  productId: it.productId,
                  productName: it.productName,
                  quantity: Number(it.quantity) || 1,
                  unitPrice: Number(it.unitPrice) || 0,
                  taxRate: Number(it.taxRate ?? 18),
                })),
                discountAmount: 0,
                notes: 'Teklif kabul edildi (otomatik oluşturuldu)'.trim(),
                sourceQuoteId: String(q.id),
              });
              // Başarılıysa state'i anında güncelle (yenilemeden görünür)
              const mapped = {
                id: saved.id,
                saleNumber: saved.saleNumber || undefined,
                customerName: q.customerName,
                customerEmail: undefined,
                items: Array.isArray(saved.items) ? saved.items : mappedItems,
                productName: mappedItems.length > 0 ? `${mappedItems[0].productName}${mappedItems.length > 1 ? ` +${mappedItems.length - 1}` : ''}` : 'Tekliften Satış',
                quantity: mappedItems[0]?.quantity || undefined,
                unitPrice: mappedItems[0]?.unitPrice || undefined,
                amount: Number(saved.total ?? totalAmount) || totalAmount,
                total: Number(saved.total ?? totalAmount) || totalAmount,
                date: saved.saleDate ? String(saved.saleDate).slice(0, 10) : new Date().toISOString().slice(0,10),
                status: 'completed' as const,
                sourceQuoteId: String(q.id),
              } as any;
              setSales(prev => {
                const exists = prev.some(s => String((s as any).sourceQuoteId || '') === String(q.id) || String(s.id) === String(saved.id));
                const next = exists ? prev : [...prev, mapped];
                try {
                  const tid = localStorage.getItem('tenantId') || '';
                  const key = tid ? `sales_${tid}` : 'sales';
                  const cacheKey = tid ? `sales_cache_${tid}` : 'sales_cache';
                  localStorage.setItem(key, JSON.stringify(next));
                  localStorage.setItem(cacheKey, JSON.stringify(next));
                } catch {}
                return next;
              });
            } catch (e) {
              console.warn('Quote→Sale dönüşümünde backend hatası, local fallback kullanılacak:', e);
              // Fallback: Local state ile oluştur (idempotent upsert)
              const saleData = {
                customerName: q.customerName,
                productName: mappedItems.length > 0 ? `${mappedItems[0].productName}${mappedItems.length > 1 ? ` +${mappedItems.length - 1}` : ''}` : 'Tekliften Satış',
                amount: totalAmount,
                total: totalAmount,
                items: mappedItems,
                date: new Date().toISOString().split('T')[0],
                status: 'completed',
                sourceType: 'quote',
                sourceQuoteId: String(q.id),
              };
              try { await upsertSale(saleData); } catch {}
            }
            q.convertedToSale = true;
            // Kilidi tamamlandı olarak işaretle
            try { localStorage.setItem(flagKey, 'done'); } catch {}
            changed = true;
          }
        }
        if (changed) {
          localStorage.setItem(key, JSON.stringify(list));
        }
      } catch (e) {
        console.warn('Accepted quotes processing failed:', e);
      }
    };

    const onStorage = (e: StorageEvent) => {
      const tid = (authUser?.tenantId != null ? String(authUser.tenantId) : (localStorage.getItem('tenantId') || '')) as string;
      const key = tid ? `quotes_cache_${tid}` : 'quotes_cache';
      if (e.key === key) {
        processAcceptedQuotes();
      }
      // Satışlar mevcut sistem tarafından zaten güncelleniyor; burada state'i ezmeyelim
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        processAcceptedQuotes();
      }
    };

  window.addEventListener('storage', onStorage);
  window.addEventListener('quotes-cache-updated', processAcceptedQuotes as any);
    document.addEventListener('visibilitychange', onVisibility);
    // İlk açılışta kontrol et
    processAcceptedQuotes();

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('quotes-cache-updated', processAcceptedQuotes as any);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // If this is a public quote view, render a minimal standalone page
  if (publicQuoteId) {
    return (
      <div className="min-h-screen">
        <PublicQuotePage quoteId={publicQuoteId} />
      </div>
    );
  }

  // Admin sayfası için authentication bypass
  if (currentPage === 'admin') {
    return <AdminPage />;
  }

  // Register sayfası için authentication bypass
  if (currentPage === 'register') {
    return <RegisterPage />;
  }

  // Landing page for non-authenticated users at root path
  if (currentPage === 'landing') {
    return <LandingPage />;
  }

  // Login page for non-authenticated users trying to access protected routes
  if (!isAuthenticated && currentPage === 'login') {
    return <LoginPage />;
  }

  // Forgot/Reset/Verify pages (public)
  if (!isAuthenticated && currentPage === 'forgot-password') {
    return <ForgotPasswordPage />;
  }
  if (!isAuthenticated && currentPage === 'reset-password') {
    return <ResetPasswordPage />;
  }
  if (!isAuthenticated && currentPage === 'verify-email') {
    return <VerifyEmailPage />;
  }
  if (!isAuthenticated && currentPage === 'verify-notice') {
    return <VerifyNoticePage />;
  }

  // Allow access to legal pages without authentication
  if (!isAuthenticated && currentPage.startsWith('legal-')) {
    const renderLegalContent = () => {
      switch (currentPage) {
        case "legal-terms":
          return <TermsOfService />;
        case "legal-privacy":
          return <PrivacyPolicy />;
        case "legal-subprocessors":
          return <SubprocessorsList />;
        case "legal-dpa":
          return <DataProcessingAgreement />;
        case "legal-cookies":
          return <CookiePolicy />;
        default:
          return <div>Legal page not found</div>;
      }
    };

    return (
      <div className="min-h-screen bg-slate-50">
        <LegalHeader />
        {renderLegalContent()}
      </div>
    );
  }

  // Help Center is public and also accessible when authenticated
  if (currentPage === 'help') {
    return <HelpCenter />;
  }

  // About is public
  if (currentPage === 'about') {
    return <AboutPage />;
  }

  // API sayfası (public)
  if (currentPage === 'api') {
    return <ApiPage />;
  }

  // Status page public değil; Admin içinde gösterilecek

  // Redirect non-authenticated users to landing page from protected routes
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Compute custom header title (no hooks; keep unconditional)
  const customHeaderTitle = (() => {
    if (typeof currentPage === 'string' && currentPage.startsWith('customer-history:')) {
      const cid = currentPage.split(':')[1];
      if (cid) {
        const found = customers.find((c: any) => String(c.id) === String(cid));
        if (found?.name) return String(found.name);
        try {
          const raw = localStorage.getItem('customers_cache');
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              const fromCache = arr.find((c: any) => String(c.id) === String(cid));
              if (fromCache?.name) return String(fromCache.name);
            }
          }
        } catch {}
      }
      return undefined;
    }
    return undefined;
  })();

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
            activePage={currentPage}
            customTitle={customHeaderTitle}
            onToggleSidebar={handleToggleSidebar}
            notifications={notifications}
            unreadCount={unreadNotificationCount}
            isNotificationsOpen={isNotificationsOpen}
            onToggleNotifications={handleToggleNotifications}
            onCloseNotifications={handleCloseNotifications}
            onNotificationClick={handleNotificationClick}
            onOpenSettingsProfile={() => openSettingsOn('profile')}
          />

          <main className="flex-1 px-3 py-6 sm:px-6 lg:px-8">
            {renderPage()}
          </main>
        </div>
      </div>

      {renderToasts()}
      {renderModals()}
      
      {/* Cookie Consent Components */}
      <CookieConsentBanner />
      <CookiePreferencesModal />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <CurrencyProvider>
        <CookieConsentProvider>
          <NotificationPreferencesProvider>
            <AppContent />
          </NotificationPreferencesProvider>
        </CookieConsentProvider>
      </CurrencyProvider>
    </LanguageProvider>
  );
};

export default App;















































