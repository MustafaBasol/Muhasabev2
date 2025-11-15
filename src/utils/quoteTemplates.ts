export type QuoteTemplate = {
  id: string;
  name: string;
  html: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
};

const keyFor = (tenantId?: string) => (tenantId ? `quote_templates_${tenantId}` : 'quote_templates');

export const listTemplates = (tenantId?: string): QuoteTemplate[] => {
  try {
    const raw = localStorage.getItem(keyFor(tenantId));
    const arr = raw ? JSON.parse(raw) as QuoteTemplate[] : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
};

const saveAll = (tenantId: string | undefined, items: QuoteTemplate[]) => {
  localStorage.setItem(keyFor(tenantId), JSON.stringify(items));
};

export const upsertTemplate = (tenantId: string | undefined, tpl: Omit<QuoteTemplate, 'createdAt' | 'updatedAt'> & Partial<Pick<QuoteTemplate, 'createdAt' | 'updatedAt'>>): QuoteTemplate => {
  const all = listTemplates(tenantId);
  const now = new Date().toISOString();
  const idx = all.findIndex(x => x.id === tpl.id);
  const item: QuoteTemplate = {
    id: tpl.id,
    name: tpl.name,
    html: tpl.html,
    isDefault: !!tpl.isDefault,
    createdAt: tpl.createdAt || now,
    updatedAt: now,
  };
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...item };
  } else {
    all.push(item);
  }
  if (item.isDefault) {
    all.forEach(x => { if (x.id !== item.id) x.isDefault = false; });
  }
  saveAll(tenantId, all);
  return item;
};

export const deleteTemplate = (tenantId: string | undefined, id: string) => {
  const all = listTemplates(tenantId).filter(x => x.id !== id);
  saveAll(tenantId, all);
};

export const setDefaultTemplate = (tenantId: string | undefined, id: string) => {
  const all = listTemplates(tenantId).map(x => ({ ...x, isDefault: x.id === id }));
  saveAll(tenantId, all);
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
      const re = new RegExp(token.replace(/[\[\].]/g, m => `\\${m}`), 'g');
      out = out.replace(re, val);
    }
  }
  return out;
};
