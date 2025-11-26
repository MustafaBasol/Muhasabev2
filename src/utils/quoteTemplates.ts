import { logger } from './logger';
import { safeLocalStorage } from './localStorageSafe';

export type QuoteTemplate = {
  id: string;
  name: string;
  html: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
};

const keyFor = (tenantId?: string) => (tenantId ? `quote_templates_${tenantId}` : 'quote_templates');

const MAX_TEMPLATE_HTML_LENGTH = 200_000; // ~200 KB safety cap

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
};

const ensureString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const clampHtml = (html: string): string => (html.length > MAX_TEMPLATE_HTML_LENGTH ? html.slice(0, MAX_TEMPLATE_HTML_LENGTH) : html);

const normalizeTemplateRecord = (value: unknown): QuoteTemplate | null => {
  if (!isPlainObject(value)) return null;
  const id = ensureString(value.id).trim();
  if (!id) return null;
  const name = ensureString(value.name).trim() || 'Şablon';
  const html = clampHtml(ensureString(value.html));
  const createdAt = ensureString(value.createdAt) || new Date().toISOString();
  const updatedAt = ensureString(value.updatedAt) || createdAt;
  const isDefault = typeof value.isDefault === 'boolean' ? value.isDefault : undefined;
  return { id, name, html, createdAt, updatedAt, isDefault };
};

const parseTemplates = (raw: string | null): QuoteTemplate[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeTemplateRecord)
      .filter((tpl): tpl is QuoteTemplate => Boolean(tpl));
  } catch (error) {
    logger.warn('[quoteTemplates] Failed to parse cache', error);
    return [];
  }
};

const persistTemplates = (tenantId: string | undefined, templates: QuoteTemplate[]): void => {
  try {
    safeLocalStorage.setItem(keyFor(tenantId), JSON.stringify(templates));
  } catch (error) {
    logger.warn('[quoteTemplates] Failed to persist templates', error);
  }
};

const generateTemplateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

const buildTemplate = (tpl: Omit<QuoteTemplate, 'createdAt' | 'updatedAt'> & Partial<Pick<QuoteTemplate, 'createdAt' | 'updatedAt'>>): QuoteTemplate => {
  const now = new Date().toISOString();
  const id = ensureString(tpl.id).trim() || generateTemplateId();
  return {
    id,
    name: ensureString(tpl.name).trim() || 'Şablon',
    html: clampHtml(ensureString(tpl.html)),
    isDefault: Boolean(tpl.isDefault),
    createdAt: tpl.createdAt || now,
    updatedAt: now,
  };
};

export const listTemplates = (tenantId?: string): QuoteTemplate[] => {
  try {
    const raw = safeLocalStorage.getItem(keyFor(tenantId));
    return parseTemplates(raw);
  } catch (error) {
    logger.warn('[quoteTemplates] Unable to access localStorage', error);
    return [];
  }
};

export const upsertTemplate = (tenantId: string | undefined, tpl: Omit<QuoteTemplate, 'createdAt' | 'updatedAt'> & Partial<Pick<QuoteTemplate, 'createdAt' | 'updatedAt'>>): QuoteTemplate => {
  const all = listTemplates(tenantId);
  const item = buildTemplate(tpl);
  const idx = all.findIndex(x => x.id === item.id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...item };
  } else {
    all.push(item);
  }
  if (item.isDefault) {
    all.forEach(x => { if (x.id !== item.id) x.isDefault = false; });
  }
  persistTemplates(tenantId, all);
  return item;
};

export const deleteTemplate = (tenantId: string | undefined, id: string) => {
  const all = listTemplates(tenantId).filter(x => x.id !== id);
  persistTemplates(tenantId, all);
};

export const setDefaultTemplate = (tenantId: string | undefined, id: string) => {
  const all = listTemplates(tenantId).map(x => ({ ...x, isDefault: x.id === id }));
  persistTemplates(tenantId, all);
};

export const getDefaultTemplate = (tenantId?: string): QuoteTemplate | undefined => listTemplates(tenantId).find(t => t.isDefault);

export type TemplateTokens =
  | '[quote.number]' | '[quote.date]' | '[quote.valid_until]'
  | '[quote.total]' | '[quote.currency]'
  | '[org.name]' | '[org.email]' | '[org.phone]' | '[org.address]'
  | '[client.company]' | '[client.name]' | '[client.email]' | '[client.address]';

export type FillContext = {
  quote?: { number?: string; date?: string; validUntil?: string; total?: number | string; currency?: string };
  org?: { name?: string; email?: string; phone?: string; address?: string };
  client?: { company?: string; name?: string; email?: string; address?: string };
};

export const availableTokens: TemplateTokens[] = [
  '[quote.number]','[quote.date]','[quote.valid_until]','[quote.total]','[quote.currency]',
  '[org.name]','[org.email]','[org.phone]','[org.address]',
  '[client.company]','[client.name]','[client.email]','[client.address]'
];

export const fillTemplate = (html: string, ctx: FillContext): string => {
  const map: Record<TemplateTokens, string | undefined> = {
    '[quote.number]': ctx.quote?.number,
    '[quote.date]': ctx.quote?.date,
    '[quote.valid_until]': ctx.quote?.validUntil,
    '[quote.total]': typeof ctx.quote?.total === 'number' ? String(ctx.quote?.total) : (ctx.quote?.total ?? undefined),
    '[quote.currency]': ctx.quote?.currency,
    '[org.name]': ctx.org?.name,
    '[org.email]': ctx.org?.email,
    '[org.phone]': ctx.org?.phone,
    '[org.address]': ctx.org?.address,
    '[client.company]': ctx.client?.company,
    '[client.name]': ctx.client?.name,
    '[client.email]': ctx.client?.email,
    '[client.address]': ctx.client?.address,
  } as const;

  let out = html;
  for (const token of availableTokens) {
    const val = map[token];
    if (typeof val === 'string' && val.length > 0) {
      const re = new RegExp(token.replace(/\[|\]|\./g, m => `\\${m}`), 'g');
      out = out.replace(re, val);
    }
  }
  return out;
};
