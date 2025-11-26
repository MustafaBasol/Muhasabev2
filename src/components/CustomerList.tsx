import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Download,
  Edit,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Pagination from './Pagination';
import SavedViewsBar from './SavedViewsBar';
import { useSavedListViews } from '../hooks/useSavedListViews';
import { safeLocalStorage } from '../utils/localStorageSafe';
import { logger } from '../utils/logger';
import type { Customer as CustomerModel } from '../types';
// preset etiketleri i18n'den alınır

export type Customer = Partial<CustomerModel> & {
  id?: string | number;
  createdAt?: string;
};

interface CustomerListProps {
  customers?: Customer[];
  onAddCustomer: () => void;
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customerId: string) => void;
  onViewCustomer: (customer: Customer) => void;
  onImportCustomers?: (file: File) => void;
  onSelectCustomer?: (customer: Customer) => void;
  selectionMode?: boolean;
}

type CustomerListViewState = {
  searchTerm: string;
  hasEmailOnly?: boolean;
  hasPhoneOnly?: boolean;
  hasCompanyOnly?: boolean;
  startDate?: string;
  endDate?: string;
  pageSize?: number;
};

const toSafeLower = (value?: string) => (value || '').toLowerCase();
const CUSTOMER_PAGE_SIZES = [20, 50, 100] as const;
const isValidCustomerPageSize = (value: number): value is (typeof CUSTOMER_PAGE_SIZES)[number] =>
  CUSTOMER_PAGE_SIZES.includes(value as (typeof CUSTOMER_PAGE_SIZES)[number]);

const getSavedCustomerPageSize = (): number => {
  const saved = safeLocalStorage.getItem('customers_pageSize');
  const parsed = saved ? Number(saved) : CUSTOMER_PAGE_SIZES[0];
  return isValidCustomerPageSize(parsed) ? parsed : CUSTOMER_PAGE_SIZES[0];
};

export default function CustomerList({
  customers,
  onAddCustomer,
  onEditCustomer,
  onDeleteCustomer,
  onViewCustomer,
  onSelectCustomer,
  onImportCustomers,
  selectionMode = false,
}: CustomerListProps) {
  const { t, i18n } = useTranslation();
  const getActiveLang = () => {
    const stored = safeLocalStorage.getItem('i18nextLng');
    if (stored && stored.length >= 2) return stored.slice(0,2).toLowerCase();
    const cand = (i18n.resolvedLanguage || i18n.language || 'en') as string;
    return cand.slice(0,2).toLowerCase();
  };
  const toLocale = (l: string) => (l === 'tr' ? 'tr-TR' : l === 'de' ? 'de-DE' : l === 'fr' ? 'fr-FR' : 'en-US');
  const lang = getActiveLang();
  const L = {
    emailExists: { tr: 'E-posta var', en: 'Has email', fr: 'E-mail présent', de: 'E-Mail vorhanden' }[lang as 'tr'|'en'|'fr'|'de'] || 'Has email',
    phoneExists: { tr: 'Telefon var', en: 'Has phone', fr: 'Téléphone présent', de: 'Telefon vorhanden' }[lang as 'tr'|'en'|'fr'|'de'] || 'Has phone',
    companyExists: { tr: 'Şirketi olanlar', en: 'Has company', fr: 'A une entreprise', de: 'Hat Firma' }[lang as 'tr'|'en'|'fr'|'de'] || 'Has company',
    from: { tr: 'Başlangıç', en: 'From', fr: 'De', de: 'Von' }[lang as 'tr'|'en'|'fr'|'de'] || 'From',
    to: { tr: 'Bitiş', en: 'To', fr: 'À', de: 'Bis' }[lang as 'tr'|'en'|'fr'|'de'] || 'To',
    clear: { tr: 'Temizle', en: 'Clear', fr: 'Effacer', de: 'Löschen' }[lang as 'tr'|'en'|'fr'|'de'] || 'Clear',
  };
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasEmailOnly, setHasEmailOnly] = useState<boolean>(false);
  const [hasPhoneOnly, setHasPhoneOnly] = useState<boolean>(false);
  const [hasCompanyOnly, setHasCompanyOnly] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(() => getSavedCustomerPageSize());

  // Default kaydedilmiş görünüm uygula
  const { getDefault } = useSavedListViews<CustomerListViewState>({ listType: 'customers' });
  useEffect(() => {
    const def = getDefault();
    if (def && def.state) {
      try {
        setSearchTerm(def.state.searchTerm ?? '');
        setHasEmailOnly(Boolean(def.state.hasEmailOnly));
        setHasPhoneOnly(Boolean(def.state.hasPhoneOnly));
        setHasCompanyOnly(Boolean(def.state.hasCompanyOnly));
        setStartDate(def.state.startDate ?? '');
        setEndDate(def.state.endDate ?? '');
        if (def.state.pageSize && isValidCustomerPageSize(def.state.pageSize)) {
          handlePageSizeChange(def.state.pageSize);
        }
      } catch (error) {
        logger.warn('Failed to apply default customer saved view', error);
      }
    }
  }, []);

  const safeCustomers = useMemo(
    () => (Array.isArray(customers) ? customers.filter(Boolean) : []),
    [customers],
  );

  const filteredCustomers = useMemo(() => {
    const lookup = searchTerm.trim().toLowerCase();
    return safeCustomers.filter(customer => {
      const name = toSafeLower(customer?.name);
      const email = toSafeLower(customer?.email);
      const company = toSafeLower(customer?.company);
      const matchesSearch = !lookup || name.includes(lookup) || email.includes(lookup) || company.includes(lookup);
      const matchesEmail = !hasEmailOnly || !!(customer?.email && customer.email.trim());
      const matchesPhone = !hasPhoneOnly || !!(customer?.phone && customer.phone.trim());
      const matchesCompany = !hasCompanyOnly || !!(customer?.company && customer.company.trim());
      const created = customer?.createdAt ? new Date(customer.createdAt) : null;
      let matchesDate = true;
      if (startDate && created) matchesDate = matchesDate && created >= new Date(startDate);
      if (endDate && created) matchesDate = matchesDate && created <= new Date(endDate);
      return matchesSearch && matchesEmail && matchesPhone && matchesCompany && matchesDate;
    });
  }, [safeCustomers, searchTerm, hasEmailOnly, hasPhoneOnly, hasCompanyOnly, startDate, endDate]);

  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, hasEmailOnly, hasPhoneOnly, hasCompanyOnly, startDate, endDate]);

  const handlePageSizeChange = (size: number) => {
    const nextSize = isValidCustomerPageSize(size) ? size : CUSTOMER_PAGE_SIZES[0];
    setPageSize(nextSize);
    safeLocalStorage.setItem('customers_pageSize', String(nextSize));
    setPage(1);
  };

  const handleFilePick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      event.target.value = '';
      return;
    }
    if (onImportCustomers) {
      onImportCustomers(file);
    }
    event.target.value = '';
  };

  const downloadTemplate = () => {
    if (typeof document === 'undefined') {
      logger.debug('CustomerList: download skipped (no document)');
      return;
    }
    try {
      const csvContent = [
        'Name,Email,Phone,Address,Company,TaxNumber',
        'John Doe,john.doe@email.com,+1-555-123-4567,123 Main Street New York NY USA,Tech Solutions Inc,123456789',
        'Jane Smith,jane.smith@company.com,+1-555-987-6543,456 Oak Avenue Los Angeles CA USA,Marketing Pro LLC,987654321',
        'Michael Johnson,m.johnson@business.org,+1-555-456-7890,789 Pine Road Chicago IL USA,Johnson & Associates,456789123'
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download === undefined) {
        logger.warn('CustomerList: download attribute unsupported');
        return;
      }
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'customer_import_template.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('CustomerList: template download failed', error);
    }
  };

  const renderHeader = () => (
    <div className="p-6 border-b border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {selectionMode ? 'Müşteri Seç' : t('customers.title')}
          </h2>
          <p className="text-sm text-gray-500">
            {safeCustomers.length} {t('customers.customersRegistered')}
          </p>
        </div>
        {!selectionMode && (
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={downloadTemplate}
              className="flex items-center gap-2 rounded-lg border border-blue-200 px-4 py-2 text-blue-600 transition-colors hover:bg-blue-50"
              title={t('customers.downloadTemplate')}
            >
              <Download className="h-4 w-4" />
              <span>{t('customers.downloadTemplate')}</span>
            </button>
            <button
              type="button"
              onClick={handleFilePick}
              className="flex items-center gap-2 rounded-lg border border-purple-200 px-4 py-2 text-purple-600 transition-colors hover:bg-purple-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300"
              disabled={!onImportCustomers}
            >
              <Upload className="h-4 w-4" />
              <span>{t('customers.importCSV')}</span>
            </button>
            <button
              type="button"
              onClick={onAddCustomer}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700"
            >
              <Plus className="h-4 w-4" />
              <span>{t('customers.newCustomer')}</span>
            </button>
          </div>
        )}
      </div>

      <div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder={t('customers.search')}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        {/* Filters row */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-gray-700 inline-flex items-center gap-2">
              <input type="checkbox" className="rounded" checked={hasEmailOnly} onChange={(e)=>setHasEmailOnly(e.target.checked)} />
              {L.emailExists}
            </label>
            <label className="text-sm text-gray-700 inline-flex items-center gap-2">
              <input type="checkbox" className="rounded" checked={hasPhoneOnly} onChange={(e)=>setHasPhoneOnly(e.target.checked)} />
              {L.phoneExists}
            </label>
            <label className="text-sm text-gray-700 inline-flex items-center gap-2">
              <input type="checkbox" className="rounded" checked={hasCompanyOnly} onChange={(e)=>setHasCompanyOnly(e.target.checked)} />
              {L.companyExists}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">{L.from}</span>
              <input type="date" lang={toLocale(lang)} value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="px-2 py-1 border border-gray-300 rounded" />
              <span className="text-sm text-gray-700">{L.to}</span>
              <input type="date" lang={toLocale(lang)} value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="px-2 py-1 border border-gray-300 rounded" />
              {(startDate || endDate) && (
                <button onClick={()=>{setStartDate(''); setEndDate('');}} className="px-2 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200">{L.clear}</button>
              )}
            </div>
          </div>
          <div className="flex justify-end">
          <SavedViewsBar
            listType="customers"
            getState={() => ({ searchTerm, hasEmailOnly, hasPhoneOnly, hasCompanyOnly, startDate, endDate, pageSize })}
            applyState={(s) => {
              const st: Partial<CustomerListViewState> = s ?? {};
              setSearchTerm(st.searchTerm ?? '');
              setHasEmailOnly(Boolean(st.hasEmailOnly));
              setHasPhoneOnly(Boolean(st.hasPhoneOnly));
              setHasCompanyOnly(Boolean(st.hasCompanyOnly));
              setStartDate(st.startDate ?? '');
              setEndDate(st.endDate ?? '');
              if (st.pageSize && isValidCustomerPageSize(st.pageSize)) {
                handlePageSizeChange(st.pageSize);
              }
            }}
            presets={[
              { id:'with-email', label:t('presets.withEmail'), apply:()=>{ setHasEmailOnly(true); setHasPhoneOnly(false); setHasCompanyOnly(false); }},
              { id:'with-phone', label:t('presets.withPhone'), apply:()=>{ setHasPhoneOnly(true); setHasEmailOnly(false); setHasCompanyOnly(false); }},
              { id:'with-company', label:t('presets.withCompany'), apply:()=>{ setHasCompanyOnly(true); setHasEmailOnly(false); setHasPhoneOnly(false); }},
              { id:'added-this-month', label:t('presets.addedThisMonth'), apply:()=>{
                const d = new Date();
                const s = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10);
                const e = new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10);
                setStartDate(s); setEndDate(e);
              }},
            ]}
          />
          </div>
        </div>
      </div>
    </div>
  );

  const renderEmptyState = () => (
    <div className="p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <Building2 className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="mb-2 text-lg font-medium text-gray-900">
        {searchTerm ? t('customers.noCustomersFound') : t('customers.noCustomers')}
      </h3>
      <p className="mb-4 text-gray-500">
        {searchTerm
          ? t('customers.noCustomersFoundDesc')
          : t('customers.noCustomersDesc')}
      </p>
      {!selectionMode && !searchTerm && (
        <button
          type="button"
          onClick={onAddCustomer}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          {t('customers.createFirstCustomer')}
        </button>
      )}
    </div>
  );

  const renderCustomerRow = (customer: Customer, index: number) => {
    const customerId = customer?.id != null ? String(customer.id) : `customer-${index}`;
    const displayName = customer?.name?.trim() || 'İsimsiz Müşteri';
    const displayEmail = customer?.email || 'E-posta bilgisi yok';
    const displayPhone = customer?.phone;
    const initials = displayName.charAt(0).toUpperCase() || '?';

    const handleRowClick = () => {
      if (selectionMode) {
        onSelectCustomer?.(customer);
        return;
      }
      onViewCustomer(customer);
    };

    const handleEdit = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onEditCustomer(customer);
    };

    const handleDelete = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!customer?.id) {
        return;
      }
      onDeleteCustomer(String(customer.id));
    };

    return (
      <div
        key={customerId}
        className="p-4 transition-colors hover:bg-gray-50"
        role="button"
        tabIndex={0}
        onClick={handleRowClick}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            handleRowClick();
          }
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
              <span className="text-lg font-semibold text-purple-600">
                {initials}
              </span>
            </div>
            <div>
              {selectionMode ? (
                <h3 className="font-semibold text-gray-900">{displayName}</h3>
              ) : (
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation();
                    onViewCustomer(customer);
                  }}
                  className="font-semibold text-purple-600 transition-colors hover:text-purple-800"
                >
                  {displayName}
                </button>
              )}
              {customer?.company && (
                <p className="flex items-center text-sm text-gray-600">
                  <Building2 className="mr-1 h-3 w-3" />
                  {customer.company}
                </p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {displayEmail}
                </span>
                {displayPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {displayPhone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {!selectionMode && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleEdit}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {renderHeader()}
      <div className="divide-y divide-gray-200">
        {filteredCustomers.length === 0
          ? renderEmptyState()
          : paginatedCustomers.map(renderCustomerRow)}
      </div>
      <div className="p-4 border-t border-gray-200">
        <Pagination
          page={page}
          pageSize={pageSize}
          total={filteredCustomers.length}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
    </div>
  );
}
