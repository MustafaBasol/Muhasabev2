import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2, Star, StarOff } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import { availableTokens, deleteTemplate, getDefaultTemplate, listTemplates, QuoteTemplate, setDefaultTemplate, upsertTemplate } from '../utils/quoteTemplates';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  planRaw?: string; // free | professional/pro | enterprise/business
}

const normalizePlan = (p?: string) => {
  const s = String(p||'').toLowerCase();
  if (s === 'pro' || s === 'professional') return 'pro';
  if (s === 'enterprise' || s === 'business') return 'business';
  return 'free';
};

const QuoteTemplatesManager: React.FC<Props> = ({ isOpen, onClose, planRaw }) => {
  const { t } = useTranslation();
  const { tenant } = useAuth();
  const tenantId = (tenant as any)?.id || localStorage.getItem('tenantId') || undefined;
  const plan = normalizePlan(planRaw || (tenant as any)?.subscriptionPlan);
  const [items, setItems] = useState<QuoteTemplate[]>([]);
  const [current, setCurrent] = useState<QuoteTemplate | null>(null);
  const [name, setName] = useState('');
  const [html, setHtml] = useState('');

  const canUse = plan !== 'free';
  const limit = plan === 'pro' ? 1 : Infinity;
  const atLimit = items.length >= limit;

  useEffect(() => {
    if (!isOpen) return;
    try {
      const list = listTemplates(tenantId || undefined);
      setItems(list);
      setCurrent(list.find(x => x.isDefault) || list[0] || null);
      if (list.length) {
        setName(list[0].name);
        setHtml(list[0].html);
      } else {
        setName(''); setHtml('');
      }
    } catch {}
  }, [isOpen, tenantId]);

  const handleSelect = (id: string) => {
    const found = items.find(x => x.id === id) || null;
    setCurrent(found);
    setName(found?.name || '');
    setHtml(found?.html || '');
  };

  const handleNew = () => {
    setCurrent(null);
    setName(t('quotes.templates.newTemplate', { defaultValue: 'Yeni Şablon' }));
    setHtml(t('quotes.templates.defaultBodyHtml', { defaultValue: '' }));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const id = current?.id || Math.random().toString(36).slice(2);
    const saved = upsertTemplate(tenantId || undefined, { id, name: name.trim(), html, isDefault: current?.isDefault });
    const list = listTemplates(tenantId || undefined);
    setItems(list);
    setCurrent(list.find(x => x.id === saved.id) || saved);
  };

  const handleDelete = () => {
    if (!current) return;
    deleteTemplate(tenantId || undefined, current.id);
    const list = listTemplates(tenantId || undefined);
    setItems(list);
    const next = list.find(x => x.isDefault) || list[0] || null;
    setCurrent(next);
    setName(next?.name || '');
    setHtml(next?.html || '');
  };

  const handleSetDefault = () => {
    if (!current) return;
    setDefaultTemplate(tenantId || undefined, current.id);
    const list = listTemplates(tenantId || undefined);
    setItems(list);
    const def = getDefaultTemplate(tenantId || undefined);
    if (def) handleSelect(def.id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t('quotes.templates.title', { defaultValue: 'Teklif Şablonları' })}</h3>
          <button onClick={onClose} className="px-3 py-1.5 border rounded-md">{t('common.close')}</button>
        </div>
        <div className="flex-1 overflow-hidden flex">
          <div className="w-64 border-r overflow-y-auto">
            <div className="p-3 flex items-center justify-between">
              <span className="text-sm text-gray-700">{t('quotes.templates.list', { defaultValue: 'Şablonlar' })}</span>
              <button
                className="text-xs px-2 py-1 rounded-md bg-indigo-600 text-white disabled:opacity-50"
                onClick={handleNew}
                disabled={!canUse || atLimit}
                title={!canUse ? t('quotes.templates.requirePlan', { defaultValue: 'Plan gerekli' }) : atLimit ? t('quotes.templates.proLimit', { defaultValue: 'Pro planda en fazla 1 şablon' }) : t('quotes.templates.newTemplate', { defaultValue: 'Yeni şablon' })}
              >
                <Plus className="w-4 h-4 inline" /> {t('quotes.templates.new', { defaultValue: 'Yeni' })}
              </button>
            </div>
            {!canUse && (
              <div className="mx-3 mb-3 p-2 text-[11px] text-amber-800 bg-amber-50 rounded border border-amber-200">
                {t('quotes.templates.freeHidden', { defaultValue: 'Şablonlar Starter planda görünmez.' })}
              </div>
            )}
            {plan === 'pro' && (
              <div className="mx-3 mb-2 text-[11px] text-gray-500">{t('quotes.templates.proLimit', { defaultValue: 'Pro planda en fazla 1 şablon kaydedebilirsiniz.' })}</div>
            )}
            <ul>
              {items.map(t => (
                <li key={t.id}>
                  <button
                    className={`w-full text-left px-3 py-2 border-b text-sm ${current?.id===t.id?'bg-indigo-50':''}`}
                    onClick={() => handleSelect(t.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{t.name}</span>
                      {t.isDefault ? <Star className="w-4 h-4 text-amber-500" /> : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {!canUse ? (
              <div className="text-sm text-gray-600">{t('quotes.templates.manageUpgrade', { defaultValue: 'Şablon yönetimi için Pro veya Business planına geçin.' })}</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e)=>setName(e.target.value)}
                    placeholder={t('quotes.templates.placeholderName', { defaultValue: 'Şablon adı' })}
                    className="px-3 py-2 border rounded-md w-72"
                  />
                  <button onClick={handleSave} className="px-3 py-2 bg-indigo-600 text-white rounded-md flex items-center gap-1"><Save className="w-4 h-4" />{t('common.save')}</button>
                  <button onClick={handleDelete} disabled={!current} className="px-3 py-2 bg-red-600 text-white rounded-md disabled:opacity-50 flex items-center gap-1"><Trash2 className="w-4 h-4" />{t('common.delete')}</button>
                  <button onClick={handleSetDefault} disabled={!current} className="px-3 py-2 bg-amber-500 text-white rounded-md disabled:opacity-50 flex items-center gap-1">
                    {current?.isDefault ? <StarOff className="w-4 h-4" /> : <Star className="w-4 h-4" />} {t('quotes.templates.setDefault', { defaultValue: 'Varsayılan' })}
                  </button>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">{t('quotes.templates.availableTokens', { defaultValue: 'Kullanılabilir alanlar (tıkla ve içeriğe ekle):' })}</div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {availableTokens.map(tok => (
                      <button key={tok} type="button" onClick={()=>setHtml(h=> (h || '') + (h ? ' ' : '') + tok)} className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50">
                        {tok}
                      </button>
                    ))}
                  </div>
                  <RichTextEditor value={html} onChange={setHtml} height={260} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteTemplatesManager;
