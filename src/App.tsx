import React, { useEffect, useMemo, useState } from "react";
import { Users, FileText, CreditCard, TrendingUp } from "lucide-react";
import { useAuth } from "./contexts/AuthContext";
import { CurrencyProvider, useCurrency } from "./contexts/CurrencyContext";
import type { Currency } from "./contexts/CurrencyContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { CookieConsentProvider } from "./contexts/CookieConsentContext";
import { NotificationPreferencesProvider, useNotificationPreferences } from "./contexts/NotificationPreferencesContext";
import { analyticsManager } from "./utils/analyticsManager";
import { useTranslation } from "react-i18next";
import type { CompanyProfile } from "./utils/pdfGenerator";
import type {
  User,
  Product,
  ProductCategory,
  Sale,
  Invoice,
  Bank,
  ChartAccount,
} from "./types";
import type {
  CustomerRecord,
  SupplierRecord,
  InvoiceRecord,
  ExpenseRecord,
} from "./types/records";
import { secureStorage } from "./utils/storage";
import { getErrorMessage } from "./utils/errorHandler";
import { isEmailVerificationRequired } from "./utils/emailVerification";
import { logger } from "./utils/logger";

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
import ErrorBoundary from "./components/ErrorBoundary";
import AdminPage from "./components/AdminPage";

// New Invoice Flow Modals
import InvoiceTypeSelectionModal from "./components/InvoiceTypeSelectionModal";
import ExistingSaleSelectionModal from "./components/ExistingSaleSelectionModal";
import InvoiceFromSaleModal, { type InvoiceDraftPayload } from "./components/InvoiceFromSaleModal";

// view modals
import CustomerViewModal from "./components/CustomerViewModal";
import ProductViewModal from "./components/ProductViewModal";
import SupplierViewModal from "./components/SupplierViewModal";
import InvoiceViewModal from "./components/InvoiceViewModal";
import ExpenseViewModal from "./components/ExpenseViewModal";
import SaleViewModal from "./components/SaleViewModal";
import BankViewModal from "./components/BankViewModal";
import InfoModal from "./components/InfoModal";
import ConfirmModal from "./components/ConfirmModal";
import QuoteViewModal, { type Quote as QuoteModel } from "./components/QuoteViewModal";
import QuoteEditModal from "./components/QuoteEditModal";

// history modals
import CustomerHistoryModal from "./components/CustomerHistoryModal";
import SupplierHistoryModal from "./components/SupplierHistoryModal";
import DeleteWarningModal, { type DeleteWarningRelatedItem } from "./components/DeleteWarningModal";

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
import VerifyNoticePage from "./components/VerifyNoticePage";
import LandingPage from "./components/landing/LandingPage";
import AboutPage from "./components/landing/AboutPage";
import ApiPage from "./components/landing/ApiPage";

// legal pages
import TermsOfService from "./components/legal/TermsOfService";
import PrivacyPolicy from "./components/legal/PrivacyPolicy";
import SubprocessorsList from "./components/legal/SubprocessorsList";
import DataProcessingAgreement from "./components/legal/DataProcessingAgreement";
import CookiePolicy from "./components/legal/CookiePolicy";
import Imprint from "./components/legal/Imprint";
import EmailPolicy from "./components/legal/EmailPolicy";
import HelpCenter from "./components/help/HelpCenter";

// cookie consent components
import CookieConsentBanner from "./components/CookieConsentBanner";
import CookiePreferencesModal from "./components/CookiePreferencesModal";

// legal header & misc
import LegalHeader from "./components/LegalHeader";
import JoinOrganizationPage from "./components/JoinOrganizationPage";
import PublicQuotePage from "./components/PublicQuotePage";
import * as quotesApi from "./api/quotes";
import { SeoInjector } from "./components/SeoInjector";
import AnnouncementBar from "./components/AnnouncementBar";

import {
  readNotificationPrefsCache,
  readTenantScopedArray,
  readTenantScopedObject,
  readTenantScopedValue,
  buildTenantScopedKey,
  safeLocalStorage,
  safeSessionStorage,
  writeTenantScopedArray,
  writeTenantScopedObject,
  writeTenantScopedValue,
  readLegacyAuthToken,
  readLegacyTenantId,
  writeLegacyTenantId,
  readLegacyUserProfile,
} from "./utils/localStorageSafe";
import { toNumberSafe } from "./utils/sortAndSearch";
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
  currency: "TRY",
};

type Nullable<T> = T | null | undefined;

const toTenantId = (value: Nullable<string | number>): string | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  return undefined;
};

const resolveTenantScopedId = (
  tenantCandidate?: { id?: string | null } | null,
  fallbackTenantId?: Nullable<string | number>
): string | undefined => {
  return toTenantId(tenantCandidate?.id)
    || toTenantId(fallbackTenantId)
    || toTenantId(readLegacyTenantId());
};

const getTenantIdForCompanyCache = (): string => toTenantId(readLegacyTenantId()) || '';
const getCompanyProfileCacheKey = (tenantId: Nullable<string>): string => (tenantId ? `companyProfile_${tenantId}` : 'companyProfile');

const readCompanyProfileFromPlainStorage = (tenantId: Nullable<string>): CompanyProfile | null => {
  const baseKey = getCompanyProfileCacheKey(tenantId || '');
  try {
    const raw = safeLocalStorage.getItem(baseKey)
      || safeLocalStorage.getItem(`${baseKey}_plain`)
      || safeLocalStorage.getItem('company');
    return raw ? (JSON.parse(raw) as CompanyProfile) : null;
  } catch {
    return null;
  }
};

// Bildirimler başlangıçta boş - backend'den veya işlemlerden dinamik oluşturulacak
const initialNotifications: HeaderNotification[] = [];

type StoredNotificationInput = Partial<HeaderNotification> & {
  relatedId?: string | number;
  firstSeenAt?: number | string;
  time?: string | number;
};

const resolveNotificationId = (notif: StoredNotificationInput, index: number): string => {
  const rawId = typeof notif.id === 'string' && notif.id.trim() ? notif.id.trim() : null;
  if (rawId) return rawId;
  const related = notif.relatedId ? String(notif.relatedId) : null;
  const suffix = `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`;
  return related ? `${related}-${suffix}` : `notif-${suffix}`;
};

const coerceTimestamp = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const normalizeStoredNotifications = (stored?: StoredNotificationInput[] | null): HeaderNotification[] => {
  const locale = (() => {
    const lang = typeof navigator !== 'undefined' ? navigator.language : 'tr';
    return (lang || 'tr').slice(0, 2);
  })();

  const list = Array.isArray(stored) ? stored : [];
  return list.map((notif, index) => {
    const id = resolveNotificationId(notif, index);
    const tsFromIdMatch = id.match(/\b\d{13}\b/);
    const guessedTs = tsFromIdMatch ? Number(tsFromIdMatch[0]) : Date.now();
    const firstSeenAt = coerceTimestamp(notif.firstSeenAt, guessedTs);
    const timeStr = typeof notif.time === 'string' && notif.time.trim()
      ? notif.time
      : new Date(firstSeenAt).toLocaleString(locale);

    return {
      ...notif,
      id,
      firstSeenAt,
      time: timeStr,
    } as HeaderNotification;
  });
};

const normalizeRelatedItems = (items: unknown): DeleteWarningRelatedItem[] => {
  if (!Array.isArray(items)) return [];

  return items
    .filter(item => item != null)
    .map((item, index) => {
      if (typeof item === 'object' && item !== null) {
        const candidate = item as Record<string, unknown>;
        const rawId = candidate.id;
        const resolvedId = typeof rawId === 'string' || typeof rawId === 'number'
          ? rawId
          : `item-${index}`;
        return {
          ...candidate,
          id: resolvedId,
        } as DeleteWarningRelatedItem;
      }

      return {
        id: `item-${index}`,
        description: typeof item === 'string' ? item : String(item),
      } as DeleteWarningRelatedItem;
    });
};

const normalizeProductTaxRate = (value: unknown): number | undefined => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return undefined;
  }
  return Math.round(numeric * 100) / 100;
};

const mapBackendProductRecord = (record: any): Product => {
  const rawStock = Number(record.stock);
  const stockQuantity = Number.isFinite(rawStock) ? Math.max(0, rawStock) : 0;
  const minStock = Number(record.minStock) || 0;
  return {
    ...record,
    sku: record.code,
    unitPrice: Number(record.price) || 0,
    costPrice: Number(record.cost) || 0,
    stockQuantity,
    reorderLevel: minStock,
    taxRate: normalizeProductTaxRate(record.taxRate),
    categoryTaxRateOverride: normalizeProductTaxRate(record.categoryTaxRateOverride),
    status: stockQuantity === 0
      ? 'out-of-stock'
      : stockQuantity <= minStock
        ? 'low'
        : 'active',
  } as Product;
};

const initialProductCategories = ["Genel"]; // Boş başlangıç, backend'den yüklenecek
const initialProductCategoryObjects: ProductCategory[] = []; // Kategori nesneleri

const LAST_PAGE_STORAGE_KEY = 'app:lastPage';
const HASH_SYNC_PAGES = [
  'dashboard',
  'invoices',
  'expenses',
  'customers',
  'products',
  'suppliers',
  'banks',
  'sales',
  'quotes',
  'reports',
  'general-ledger',
  'chart-of-accounts',
  'archive',
  'settings',
  'fiscal-periods',
  'organization-members',
] as const;
const HASH_SYNC_PAGE_SET = new Set<string>(HASH_SYNC_PAGES);

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
 
type BackendInvoiceLineItem = {
  productId?: string | number;
  productName?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxRate?: number;
};
 
type BackendInvoicePayload = {
  customerId: string;
  issueDate: string;
  dueDate: string;
  type: 'product' | 'service';
  lineItems: BackendInvoiceLineItem[];
  taxAmount: number;
  discountAmount: number;
  notes: string;
  status: Invoice['status'];
  saleId?: string | number;
};

type SalesUpdater = Sale[] | ((prev: Sale[]) => Sale[]);

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
  duration: number;
}

const formatPercentage = (value: number) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

const reportSilentError = (scope: string, detail?: unknown) => {
  logger.debug(scope, detail);
};

const readLastVisitedPage = (): string | null => {
  try {
    return safeSessionStorage.getItem(LAST_PAGE_STORAGE_KEY) || safeLocalStorage.getItem(LAST_PAGE_STORAGE_KEY);
  } catch (error) {
    reportSilentError('app.navigation.lastPage.readFailed', error);
    return null;
  }
};

const persistLastVisitedPage = (page: string): void => {
  if (!page) return;
  try {
    safeSessionStorage.setItem(LAST_PAGE_STORAGE_KEY, page);
    safeLocalStorage.setItem(LAST_PAGE_STORAGE_KEY, page);
  } catch (error) {
    reportSilentError('app.navigation.lastPage.persistFailed', { page, error });
  }
};


const AppContent: React.FC = () => {
  const { isAuthenticated, user: authUser, logout, tenant } = useAuth();
  const { formatCurrency, setCurrency } = useCurrency();
  const { t, i18n } = useTranslation();
  const { prefs } = useNotificationPreferences();

  // i18n fallback yardımcı: çeviri yoksa anahtar yerine fallback metni döndür
  const tOr = React.useCallback((key: string, fallback: string, params?: Record<string, any>): string => {
    try {
      const val = t(key as any, params as any) as unknown as string;
      return val === key ? fallback : String(val);
    } catch {
      return fallback;
    }
  }, [t]);
  // Birden fazla anahtarı sırayla dener
  const tOrFirst = React.useCallback((keys: string[], fallback: string, params?: Record<string, any>): string => {
    for (const key of keys) {
      try {
        const val = t(key as any, params as any) as unknown as string;
        if (val !== key) return String(val);
      } catch (error) {
        reportSilentError('app.i18n.tOrFirst', { key, error });
      }
    }
    return fallback;
  }, [t]);
  
  const [currentPage, setCurrentPage] = useState(() => readLastVisitedPage() || "dashboard");
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>(undefined);
  
  // Debug currentPage değişikliklerini
  useEffect(() => {
    logger.debug('app.navigation.pageChanged', { page: currentPage });
  }, [currentPage]);

  useEffect(() => {
    persistLastVisitedPage(currentPage);
  }, [currentPage]);

  // Keep URL hash in sync for primary in-app routes so refresh restores page reliably
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const isHashSyncCandidate = HASH_SYNC_PAGE_SET.has(currentPage) || currentPage.startsWith('customer-history:');
    if (!isHashSyncCandidate) {
      return;
    }
    const targetHash = currentPage === 'dashboard' ? '' : currentPage;
    const currentHash = window.location.hash.replace('#', '');
    if (currentHash === targetHash) {
      return;
    }
    try {
      window.location.hash = targetHash;
    } catch (error) {
      reportSilentError('app.hashSync.writeFailed', { targetHash, error });
    }
  }, [currentPage]);

  // Legal sayfalara geçişte otomatik en üste kaydır (UX düzeltmesi)
  useEffect(() => {
    try {
      if (currentPage.startsWith('legal-')) {
        // Ani kaydırma: auto + fallback
        window.scrollTo({ top: 0, behavior: 'auto' });
        if (window.scrollY > 0) {
          window.scrollTo(0, 0);
        }
      }
    } catch (error) {
      reportSilentError('app.navigation.scrollTopFailed', error);
    }
  }, [currentPage]);

  // E-posta doğrulaması zorunluysa: doğrulanmamış kullanıcıyı sadece doğrulama sayfalarına ve kamu (landing/about/api/legal) sayfalarına izin ver
  useEffect(() => {
    const verificationRequired = isEmailVerificationRequired();
    const verified = (authUser as any)?.isEmailVerified === true;
    if (verificationRequired && isAuthenticated && !verified) {
      const allowed = new Set([
        'verify-email',
        'verify-notice',
        'landing',
        'about',
        'api'
      ]);
      const isLegal = currentPage.startsWith('legal-');
      if (!allowed.has(currentPage) && !isLegal) {
        // Hash tabanlı yönlendirme
        try { window.location.hash = 'verify-notice'; } catch (error) {
          reportSilentError('app.navigation.hashUpdateFailed', error);
        }
        setCurrentPage('verify-notice');
      }
    }
  }, [isAuthenticated, authUser, currentPage]);

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
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  // Şirket bilgisi: önce varsayılan, ardından asenkron olarak secureStorage/localStorage'dan yükle
  const [company, setCompany] = useState<CompanyProfile>(() => defaultCompany);
  const tenantId = tenant?.id;
  const authUserTenantId = authUser?.tenantId;
  const authUserId = authUser?.id;
  const tenantScopedId = React.useMemo(() => {
    try {
      return resolveTenantScopedId({ id: tenantId }, authUserTenantId);
    } catch {
      return undefined;
    }
  }, [tenantId, authUserTenantId]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tenantIdForCache = getTenantIdForCompanyCache();
        const secureKey = getCompanyProfileCacheKey(tenantIdForCache);
        const fromSecure = await secureStorage.getJSON<CompanyProfile>(secureKey);
        const loaded: CompanyProfile | null = fromSecure ?? readCompanyProfileFromPlainStorage(tenantIdForCache);
        if (!cancelled && loaded) {
          setCompany({ ...defaultCompany, ...loaded! });
          if (loaded.currency) {
            setCurrency(loaded.currency as Currency);
          }
          // Eğer şifreli kayıt yoksa ama düz kayıt varsa, bir defaya mahsus migrate et
          if (!fromSecure) {
            try {
              await secureStorage.setJSON(secureKey, loaded);
            } catch (error) {
              reportSilentError('app.companyCache.secureWriteFailed', error);
            }
          }
        }
      } catch {
        // yoksay
      }
    })();
    const handler = () => {
      // Diğer sekmelerden güncelleme geldiğinde tekrar yükle
      (async () => {
        try {
          const tenantIdForCache = getTenantIdForCompanyCache();
          const secureKey = getCompanyProfileCacheKey(tenantIdForCache);
          const fromSecure = await secureStorage.getJSON<CompanyProfile>(secureKey);
          if (fromSecure) {
            setCompany({ ...defaultCompany, ...fromSecure });
            if (fromSecure.currency) {
              setCurrency(fromSecure.currency as Currency);
            }
            return;
          }
          const fallback = readCompanyProfileFromPlainStorage(tenantIdForCache);
          if (fallback) {
            setCompany({ ...defaultCompany, ...fallback });
            if (fallback.currency) {
              setCurrency(fallback.currency as Currency);
            }
            // Not: Event sırasında secureStorage'a tekrar yazmıyoruz (gereksiz ağır işlem ve olası döngüler)
          }
        } catch (error) {
          reportSilentError('app.companyCache.refreshFailed', error);
        }
      })();
    };
    window.addEventListener('company-profile-updated', handler as EventListener);
    return () => { cancelled = true; window.removeEventListener('company-profile-updated', handler as EventListener); };
  }, [setCurrency]);

  // Backend'den tenant şirket profilini yükle ve local cache'i override et
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = readLegacyAuthToken();
        if (!token || !isAuthenticated) return;
        const { tenantsApi } = await import('./api/tenants');
        const me = await tenantsApi.getMyTenant();
        if (!me) return;
        const brand = ((me.settings || {}) as any)?.brand || {};

        // One-time migration: If backend has empty brand/legal but we have richer local cache, push it to backend
        try {
          const scopedIdForCompany = tenantScopedId || '';
          const secureKey = getCompanyProfileCacheKey(scopedIdForCompany);
          const cached: CompanyProfile | null = await secureStorage.getJSON<CompanyProfile>(secureKey).catch(() => null);
          const cachedFallback = readCompanyProfileFromPlainStorage(scopedIdForCompany);
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
          currency: (me as any).currency || (brand as any).currency || 'TRY',
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
          if (updated.currency) {
            setCurrency(updated.currency as Currency);
          }
          try {
            const scopedIdForCompany = tenantScopedId || '';
            const secureKey = getCompanyProfileCacheKey(scopedIdForCompany);
            await secureStorage.setJSON(secureKey, updated);
            window.dispatchEvent(new Event('company-profile-updated'));
          } catch (error) {
            reportSilentError('app.companyCache.backendSyncFailed', error);
          }
        }
      } catch {
        // Sessizce geç
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, tenantScopedId, setCurrency]);
  const [notifications, setNotifications] = useState<HeaderNotification[]>(initialNotifications);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigateTo = React.useCallback((page: string) => {
    setCurrentPage(page);
    setIsSidebarOpen(false);
    setIsNotificationsOpen(false);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const openSettingsOn = React.useCallback((tabId: string) => {
    setSettingsInitialTab(tabId);
    navigateTo('settings');
  }, [navigateTo]);

  const hydrateNotifications = React.useCallback(() => {
    const scopedId = tenantScopedId;
    const hasActiveTenantContext = Boolean(scopedId || tenantId || authUserTenantId);
    if (hasActiveTenantContext && scopedId) {
      const scoped = readTenantScopedArray<HeaderNotification>('notifications', {
        tenantId: scopedId,
        fallbackToBase: false,
      });
      if (Array.isArray(scoped) && scoped.length > 0) {
        setNotifications(normalizeStoredNotifications(scoped));
        return;
      }
      setNotifications(initialNotifications);
      return;
    }
    const fallback = readTenantScopedArray<HeaderNotification>('notifications', {
      tenantId: undefined,
      fallbackToBase: true,
    });
    if (Array.isArray(fallback) && fallback.length > 0) {
      setNotifications(normalizeStoredNotifications(fallback));
      return;
    }
    setNotifications(initialNotifications);
  }, [tenantScopedId, tenantId, authUserTenantId]);

  React.useEffect(() => {
    hydrateNotifications();
  }, [hydrateNotifications]);

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
  const [preselectedCustomerForInvoice, setPreselectedCustomerForInvoice] = useState<CustomerRecord | null>(null);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [deleteWarningData, setDeleteWarningData] = useState<{
    title: string;
    message: string;
    relatedItems: DeleteWarningRelatedItem[];
    itemType: 'invoice' | 'expense';
  } | null>(null);
  const [selectedSaleForInvoice, setSelectedSaleForInvoice] = useState<Sale | null>(null);

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierRecord | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRecord | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<QuoteModel | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [supplierForExpense, setSupplierForExpense] = useState<SupplierExpenseHint | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);

  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productCategories, setProductCategories] = useState<string[]>(() => initialProductCategories);
  const [productCategoryObjects, setProductCategoryObjects] = useState<ProductCategory[]>(() => initialProductCategoryObjects);
  const [bankAccounts, setBankAccounts] = useState<Bank[]>([]);
  const bankAccountsRef = React.useRef<Bank[]>([]);
  const salesHasDataRef = React.useRef(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [_isLoadingData, setIsLoadingData] = useState(true);
  const [infoModal, setInfoModal] = useState<{ title: string; message: string; tone?: 'success' | 'error' | 'info'; confirmLabel?: string; onConfirm?: () => void; cancelLabel?: string; onCancel?: () => void; extraLabel?: string; onExtra?: () => void } | null>(null);
  const [publicQuoteId, setPublicQuoteId] = useState<string | null>(null);

  const refreshProductsFromServer = React.useCallback(async () => {
    try {
      const latest = await productsApi.getProducts();
      const mapped = Array.isArray(latest) ? latest.map(mapBackendProductRecord) : [];
      setProducts(mapped);
      try {
        writeTenantScopedArray('products_cache', mapped, { tenantId: tenantScopedId, mirrorToBase: true });
      } catch (cacheError) {
        reportSilentError('app.products.refresh.cacheFailed', cacheError);
      }
    } catch (error) {
      reportSilentError('app.products.refresh.failed', error);
    }
  }, [tenantScopedId]);

  const authUserSnapshot = React.useMemo(() => ({
    id: authUser?.id ?? null,
    tenantId: authUser?.tenantId ?? null,
    firstName: authUser?.firstName ?? '',
    lastName: authUser?.lastName ?? '',
    email: authUser?.email ?? '',
  }), [authUser?.id, authUser?.tenantId, authUser?.firstName, authUser?.lastName, authUser?.email]);

  // Customers state değiştiğinde tenant cache'i güncel tut
  useEffect(() => {
    writeTenantScopedArray('customers_cache', customers, { tenantId: tenantScopedId, mirrorToBase: true });
  }, [customers, tenantScopedId]);

  useEffect(() => {
    bankAccountsRef.current = bankAccounts;
  }, [bankAccounts]);

  useEffect(() => {
    salesHasDataRef.current = Array.isArray(sales) && sales.length > 0;
  }, [sales]);

  const dismissToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = React.useCallback(
    (message: string | null | undefined, tone: ToastMessage['tone'] = 'info', options?: Partial<ToastMessage>) => {
      const id = options?.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2);
      const duration = typeof options?.duration === 'number' ? options.duration : 4000;
      const resolvedTone = options?.tone ?? tone;
      const toast: ToastMessage = {
        id,
        message: message || t('toasts.common.genericMessage'),
        tone: resolvedTone,
        duration,
      };
      setToasts(prev => [...prev, toast]);
      if (duration > 0) {
        window.setTimeout(() => dismissToast(id), duration);
      }
      return id;
    },
    [t, dismissToast]
  );

  useEffect(() => {
    const handler = (event: CustomEvent<{ message: string; tone?: ToastMessage['tone']; id?: string; duration?: number }>) => {
      const { message, tone = 'info', id, duration } = event.detail || {};
      if (!message) return;
      showToast(message, tone, { id, duration });
    };
    window.addEventListener('showToast', handler as EventListener);
    return () => {
      window.removeEventListener('showToast', handler as EventListener);
    };
  }, [showToast]);

  // Logout sırasında storage'ı yanlışlıkla boş listeyle ezmemek için bayrak
  const suppressSalesPersistenceRef = React.useRef(false);

  const runWithSalesPersistenceSuppressed = React.useCallback((fn: () => void) => {
    suppressSalesPersistenceRef.current = true;
    try {
      fn();
    } finally {
      setTimeout(() => {
        suppressSalesPersistenceRef.current = false;
      }, 0);
    }
  }, []);

  const persistSalesState = React.useCallback((updater: SalesUpdater) => {
    setSales(prevState => {
      const prevArray = Array.isArray(prevState) ? (prevState as Sale[]) : [];
      const nextArray = typeof updater === 'function'
        ? (updater as (prev: Sale[]) => Sale[])(prevArray)
        : (Array.isArray(updater) ? updater : prevArray);

      if (!suppressSalesPersistenceRef.current) {
        try {
          const tenantScopedIdValue = tenantScopedId;
          writeTenantScopedArray('sales_cache', nextArray, { tenantId: tenantScopedIdValue, mirrorToBase: true });
          writeTenantScopedArray('sales', nextArray, { tenantId: tenantScopedIdValue, mirrorToBase: true });
          window.dispatchEvent(new Event('sales-cache-updated'));
        } catch (error) {
          logger.warn('app.sales.cacheWriteFailed', error);
        }
      }

      return nextArray;
    });
  }, [tenantScopedId]);

  // Load data from backend on mount
  useEffect(() => {
    // Public link path detection (no auth required)
    try {
      const path = window.location.pathname || '';
      const match = path.match(/\/public\/quote\/(.+)$/);
      if (match && match[1]) {
        setPublicQuoteId(decodeURIComponent(match[1]));
      }
    } catch (error) {
      reportSilentError('app.publicQuote.decodeFailed', error);
    }

    const loadData = async () => {
      // Check if we have auth token
      const token = readLegacyAuthToken();
      if (!token || !isAuthenticated) {
        logger.warn('app.bootstrap.tokenMissing', {
          isAuthenticated,
          hasToken: Boolean(token),
        });
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
        logger.info('app.bootstrap.fetch.start');
        
        // API isteklerini sıralı olarak gönder (rate limiting'i önlemek için)
        logger.debug('app.bootstrap.fetch.step', { resource: 'customers' });
        const customersData = await customersApi.getCustomers();
        
        logger.debug('app.bootstrap.fetch.step', { resource: 'suppliers' });
        const suppliersData = await suppliersApi.getSuppliers();
        
        logger.debug('app.bootstrap.fetch.step', { resource: 'products' });
        const productsData = await productsApi.getProducts();
        
        logger.debug('app.bootstrap.fetch.step', { resource: 'invoices' });
        const invoicesData = await invoicesApi.getInvoices();
        
        logger.debug('app.bootstrap.fetch.step', { resource: 'expenses' });
        const expensesData = await expensesApi.getExpenses();

        logger.debug('app.bootstrap.fetch.step', { resource: 'sales' });
        let salesData: any[] = [];
        try {
          salesData = await salesApi.getSales();
        } catch (e) {
          logger.warn('app.bootstrap.salesLoadFailed', e);
        }
        
        logger.debug('app.bootstrap.fetch.step', { resource: 'productCategories' });
        const categoriesData = await import('./api/product-categories').then(({ productCategoriesApi }) => productCategoriesApi.getAll());

        logger.debug('app.bootstrap.fetch.success', {
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

        logger.info('app.bootstrap.safeSizes', {
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
        const mappedProducts = safeProductsData.map(mapBackendProductRecord);
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
          const currentUserDisplayName = `${authUserSnapshot.firstName} ${authUserSnapshot.lastName}`.trim() || authUserSnapshot.email || undefined;
          const mappedSales = salesData.map((s: any) => {
            const resolvePersonName = (p: any): string | undefined => {
              if (!p) return undefined;
              const full = `${p.firstName || ''} ${p.lastName || ''}`.trim();
              return full || p.name || p.email || undefined;
            };
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

            // Oluşturan / Güncelleyen bilgilerini mümkün olan en erken aşamada doldur
            const createdByName = s?.createdByName
              || resolvePersonName(s?.createdBy)
              || (s?.createdById && authUserSnapshot.id && String(s.createdById) === String(authUserSnapshot.id)
                ? currentUserDisplayName
                : undefined);
            const updatedByName = s?.updatedByName
              || resolvePersonName(s?.updatedBy)
              || (s?.updatedById && authUserSnapshot.id && String(s.updatedById) === String(authUserSnapshot.id)
                ? currentUserDisplayName
                : undefined);

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
              createdByName: createdByName,
              updatedByName: updatedByName,
              createdAt: s?.createdAt || s?.createdDate || s?.createdOn || s?.saleDate,
              updatedAt: s?.updatedAt || s?.updatedDate || s?.updatedOn || s?.saleDate,
            };
          });
          // Backend'ten gelen liste, kullanıcı eklerken tamamlanan ilk yükleme tarafından
          // state'i ezmemeli. Mevcut state ile birleştirip (saleNumber,id) bazında tekilleştir.
          persistSalesState(prev => {
            const byKey = new Map<string, any>();
            const makeKey = (x: any) => `${x?.saleNumber || ''}#${x?.id || ''}`;
            for (const s of Array.isArray(prev) ? prev : []) {
              byKey.set(makeKey(s), s);
            }
            for (const s of mappedSales) {
              byKey.set(makeKey(s), s);
            }
            return Array.from(byKey.values());
          });
        }
        // Debug amaçlı küçük bir örnek kaydı logger üzerinden paylaş
        logger.debug('app.bootstrap.expenseSample', {
          sample: mappedExpenses.slice(0, 10).map(e => ({ id: e.id, amount: e.amount, status: e.status, expenseDate: e.expenseDate })),
        });
        
        const tenantScopedId = resolveTenantScopedId(tenant, authUserSnapshot.tenantId);
        const tenantWriteOptions = { tenantId: tenantScopedId, mirrorToBase: true } as const;
        writeTenantScopedArray('customers_cache', safeCustomersData, tenantWriteOptions);
        writeTenantScopedArray('suppliers_cache', safeSuppliersData, tenantWriteOptions);
        writeTenantScopedArray('products_cache', mappedProducts, tenantWriteOptions);
        writeTenantScopedArray('invoices_cache', safeInvoicesData, tenantWriteOptions);
        writeTenantScopedArray('expenses_cache', safeExpensesData, tenantWriteOptions);
        if (Array.isArray(salesData)) {
          writeTenantScopedArray('sales_cache', salesData, tenantWriteOptions);
        }
        
        logger.info('app.bootstrap.cachePersisted');
      } catch (error) {
        logger.error('app.bootstrap.fetch.failed', error);
        showToast(t('toasts.common.dataLoadError'), 'error');
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
  }, [isAuthenticated, tenant, authUserSnapshot, persistSalesState, showToast, t]); // isAuthenticated veya tenant değiştiğinde tekrar yükle

  // Save Bank accounts cache to localStorage (tenant-scoped)
  useEffect(() => {
    writeTenantScopedArray('bankAccounts', bankAccounts, { tenantId: tenantScopedId, mirrorToBase: true });
  }, [bankAccounts, tenantScopedId]);

  const handleSimpleSalesPageUpdate = React.useCallback((updatedSales: Sale[] = []) => {
    logger.info('app.sales.simpleList.updated', { count: updatedSales.length });
    persistSalesState(updatedSales);
  }, [persistSalesState]);

  useEffect(() => {
    // Her değişimde localStorage'ı güncelle (boş liste dahil)
    // Ancak logout akışında state temizlenirken storage'ı EZME!
    if (suppressSalesPersistenceRef.current) return;
    try {
      const scopedIdForSales = tenantScopedId;
      const normalizedSales = Array.isArray(sales) ? sales : [];
      writeTenantScopedArray('sales', normalizedSales, { tenantId: scopedIdForSales, mirrorToBase: true });
      // Yedeği HER ZAMAN mevcut state ile senkron tut (boş liste dahil)
      const serialized = JSON.stringify(normalizedSales);
      writeTenantScopedValue('sales_backup', serialized, { tenantId: scopedIdForSales, mirrorToBase: false });
      writeTenantScopedValue('sales_last_seen_ts', Date.now(), { tenantId: scopedIdForSales, mirrorToBase: false });
    } catch (error) {
      reportSilentError('app.sales.persistFailed', error);
    }
  }, [sales, tenantScopedId]);

  useEffect(() => {
    writeTenantScopedArray('invoices_cache', invoices, { tenantId: tenantScopedId, mirrorToBase: true });
  }, [invoices, tenantScopedId]);

  // � Bildirimleri localStorage'a kaydet
  useEffect(() => {
    try {
      writeTenantScopedArray('notifications', notifications, { tenantId: tenantScopedId, mirrorToBase: true });
    } catch (error) {
      reportSilentError('app.notifications.persistFailed', error);
    }
  }, [notifications, tenantScopedId]);

  // �🔄 AuthContext'deki user değiştiğinde App.tsx'deki user state'ini güncelle
  useEffect(() => {
    if (authUser) {
      // Display name için daha sağlam fallback: firstName/lastName yoksa eski adı koru
      const fullNameRaw = `${authUser.firstName || ''} ${authUser.lastName || ''}`.trim();
      let displayName = fullNameRaw;
      if (!displayName) {
        // localStorage'daki user objesinden birleştir (varsa)
        const cachedProfile = readLegacyUserProfile<{ firstName?: string; lastName?: string; name?: string }>();
        if (cachedProfile) {
          const fromCache = `${cachedProfile.firstName || ''} ${cachedProfile.lastName || ''}`.trim() || cachedProfile.name || '';
          if (fromCache) displayName = fromCache;
        }
      }
      setUser(prev => ({
        name: displayName || prev.name || 'User',
        email: authUser.email || prev.email || '',
      }));
      logger.debug('app.auth.userSync', {
        name: displayName || 'User',
        email: authUser.email || '',
      });
      // Tenant bilgisini localStorage'a da yaz (fallback için)
      if (authUser.tenantId != null) {
        writeLegacyTenantId(authUser.tenantId);
      }
    }
  }, [authUser]);

  // Cross-tab senkron: başka sekmede sales değişirse state'i güncelle
    React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      const scopedId = tenantScopedId;
      const key = buildTenantScopedKey('sales', scopedId);
      const cacheKey = buildTenantScopedKey('sales_cache', scopedId);
      // backupKey kullanılmıyor: bilinçli silmelerin geri gelmesini engelle
      if (e.key === key || e.key === cacheKey) {
        try {
          const arrA = readTenantScopedArray<any>('sales', { tenantId: scopedId, fallbackToBase: false }) ?? [];
          const arrB = readTenantScopedArray<any>('sales_cache', { tenantId: scopedId, fallbackToBase: false }) ?? [];
          const merged = [...(Array.isArray(arrA) ? arrA : []), ...(Array.isArray(arrB) ? arrB : [])];
          // Önce (saleNumber,id) ile tekilleştir
          const uniq = new Map<string, any>();
          merged.forEach((s: any) => {
            const k = `${s.saleNumber || ''}#${s.id || ''}`;
            if (!uniq.has(k)) uniq.set(k, s);
          });
              const next = Array.from(uniq.values());
              // Artık boş liste gelirse yedekten RESTORE ETME — kullanıcı silmiş olabilir
              runWithSalesPersistenceSuppressed(() => {
                persistSalesState(next);
              });
        } catch (error) {
          reportSilentError('app.sales.storageSyncFailed', error);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [tenantScopedId, persistSalesState, runWithSalesPersistenceSuppressed]);

  // Cache yükleme: Sadece gerçekten OTURUM YOKSA offline sales'i yükle
  useEffect(() => {
    // Authentication kontrolü - token yoksa veya authenticated değilse ÇIKIŞ
    const token = readLegacyAuthToken();
    // Eğer token varsa ama isAuthenticated henüz false ise, offline veriyi yükleme (yanlış grafik/istatistik parlamasını önlemek için bekle)
    if (!token && !isAuthenticated) {
      logger.info('app.cache.offlineSalesLoad.start');
      try {
        const savedSales = readTenantScopedArray<any>('sales', { tenantId: undefined, fallbackToBase: true });
        if (Array.isArray(savedSales) && savedSales.length > 0) {
          persistSalesState(savedSales);
          logger.info('app.cache.offlineSalesLoad.success', { count: savedSales.length });
        }
      } catch (e) {
        logger.error('app.cache.offlineSalesLoad.failed', e);
      }
      setIsLoadingData(false);
      return;
    }

  // YALNIZCA GERÇEK OTURUM TENANT ID'sini kullan; localStorage fallback KULLANMA (yanlış tenant sızıntısını önlemek için)
  const tenantScopedId = toTenantId(tenant?.id) || toTenantId(authUser?.tenantId) || '';
  logger.info('app.cache.authenticatedLoad.start');
  const savedBanks = readTenantScopedArray<any>('bankAccounts', { tenantId: tenantScopedId, fallbackToBase: false }) ?? [];
  // Eski/generic anahtar desteği: birleşik oku, tenant anahtarına öncelik ver
  const savedBanksGeneric = readTenantScopedArray<any>('bankAccounts', { tenantId: undefined, fallbackToBase: true }) ?? [];
  if (!tenantScopedId) {
    // Tenant ID henüz belli değilse cache yüklemeyi ertele
    setIsLoadingData(false);
    return;
  }
  // Authenticated kullanıcıda backup'tan otomatik geri yükleme yapmayacağız
  const savedSales = readTenantScopedArray<any>('sales', { tenantId: tenantScopedId, fallbackToBase: false }) ?? [];
  const savedSalesCache = readTenantScopedArray<any>('sales_cache', { tenantId: tenantScopedId, fallbackToBase: true }) ?? [];
  const savedCustomers = readTenantScopedArray<any>('customers_cache', { tenantId: tenantScopedId, fallbackToBase: true }) ?? [];
  const savedSuppliers = readTenantScopedArray<any>('suppliers_cache', { tenantId: tenantScopedId, fallbackToBase: true }) ?? [];
  const savedProducts = readTenantScopedArray<any>('products_cache', { tenantId: tenantScopedId, fallbackToBase: true }) ?? [];
  const savedInvoices = readTenantScopedArray<any>('invoices_cache', { tenantId: tenantScopedId, fallbackToBase: true }) ?? [];
  const savedExpenses = readTenantScopedArray<any>('expenses_cache', { tenantId: tenantScopedId, fallbackToBase: true }) ?? [];
  const fallbackBankList = savedBanks.length ? savedBanks : null;
    
    if (savedBanks.length || savedBanksGeneric.length) {
      try {
        const combined = [...savedBanks, ...savedBanksGeneric];
        if (combined.length > 0) {
          // id bazında tekilleştir (tenant öncelikli)
          const byId = new Map<string, any>();
          for (const b of combined) {
            const id = String((b && b.id) || '');
            if (!id) continue;
            if (!byId.has(id)) byId.set(id, b);
          }
          const list = Array.from(byId.values());
          logger.info('app.cache.banksLoaded', { count: list.length });
          setBankAccounts(list.map((b: any) => ({ ...b, id: String(b.id) })));
        }
      } catch (e) {
        logger.error('app.cache.banksLoadFailed', e);
      }
    }
    // Ardından backend'den bankalar çekilip cache güncellensin
    (async () => {
      try {
        const { bankAccountsApi } = await import('./api/bank-accounts');
        const remote = await bankAccountsApi.list();
        // Backend'den gelen 'name' alanını frontend'de kullanılan 'accountName' ile eşle
        const mappedRemote = remote.map((b:any)=>({ ...b, id: String(b.id), accountName: b.name }));
        // Lokal cache veya mevcut state'teki UI alanları ile birleştir (kalıcı kıl)
        const localList: any[] = fallbackBankList ?? bankAccountsRef.current;
        // UI alanları için ayrı harita (ek güvence)
        const uiMap: Record<string, any> = readTenantScopedObject<Record<string, any>>('bankUi', {
          tenantId: tenantScopedId,
          fallbackToBase: false,
        }) || {};
        const merged = mappedRemote.map((r:any) => {
          const local = (Array.isArray(localList) ? localList : []).find((x:any) => String(x.id) === String(r.id));
          const extra = uiMap[String(r.id)] || {};
          return {
            ...local,
            ...r,
            // UI alanları için local öncelikli, varsayılanlar
            isActive: (local?.isActive !== undefined) ? local.isActive : (extra?.isActive !== undefined ? extra.isActive : true),
            accountType: local?.accountType || extra?.accountType || 'checking',
            balance: Number((local?.balance ?? extra?.balance) ?? 0),
            branchCode: local?.branchCode || extra?.branchCode || '',
            routingNumber: local?.routingNumber || extra?.routingNumber || '',
            swiftBic: local?.swiftBic || extra?.swiftBic || '',
          };
        });
        setBankAccounts(merged);
        try {
          writeTenantScopedArray('bankAccounts', merged, { tenantId: tenantScopedId, mirrorToBase: true });
        } catch (error) {
          reportSilentError('app.cache.bankAccounts.persistFailed', error);
        }
      } catch (e) {
        logger.warn('app.cache.bankAccounts.refreshFailed', e);
      }
    })();
    
  if (savedSales.length || savedSalesCache.length) {
      try {
        const salesData = [...savedSales, ...savedSalesCache];
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
        const customersFromCache = Array.isArray(savedCustomers) ? savedCustomers : [];
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

        logger.info('app.cache.salesLoaded', {
          total: (salesData || []).length,
          filtered: (filteredSales || []).length,
          unique: deduped.length,
        });
        // Artık backup'tan otomatik geri yükleme yok — doğrudan hydrated veriyi kullan
        runWithSalesPersistenceSuppressed(() => {
          persistSalesState(hydrated);
        });
        // Not: Burada storage'ı geriye yazmıyoruz (potansiyel veri kaybını önlemek için)
        // Dedup sonucu daha kısa olabilir; kullanıcı onayı olmadan overwrite etmeyelim.
      } catch (e) {
        logger.error('app.cache.salesLoadFailed', e);
      }
    }
    // Not: authenticated kullanıcıda backup'tan otomatik geri dönüş devre dışı
    
    if (savedCustomers.length) {
      logger.info('app.cache.customersLoaded', { count: savedCustomers.length });
      setCustomers(savedCustomers);
    }
    
    if (savedSuppliers.length) {
      logger.info('app.cache.suppliersLoaded', { count: savedSuppliers.length });
      setSuppliers(savedSuppliers);
    }
    
    if (savedProducts.length) {
      try {
        logger.info('app.cache.productsLoaded', { count: savedProducts.length });
        // Ensure numeric values
        const normalizedProducts = savedProducts.map((p: any) => ({
          ...p,
          unitPrice: Number(p.unitPrice) || 0,
          costPrice: Number(p.costPrice) || 0,
          stockQuantity: Number(p.stockQuantity) || 0,
          reorderLevel: Number(p.reorderLevel) || 0,
        }));
        setProducts(normalizedProducts);
      } catch (e) {
        logger.error('app.cache.productsLoadFailed', e);
      }
    }
    
    if (savedInvoices.length) {
      logger.info('app.cache.invoicesLoaded', { count: savedInvoices.length });
      setInvoices(savedInvoices);
    }
    
    if (savedExpenses.length) {
      try {
        logger.info('app.cache.expensesLoaded', { count: savedExpenses.length });
        // Ensure proper format for expenseDate
        const mappedExpenses = savedExpenses.map((e: any) => {
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
        logger.error('app.cache.expensesLoadFailed', e);
      }
    }
  }, [
    isAuthenticated,
    tenant?.id,
    authUser?.tenantId,
    persistSalesState,
    runWithSalesPersistenceSuppressed,
  ]); // tenant ID hazır olduğunda çalıştır

  // Tenant değiştiğinde eski state'i anında temizle (eski tenant verisinin bir an bile görünmemesi için)
  useEffect(() => {
    const currTid = tenant?.id || authUser?.tenantId;
    if (!isAuthenticated || !currTid) return;
    // State temizliği; API yüklemesi kısa süre sonra dolduracak
    setCustomers([]);
    setSuppliers([]);
    setProducts([]);
    setInvoices([]);
    setExpenses([]);
    persistSalesState([]);
    setBankAccounts([]);
  // Bu temizlik, tenant id değiştiğinde bir defa tetiklenir
  }, [tenant?.id, authUser?.tenantId, isAuthenticated, persistSalesState]);

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
              logger.debug('app.notifications.persistentReset', {
                notificationId: n.id,
                title: n.title,
              });
              return { ...n, read: false, readAt: undefined };
            }
          }
          return n;
        });
        
        const removedCount = current.length - filtered.length;
        if (removedCount > 0) {
          logger.info('app.notifications.cleanupRemoved', { count: removedCount });
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

  const authUserTwoFactorEnabled = ((authUser as any)?.twoFactorEnabled === true);
  const tenantScopedIdForNotifications = React.useMemo(() => {
    try {
      return resolveTenantScopedId(tenant, authUserTenantId);
    } catch {
      return undefined;
    }
  }, [tenant, authUserTenantId]);

  const addNotification = React.useCallback((
    title: string,
    description: string,
    type: 'info' | 'warning' | 'success' | 'danger' = 'info',
    link?: string,
    options?: {
      persistent?: boolean;
      repeatDaily?: boolean;
      relatedId?: string;
      i18nTitleKey?: string;
      i18nDescKey?: string;
      i18nParams?: Record<string, any>;
    }
  ) => {
    const allowedCategories = new Set(['invoices', 'expenses', 'sales', 'products', 'suppliers', 'quotes']);
    const category = link || '';
    const readPrefs = () => {
      try {
        const tenantScopedId = tenantScopedIdForNotifications;
        const userId = authUserId ? String(authUserId) : undefined;
        return (
          readNotificationPrefsCache({
            tenantIds: tenantScopedId ? [tenantScopedId] : undefined,
            userIds: userId ? [userId] : undefined,
          }) || {}
        );
      } catch {
        return {};
      }
    };

    if (category && !allowedCategories.has(category)) return;
    if (category === 'products') {
      const rid = options?.relatedId || '';
      const isStockAlert = /^low-stock-|^out-of-stock-/.test(rid);
      if (!isStockAlert) return;
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

    const uniqueId = options?.relatedId
      ? `${options.relatedId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      : `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const nowTs = Date.now();
    const timeStr = new Date(nowTs).toLocaleString((navigator.language || 'tr').slice(0, 2));
    const newNotification: HeaderNotification = {
      id: uniqueId,
      title,
      description,
      time: timeStr,
      firstSeenAt: nowTs,
      type,
      read: false,
      link,
      persistent: options?.persistent,
      repeatDaily: options?.repeatDaily,
      relatedId: options?.relatedId,
      i18nTitleKey: options?.i18nTitleKey,
      i18nDescKey: options?.i18nDescKey,
      i18nParams: options?.i18nParams,
    };

    setNotifications(prev => {
      if (options?.relatedId) {
        const filtered = prev.filter(n => n.relatedId !== options.relatedId);
        return [newNotification, ...filtered];
      }
      return [newNotification, ...prev];
    });

    logger.info('app.notifications.created', {
      id: newNotification.id,
      type: newNotification.type,
      category,
      persistent: Boolean(newNotification.persistent),
    });
  }, [tenantScopedIdForNotifications, authUserId]);

  // 2FA hatırlatıcı bildirimi ve ilk açılış modali
  useEffect(() => {
    if (!isAuthenticated) return;
    const enabled = authUserTwoFactorEnabled;

    // 2FA etkin ise: varsa hatırlatıcı bildirimi kaldır ve çık
    if (enabled) {
      setNotifications(current => current.filter(n => n.relatedId !== 'twofa-reminder'));
      return;
    }

    // 2FA etkin değilse: kalıcı/günlük tekrar eden bildirim ekle (kategori filtresine takılmaması için link vermiyoruz)
    const title = tOrFirst(['security.twofa.reminderTitle','sales.security.twofa.reminderTitle'], 'İki Aşamalı Doğrulamayı Etkinleştirin');
    const description = tOrFirst(['security.twofa.reminderDesc','sales.security.twofa.reminderDesc'], 'Hesabınızı korumak için 2FA’yı etkinleştirmeniz önerilir.');
    addNotification(title, description, 'warning', undefined, { persistent: true, repeatDaily: true, relatedId: 'twofa-reminder', i18nTitleKey: 'security.twofa.reminderTitle', i18nDescKey: 'security.twofa.reminderDesc' });

    // İlk açılış modali: kullanıcı/tenant bazlı, HER OTURUMDA bir kez göster (2FA etkinleşene kadar)
    try {
      const tenantScopedId = resolveTenantScopedId(tenant, authUserTenantId) || 'default';
      const userKey = String(authUserId || 'anon');
      const neverMap = readTenantScopedObject<Record<string, string>>('twofa_modal_never', {
        tenantId: tenantScopedId,
        fallbackToBase: false,
      }) || {};
      if (neverMap[userKey]) return; // Kullanıcı bir daha hatırlatma dedi
      const key = `twofa_modal_shown_session:${tenantScopedId}:${userKey}`;
      const shownThisSession = safeSessionStorage.getItem(key);
      if (!shownThisSession) {
        setInfoModal({
          title: tOrFirst(['security.twofa.modalTitle','sales.security.twofa.modalTitle'], 'Hesabınızı Güvenceye Alın'),
          message: tOrFirst(['security.twofa.modalMessage','sales.security.twofa.modalMessage'], 'İki Aşamalı Doğrulama (2FA) hesap güvenliğinizi önemli ölçüde artırır. Şimdi etkinleştirmek ister misiniz?'),
          tone: 'info',
          confirmLabel: tOrFirst(['security.twofa.enableNow','sales.security.twofa.enableNow'], 'Şimdi Etkinleştir'),
          cancelLabel: tOr('common.remindMeLater', 'Daha Sonra'),
          extraLabel: tOrFirst(['security.twofa.neverRemind','sales.security.twofa.neverRemind'], 'Bir daha hatırlatma'),
          onConfirm: () => {
            safeSessionStorage.setItem(key, '1');
            openSettingsOn('security');
            setInfoModal(null);
          },
          onCancel: () => {
            safeSessionStorage.setItem(key, '1');
            setInfoModal(null);
          },
          onExtra: () => {
            safeSessionStorage.setItem(key, '1');
            const nextMap = { ...neverMap, [userKey]: '1' };
            writeTenantScopedObject('twofa_modal_never', nextMap, { tenantId: tenantScopedId, mirrorToBase: false });
            setInfoModal(null);
          },
        });
      }
    } catch (error) {
      reportSilentError('app.security.twofaPromptFailed', error);
    }
  }, [
    isAuthenticated,
    authUserTwoFactorEnabled,
    authUserId,
    authUserTenantId,
    tenant,
    tenantId,
    i18n.language,
    addNotification,
    openSettingsOn,
    tOr,
    tOrFirst,
  ]);

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
          
          const customerName = invoice.customer?.name || tOr('common.generic.customer', 'Müşteri');
          const invoiceNumber = invoice.invoiceNumber || `#${invoice.id}`;
          
          if (dueDateMs < todayMs) {
            // Ödeme tarihi geçmiş
            const daysOverdue = Math.floor((todayMs - dueDateMs) / (1000 * 60 * 60 * 24));
            addNotification(
              tOr('notifications.invoices.overdue.title', 'Gecikmiş fatura ödemesi'),
              tOr('notifications.invoices.overdue.desc', `${invoiceNumber} - ${customerName} (${daysOverdue} gün gecikmiş)`, { invoiceNumber, customerName, daysOverdue }),
              'danger',
              'invoices',
              { persistent: true, repeatDaily: true, relatedId: `invoice-${invoice.id}`, i18nTitleKey: 'notifications.invoices.overdue.title', i18nDescKey: 'notifications.invoices.overdue.desc', i18nParams: { invoiceNumber, customerName, daysOverdue } }
            );
          } else if (dueDateMs <= threeDaysLater.getTime()) {
            // 3 gün içinde ödeme
            const daysLeft = Math.ceil((dueDateMs - todayMs) / (1000 * 60 * 60 * 24));
            addNotification(
              tOr('notifications.invoices.upcoming.title', 'Yaklaşan fatura ödemesi'),
              tOr('notifications.invoices.upcoming.desc', `${invoiceNumber} - ${customerName} (${daysLeft} gün kaldı)`, { invoiceNumber, customerName, daysLeft }),
              'warning',
              'invoices',
              { persistent: true, repeatDaily: true, relatedId: `invoice-${invoice.id}`, i18nTitleKey: 'notifications.invoices.upcoming.title', i18nDescKey: 'notifications.invoices.upcoming.desc', i18nParams: { invoiceNumber, customerName, daysLeft } }
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
          
          const supplierName = expense.supplier?.name || expense.supplier || tOr('common.generic.supplier', 'Tedarikçi');
          const description = expense.description || tOr('common.generic.expense', 'Gider');
          
          if (dueDateMs < todayMs) {
            // Ödeme tarihi geçmiş
            const daysOverdue = Math.floor((todayMs - dueDateMs) / (1000 * 60 * 60 * 24));
            addNotification(
              tOr('notifications.expenses.overdue.title', 'Gecikmiş gider ödemesi'),
              tOr('notifications.expenses.overdue.desc', `${description} - ${supplierName} (${daysOverdue} gün gecikmiş)`, { description, supplierName, daysOverdue }),
              'danger',
              'expenses',
              { persistent: true, repeatDaily: true, relatedId: `expense-${expense.id}`, i18nTitleKey: 'notifications.expenses.overdue.title', i18nDescKey: 'notifications.expenses.overdue.desc', i18nParams: { description, supplierName, daysOverdue } }
            );
          } else if (dueDateMs <= threeDaysLater.getTime()) {
            // 3 gün içinde ödeme
            const daysLeft = Math.ceil((dueDateMs - todayMs) / (1000 * 60 * 60 * 24));
            addNotification(
              tOr('notifications.expenses.upcoming.title', 'Yaklaşan gider ödemesi'),
              tOr('notifications.expenses.upcoming.desc', `${description} - ${supplierName} (${daysLeft} gün kaldı)`, { description, supplierName, daysLeft }),
              'warning',
              'expenses',
              { persistent: true, repeatDaily: true, relatedId: `expense-${expense.id}`, i18nTitleKey: 'notifications.expenses.upcoming.title', i18nDescKey: 'notifications.expenses.upcoming.desc', i18nParams: { description, supplierName, daysLeft } }
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
              addNotification(
                tOr('notifications.products.outOfStock.title', 'Stok tükendi'),
                tOr('notifications.products.outOfStock.desc', `${p.name} - Stok tükendi!`, { name: p.name }),
                'danger', 'products', { persistent: true, repeatDaily: true, relatedId: `out-of-stock-${p.id}`, i18nTitleKey: 'notifications.products.outOfStock.title', i18nDescKey: 'notifications.products.outOfStock.desc', i18nParams: { name: p.name } }
              );
            } else {
              addNotification(
                tOr('notifications.products.lowStock.title', 'Düşük stok uyarısı'),
                tOr('notifications.products.lowStock.desc', `${p.name} - Stok seviyesi minimum limitin altında! (${stock}/${min})`, { name: p.name, stock, min }),
                'warning', 'products', { persistent: true, repeatDaily: true, relatedId: `low-stock-${p.id}`, i18nTitleKey: 'notifications.products.lowStock.title', i18nDescKey: 'notifications.products.lowStock.desc', i18nParams: { name: p.name, stock, min } }
              );
            }
          });
        } catch (error) {
          reportSilentError('app.notifications.lowStockCheckFailed', error);
        }
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
  }, [invoices, expenses, products, isAuthenticated, prefs, addNotification, tOr]);

  // Ürün kategorileri başka bir componentten güncellendiğinde (create/update/delete)
  // ProductList global bir 'product-categories-updated' eventi dispatch eder; burada dinleyip yeniden yükleriz.
  useEffect(() => {
    const onCategoriesUpdated = () => {
      (async () => {
        try {
          const { productCategoriesApi } = await import('./api/product-categories');
          const data = await productCategoriesApi.getAll();
          setProductCategoryObjects(data);
          setProductCategories(prev => {
            const combined = new Set<string>([...prev, ...data.map(c => c.name.trim()).filter(Boolean)]);
            return Array.from(combined).sort((a,b)=>a.localeCompare(b,'tr-TR'));
          });
        } catch (e) {
          console.warn('Kategori güncelleme yeniden yükleme hatası:', e);
        }
      })();
    };
    window.addEventListener('product-categories-updated', onCategoriesUpdated as EventListener);
    return () => window.removeEventListener('product-categories-updated', onCategoriesUpdated as EventListener);
  }, []);

  // Teklif (quote) hatırlatma bildirimi: süresi dolmak üzere / doldu
  useEffect(() => {
    if (!isAuthenticated) return;
    const loadAndNotifyQuotes = () => {
      try {
        const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
        const quotes = readTenantScopedArray<any>('quotes_cache', { tenantId: tenantScopedId, fallbackToBase: true }) ?? [];
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
            addNotification(
              tOr('notifications.quotes.expired.title', 'Teklif süresi doldu'),
              tOr('notifications.quotes.expired.desc', `${q.quoteNumber || tOr('common.generic.quote','Teklif')} - süre doldu`, { quoteNumber: q.quoteNumber || tOr('common.generic.quote','Teklif') }),
              'danger', 'quotes', { persistent: true, repeatDaily: true, relatedId: `quote-expired-${q.id}`, i18nTitleKey: 'notifications.quotes.expired.title', i18nDescKey: 'notifications.quotes.expired.desc', i18nParams: { quoteNumber: q.quoteNumber || 'Teklif' } }
            );
          } else if (diffDays <= 3) {
            addNotification(
              tOr('notifications.quotes.dueSoon.title', 'Teklif süresi yaklaşıyor'),
              tOr('notifications.quotes.dueSoon.desc', `${q.quoteNumber || tOr('common.generic.quote','Teklif')} - ${diffDays} gün kaldı`, { quoteNumber: q.quoteNumber || tOr('common.generic.quote','Teklif'), diffDays }),
              'warning', 'quotes', { persistent: true, repeatDaily: true, relatedId: `quote-due-${q.id}`, i18nTitleKey: 'notifications.quotes.dueSoon.title', i18nDescKey: 'notifications.quotes.dueSoon.desc', i18nParams: { quoteNumber: q.quoteNumber || 'Teklif', diffDays } }
            );
          }
        });
      } catch { /* sessiz */ }
    };
    loadAndNotifyQuotes();
    const interval = setInterval(loadAndNotifyQuotes, 6 * 60 * 60 * 1000); // 6 saatte bir
    return () => clearInterval(interval);
  }, [isAuthenticated, prefs, tenant, tenant?.id, authUser?.tenantId, addNotification, tOr]);

  // Dil değişince (veya veriler güncellenince) bildirimleri yeniden yerelleştir
  useEffect(() => {
    const relocalize = () => {
      setNotifications(current => current.map(n => {
        // 0) Öncelikle bilinen pattern'lere göre her durumda yeniden yerelleştir
        try {
          if (n.relatedId === 'twofa-reminder') {
            return {
              ...n,
              i18nTitleKey: 'security.twofa.reminderTitle',
              i18nDescKey: 'security.twofa.reminderDesc',
              title: tOrFirst(['security.twofa.reminderTitle','sales.security.twofa.reminderTitle'], n.title),
              description: tOrFirst(['security.twofa.reminderDesc','sales.security.twofa.reminderDesc'], n.description),
            } as HeaderNotification;
          }
          if (n.relatedId?.startsWith('out-of-stock-')) {
            const pid = n.relatedId.split('out-of-stock-')[1];
            const p = products.find(x => String(x.id) === String(pid));
            const name = p?.name || '';
            return {
              ...n,
              i18nTitleKey: 'notifications.products.outOfStock.title',
              i18nDescKey: 'notifications.products.outOfStock.desc',
              i18nParams: { name },
              title: tOr('notifications.products.outOfStock.title', n.title),
              description: tOr('notifications.products.outOfStock.desc', n.description, { name }),
            } as HeaderNotification;
          }
          if (n.relatedId?.startsWith('low-stock-')) {
            const pid = n.relatedId.split('low-stock-')[1];
            const p: any = products.find(x => String((x as any).id) === String(pid));
            const name = p?.name || '';
            const stock = Number(p?.stockQuantity || 0);
            const min = Number(p?.reorderLevel || 0);
            return {
              ...n,
              i18nTitleKey: 'notifications.products.lowStock.title',
              i18nDescKey: 'notifications.products.lowStock.desc',
              i18nParams: { name, stock, min },
              title: tOr('notifications.products.lowStock.title', n.title),
              description: tOr('notifications.products.lowStock.desc', n.description, { name, stock, min }),
            } as HeaderNotification;
          }
          if (n.relatedId?.startsWith('invoice-')) {
            const id = n.relatedId.split('invoice-')[1];
            const inv: any = invoices.find(x => String((x as any).id) === String(id));
            const customerName = inv?.customer?.name || tOr('common.generic.customer', 'Müşteri');
            const invoiceNumber = inv?.invoiceNumber || `#${inv?.id || ''}`;
            const dueDate = inv?.dueDate ? new Date(inv.dueDate) : null;
            if (dueDate) {
              const today = new Date(); today.setHours(0,0,0,0);
              dueDate.setHours(0,0,0,0);
              const todayMs = today.getTime();
              const dueMs = dueDate.getTime();
              if (dueMs < todayMs) {
                const daysOverdue = Math.floor((todayMs - dueMs) / 86400000);
                return {
                  ...n,
                  i18nTitleKey: 'notifications.invoices.overdue.title',
                  i18nDescKey: 'notifications.invoices.overdue.desc',
                  i18nParams: { invoiceNumber, customerName, daysOverdue },
                  title: tOr('notifications.invoices.overdue.title', n.title),
                  description: tOr('notifications.invoices.overdue.desc', n.description, { invoiceNumber, customerName, daysOverdue }),
                } as HeaderNotification;
              } else {
                const daysLeft = Math.ceil((dueMs - todayMs) / 86400000);
                return {
                  ...n,
                  i18nTitleKey: 'notifications.invoices.upcoming.title',
                  i18nDescKey: 'notifications.invoices.upcoming.desc',
                  i18nParams: { invoiceNumber, customerName, daysLeft },
                  title: tOr('notifications.invoices.upcoming.title', n.title),
                  description: tOr('notifications.invoices.upcoming.desc', n.description, { invoiceNumber, customerName, daysLeft }),
                } as HeaderNotification;
              }
            }
          }
          if (n.relatedId?.startsWith('expense-')) {
            const id = n.relatedId.split('expense-')[1];
            const exp: any = expenses.find(x => String((x as any).id) === String(id));
            const supplierName = exp?.supplier?.name || exp?.supplier || tOr('common.generic.supplier', 'Tedarikçi');
            const description = exp?.description || tOr('common.generic.expense', 'Gider');
            const dueDate = exp?.dueDate || exp?.expenseDate ? new Date(exp?.dueDate || exp?.expenseDate) : null;
            if (dueDate) {
              const today = new Date(); today.setHours(0,0,0,0);
              dueDate.setHours(0,0,0,0);
              const todayMs = today.getTime();
              const dueMs = dueDate.getTime();
              if (dueMs < todayMs) {
                const daysOverdue = Math.floor((todayMs - dueMs) / 86400000);
                return {
                  ...n,
                  i18nTitleKey: 'notifications.expenses.overdue.title',
                  i18nDescKey: 'notifications.expenses.overdue.desc',
                  i18nParams: { description, supplierName, daysOverdue },
                  title: tOr('notifications.expenses.overdue.title', n.title),
                  description: tOr('notifications.expenses.overdue.desc', n.description, { description, supplierName, daysOverdue }),
                } as HeaderNotification;
              } else {
                const daysLeft = Math.ceil((dueMs - todayMs) / 86400000);
                return {
                  ...n,
                  i18nTitleKey: 'notifications.expenses.upcoming.title',
                  i18nDescKey: 'notifications.expenses.upcoming.desc',
                  i18nParams: { description, supplierName, daysLeft },
                  title: tOr('notifications.expenses.upcoming.title', n.title),
                  description: tOr('notifications.expenses.upcoming.desc', n.description, { description, supplierName, daysLeft }),
                } as HeaderNotification;
              }
            }
          }
          if (n.relatedId?.startsWith('quote-expired-')) {
            const id = n.relatedId.split('quote-expired-')[1];
            return {
              ...n,
              i18nTitleKey: 'notifications.quotes.expired.title',
              i18nDescKey: 'notifications.quotes.expired.desc',
              i18nParams: { quoteNumber: n.i18nParams?.quoteNumber || `#${id}` },
              title: tOr('notifications.quotes.expired.title', n.title),
              description: tOr('notifications.quotes.expired.desc', n.description, { quoteNumber: n.i18nParams?.quoteNumber || `#${id}` }),
            } as HeaderNotification;
          }
          if (n.relatedId?.startsWith('quote-due-')) {
            const id = n.relatedId.split('quote-due-')[1];
            const diffDays = n.i18nParams?.diffDays ?? 0;
            return {
              ...n,
              i18nTitleKey: 'notifications.quotes.dueSoon.title',
              i18nDescKey: 'notifications.quotes.dueSoon.desc',
              i18nParams: { quoteNumber: n.i18nParams?.quoteNumber || `#${id}`, diffDays },
              title: tOr('notifications.quotes.dueSoon.title', n.title),
              description: tOr('notifications.quotes.dueSoon.desc', n.description, { quoteNumber: n.i18nParams?.quoteNumber || `#${id}`, diffDays }),
            } as HeaderNotification;
          }
          // 'created' türündeki eski bildirimler: relatedId yok; link kategorisine göre yeniden yerelleştir
          if (!n.i18nTitleKey && !n.i18nDescKey) {
            if (n.link === 'customers') {
              return {
                ...n,
                i18nTitleKey: 'notifications.customers.created.title',
                i18nDescKey: 'notifications.customers.created.desc',
                // Parametre yoksa mevcut başlık/açıklamayı koru
                title: n.i18nParams ? tOr('notifications.customers.created.title', n.title) : n.title,
                description: n.i18nParams ? tOr('notifications.customers.created.desc', n.description, n.i18nParams) : n.description,
              } as HeaderNotification;
            }
            if (n.link === 'suppliers') {
              return {
                ...n,
                i18nTitleKey: 'notifications.suppliers.created.title',
                i18nDescKey: 'notifications.suppliers.created.desc',
                title: n.i18nParams ? tOr('notifications.suppliers.created.title', n.title) : n.title,
                description: n.i18nParams ? tOr('notifications.suppliers.created.desc', n.description, n.i18nParams) : n.description,
              } as HeaderNotification;
            }
            if (n.link === 'invoices' && !n.relatedId) {
              return {
                ...n,
                i18nTitleKey: 'notifications.invoices.created.title',
                i18nDescKey: 'notifications.invoices.created.desc',
                title: n.i18nParams ? tOr('notifications.invoices.created.title', n.title) : n.title,
                description: n.i18nParams ? tOr('notifications.invoices.created.desc', n.description, n.i18nParams) : n.description,
              } as HeaderNotification;
            }
            if (n.link === 'expenses' && !n.relatedId) {
              return {
                ...n,
                i18nTitleKey: 'notifications.expenses.created.title',
                i18nDescKey: 'notifications.expenses.created.desc',
                title: n.i18nParams ? tOr('notifications.expenses.created.title', n.title) : n.title,
                description: n.i18nParams ? tOr('notifications.expenses.created.desc', n.description, n.i18nParams) : n.description,
              } as HeaderNotification;
            }
            if (n.link === 'sales' && !n.relatedId) {
              return {
                ...n,
                i18nTitleKey: 'notifications.sales.created.title',
                i18nDescKey: 'notifications.sales.created.desc',
                title: n.i18nParams ? tOr('notifications.sales.created.title', n.title) : n.title,
                description: n.i18nParams ? tOr('notifications.sales.created.desc', n.description, n.i18nParams) : n.description,
              } as HeaderNotification;
            }
          }
        } catch (error) {
          reportSilentError('app.notifications.relocalizeLegacy', { notificationId: n?.id, error });
        }

        // 1) i18n meta'ya göre genel yeniden çeviri
        if (n.i18nTitleKey || n.i18nDescKey) {
          // Özel durum: 2FA anahtarlarını alternatif path'lerle dene
          if (n.relatedId === 'twofa-reminder' || String(n.i18nTitleKey || '').startsWith('security.twofa') || String(n.i18nDescKey || '').startsWith('security.twofa')) {
            return {
              ...n,
              title: tOrFirst(['security.twofa.reminderTitle','sales.security.twofa.reminderTitle'], n.title, n.i18nParams),
              description: tOrFirst(['security.twofa.reminderDesc','sales.security.twofa.reminderDesc'], n.description, n.i18nParams),
                
            } as HeaderNotification;
          }
          return {
            ...n,
            title: n.i18nTitleKey ? tOr(n.i18nTitleKey, n.title, n.i18nParams) : n.title,
            description: n.i18nDescKey ? tOr(n.i18nDescKey, n.description, n.i18nParams) : n.description,
              
          };
        }

        // 2) Başka bir şey değilse hiçbir alanı değiştirme
        return { ...n };
      }
      
      ));
    };

    relocalize();
  }, [i18n.language, invoices, expenses, products, tOr, tOrFirst]);

  const normalizeId = (value?: string | number) => String(value ?? Date.now());

  // URL hash routing for admin page
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      logger.debug('app.hashRouting.hashChange', { hash });

      const navigate = (page: string, extra?: Record<string, unknown>) => {
        logger.debug('app.hashRouting.navigate', { hash, targetPage: page, ...extra });
        setCurrentPage(page);
      };

      if (HASH_SYNC_PAGE_SET.has(hash)) {
        navigate(hash, { reason: 'hash-direct-match' });
        return;
      }

      if (hash === 'admin') {
        navigate('admin');
      } else if (hash === 'register') {
        navigate('register');
      } else if (hash === 'login') {
        navigate('login');
      } else if (hash === 'forgot-password') {
        navigate('forgot-password');
      } else if (hash.startsWith('reset-password')) {
        // Keep token in hash; page will parse
        navigate('reset-password');
      } else if (hash.startsWith('verify-email')) {
        navigate('verify-email');
      } else if (hash === 'verify-notice') {
        navigate('verify-notice');
      } else if (hash === 'help') {
        navigate('help');
      } else if (hash.startsWith('legal/')) {
        const legalPage = hash.replace('legal/', '');
        navigate(`legal-${legalPage}`, { legalPage });
      } else if (hash === 'settings/organization/members') {
        navigate('organization-members');
      } else if (hash.startsWith('join?token=')) {
        const token = hash.replace('join?token=', '');
        navigate(`join-organization:${token}`, { token });
      } else if (hash === '') {
        const assumeAuthenticated = isAuthenticated || Boolean(readLegacyAuthToken());
        if (assumeAuthenticated) {
          const cachedPage = readLastVisitedPage();
          if (cachedPage) {
            navigate(cachedPage, { reason: 'hash-empty-restored' });
            return;
          }
          navigate('dashboard', { reason: 'hash-empty-authenticated' });
        } else {
          navigate('landing', { reason: 'hash-empty-guest' });
        }
      } else if (hash === 'about') {
        navigate('about');
      } else if (hash === 'api') {
        navigate('api');
      } else if (hash.startsWith('customer-history:')) {
        navigate(hash);
      }
    };

    // Check initial hash
    logger.debug('app.hashRouting.initialHash', { hash: window.location.hash });
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [isAuthenticated]);

  // Legacy toast helpers will be removed once all call sites are refactored

  const confirmAction = (message: string) => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.confirm(message);
  };

  const handleCompanyUpdate = (updated: CompanyProfile) => {
    setCompany(updated);
    if (updated.currency) {
      setCurrency(updated.currency as Currency);
    }
    // Kalıcı saklama: secureStorage her zaman; düz localStorage yalnızca şifreleme kapalıysa
    try {
      const tenantScopedId = getTenantIdForCompanyCache();
      const secureKey = getCompanyProfileCacheKey(tenantScopedId);
      void secureStorage.setJSON(secureKey, updated);
    } catch (error) {
      reportSilentError('app.companyUpdate.securePersistFailed', error);
    }
    try {
      const encryptionEnabled = (import.meta as any)?.env?.VITE_ENABLE_ENCRYPTION === 'true';
      const tenantScopedId = getTenantIdForCompanyCache();
      const baseKey = getCompanyProfileCacheKey(tenantScopedId);
      const serialized = JSON.stringify(updated);
      if (!encryptionEnabled) {
        safeLocalStorage.setItem(baseKey, serialized);
      } else {
        // İsteğe bağlı: sade kopyayı ayrı anahtar altında tut (okumada fallback var)
        safeLocalStorage.setItem(`${baseKey}_plain`, serialized);
      }
    } catch (error) {
      reportSilentError('app.companyUpdate.plainPersistFailed', error);
    }
    try {
      window.dispatchEvent(new Event('company-profile-updated'));
    } catch (error) {
      reportSilentError('app.companyUpdate.dispatchFailed', error);
    }
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
  // Faturalama dönemi metni: Free planda boş, aksi halde 'Aylık' (i18n ileride eklenebilir)
  // NOT: billingPeriodLabel artık SettingsPage içindeki plan sekmesinde yeniden hesaplandığı için burada tutulmuyor (lint uyarısını engellemek için kaldırıldı)

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
    logger.info('app.notifications.clicked', {
      id: notification.id,
      type: notification.type,
      link: notification.link,
      persistent: Boolean(notification.persistent),
    });
    
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
      logger.debug('app.notifications.persistentHandled', { id: notification.id });
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
    
    // 2FA hatırlatıcısı için özel yönlendirme: Güvenlik sekmesini aç
    try {
      if (notification.relatedId && String(notification.relatedId).startsWith('twofa')) {
        openSettingsOn('security');
        return;
      }
    } catch (error) {
      reportSilentError('app.notifications.twofaRedirectFailed', error);
    }

    // Eğer link varsa o sayfaya git
    if (notification.link) {
      navigateTo(notification.link);
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
        try {
          const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
          writeTenantScopedArray('invoices_cache', next, { tenantId: tenantScopedId, mirrorToBase: true });
        } catch (error) {
          reportSilentError('app.invoices.inlineUpdate.persistFailed', error);
        }
        return next;
      });
      showToast(t('toasts.invoices.updateSuccess'), 'success');
    } catch (error: any) {
      console.error('Inline invoice update error:', error);
      showToast(error?.response?.data?.message || t('toasts.invoices.updateError'), 'error');
    }
  };

  const handleLogout = () => {
    setCurrentPage('dashboard');
    handleCloseNotifications();
    // State'leri temizle
    runWithSalesPersistenceSuppressed(() => {
      persistSalesState([]);
    });
    setCustomers([]);
    setSuppliers([]);
    setProducts([]);
    setInvoices([]);
    setExpenses([]);
    setBankAccounts([]);
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
        company: customerData.company?.trim() || undefined,
      };
      
      if (customerData.id) {
        // Update existing
        const updated = await customersApi.updateCustomer(String(customerData.id), cleanData);
        setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
        showToast(t('toasts.customers.updateSuccess'), 'success');
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
        showToast(t('toasts.customers.createSuccess'), 'success');
        
        // 🔔 Bildirim ekle
        addNotification(
          tOr('notifications.customers.created.title', 'Yeni müşteri eklendi'),
          tOr('notifications.customers.created.desc', `${created.name} sisteme kaydedildi.`, { name: created.name }),
          'success',
          'customers',
          { i18nTitleKey: 'notifications.customers.created.title', i18nDescKey: 'notifications.customers.created.desc', i18nParams: { name: created.name } }
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
    if (typeof window !== "undefined" && !window.confirm(t('customers.deleteConfirm', { defaultValue: 'Bu müşteriyi silmek istediğinizden emin misiniz?' }))) {
      return;
    }
    try {
      await customersApi.deleteCustomer(String(customerId));
      setCustomers(prev => prev.filter(customer => String(customer.id) !== String(customerId)));
      showToast(t('toasts.customers.deleteSuccess'), 'success');
    } catch (error: any) {
      console.error('Customer delete error:', error);
      
      // Bağlı fatura kontrolü
      if (error.response?.data?.relatedInvoices) {
        setDeleteWarningData({
          title: 'Müşteri Silinemez',
          message: error.response.data.message,
          relatedItems: normalizeRelatedItems(error.response.data.relatedInvoices),
          itemType: 'invoice'
        });
        setShowDeleteWarning(true);
      } else {
        showToast(error.response?.data?.message || t('toasts.customers.deleteError'), 'error');
      }
    }
  };

  const handleImportCustomers = async (file: File) => {
    try {
      logger.info('app.import.customers.start', { fileName: file.name, fileType: file.type });
      const data = await file.arrayBuffer();
      
      const rows: Record<string, unknown>[] = [];
      
      // Handle CSV files separately
      if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
        logger.debug('app.import.customers.csvDetected');
        const text = new TextDecoder('utf-8').decode(data);
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          logger.warn('app.import.customers.csvInsufficientData', { lineCount: lines.length });
          setInfoModal({ title: t('common.warning'), message: t('customers.import.noDataFound') });
          return;
        }
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        logger.debug('app.import.customers.csvHeaders', { headers });
        
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
        logger.debug('app.import.customers.excelDetected');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(data);
        
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          logger.warn('app.import.customers.excelNoWorksheet');
          setInfoModal({ title: t('common.warning'), message: t('customers.import.noDataFound') });
          return;
        }
        
        logger.debug('app.import.customers.excelWorksheet', { rowCount: worksheet.rowCount });
        
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

      logger.info('app.import.customers.parsed', { count: imported.length });
      
      if (imported.length === 0) {
        logger.warn('app.import.customers.noValidRecords');
        setInfoModal({ title: t('common.warning'), message: t('customers.import.noCustomersFound') });
        return;
      }

      // Persist imported customers to backend if possible
      try {
        logger.info('app.import.customers.persist.start', { count: imported.length });
        const results = await Promise.allSettled(
          imported.map((c, idx) => {
            logger.debug('app.import.customers.persist.request', { index: idx, name: c.name || 'unknown' });
            return customersApi.createCustomer({
              name: c.name,
              email: c.email || undefined,
              phone: c.phone || undefined,
              address: c.address || undefined,
              taxNumber: c.taxNumber || undefined,
              company: c.company || undefined,
            }).then(res => {
              logger.debug('app.import.customers.persist.success', { index: idx, customerId: res?.id });
              return res;
            }).catch(err => {
              logger.warn('app.import.customers.persist.failure', {
                index: idx,
                name: c.name || 'unknown',
                error: getErrorMessage(err),
              });
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

        logger.info('app.import.customers.persist.result', { created: created.length, failed: failed.length });

        // Notify user about results
        if (failed.length === 0) {
          setInfoModal({ title: t('common.success'), message: t('customers.import.success', { count: created.length }) });
        } else {
          const msg = `${t('customers.import.success', { count: created.length })}\n${failed.length} kayıt başarısız.`;
          setInfoModal({ title: t('common.warning'), message: msg });
          logger.warn('app.import.customers.persist.partialFailure', { failedCount: failed.length });
        }
      } catch (err) {
        logger.error('app.import.customers.persist.exception', err);
        setInfoModal({ title: t('common.error'), message: t('customers.import.error') + '\n\nDetay: ' + (err instanceof Error ? err.message : String(err)) });
      }
    } catch (error) {
      logger.error('app.import.customers.failed', error);
      setInfoModal({ title: t('common.error'), message: t('customers.import.error') + "\n\nDetay: " + (error instanceof Error ? error.message : String(error)) });
    }
  };

  const handleImportProducts = async (file: File) => {
    try {
      logger.info('app.import.products.start', { fileName: file.name, fileType: file.type });
      const data = await file.arrayBuffer();

      const rows: Record<string, unknown>[] = [];

      // CSV işleme
      if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
        logger.debug('app.import.products.csvDetected');
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
        logger.debug('app.import.products.excelDetected');
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

      logger.info('app.import.products.parsed', { count: imported.length });

      if (imported.length === 0) {
        logger.warn('app.import.products.noValidRecords');
        setInfoModal({ title: t('common.warning'), message: t('customers.import.noDataFound') });
        return;
      }

      // Backend'e kaydet
      try {
        logger.info('app.import.products.persist.start', { count: imported.length });
        const results = await Promise.allSettled(
          imported.map((p, index) => {
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
            logger.debug('app.import.products.persist.request', { index, name: p.name });
            return productsApi.createProduct(dto)
              .then(res => {
                logger.debug('app.import.products.persist.success', { index, productId: res?.id });
                return res;
              })
              .catch(err => {
                logger.warn('app.import.products.persist.failure', {
                  index,
                  name: p.name,
                  error: getErrorMessage(err),
                });
                throw err;
              });
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
          const mapped = created.map(mapBackendProductRecord);
          setProducts(prev => {
            const next = [...prev, ...mapped];
            const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
            writeTenantScopedArray('products_cache', next, { tenantId: tenantScopedId, mirrorToBase: true });
            return next;
          });
        }

        logger.info('app.import.products.persist.result', { created: created.length, failed: failed.length });

        if (failed.length === 0) {
          setInfoModal({ title: t('common.success'), message: `${created.length} ürün başarıyla içe aktarıldı!` });
        } else {
          setInfoModal({ title: t('common.warning'), message: `${created.length} ürün içe aktarıldı, ${failed.length} kayıt başarısız.` });
          logger.warn('app.import.products.persist.partialFailure', { failedCount: failed.length });
        }
      } catch (err) {
        logger.error('app.import.products.persist.exception', err);
        setInfoModal({ title: t('common.error'), message: (t('customers.import.error') || 'İçe aktarma hatası') + '\n\nDetay: ' + (err instanceof Error ? err.message : String(err)) });
      }
    } catch (error) {
      logger.error('app.import.products.failed', error);
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
        showToast(t('toasts.suppliers.updateSuccess'), 'success');
      } else {
        const created = await suppliersApi.createSupplier(cleanData);
        setSuppliers(prev => [...prev, created]);
        showToast(t('toasts.suppliers.createSuccess'), 'success');
        
        // 🔔 Bildirim ekle
        addNotification(
          tOr('notifications.suppliers.created.title', 'Yeni tedarikçi eklendi'),
          tOr('notifications.suppliers.created.desc', `${created.name} sisteme kaydedildi.`, { name: created.name }),
          'success',
          'suppliers',
          { i18nTitleKey: 'notifications.suppliers.created.title', i18nDescKey: 'notifications.suppliers.created.desc', i18nParams: { name: created.name } }
        );
      }
    } catch (error: any) {
      console.error('Supplier upsert error:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Tedarikçi kaydedilemedi';
      showToast(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg, 'error');
    }
  };

  const deleteSupplier = async (supplierId: string | number) => {
    if (typeof window !== "undefined" && !window.confirm(t('suppliers.deleteConfirm', { defaultValue: 'Bu tedarikçiyi silmek istediğinizden emin misiniz?' }))) {
      return;
    }
    try {
      await suppliersApi.deleteSupplier(String(supplierId));
      setSuppliers(prev => prev.filter(supplier => String(supplier.id) !== String(supplierId)));
      showToast(t('toasts.suppliers.deleteSuccess'), 'success');
    } catch (error: any) {
      console.error('Supplier delete error:', error);
      
      // Bağlı gider kontrolü
      if (error.response?.data?.relatedExpenses) {
        setDeleteWarningData({
          title: 'Tedarikçi Silinemez',
          message: error.response.data.message,
          relatedItems: normalizeRelatedItems(error.response.data.relatedExpenses),
          itemType: 'expense'
        });
        setShowDeleteWarning(true);
      } else {
        showToast(error.response?.data?.message || t('toasts.suppliers.deleteError'), 'error');
      }
    }
  };

  const upsertInvoice = async (invoiceData: any) => {
    const extractLineItems = (record?: any): any[] => {
      if (!record) return [];
      if (Array.isArray(record.items) && record.items.length) return record.items;
      if (Array.isArray(record.lineItems) && record.lineItems.length) return record.lineItems;
      return [];
    };

    const isRefundInvoiceRecord = (record?: any): boolean => {
      const type = String(record?.type || '').toLowerCase();
      return type === 'refund' || type === 'return';
    };

    const buildProductQuantityMap = (record?: any): Map<string, number> => {
      const map = new Map<string, number>();
      extractLineItems(record).forEach((line: any) => {
        const pid = line?.productId ? String(line.productId) : '';
        if (!pid) return;
        const qty = Number(line?.quantity) || 0;
        if (!Number.isFinite(qty) || qty === 0) return;
        map.set(pid, (map.get(pid) || 0) + qty);
      });
      return map;
    };

    const applyLocalStockAdjustments = (adjustments: Map<string, number>) => {
      if (!adjustments || adjustments.size === 0) return;
      setProducts(prev => prev.map(product => {
        const key = String(product.id);
        if (!adjustments.has(key)) {
          return product;
        }
        const delta = adjustments.get(key) || 0;
        if (!delta) {
          return product;
        }
        const baseStock = Number(product.stockQuantity ?? product.stock ?? 0) || 0;
        const nextStock = Math.max(0, baseStock + delta);
        const status = nextStock <= 0 ? 'out-of-stock' : nextStock <= (product.reorderLevel || 0) ? 'low' : 'active';
        return {
          ...product,
          stockQuantity: nextStock,
          stock: nextStock,
          status,
        };
      }));
    };

    const ensureInvoiceWithItems = async (record?: any): Promise<any | null> => {
      if (record && Array.isArray(record.items) && record.items.length) {
        return record;
      }
      if (!record?.id) {
        return record || null;
      }
      try {
        const full = await invoicesApi.getInvoice(String(record.id));
        return full;
      } catch (error) {
        reportSilentError('app.invoices.update.fetchFailed', error);
        return record || null;
      }
    };

    try {
      logger.info('app.invoices.upsert.start', {
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
        showToast(t('toasts.sales.customerNotSelected'), 'error');
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
        // Sadece yeni iade faturası OLUŞTURULUYORSA orijinale referans ver
        refundedInvoiceId: (!invoiceData.id && invoiceData.originalInvoiceId &&
          (String((invoiceData.type||'').toLowerCase()) === 'return' || String((invoiceData.type||'').toLowerCase()) === 'refund'))
          ? invoiceData.originalInvoiceId
          : undefined,
      };
      
      logger.debug('app.invoices.upsert.payload', {
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
            title: t('plans.limitExceeded.title', { defaultValue: 'Plan Limiti Aşıldı' }),
            message: t('plans.limitExceeded.invoicesMessage', { defaultValue: 'Starter/Free planda bir ayda en fazla 5 fatura oluşturabilirsiniz. Daha fazla fatura için planınızı yükseltin.' })
          });
          // İsteğe bağlı: Ayarlar sayfasını açmak isterseniz yorumdan çıkartın
          // openSettingsOn('organization');
          return;
        } else if (used === MAX - 1) {
          addNotification(
            tOr('notifications.plan.limit.title', 'Plan limiti uyarısı'),
            tOr('notifications.plan.limit.invoices.desc', 'Bu ay 5/5 limitine yaklaşmaktasınız (4/5).', { used: used, limit: MAX }),
            'info',
            'invoices',
            { relatedId: 'plan-limit-invoices', i18nTitleKey: 'notifications.plan.limit.title', i18nDescKey: 'notifications.plan.limit.invoices.desc', i18nParams: { used: used, limit: MAX } }
          );
        }
      }

      if (invoiceData.id) {
        const oldInvoice = invoices.find(i => String(i.id) === String(invoiceData.id));
        const previousDetailed = await ensureInvoiceWithItems(oldInvoice);
        const wasRefund = isRefundInvoiceRecord(previousDetailed);
        const updated = await invoicesApi.updateInvoice(String(invoiceData.id), cleanData);
        const updatedDetailed = await ensureInvoiceWithItems(updated);
        const isNowRefund = isRefundInvoiceRecord(updatedDetailed);
        const invoiceForState = updatedDetailed || updated;
        
        const newInvoices = invoices.map(i => i.id === updated.id ? invoiceForState : i);
        setInvoices(newInvoices);
        try {
          const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
          writeTenantScopedArray('invoices_cache', newInvoices, { tenantId: tenantScopedId, mirrorToBase: true });
        } catch (error) {
          reportSilentError('app.invoices.update.persistFailed', error);
        }
        
        const isRefundTransition = !wasRefund && isNowRefund;
        if (previousDetailed && updatedDetailed && !isRefundTransition) {
          const prevMap = buildProductQuantityMap(previousDetailed);
          const nextMap = buildProductQuantityMap(updatedDetailed);
          const adjustments = new Map<string, number>();
          const productIds = new Set<string>([
            ...Array.from(prevMap.keys()),
            ...Array.from(nextMap.keys()),
          ]);
          productIds.forEach(pid => {
            const delta = (prevMap.get(pid) || 0) - (nextMap.get(pid) || 0);
            if (delta !== 0) {
              adjustments.set(pid, delta);
            }
          });
          if (adjustments.size) {
            applyLocalStockAdjustments(adjustments);
          }
        }

        // İade faturasına dönüşmüşse: stokları UI'de geri ekle + satışı iptal et
        if (isRefundTransition) {
          try {
            const lineItems = extractLineItems(updatedDetailed || updated);
            setProducts(prev => prev.map(p => {
              const matched = lineItems.find((li: any) => String(li.productId || '') === String(p.id));
              if (!matched) return p;
              const q = Number(matched.quantity || 0);
              // Backend stok artırdı; UI'de de artır (negatif iade miktarlarını mutlak değerle)
              const delta = q < 0 ? Math.abs(q) : q;
              const newStock = Number(p.stockQuantity || 0) + delta;
              return {
                ...p,
                stockQuantity: newStock,
                status: newStock <= 0 ? 'out-of-stock' : newStock <= (p.reorderLevel || 0) ? 'low' : 'active'
              };
            }));
          } catch (error) {
            reportSilentError('app.invoices.stockRestoreFailed', error);
          }
          
          // İlgili satışı 'refunded' yap
          if ((updated as any).saleId) {
            persistSalesState(prev => prev.map(s => 
              String(s.id) === String((updated as any).saleId) 
                ? { ...s, status: 'refunded' }
                : s
            ));
          }
        }
        
        logger.debug('app.invoices.cacheUpdated', { action: 'update' });
        showToast(t('toasts.invoices.updateSuccess'), 'success');
        return updated; // Güncellenen faturayı return et
      } else {
        // Ek güvenlik: backend'e gitmeden önce stok kontrolü (modal kaçsa da engelle)
        try {
          for (const it of (cleanData.items || [])) {
            let prod: any = undefined;
            if (it.productId) prod = products.find(p => String(p.id) === String(it.productId));
            if (!prod && it.productName) {
              const nameLc = String(it.productName).trim().toLowerCase();
              prod = products.find(p => String(p.name || '').trim().toLowerCase() === nameLc)
                  || products.find(p => String(p.name || '').toLowerCase().includes(nameLc));
            }
            if (prod) {
              const available = Number((prod as any).stock ?? (prod as any).stockQuantity ?? NaN);
              const requested = Number(it.quantity) || 0;
              if (Number.isFinite(available) && requested > available) {
                showToast(t('validation.insufficientStock', { defaultValue: `Stok yetersiz: ${prod.name} (İstenen: ${requested}, Mevcut: ${available})` }), 'error');
                return; // Fatura/satış oluşturmayı durdur
              }
            }
          }
        } catch (error) {
          reportSilentError('app.invoices.preCreate.stockCheckFailed', error);
        }

        const created = await invoicesApi.createInvoice(cleanData);
        logger.info('app.invoices.create.success', {
          id: created.id,
          invoiceNumber: created.invoiceNumber,
          type: created.type,
          customer: created.customer,
          items: (created as any).items,
          lineItems: (created as any).lineItems
        });
        
        // Eğer mevcut bir satış yoksa (saleId yok) ve fatura iade değilse otomatik satış OLUŞTUR ve backend'e kaydet
        if (
          !cleanData.saleId &&
          cleanData.items &&
          cleanData.items.length > 0 &&
          String(cleanData.type || '').toLowerCase() !== 'refund' &&
          String(cleanData.type || '').toLowerCase() !== 'return'
        ) {
          try {
            logger.debug('app.sales.autoCreate.fromInvoice.start', { invoiceId: created.id });

            // Müşteri bilgileri
            const customerInfo = customers.find(c => c.id === cleanData.customerId);
            const customerName = customerInfo?.name || invoiceData.customerName || 'N/A';
            const customerEmail = customerInfo?.email || invoiceData.customerEmail || '';

            // Satış kalemleri (KDV oranı bilgisi de tutuluyor)
            const saleItems = cleanData.items.map((item: any) => ({
              productId: item.productId,
              productName: item.productName || item.description || 'Ürün/Hizmet',
              quantity: Number(item.quantity) || 1,
              unitPrice: Number(item.unitPrice) || 0,
              taxRate: Number(item.taxRate ?? 18)
            }));

            const salePayload: salesApi.CreateSaleDto = {
              customerId: String(cleanData.customerId),
              customerName,
              customerEmail,
              saleDate: cleanData.issueDate,
              items: saleItems,
              discountAmount: Number(cleanData.discountAmount || 0),
              notes: `${created.invoiceNumber} numaralı faturadan otomatik oluşturuldu.`,
              invoiceId: created.id,
            };

            // Backend'e yaz
            const savedSale = await salesApi.createSale(salePayload);

            // UI state için temel alanları normalleştir
            const firstItem = Array.isArray(savedSale?.items) && savedSale.items.length > 0 ? savedSale.items[0] : undefined;
            const uiSale = {
              ...savedSale,
              customerName: savedSale?.customer?.name || customerName,
              customerEmail: customerEmail,
              productId: firstItem?.productId,
              productName: firstItem?.productName || firstItem?.description || '',
              quantity: Number(firstItem?.quantity ?? 1),
              unitPrice: Number(firstItem?.unitPrice ?? 0),
              date: savedSale?.saleDate ? String(savedSale.saleDate).slice(0,10) : cleanData.issueDate,
              amount: Number(savedSale?.total ?? created.total ?? 0),
              status: 'completed',
            } as any;

            // Satış state + cache
            persistSalesState(prev => [...prev, uiSale]);

            // Ürün stoklarını sadece UI'de düş (backend zaten düşürdü)
            try {
              const lineItems = Array.isArray(saleItems) ? saleItems : [];
              setProducts(prev => prev.map(p => {
                const matched = lineItems.find(li => String(li.productId || '') === String(p.id));
                if (!matched) return p;
                const newStock = Number(p.stockQuantity || 0) - Number(matched.quantity || 0);
                const ns = newStock < 0 ? 0 : newStock;
                return {
                  ...p,
                  stockQuantity: ns,
                  status: ns <= 0 ? 'out-of-stock' : ns <= (p.reorderLevel || 0) ? 'low' : 'active'
                };
              }));
            } catch (error) {
              reportSilentError('app.sales.autoCreate.stockAdjustFailed', error);
            }

            // Faturayı satış ile ilişkilendir (tip güvenliği için saleId ekli UpdateInvoiceDto)
            try {
              await invoicesApi.updateInvoice(String(created.id), { saleId: String(savedSale.id) });
              setInvoices(prev => prev.map(inv => String(inv.id) === String(created.id) ? { ...inv, saleId: savedSale.id } : inv));
            } catch (e) {
              logger.warn('app.invoices.linkUpdateFailed', e);
            }

            // Bildirim
            try {
              const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
              const userId = (authUser as any)?.id ? String((authUser as any).id) : undefined;
              const prefs = readNotificationPrefsCache({
                tenantIds: tenantScopedId ? [tenantScopedId] : undefined,
                userIds: userId ? [userId] : undefined,
              }) || {};
              if (prefs?.salesNotifications !== false) {
                addNotification(
                  tOr('notifications.sales.created.title', 'Yeni satış kaydedildi'),
                  tOr('notifications.sales.created.desc', `${customerName} - ${String((savedSale as any)?.items?.[0]?.productName || '')}: ${Number(savedSale.total)||0}`, { customerName, summary: String((savedSale as any)?.items?.[0]?.productName || ''), totalAmount: Number(savedSale.total)||0 }),
                  'success',
                  'sales',
                  { i18nTitleKey: 'notifications.sales.created.title', i18nDescKey: 'notifications.sales.created.desc', i18nParams: { customerName, summary: String((savedSale as any)?.items?.[0]?.productName || ''), totalAmount: Number(savedSale.total)||0 } }
                );
              }
            } catch (error) {
              reportSilentError('app.sales.autoCreate.notificationFailed', error);
            }

          } catch (saleError) {
            console.error('⚠️ Otomatik satış (backend) oluşturulamadı:', saleError);
            // Fatura başarılı oldu ama satış oluşturulamadıysa kullanıcıya bilgi ver (fatura kaydı bozulmasın)
            showToast(t('toasts.invoices.createPartialError'), 'error');
          }

          void refreshProductsFromServer();
        }
        
        const newInvoices = [...invoices, created];
        setInvoices(newInvoices);
        try {
          const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
          writeTenantScopedArray('invoices_cache', newInvoices, { tenantId: tenantScopedId, mirrorToBase: true });
        } catch (error) {
          reportSilentError('app.invoices.create.persistFailed', error);
        }
        logger.debug('app.invoices.cacheUpdated', { action: 'create' });
        showToast(t('toasts.invoices.createWithSaleSuccess'), 'success');
        
        // 🔔 Bildirim ekle
        const customerInfo = customers.find(c => c.id === cleanData.customerId);
        addNotification(
          tOr('notifications.invoices.created.title', 'Yeni fatura oluşturuldu'),
          tOr('notifications.invoices.created.desc', `${created.invoiceNumber} - ${customerInfo?.name || 'Müşteri'} için fatura hazır.`, { invoiceNumber: created.invoiceNumber, customerName: customerInfo?.name || 'Müşteri' }),
          'success',
          'invoices',
          { i18nTitleKey: 'notifications.invoices.created.title', i18nDescKey: 'notifications.invoices.created.desc', i18nParams: { invoiceNumber: created.invoiceNumber, customerName: customerInfo?.name || 'Müşteri' } }
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
    try {
      // Backend'e silme isteği gönder
      await invoicesApi.deleteInvoice(String(invoiceId));
      
      // Sadece backend'den başarılı response gelirse cache'i güncelle
      const newInvoices = invoices.filter(invoice => String(invoice.id) !== String(invoiceId));
      setInvoices(newInvoices);
      try {
        const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
        writeTenantScopedArray('invoices_cache', newInvoices, { tenantId: tenantScopedId, mirrorToBase: true });
      } catch (error) {
        reportSilentError('app.invoices.delete.persistFailed', error);
      }
      logger.debug('app.invoices.cacheUpdated', { action: 'delete' });
      showToast(t('invoices.deleteSuccess', { defaultValue: 'Fatura silindi' }), 'success');
    } catch (error: any) {
      console.error('Invoice delete error:', error);
      const errorMessage = error.response?.data?.message || '';
      
      // Hata durumunda cache'i güncelleme - fatura listede kalacak
      logger.warn('app.invoices.cacheUpdateSkipped', { action: 'delete' });
      
      // Check if error is about locked period
      if (errorMessage.includes('locked period') || errorMessage.includes('kilitli dönem') || errorMessage.includes('Cannot modify records')) {
        showToast(t('common.periodLockedError'), 'error');
      } else {
        showToast(errorMessage || t('invoices.deleteError'), 'error');
      }
    }
  };

  // UI'dan çağrılan silme isteği: önce onay modalı aç
  const requestDeleteInvoice = (invoiceId: string | number) => {
    setInvoiceToDelete(String(invoiceId));
  };

  const voidInvoice = async (invoiceId: string, reason: string) => {
    try {
      const invoiceToVoid = invoices.find(inv => inv.id === invoiceId);
      await invoicesApi.voidInvoice(invoiceId, reason);
      const updatedInvoices = invoices.map(invoice => 
        invoice.id === invoiceId 
          ? { ...invoice, isVoided: true, voidReason: reason, voidedAt: new Date().toISOString() }
          : invoice
      );
      setInvoices(updatedInvoices);
      try {
        const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
        writeTenantScopedArray('invoices_cache', updatedInvoices, { tenantId: tenantScopedId, mirrorToBase: true });
      } catch (error) {
        reportSilentError('app.invoices.void.persistFailed', error);
      }
      
      // Backend stokları geri ekledi; UI state'ini de güncelle
      if (invoiceToVoid) {
        try {
          const lineItems = Array.isArray((invoiceToVoid as any).items) ? (invoiceToVoid as any).items : [];
          setProducts(prev => prev.map(p => {
            const matched = lineItems.find((li: any) => String(li.productId || '') === String(p.id));
            if (!matched) return p;
            const qty = Number(matched.quantity || 0);
            const newStock = Number(p.stockQuantity || 0) + qty;
            return {
              ...p,
              stockQuantity: newStock,
              status: newStock <= 0 ? 'out-of-stock' : newStock <= (p.reorderLevel || 0) ? 'low' : 'active'
            };
          }));
        } catch (error) {
          reportSilentError('app.invoices.void.stockRestoreFailed', error);
        }
        
        // İlgili satışı iptal et
        if ((invoiceToVoid as any).saleId) {
          persistSalesState(prev => prev.map(s => 
            String(s.id) === String((invoiceToVoid as any).saleId) 
              ? { ...s, status: 'cancelled' }
              : s
          ));
        }
      }
      
      showToast(t('toasts.invoices.cancelSuccess'), 'success');
    } catch (error: any) {
      console.error('Invoice void error:', error);
      showToast(error.response?.data?.message || t('toasts.invoices.cancelError'), 'error');
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
      try {
        const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
        writeTenantScopedArray('invoices_cache', updatedInvoices, { tenantId: tenantScopedId, mirrorToBase: true });
      } catch (error) {
        reportSilentError('app.invoices.restore.persistFailed', error);
      }
      showToast(t('toasts.invoices.restoreSuccess'), 'success');
    } catch (error: any) {
      console.error('Invoice restore error:', error);
      showToast(error.response?.data?.message || t('toasts.invoices.restoreError'), 'error');
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
            title: t('plans.limitExceeded.title', { defaultValue: 'Plan Limiti Aşıldı' }),
            message: t('plans.limitExceeded.expensesMessage', { defaultValue: 'Starter/Free planda bir ayda en fazla 5 gider kaydı oluşturabilirsiniz. Daha fazlası için planınızı yükseltin.' })
          });
          // openSettingsOn('organization');
          return;
        } else if (used === MAX - 1) {
          addNotification(
            tOr('notifications.plan.limit.title', 'Plan limiti uyarısı'),
            tOr('notifications.plan.limit.expenses.desc', 'Bu ay 5/5 limitine yaklaşmaktasınız (4/5).', { used: used, limit: MAX }),
            'info',
            'expenses',
            { relatedId: 'plan-limit-expenses', i18nTitleKey: 'notifications.plan.limit.title', i18nDescKey: 'notifications.plan.limit.expenses.desc', i18nParams: { used: used, limit: MAX } }
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
        try {
          const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
          writeTenantScopedArray('expenses_cache', newExpenses, { tenantId: tenantScopedId, mirrorToBase: true });
        } catch (error) {
          reportSilentError('app.expenses.update.persistFailed', error);
        }
        showToast(t('toasts.expenses.updateSuccess'), 'success');
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
        try {
          const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
          writeTenantScopedArray('expenses_cache', newExpenses, { tenantId: tenantScopedId, mirrorToBase: true });
        } catch (error) {
          reportSilentError('app.expenses.create.persistFailed', error);
        }
        showToast(t('toasts.expenses.createSuccess'), 'success');
        
        // 🔔 Bildirim ekle
        const supplierName = mappedCreated.supplier?.name || 'Tedarikçi';
        addNotification(
          tOr('notifications.expenses.created.title', 'Yeni gider kaydedildi'),
          tOr('notifications.expenses.created.desc', `${supplierName} - ${mappedCreated.description}: ${mappedCreated.amount} TL`, { supplierName, description: mappedCreated.description, amount: mappedCreated.amount }),
          'info',
          'expenses',
          { i18nTitleKey: 'notifications.expenses.created.title', i18nDescKey: 'notifications.expenses.created.desc', i18nParams: { supplierName, description: mappedCreated.description, amount: mappedCreated.amount } }
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
      try {
        const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
        writeTenantScopedArray('expenses_cache', newExpenses, { tenantId: tenantScopedId, mirrorToBase: true });
      } catch (error) {
        reportSilentError('app.expenses.delete.persistFailed', error);
      }
      logger.debug('app.expenses.cacheUpdated', { action: 'delete' });
      showToast(t('expenses.deleteSuccess'), 'success');
    } catch (error: any) {
      console.error('Expense delete error:', error);
      const errorMessage = error.response?.data?.message || '';
      
      // Hata durumunda cache'i güncelleme - gider listede kalacak
      logger.warn('app.expenses.cacheUpdateSkipped', { action: 'delete' });
      
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
      try {
        const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
        writeTenantScopedArray('expenses_cache', updatedExpenses, { tenantId: tenantScopedId, mirrorToBase: true });
      } catch (error) {
        reportSilentError('app.expenses.void.persistFailed', error);
      }
      showToast(t('toasts.expenses.cancelSuccess'), 'success');
    } catch (error: any) {
      console.error('Expense void error:', error);
      showToast(error.response?.data?.message || t('toasts.expenses.cancelError'), 'error');
    }
  };

  // Inline gider durumu güncelleme (kalıcı)
  const updateExpenseStatusInline = async (updated: any) => {
    try {
      const server = await expensesApi.updateExpenseStatus(String(updated.id), updated.status as any);
      const mapped: any = {
        ...server,
        supplier: server.supplier || null,
        expenseDate: server.expenseDate
          ? (typeof server.expenseDate === 'string' ? server.expenseDate : new Date(server.expenseDate).toISOString().split('T')[0])
          : updated.expenseDate,
        dueDate: (server as any).dueDate || (server as any).expenseDate || updated.expenseDate,
      };
      const next = expenses.map(e => (String(e.id) === String(mapped.id) ? mapped : e));
      setExpenses(next);
      try {
        const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
        writeTenantScopedArray('expenses_cache', next, { tenantId: tenantScopedId, mirrorToBase: true });
      } catch (error) {
        reportSilentError('app.expenses.inlineStatus.persistFailed', error);
      }
      showToast(t('toasts.expenses.statusUpdateSuccess'), 'success');
    } catch (error: any) {
      console.error('Expense status update error:', error);
      const msg = String(error?.response?.data?.message || error?.message || 'Gider durumu güncellenemedi');
      if (msg.includes('locked period') || msg.includes('kilitli dönem') || msg.includes('Cannot modify records')) {
        showToast(t('common.periodLockedError'), 'error');
      } else {
        showToast(msg, 'error');
      }
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
      try {
        const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
        writeTenantScopedArray('expenses_cache', updatedExpenses, { tenantId: tenantScopedId, mirrorToBase: true });
      } catch (error) {
        reportSilentError('app.expenses.restore.persistFailed', error);
      }
      showToast(t('toasts.expenses.restoreSuccess'), 'success');
    } catch (error: any) {
      console.error('Expense restore error:', error);
      showToast(error.response?.data?.message || t('toasts.expenses.restoreError'), 'error');
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
          showToast(t('toasts.sales.insufficientStock', { name: product.name, available: availableStock, requested: requestedQty }), 'error');
          return; // Satışı oluşturma
        }
      }
    }
    
    // Backend'e kaydet ve state'i güncelle
    const isNewSale = !saleData?.id;

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
        customerName: !customerId ? saleData.customerName : undefined,
        customerEmail: !customerId ? saleData.customerEmail : undefined,
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
          createdByName: saved?.createdByName || `${authUser?.firstName || ''} ${authUser?.lastName || ''}`.trim() || authUser?.email || user.name,
          updatedByName: saved?.updatedByName || `${authUser?.firstName || ''} ${authUser?.lastName || ''}`.trim() || authUser?.email || user.name,
          createdAt: saved?.createdAt || new Date().toISOString(),
          updatedAt: saved?.updatedAt || new Date().toISOString(),
        } as any;

        persistSalesState(prev => [...prev, mapped]);
        showToast(t('toasts.sales.createSuccess'), 'success');
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
        persistSalesState(prev => prev.map(s => String(s.id) === id ? {
            ...s,
            saleNumber: updated.saleNumber || s.saleNumber,
            date: updated.saleDate ? String(updated.saleDate).slice(0,10) : s.date,
            amount: Number(updated.total ?? s.amount) || 0,
            total: Number(updated.total ?? s.total) || 0,
            items: Array.isArray(updated.items) ? updated.items : s.items,
            notes: updated.notes ?? s.notes,
            updatedByName: updated?.updatedByName || `${authUser?.firstName || ''} ${authUser?.lastName || ''}`.trim() || authUser?.email || s.updatedByName,
            updatedAt: updated?.updatedAt || new Date().toISOString(),
          } : s));
        showToast(t('toasts.sales.updateSuccess'), 'success');
      }
    } catch (err: any) {
      console.error('❌ Sales upsert error:', err);
      // Offline fallback: yerel kaydetmeye devam et
      persistSalesState(prev => {
        const newItem = {
          ...saleData,
          id: saleData.id || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
          saleNumber: saleData.saleNumber || `SAL-${new Date().toISOString().slice(0,7)}-OFF`,
          date: saleData?.date || new Date().toISOString().split('T')[0],
          amount: saleData.amount || (Number(saleData.quantity||1) * Number(saleData.unitPrice||0)),
          createdByName: `${authUser?.firstName || ''} ${authUser?.lastName || ''}`.trim() || authUser?.email || user.name,
          updatedByName: `${authUser?.firstName || ''} ${authUser?.lastName || ''}`.trim() || authUser?.email || user.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const existsIdx = prev.findIndex(p => String(p.id) === String(newItem.id));
        return existsIdx >= 0 ? prev.map((p, i) => i === existsIdx ? newItem : p) : [...prev, newItem];
      });
      showToast(getErrorMessage(err) || t('toasts.sales.localSaved'), 'info');
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
            addNotification(
              tOr('notifications.products.lowStock.title', 'Düşük stok uyarısı'),
              tOr('notifications.products.lowStock.desc', `${product.name} - Stok seviyesi minimum limitin altında! (${newStock}/${product.reorderLevel})`, { name: product.name, stock: newStock, min: product.reorderLevel }),
              'info', 'products', { persistent: true, repeatDaily: true, relatedId: `low-stock-${product.id}` }
            );
          }
          if (newStock <= 0) {
            addNotification(
              tOr('notifications.products.outOfStock.title', 'Stok tükendi'),
              tOr('notifications.products.outOfStock.desc', `${product.name} - Stok tükendi!`, { name: product.name }),
              'info', 'products', { persistent: true, repeatDaily: true, relatedId: `out-of-stock-${product.id}` }
            );
          }
        } catch (stockError) {
          console.error('Manuel satış - Stok güncellenemedi:', stockError);
          showToast(t('toasts.sales.stockUpdateFailed'), 'error');
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
      addNotification(
        tOr('notifications.sales.created.title', 'Yeni satış kaydedildi'),
        tOr('notifications.sales.created.desc', `${saleData.customerName} - ${summary}: ${totalAmount} TL`, { customerName: saleData.customerName, summary, totalAmount }),
        'success', 'sales'
      );

      void refreshProductsFromServer();
    }
  };

  const upsertSaleRef = React.useRef(upsertSale);
  upsertSaleRef.current = upsertSale;

  const handleDeleteSale = async (saleId: string, opts?: { skipConfirm?: boolean }) => {
    if (!opts?.skipConfirm) {
      if (!confirm(t('sales.deleteConfirm', { defaultValue: 'Bu satışı silmek istediğinizden emin misiniz?' }))) {
        return;
      }
    }
    logger.info('app.sales.delete.request', { saleId });
    // const prevSnapshot = [...sales];
    try {
      await salesApi.deleteSale(String(saleId));
    } catch (err: any) {
      console.error('❌ Satış backend üzerinde silinemedi:', err);
      showToast(getErrorMessage(err) || t('toasts.sales.deleteError'), 'error');
      return; // Başarısızsa yerel olarak silme, veri tutarlılığı korunur
    }
    persistSalesState(prev => {
      const filtered = prev.filter(sale => String(sale.id) !== String(saleId));
      logger.info('app.sales.delete.success', { remaining: filtered.length });
      return filtered;
    });
    showToast(t('toasts.sales.deleteSuccess'), 'success');
    setShowSaleViewModal(false);
    setSelectedSale(null);
  };

  const requestDeleteSale = (saleId: string | number) => {
    setSaleToDelete(String(saleId));
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
        taxRate: Number(productData.taxRate ?? 18), // Kategori KDV'si
        categoryTaxRateOverride: productData.categoryTaxRateOverride ? Number(productData.categoryTaxRateOverride) : undefined, // Özel KDV
      };

      logger.debug('app.products.upsert.payload', {
        name: backendData.name,
        category: backendData.category,
        taxRate: backendData.taxRate,
        categoryTaxRateOverride: backendData.categoryTaxRateOverride
      });

      if (productData?.id) {
        // Update existing
        const updated = await productsApi.updateProduct(String(productData.id), backendData);
        setProducts(prev => prev.map(p => p.id === updated.id ? mapBackendProductRecord(updated) : p));
        showToast(t('toasts.products.updateSuccess'), 'success');
      } else {
        // Create new
        const created = await productsApi.createProduct(backendData);
        setProducts(prev => [...prev, mapBackendProductRecord(created)]);
        showToast(t('toasts.products.createSuccess'), 'success');
        
        // Ürün eklendi bildirimi kaldırıldı (yalnızca düşük stok/tükenmiş stok bildirimleri gösterilecek)
        
        // ⚠️ Stok uyarısı
        if (created.stock <= created.minStock) {
          addNotification(
            tOr('notifications.products.lowStock.title', 'Düşük stok uyarısı'),
            tOr('notifications.products.lowStock.desc', `${created.name} - Stok seviyesi minimum limitin altında! (${created.stock}/${created.minStock})`, { name: created.name, stock: created.stock, min: created.minStock }),
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
    if (!confirmAction(t('products.deleteConfirm', { defaultValue: 'Bu ürünü silmek istediğinizden emin misiniz?' }))) {
      return;
    }
    try {
      await productsApi.deleteProduct(String(productId));
      setProducts(prev => prev.filter(product => product.id !== String(productId)));
      showToast(t('toasts.products.deleteSuccess'), 'success');
    } catch (error: any) {
      console.error('Product delete error:', error);
      showToast(error.response?.data?.message || t('toasts.products.deleteError'), 'error');
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
        
        logger.info('app.productCategories.created', { id: newCategory.id, name: newCategory.name });
        
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
        showToast(t('toasts.categories.added', { name: normalized, taxRate }), 'success');
      }
    } catch (error: any) {
      console.error('Kategori ekleme hatası:', error);
      showToast(error.response?.data?.message || t('toasts.categories.addError'), 'error');
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
    showToast(t('toasts.categories.updateSuccess'), 'success');
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
    showToast(t('toasts.categories.deleteSuccess'), 'success');
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
          showToast(t('toasts.products.bulkRemoved', { count: removedCount }), 'success');
        } else {
          showToast(t('toasts.products.bulkNotFound'), 'info');
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
          showToast(t('toasts.products.bulkArchived', { count: changed }), 'success');
        } else {
          showToast(t('toasts.products.bulkAlreadyArchived'), 'info');
        }
        return next;
      });
      return;
    }

    if (action === "update-price") {
      showToast(t('toasts.products.bulkPriceUpdateSaved'), 'info');
      return;
    }

    if (action === "assign-category") {
      showToast(t('toasts.categories.assignmentInfo'), 'info');
    }
  };

  const upsertBank = async (bankData: any) => {
    try {
      const { bankAccountsApi } = await import('./api/bank-accounts');
      if (bankData.id) {
        const updated = await bankAccountsApi.update(String(bankData.id), {
          // Backend 'name' alanını frontend'deki 'accountName' ile eşle
          name: bankData.accountName,
          iban: bankData.iban,
          bankName: bankData.bankName,
          currency: bankData.currency,
        });
        // Frontend listesi için 'accountName' alanını doldur
        setBankAccounts(prev => {
          const next = prev.map(bank => {
            if (String(bank.id) !== String(updated.id)) return bank;
            return {
              ...bank,
              ...updated,
              accountName: updated.name,
              // UI'ya özel alanları KALICI olarak sakla (localStorage ile)
              isActive: bankData.isActive !== false,
              accountType: bankData.accountType || 'checking',
              balance: Number(bankData.balance) || 0,
              branchCode: (bankData as any).branchCode || '',
              routingNumber: (bankData as any).routingNumber || '',
              swiftBic: (bankData as any).swiftBic || '',
            };
          });
          try {
            const tenantScopedIdForBank = resolveTenantScopedId(tenant, authUser?.tenantId);
            writeTenantScopedArray('bankAccounts', next, { tenantId: tenantScopedIdForBank, mirrorToBase: true });
            const uiMap: Record<string, any> = readTenantScopedObject<Record<string, any>>('bankUi', {
              tenantId: tenantScopedIdForBank,
              fallbackToBase: false,
            }) || {};
            uiMap[String(updated.id)] = {
              isActive: bankData.isActive !== false,
              accountType: bankData.accountType || 'checking',
              balance: Number(bankData.balance) || 0,
              branchCode: (bankData as any).branchCode || '',
              routingNumber: (bankData as any).routingNumber || '',
              swiftBic: (bankData as any).swiftBic || '',
            };
            writeTenantScopedObject('bankUi', uiMap, { tenantId: tenantScopedIdForBank, mirrorToBase: false });
          } catch (error) {
            reportSilentError('app.banks.update.persistFailed', error);
          }
          return next;
        });
        const msgUpdated = i18n.language === 'tr' ? 'Banka hesabı güncellendi' :
          i18n.language === 'en' ? 'Bank account updated' :
          i18n.language === 'fr' ? 'Compte bancaire mis à jour' :
          i18n.language === 'de' ? 'Bankkonto aktualisiert' : 'Bank account updated';
        showToast(msgUpdated, 'success');
      } else {
        const created = await bankAccountsApi.create({
          name: bankData.accountName,
          iban: bankData.iban,
          bankName: bankData.bankName,
          currency: bankData.currency,
        });
        setBankAccounts(prev => {
          const next = [
            ...prev,
            {
              ...created,
              id: String(created.id),
              accountName: created.name,
              isActive: bankData.isActive !== false,
              accountType: bankData.accountType || 'checking',
              balance: Number(bankData.balance) || 0,
              branchCode: (bankData as any).branchCode || '',
              routingNumber: (bankData as any).routingNumber || '',
              swiftBic: (bankData as any).swiftBic || '',
            },
          ];
          try {
            const tenantScopedIdForBank = resolveTenantScopedId(tenant, authUser?.tenantId);
            writeTenantScopedArray('bankAccounts', next, { tenantId: tenantScopedIdForBank, mirrorToBase: true });
            const uiMap: Record<string, any> = readTenantScopedObject<Record<string, any>>('bankUi', {
              tenantId: tenantScopedIdForBank,
              fallbackToBase: false,
            }) || {};
            uiMap[String(created.id)] = {
              isActive: bankData.isActive !== false,
              accountType: bankData.accountType || 'checking',
              balance: Number(bankData.balance) || 0,
              branchCode: (bankData as any).branchCode || '',
              routingNumber: (bankData as any).routingNumber || '',
              swiftBic: (bankData as any).swiftBic || '',
            };
            writeTenantScopedObject('bankUi', uiMap, { tenantId: tenantScopedIdForBank, mirrorToBase: false });
          } catch (error) {
            reportSilentError('app.banks.create.persistFailed', error);
          }
          return next;
        });
        const msgAdded = i18n.language === 'tr' ? 'Banka hesabı eklendi' :
          i18n.language === 'en' ? 'Bank account added' :
          i18n.language === 'fr' ? 'Compte bancaire ajouté' :
          i18n.language === 'de' ? 'Bankkonto hinzugefügt' : 'Bank account added';
        showToast(msgAdded, 'success');
      }
    } catch (e: any) {
      console.error('Bank upsert failed:', e);
      const msgFailed = i18n.language === 'tr' ? 'Banka işlemi başarısız' :
        i18n.language === 'en' ? 'Bank operation failed' :
        i18n.language === 'fr' ? 'L’opération bancaire a échoué' :
        i18n.language === 'de' ? 'Bankvorgang fehlgeschlagen' : 'Bank operation failed';
      showToast(e?.response?.data?.message || msgFailed, 'error');
    }
  };

  const deleteBank = async (bankId: string | number) => {
    if (!confirmAction(t('banks.deleteConfirm', { defaultValue: 'Bu banka hesabını silmek istediğinizden emin misiniz?' }))) return;
    try {
      const { bankAccountsApi } = await import('./api/bank-accounts');
      await bankAccountsApi.remove(String(bankId));
      setBankAccounts(prev => prev.filter(bank => String(bank.id) !== String(bankId)));
      const msgDeleted = i18n.language === 'tr' ? 'Banka hesabı silindi' :
        i18n.language === 'en' ? 'Bank account deleted' :
        i18n.language === 'fr' ? 'Compte bancaire supprimé' :
        i18n.language === 'de' ? 'Bankkonto gelöscht' : 'Bank account deleted';
      showToast(msgDeleted, 'success');
    } catch (e: any) {
      console.error('Bank delete failed:', e);
      showToast(e?.response?.data?.message || t('toasts.bank.deleteError'), 'error');
    }
  };

  const openCustomerModal = (customer?: any) => {
    setSelectedCustomer(customer ?? null);
    setShowCustomerModal(true);
  };

  const openSupplierModal = (supplier?: any) => {
    setSelectedSupplier(supplier ?? null);
    setShowSupplierModal(true);
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

  const openInvoiceModal = React.useCallback(async (invoice?: any) => {
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
  }, [normalizeInvoiceForUi]);

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

  const handleSelectSaleForInvoice = (sale: Sale) => {
    setSelectedSaleForInvoice(sale);
    setShowExistingSaleModal(false);
    setShowInvoiceFromSaleModal(true);
  };

  const handleCreateInvoiceFromSale = async (invoiceData: InvoiceDraftPayload) => {
    const normalizeInvoiceLineItems = (items?: InvoiceDraftPayload['items']): BackendInvoiceLineItem[] => {
      if (!Array.isArray(items)) return [];
      return items
        .filter(Boolean)
        .map((item) => {
          const quantity = Math.max(1, toNumberSafe(item.quantity));
          const unitPrice = Math.max(0, toNumberSafe(item.unitPrice));
          const normalizedTotal = (() => {
            const explicit = toNumberSafe(item.total);
            if (explicit > 0) return explicit;
            const fallback = quantity * unitPrice;
            return Number.isFinite(fallback) ? fallback : 0;
          })();
          const fallbackDescription = item.description || item.productName || t('products.name', 'Product');
          const parsedTaxRate = Number(item.taxRate);
          const taxRate = Number.isFinite(parsedTaxRate) && parsedTaxRate >= 0
            ? Math.round(parsedTaxRate * 100) / 100
            : undefined;
          return {
            productId: item.productId,
            productName: item.productName || fallbackDescription,
            description: fallbackDescription,
            quantity,
            unitPrice,
            total: normalizedTotal,
            taxRate,
          };
        });
    };

    try {
      logger.info('app.invoiceFromSale.request', {
        saleId: selectedSaleForInvoice?.id,
        lineItemCount: invoiceData.items?.length,
      });

      let customerId = invoiceData.customerId;

      if (!customerId && selectedSaleForInvoice) {
        const customer = customers.find((c) => c.name === selectedSaleForInvoice.customerName);
        customerId = customer?.id;
        logger.info('app.invoiceFromSale.customerResolvedFromSale', {
          saleCustomerName: selectedSaleForInvoice.customerName,
          foundCustomerId: customerId,
        });
      }

      if (!customerId && invoiceData.customerName) {
        const customer = customers.find((c) => c.name === invoiceData.customerName);
        customerId = customer?.id;
        logger.info('app.invoiceFromSale.customerResolvedFromName', {
          customerName: invoiceData.customerName,
          foundCustomerId: customerId,
        });
      }

      if (!customerId) {
        logger.warn('app.invoiceFromSale.customerNotFound', {
          providedCustomerName: invoiceData.customerName,
          saleCustomerName: selectedSaleForInvoice?.customerName,
        });
        showToast(t('toasts.sales.customerNotFound'), 'error');
        throw new Error('customerId required');
      }

      const lineItems = normalizeInvoiceLineItems(invoiceData.items);
      if (!lineItems.length) {
        logger.warn('app.invoiceFromSale.noLineItems', { saleId: selectedSaleForInvoice?.id });
        showToast(t('invoices.noLineItemsError', 'Faturaya aktarılacak satır bulunamadı.'), 'error');
        throw new Error('lineItems required');
      }

      const backendData: BackendInvoicePayload = {
        customerId,
        issueDate: invoiceData.issueDate || new Date().toISOString().split('T')[0],
        dueDate: invoiceData.dueDate,
        type: invoiceData.type || 'service',
        lineItems,
        taxAmount: Math.max(0, toNumberSafe(invoiceData.taxAmount)),
        discountAmount: Math.max(0, toNumberSafe(invoiceData.discountAmount)),
        notes: invoiceData.notes?.trim() || '',
        status: invoiceData.status || 'draft',
      };

      if (selectedSaleForInvoice?.id) {
        backendData.saleId = selectedSaleForInvoice.id;
      }

      const created = await invoicesApi.createInvoice(backendData);
      logger.info('app.invoiceFromSale.success', {
        invoiceId: created.id,
        invoiceNumber: created.invoiceNumber,
        linkedSaleId: backendData.saleId,
      });

      const createdWithLink = selectedSaleForInvoice?.id && !created.saleId
        ? { ...created, saleId: selectedSaleForInvoice.id }
        : created;
      const newInvoices = [...invoices, createdWithLink];
      setInvoices(newInvoices);
      try {
        const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
        writeTenantScopedArray('invoices_cache', newInvoices, { tenantId: tenantScopedId, mirrorToBase: true });
      } catch (cacheError) {
        logger.warn('app.invoiceFromSale.cacheWriteFailed', cacheError);
      }

      if (selectedSaleForInvoice) {
        persistSalesState(prev => prev.map(s =>
          s.id === selectedSaleForInvoice.id
            ? { ...s, invoiceId: created.id }
            : s
        ));
        logger.info('app.invoiceFromSale.saleLinked', {
          saleId: selectedSaleForInvoice.id,
          invoiceId: created.id,
        });
      }

      const customerInfo = customers.find((c) => c.id === customerId);
      addNotification(
        tOr('notifications.invoices.created.title', 'Yeni fatura oluşturuldu'),
        tOr('notifications.invoices.created.desc', `${created.invoiceNumber} - ${customerInfo?.name || 'Müşteri'} için fatura hazır.`, { invoiceNumber: created.invoiceNumber, customerName: customerInfo?.name || 'Müşteri' }),
        'success',
        'invoices',
        { i18nTitleKey: 'notifications.invoices.created.title', i18nDescKey: 'notifications.invoices.created.desc', i18nParams: { invoiceNumber: created.invoiceNumber, customerName: customerInfo?.name || 'Müşteri' } }
      );

      showToast(t('toasts.invoices.createSuccess'), 'success');

      setShowInvoiceFromSaleModal(false);
      setSelectedSaleForInvoice(null);

      return created;
    } catch (error) {
      logger.error('app.invoiceFromSale.failed', error);
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const errorMsg = err.response?.data?.message || err.message || t('toasts.invoices.createError', 'Fatura oluşturulamadı');
      showToast(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg, 'error');
      throw error;
    }
  };

  const openExpenseModal = (expense?: ExpenseRecord | null, supplierHint?: SupplierExpenseHint | null) => {
    setSelectedExpense(expense ?? null);
    setSupplierForExpense(supplierHint ?? null);
    setShowExpenseModal(true);
  };

  const openSaleModal = React.useCallback((sale?: Sale | null) => {
    logger.debug('app.saleModal.openRequested', {
      modalOpen: showSaleModal,
      saleId: sale?.id,
      isNewSale: !sale,
    });

    // Modal kapalıysa direkt aç
    if (!showSaleModal) {
      logger.debug('app.saleModal.openImmediate', { saleId: sale?.id });
      setSelectedSale(sale || null);
      setShowSaleModal(true);
      return;
    }

    // Modal açıksa: kapat → bekle → state güncelle → aç
    logger.debug('app.saleModal.reopenSequenceStart', { saleId: sale?.id });
    setShowSaleModal(false);
    setTimeout(() => {
      logger.debug('app.saleModal.reopenSetSelected', { saleId: sale?.id });
      setSelectedSale(sale || null);
      setTimeout(() => {
        logger.debug('app.saleModal.reopenFinalize', { saleId: sale?.id });
        setShowSaleModal(true);
      }, 50);
    }, 100);
  }, [showSaleModal]);

  const openProductModal = (product?: Product | null) => {
    setSelectedProduct(product ?? null);
    setShowProductModal(true);
  };

  const openProductCategoryModal = () => {
    setShowProductCategoryModal(true);
  };

  const openProductViewModal = (product: Product) => {
    setSelectedProduct(product);
    setShowProductViewModal(true);
  };

  const openBankModal = (bank?: Bank | null) => {
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
    logger.debug('app.saleModal.closeRequested');
    setShowSaleModal(false);
    // Modal tamamen kapanana kadar bekle
    setTimeout(() => {
      logger.debug('app.saleModal.selectionCleared');
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

  const handleCreateInvoiceFromCustomer = (customer: CustomerRecord | null) => {
    // Üçlü menü akışını aç ve müşteri bağlamını taşı
    setPreselectedCustomerForInvoice(customer || null);
    setShowCustomerViewModal(false);
    setShowCustomerHistoryModal(false);
    setShowInvoiceTypeModal(true);
  };

  const handleRecordPaymentForCustomer = (customer: CustomerRecord) => {
    setInvoices(prev => prev.map(invoice => {
      if (invoice.customerName === customer.name && invoice.status !== "paid") {
        return { ...invoice, status: "paid" };
      }
      return invoice;
    }));
  };

  const handleCreateExpenseFromSupplier = (supplier: SupplierRecord) => {
    openExpenseModal(null, { name: supplier?.name, category: supplier?.category });
    setShowSupplierViewModal(false);
    setShowSupplierHistoryModal(false);
  };

  const handleDownloadInvoice = React.useCallback(async (invoice: any) => {
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
  }, [company, i18n.language, normalizeInvoiceForUi]);

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
  }, [openInvoiceModal, handleDownloadInvoice, openSaleModal]);

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

    // Status yardımcıları (raporlarla aynı mantık)
    const isPaidLike = (status: any) => {
      const s = String(status || '').toLowerCase();
      return s.includes('paid') || s.includes('öden') || s.includes('odendi') || s.includes('ödendi');
    };
    const isCompletedLike = (status: any) => {
      const s = String(status || '').toLowerCase();
      return s.includes('completed') || s.includes('tamam');
    };
    // Satış faturalandırılmış mı? (sale.invoiceId, invoice.saleId, notlarda saleNumber)
    const isSaleInvoiced = (sale: any): boolean => {
      try {
        const sid = String(sale?.id || '');
        if (!sid) return false;
        if (sale?.invoiceId) return true;
        const bySaleId = invoices.some(inv => String((inv as any)?.saleId || '') === sid);
        if (bySaleId) return true;
        const sn = sale?.saleNumber || `SAL-${sid}`;
        const byNotes = invoices.some(inv => typeof (inv as any)?.notes === 'string' && (inv as any).notes.includes(sn));
        return !!byNotes;
      } catch { return false; }
    };

    // Sadece ödenmiş giderler
    const paidExpenses = expenses.filter(exp => {
      const s = String(exp.status || '').toLowerCase();
      return s.includes('paid') || s.includes('öden') || s.includes('odendi') || s.includes('ödenendi');
    });

    // Gelir: Ödenmiş faturalar + faturaya dönüşmeyen tamamlanmış satışlar
    const paidInvoicesCurrent = invoices.filter(inv => isPaidLike(inv.status) && isInMonth(inv?.issueDate, currentMonth, currentYear));
    const paidInvoicesPrevious = invoices.filter(inv => isPaidLike(inv.status) && isInMonth(inv?.issueDate, previousMonth, previousYear));

    const completedSalesCurrent = sales.filter(sale =>
      isCompletedLike(sale?.status) &&
      isInMonth(sale?.date || sale?.saleDate, currentMonth, currentYear) &&
      !isSaleInvoiced(sale)
    );
    const completedSalesPrevious = sales.filter(sale =>
      isCompletedLike(sale?.status) &&
      isInMonth(sale?.date || sale?.saleDate, previousMonth, previousYear) &&
      !isSaleInvoiced(sale)
    );

    const revenueCurrent = sum(paidInvoicesCurrent, invoiceAmount) + sum(completedSalesCurrent, saleAmount);
    const revenuePrevious = sum(paidInvoicesPrevious, invoiceAmount) + sum(completedSalesPrevious, saleAmount);

  const expenseCurrent = sum(paidExpenses.filter(expense => isInMonth(expense?.expenseDate, currentMonth, currentYear)), expenseAmount);
    const expensePrevious = sum(paidExpenses.filter(expense => isInMonth(expense?.expenseDate, previousMonth, previousYear)), expenseAmount);

    // Bekleyen: yalnızca pozitif tutarlı (tahsil edilecek) ve ödenmemiş faturalar
    const outstandingInvoices = invoices.filter(
      (invoice) => !isPaidLike(invoice.status) && Number(invoice?.total ?? 0) > 0
    );
    const outstandingAmount = sum(outstandingInvoices, invoiceAmount);
    const outstandingCurrent = outstandingInvoices.filter((invoice) =>
      isInMonth(invoice?.dueDate || invoice?.issueDate, currentMonth, currentYear)
    ).length;
    const outstandingPrevious = outstandingInvoices.filter((invoice) =>
      isInMonth(invoice?.dueDate || invoice?.issueDate, previousMonth, previousYear)
    ).length;

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
  }, [invoices, expenses, sales, bankAccounts, t, formatCurrency]);

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
    logger.info('app.data.exported', { payload });
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
      persistSalesState(payload.sales.map((sale: any) => ({ ...sale, id: String(sale.id) })));
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
              const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
              const list = readTenantScopedArray<any>('quotes_cache', { tenantId: tenantScopedId }) ?? [];
              if (Array.isArray(list)) quotesForRecent = list;
            } catch (error) {
              reportSilentError('app.dashboard.quotesCache.readFailed', error);
            }
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
            onDeleteInvoice={requestDeleteInvoice}
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
            onUpdateExpense={updateExpenseStatusInline}
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
            onSalesUpdate={handleSimpleSalesPageUpdate}
            onUpsertSale={upsertSale}
            onCreateInvoice={upsertInvoice}
            onEditInvoice={invoice => openInvoiceModal(invoice)}
            onDownloadSale={handleDownloadSale}
            onDeleteSale={(id) => requestDeleteSale(String(id))}
          />
        );
      case "quotes":
        return <QuotesPage customers={customers} products={products} />;
      case "reports":
        return (
          <ReportsPage 
            invoices={invoices} 
            expenses={expenses} 
            sales={sales} 
            customers={customers}
            quotes={(() => {
              // Quotes: Raporlar sayfası için local cache'den oku (tenant scoped)
              let list: any[] = [];
              try {
                const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
                const parsed = readTenantScopedArray<any>('quotes_cache', { tenantId: tenantScopedId }) ?? [];
                if (Array.isArray(parsed)) list = parsed;
              } catch (error) {
                reportSilentError('app.reports.quotesCache.readFailed', error);
              }
              return list;
            })()}
          />
        );
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
            onSalesUpdate={(nextSales) => persistSalesState(nextSales)}
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
          <ErrorBoundary name="settings">
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
          </ErrorBoundary>
        );
      case "fiscal-periods":
        return (
          <ErrorBoundary name="fiscal-periods">
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
          </ErrorBoundary>
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
      case "legal-imprint":
        return <Imprint />;
      case "legal-email-policy":
        return <EmailPolicy />;
      case "organization-members":
        return (
          <ErrorBoundary name="organization-members">
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
          </ErrorBoundary>
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
              const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
              const existingQuotes = readTenantScopedArray<any>('quotes_cache', { tenantId: tenantScopedId }) ?? [];
              const list = Array.isArray(existingQuotes) ? existingQuotes : [];
              const nextIndex = list.length + 1;
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
              const updated = [next, ...list];
              writeTenantScopedArray('quotes_cache', updated, { tenantId: tenantScopedId, mirrorToBase: true });
              setShowQuoteCreateModal(false);
              showToast(t('toasts.quotes.createSuccess'), 'success');
            } catch (e) {
              console.error('Quote create (dashboard) failed:', e);
              showToast(t('toasts.quotes.createError'), 'error');
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
                const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
                const existingQuotes = readTenantScopedArray<any>('quotes_cache', {
                  tenantId: tenantScopedId,
                  fallbackToBase: true,
                }) ?? [];
                const next = Array.isArray(existingQuotes) ? existingQuotes.map((q: any) => (
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
                writeTenantScopedArray('quotes_cache', next, {
                  tenantId: tenantScopedId,
                  mirrorToBase: true,
                });
                try {
                  window.dispatchEvent(new Event('quotes-cache-updated'));
                } catch (error) {
                  reportSilentError('app.quotes.cache.dispatchFailed', error);
                }
              } catch (error) {
                reportSilentError('app.quotes.cache.updateFailed', error);
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
        onEdit={bank => {
          setShowBankViewModal(false);
          setTimeout(() => openBankModal(bank), 50);
        }}
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
          cancelLabel={infoModal.cancelLabel}
          onConfirm={infoModal.onConfirm}
          onCancel={infoModal.onCancel}
          extraLabel={infoModal.extraLabel}
          onExtra={infoModal.onExtra}
          onClose={() => setInfoModal(null)}
        />
      )}

      {Boolean(invoiceToDelete) && (
        <ConfirmModal
          isOpen={true}
          title={t('common.confirm', { defaultValue: 'Onay' })}
          message={t('invoices.deleteConfirm', { defaultValue: 'Bu faturayı silmek istediğinizden emin misiniz?' })}
          confirmText={t('common.delete', { defaultValue: 'Sil' })}
          cancelText={t('common.cancel', { defaultValue: 'İptal' })}
          danger
          onConfirm={async () => {
            const id = invoiceToDelete!;
            setInvoiceToDelete(null);
            await deleteInvoice(id);
          }}
          onCancel={() => setInvoiceToDelete(null)}
        />
      )}

      {Boolean(saleToDelete) && (
        <ConfirmModal
          isOpen={true}
          title={t('common.confirm', { defaultValue: 'Onay' })}
          message={t('sales.deleteConfirm', { defaultValue: 'Bu satışı silmek istediğinizden emin misiniz?' })}
          confirmText={t('common.delete', { defaultValue: 'Sil' })}
          cancelText={t('common.cancel', { defaultValue: 'İptal' })}
          danger
          onConfirm={async () => {
            const id = saleToDelete!;
            setSaleToDelete(null);
            await handleDeleteSale(id, { skipConfirm: true });
          }}
          onCancel={() => setSaleToDelete(null)}
        />
      )}
    </>
  );

  // Kabul edilen teklifleri satışa dönüştür (public sayfadan tetiklenebilir)
  React.useEffect(() => {
    const processAcceptedQuotes = async () => {
      try {
        const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
        const quotesCache = readTenantScopedArray<any>('quotes_cache', {
          tenantId: tenantScopedId,
          fallbackToBase: true,
        });
        if (!Array.isArray(quotesCache) || quotesCache.length === 0) return;

        const list = [...quotesCache];
        let changed = false;
        for (const q of list) {
          if (q && q.status === 'accepted') {
            // Çoklu sekme yarışı için basit bir kilit: pending:<token> → done
            const flagBaseKey = `quote_converted_${q.id}`;
            const curr = readTenantScopedValue(flagBaseKey, { tenantId: tenantScopedId, fallbackToBase: false });
            if (curr === 'done' || q.convertedToSale) {
              continue;
            }
            if (curr && curr.startsWith('pending:')) {
              // Başka bir sekme çalışıyor; bu turda atla
              continue;
            }
            const token = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
            try {
              writeTenantScopedValue(flagBaseKey, `pending:${token}`, { tenantId: tenantScopedId, mirrorToBase: false });
            } catch (error) {
              reportSilentError('app.quotes.accepted.lockPersistFailed', error);
            }
            // Kilidi gerçekten aldık mı?
            const verify = readTenantScopedValue(flagBaseKey, { tenantId: tenantScopedId, fallbackToBase: false });
            if (verify !== `pending:${token}`) {
              continue;
            }
            const items = Array.isArray(q.items) ? q.items : [];
            // Ürünün efektif KDV oranını belirle: ürün özel > kategori > ürün alanı > varsayılan 18
            const resolveProductTaxRate = (productId?: any): number => {
              const pid = String(productId || '');
              if (!pid) return 18;
              try {
                const p = products.find((pp: any) => String(pp.id) === pid);
                if (!p) return 18;
                const v = Number(p.categoryTaxRateOverride ?? p.taxRate ?? 18);
                return Number.isFinite(v) && v >= 0 ? v : 18;
              } catch { return 18; }
            };
            const mappedItems = items.map((it: any) => {
              const quantity = Number(it?.quantity || 1);
              const unitPrice = Number(it?.unitPrice || 0);
              const total = Number(it?.total || (unitPrice * quantity));
              const productId = it?.productId;
              const productName = it?.description || it?.productName || 'Ürün/Hizmet';
              const taxRate = (() => {
                const explicit = Number((it as any).taxRate);
                if (Number.isFinite(explicit) && explicit >= 0) return explicit;
                return resolveProductTaxRate(productId);
              })();
              return { productId, productName, quantity, unitPrice, total, taxRate };
            });
            const totalAmount = mappedItems.reduce((s: number, li: any) => s + Number(li.total || 0), 0);
            // Backend'e idempotent istek: sourceQuoteId ile
            try {
              const saved = await salesApi.createSale({
                customerId: (q as any).customerId,
                customerEmail: (q as any).customerEmail || undefined,
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
                customerEmail: (q as any).customerEmail || (customers.find(c => String(c.id) === String((q as any).customerId))?.email) || undefined,
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
              persistSalesState(prev => {
                const exists = prev.some(s => String((s as any).sourceQuoteId || '') === String(q.id) || String(s.id) === String(saved.id));
                return exists ? prev : [...prev, mapped];
              });

              void refreshProductsFromServer();
            } catch (error) {
              reportSilentError('app.quotes.accepted.remoteConversionFailed', error);
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
              const latestUpsertSale = upsertSaleRef.current;
              if (latestUpsertSale) {
                try {
                  await latestUpsertSale(saleData);
                } catch (error) {
                  reportSilentError('app.quotes.accepted.localSaleUpsertFailed', error);
                }
              }
            }
            q.convertedToSale = true;
            // Kilidi tamamlandı olarak işaretle
            try {
              writeTenantScopedValue(flagBaseKey, 'done', { tenantId: tenantScopedId, mirrorToBase: false });
            } catch (error) {
              reportSilentError('app.quotes.accepted.lockReleaseFailed', error);
            }
            changed = true;
          }
        }
        if (changed) {
          writeTenantScopedArray('quotes_cache', list, { tenantId: tenantScopedId, mirrorToBase: true });
        }
      } catch (error) {
        reportSilentError('app.quotes.accepted.processingFailed', error);
      }
    };

    const onStorage = (e: StorageEvent) => {
      const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
      const key = tenantScopedId ? `quotes_cache_${tenantScopedId}` : 'quotes_cache';
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
  }, [
    tenant,
    authUser?.tenantId,
    products,
    customers,
    persistSalesState,
  ]);

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

  // Join organization is publicly viewable (accept requires auth)
  if (!isAuthenticated && typeof currentPage === 'string' && currentPage.startsWith('join-organization:')) {
    const token = currentPage.replace('join-organization:', '');
    return (
      <JoinOrganizationPage
        token={token}
        onJoinSuccess={() => {
          // Success after login+accept -> dashboard
          setCurrentPage('dashboard');
          window.location.hash = '';
        }}
        onNavigateHome={() => {
          setCurrentPage('landing');
          window.location.hash = '';
        }}
        onNavigateDashboard={() => {
          setCurrentPage('dashboard');
          window.location.hash = '';
        }}
      />
    );
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
        case "legal-imprint":
          return <Imprint />;
        case "legal-email-policy":
          return <EmailPolicy />;
        default:
          return <div>Legal page not found</div>;
      }
    };

    return (
      <div className="min-h-screen bg-slate-50">
        <LegalHeader />
        {/* Cookie consent banner & modal must also be available on public legal pages.
            Previously these were not rendered due to the early return, so the
            "Çerez Tercihlerini Yönet" button on the Cookie Policy page could not
            open the preferences modal when user is logged out. */}
        <CookieConsentBanner />
        <CookiePreferencesModal />
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
          const tenantScopedId = resolveTenantScopedId(tenant, authUser?.tenantId);
          const cachedCustomers = readTenantScopedArray<any>('customers_cache', {
            tenantId: tenantScopedId,
            fallbackToBase: true,
          });
          if (Array.isArray(cachedCustomers)) {
            const fromCache = cachedCustomers.find((c: any) => String(c.id) === String(cid));
            if (fromCache?.name) return String(fromCache.name);
          }
        } catch (error) {
          reportSilentError('app.sidebar.customerCache.readFailed', error);
        }
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
          <AnnouncementBar />
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
            <SeoInjector />
            <AppContent />
          </NotificationPreferencesProvider>
        </CookieConsentProvider>
      </CurrencyProvider>
    </LanguageProvider>
  );
};

export default App;















































