import React, { useMemo, useRef, useState } from 'react';
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

export interface Customer {
  id?: string | number;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  company?: string;
  createdAt?: string;
}

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

const toSafeLower = (value?: string) => (value || '').toLowerCase();

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
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const safeCustomers = useMemo(
    () => (Array.isArray(customers) ? customers.filter(Boolean) : []),
    [customers],
  );

  const filteredCustomers = useMemo(() => {
    const lookup = searchTerm.trim().toLowerCase();
    if (!lookup) {
      return safeCustomers;
    }

    return safeCustomers.filter(customer => {
      const name = toSafeLower(customer?.name);
      const email = toSafeLower(customer?.email);
      const company = toSafeLower(customer?.company);
      return (
        name.includes(lookup) ||
        email.includes(lookup) ||
        company.includes(lookup)
      );
    });
  }, [safeCustomers, searchTerm]);

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
    // Create comprehensive CSV template with proper formatting
    const csvContent = [
      // Headers with required field indicators (* means required)
      'Name,Email,Phone,Address,Company,TaxNumber',
      // Sample data rows with realistic examples
      'John Doe,john.doe@email.com,+1-555-123-4567,123 Main Street New York NY USA,Tech Solutions Inc,123456789',
      'Jane Smith,jane.smith@company.com,+1-555-987-6543,456 Oak Avenue Los Angeles CA USA,Marketing Pro LLC,987654321',
      'Michael Johnson,m.johnson@business.org,+1-555-456-7890,789 Pine Road Chicago IL USA,Johnson & Associates,456789123'
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'customer_import_template.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={event => setSearchTerm(event.target.value)}
          placeholder={t('customers.search')}
          className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
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
          : filteredCustomers.map(renderCustomerRow)}
      </div>
    </div>
  );
}
