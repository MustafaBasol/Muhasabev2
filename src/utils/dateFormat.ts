import i18n from '../i18n/config';
import {
  readLegacyTenantId,
  readTenantScopedValue,
  writeTenantScopedValue,
} from './localStorageSafe';

export type DateFormatPattern = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

const DATE_FORMAT_PREF_KEY = 'date_format';
const VALID_PATTERNS: DateFormatPattern[] = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

const coercePattern = (value: unknown): DateFormatPattern | null => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return (VALID_PATTERNS as readonly string[]).includes(raw) ? (raw as DateFormatPattern) : null;
};

export const getSelectedDateFormat = (): DateFormatPattern => {
  try {
    const tenantId = (readLegacyTenantId() || '').toString();
    const stored = readTenantScopedValue(DATE_FORMAT_PREF_KEY, { tenantId, fallbackToBase: true });
    const coerced = coercePattern(stored);
    return coerced ?? 'DD/MM/YYYY';
  } catch {
    return 'DD/MM/YYYY';
  }
};

export const setSelectedDateFormat = (pattern: DateFormatPattern): void => {
  const coerced = coercePattern(pattern) ?? 'DD/MM/YYYY';
  const tenantId = (readLegacyTenantId() || '').toString();
  writeTenantScopedValue(DATE_FORMAT_PREF_KEY, coerced, { tenantId, mirrorToBase: true });
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

export const formatAppDate = (
  input: string | number | Date | null | undefined,
  opts?: { pattern?: DateFormatPattern; fallback?: string }
): string => {
  const fallback = opts?.fallback ?? '—';
  if (input == null || input === '') return fallback;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return fallback;

  const day = pad2(d.getDate());
  const month = pad2(d.getMonth() + 1);
  const year = String(d.getFullYear());

  const pattern = opts?.pattern ?? getSelectedDateFormat();
  switch (pattern) {
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD/MM/YYYY':
    default:
      return `${day}/${month}/${year}`;
  }
};

export const formatAppDateTime = (
  input: string | number | Date | null | undefined,
  opts?: { pattern?: DateFormatPattern; fallback?: string; locale?: string }
): string => {
  const fallback = opts?.fallback ?? '—';
  if (input == null || input === '') return fallback;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return fallback;

  const locale = opts?.locale || (i18n.language || undefined);
  const datePart = formatAppDate(d, { pattern: opts?.pattern, fallback });
  try {
    const timePart = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return `${datePart} ${timePart}`;
  } catch {
    return datePart;
  }
};
