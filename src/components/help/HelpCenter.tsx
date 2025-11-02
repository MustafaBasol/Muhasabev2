import React, { useMemo, useState } from 'react';
import LegalHeader from '../LegalHeader';
import { useTranslation } from 'react-i18next';

const HelpCenter: React.FC = () => {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const { t } = useTranslation('help');
  const [query, setQuery] = useState('');
  type HelpL = {
    sidebarTitle: string;
    pageTitle: string;
    overviewDesc: string;
    labels: { tip: string };
    sections: { id: string; title: string }[];
    gettingStarted: { title: string; steps: string[]; tipKeyboard?: string; tipAfter?: string };
    customers: { title: string; items: string[] };
    suppliers: { title: string; desc: string };
    products: { title: string; desc: string; items: string[] };
    invoices: { title: string; steps: string[] };
    expenses: { title: string; desc: string };
    sales: { title: string; desc: string };
    bank: { title: string; desc: string };
    reports: { title: string; desc: string };
    settings: { title: string; items: string[] };
    users: { title: string; desc: string };
    planLimits: { title: string; desc: string };
    periodLock: { title: string; desc: string };
    securityBackup: { title: string; items: string[]; cookiesText?: string };
    faq: { title: string; text: string };
  };

  const L: HelpL = useMemo(() => ({
    sidebarTitle: t('sidebarTitle'),
    pageTitle: t('pageTitle'),
    overviewDesc: t('overviewDesc'),
    labels: { tip: t('labels.tip') },
    sections: t('sections', { returnObjects: true }) as { id: string; title: string }[],
    gettingStarted: t('gettingStarted', { returnObjects: true }),
    customers: t('customers', { returnObjects: true }),
    suppliers: t('suppliers', { returnObjects: true }),
    products: t('products', { returnObjects: true }),
    invoices: t('invoices', { returnObjects: true }),
    expenses: t('expenses', { returnObjects: true }),
    sales: t('sales', { returnObjects: true }),
    bank: t('bank', { returnObjects: true }),
    reports: t('reports', { returnObjects: true }),
    settings: t('settings', { returnObjects: true }),
    users: t('users', { returnObjects: true }),
    planLimits: t('planLimits', { returnObjects: true }),
    periodLock: t('periodLock', { returnObjects: true }),
    securityBackup: t('securityBackup', { returnObjects: true }),
    faq: t('faq', { returnObjects: true }),
  }) as unknown as HelpL, [t]);

  const sections = useMemo<{ id: string; title: string }[]>(() => L.sections || [], [L]);

  const includesQ = (s: string) => s.toLowerCase().includes(query.trim().toLowerCase());
  const Hl = ({ text }: { text: string }) => {
    const q = query.trim();
    if (!q) return <>{text}</>;
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return <>{parts.map((p, i) => p.toLowerCase() === q.toLowerCase() ? <mark key={i} className="bg-yellow-200 rounded px-0.5">{p}</mark> : <React.Fragment key={i}>{p}</React.Fragment>)}</>;
  };

  const Tip = ({ children }: { children: React.ReactNode }) => (
    <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-blue-900 text-sm">{children}</div>
  );

  const Keyboard = ({ children }: { children: React.ReactNode }) => (
    <kbd className="px-1.5 py-0.5 text-xs rounded border bg-gray-50 border-gray-300 text-gray-800">{children}</kbd>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <LegalHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar */}
          <aside className="lg:col-span-3">
            <div className="sticky top-24 space-y-2">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{L.sidebarTitle}</h2>
              <nav className="space-y-1">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    className="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  >
                    {s.title}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="lg:col-span-9 space-y-12">
            {/* Search */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchPlaceholder', { ns: 'common', defaultValue: 'Ara...' })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </section>
            {/* Overview */}
            {(!query || includesQ(L.pageTitle) || includesQ(L.overviewDesc)) && (
            <section id="overview" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-3">{L.pageTitle}</h1>
              <p className="text-gray-700 leading-relaxed"><Hl text={L.overviewDesc} /></p>
            </section>
            )}

            {/* Getting Started */}
            {(!query || includesQ(L.gettingStarted.title) || (L.gettingStarted.steps||[]).some((s:string)=>includesQ(s))) && (
            <section id="getting-started" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{L.gettingStarted.title}</h2>
              <ol className="list-decimal pl-5 space-y-2 text-gray-700">
                {L.gettingStarted.steps.map((s: string, i: number) => (
                  <li key={i}><Hl text={s} /></li>
                ))}
              </ol>
              <div className="mt-4"><Tip>{L.labels.tip}: {L.gettingStarted.tipKeyboard} <Keyboard>g</Keyboard> {L.gettingStarted.tipAfter}</Tip></div>
            </section>
            )}

            {/* Customers */}
            {(!query || includesQ(L.customers.title) || (L.customers.items||[]).some((s:string)=>includesQ(s))) && (
            <section id="customers" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{L.customers.title}</h2>
              <ul className="list-disc pl-5 space-y-2 text-gray-700">
                {L.customers.items.map((it: string, i: number) => (<li key={i}><Hl text={it} /></li>))}
              </ul>
            </section>
            )}

            {/* Suppliers */}
            {(!query || includesQ(L.suppliers.title) || includesQ(L.suppliers.desc)) && (
            <section id="suppliers" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{L.suppliers.title}</h2>
              <p className="text-gray-700"><Hl text={L.suppliers.desc} /></p>
            </section>
            )}

            {/* Products */}
            {(!query || includesQ(L.products.title) || includesQ(L.products.desc) || (L.products.items||[]).some((s:string)=>includesQ(s))) && (
            <section id="products" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{L.products.title}</h2>
              <p className="text-gray-700 mb-3"><Hl text={L.products.desc} /></p>
              <ul className="list-disc pl-5 space-y-2 text-gray-700">
                {L.products.items.map((it: string, i: number) => (<li key={i}><Hl text={it} /></li>))}
              </ul>
            </section>
            )}

            {/* Invoices */}
            {(!query || includesQ(L.invoices.title) || (L.invoices.steps||[]).some((s:string)=>includesQ(s))) && (
            <section id="invoices" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{L.invoices.title}</h2>
              <ol className="list-decimal pl-5 space-y-2 text-gray-700">
                {L.invoices.steps.map((s: string, i: number) => (<li key={i}><Hl text={s} /></li>))}
              </ol>
            </section>
            )}

            {/* Expenses */}
            {(!query || includesQ(L.expenses.title) || includesQ(L.expenses.desc)) && (
            <section id="expenses" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{L.expenses.title}</h2>
              <p className="text-gray-700"><Hl text={L.expenses.desc} /></p>
            </section>
            )}

            {/* Sales */}
            {(!query || includesQ(L.sales.title) || includesQ(L.sales.desc)) && (
            <section id="sales" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{L.sales.title}</h2>
              <p className="text-gray-700"><Hl text={L.sales.desc} /></p>
            </section>
            )}

            {/* Bank */}
            {(!query || includesQ(L.bank.title) || includesQ(L.bank.desc)) && (
            <section id="bank" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{L.bank.title}</h2>
              <p className="text-gray-700"><Hl text={L.bank.desc} /></p>
            </section>
            )}

            {/* Reports */}
            {(!query || includesQ(L.reports.title) || includesQ(L.reports.desc)) && (
            <section id="reports" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{L.reports.title}</h2>
              <p className="text-gray-700"><Hl text={L.reports.desc} /></p>
            </section>
            )}

            {/* Settings */}
            {(!query || includesQ(L.settings.title) || (L.settings.items||[]).some((s:string)=>includesQ(s))) && (
            <section id="settings" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{L.settings.title}</h2>
              <ul className="list-disc pl-5 space-y-2 text-gray-700">
                {L.settings.items.map((it: string, i: number) => (<li key={i}><Hl text={it} /></li>))}
              </ul>
            </section>
            )}

            {/* Users */}
            {(!query || includesQ(L.users.title) || includesQ(L.users.desc)) && (
            <section id="users" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{L.users.title}</h2>
              <p className="text-gray-700"><Hl text={L.users.desc} /></p>
            </section>
            )}

            {/* Plan limits */}
            {(!query || includesQ(L.planLimits.title) || includesQ(L.planLimits.desc)) && (
            <section id="plan-limits" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{L.planLimits.title}</h2>
              <p className="text-gray-700"><Hl text={L.planLimits.desc} /></p>
            </section>
            )}

            {/* Period lock */}
            {(!query || includesQ(L.periodLock.title) || includesQ(L.periodLock.desc)) && (
            <section id="period-lock" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{L.periodLock.title}</h2>
              <p className="text-gray-700"><Hl text={L.periodLock.desc} /></p>
            </section>
            )}

            {/* Security & Backup */}
            {(!query || includesQ(L.securityBackup.title) || includesQ(L.securityBackup.items?.join(' '))) && (
            <section id="security-backup" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{L.securityBackup.title}</h2>
              <ul className="list-disc pl-5 space-y-2 text-gray-700">
                <li><Hl text={L.securityBackup.items[0]} /></li>
                <li><Hl text={L.securityBackup.items[1]} /></li>
                <li><a className="underline" href="#legal/cookies">{L.securityBackup.cookiesText}</a></li>
              </ul>
            </section>
            )}

            {/* FAQ & Contact */}
            {(!query || includesQ(L.faq.title) || includesQ(L.faq.text)) && (
            <section id="faq-contact" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{L.faq.title}</h2>
              <p className="text-gray-700">
                <Hl text={L.faq.text.replace('support@comptario.com', '')} />
                <a className="underline" href="mailto:support@comptario.com">support@comptario.com</a>
              </p>
            </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;
