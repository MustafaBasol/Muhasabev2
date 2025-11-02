export type SortDir = 'asc' | 'desc';

export const normalizeText = (value: unknown): string => {
  if (value == null) return '';
  try {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove diacritics
      .toLowerCase()
      .trim();
  } catch {
    return String(value).toLowerCase().trim();
  }
};

export const parseDateSafe = (value: unknown): number => {
  if (!value) return 0;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const s = String(value).trim();

  // ISO 8601 veya YYYY-MM-DD (güvenli)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const t = new Date(s).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  // DD.MM.YYYY veya DD/MM/YYYY veya DD-MM-YYYY formatlarını destekle
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1; // 0-indexed
    const year = parseInt(dmy[3], 10);
    const hour = dmy[4] ? parseInt(dmy[4], 10) : 0;
    const minute = dmy[5] ? parseInt(dmy[5], 10) : 0;
    const second = dmy[6] ? parseInt(dmy[6], 10) : 0;
    const t = new Date(year, month, day, hour, minute, second).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  // Fallback: Date parser
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : 0;
};

export const toNumberSafe = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const s = String(value).trim();
  // Try to parse numbers that may use . or , as thousand/decimal separators
  const normalized = s
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '') // drop thousand separators
    .replace(/,(?=\d{3}(?:\D|$))/g, '') // drop thousand separators variant
    .replace(/,(?=\d{1,2}$)/, '.') // decimal comma
    ;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

export const compareValues = (a: unknown, b: unknown, dir: SortDir, type?: 'string' | 'number' | 'date', statusOrder?: string[]): number => {
  let av: number | string = '';
  let bv: number | string = '';

  switch (type) {
    case 'number':
      av = toNumberSafe(a);
      bv = toNumberSafe(b);
      break;
    case 'date':
      av = parseDateSafe(a);
      bv = parseDateSafe(b);
      break;
    case 'string':
    default:
      av = normalizeText(a);
      bv = normalizeText(b);
  }

  // Optional custom status order
  if (statusOrder && type === 'string') {
    const ai = statusOrder.indexOf(normalizeText(a));
    const bi = statusOrder.indexOf(normalizeText(b));
    if (ai !== -1 || bi !== -1) {
      const cmp = (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) - (bi === -1 ? Number.MAX_SAFE_INTEGER : bi);
      return dir === 'asc' ? cmp : -cmp;
    }
  }

  if (av < bv) return dir === 'asc' ? -1 : 1;
  if (av > bv) return dir === 'asc' ? 1 : -1;
  return 0;
};

export const compareBy = <T,>(a: T, b: T, selector: (x: T) => unknown, dir: SortDir, type?: 'string' | 'number' | 'date', statusOrder?: string[]) => {
  return compareValues(selector(a), selector(b), dir, type, statusOrder);
};

export const defaultStatusOrderInvoices = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
export const defaultStatusOrderExpenses = ['pending', 'approved', 'paid', 'rejected'];
export const defaultStatusOrderSales = ['completed', 'pending', 'cancelled'];
