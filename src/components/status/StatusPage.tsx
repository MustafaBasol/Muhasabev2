import React from 'react';
import { CheckCircle2, AlertTriangle, Database, Mail, FileText, Cloud } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const StatusPage: React.FC = () => {
  const { t, i18n } = useTranslation('status');

  const components: Array<{ key: keyof ReturnType<typeof buildKeys>['components']; icon: React.ReactNode }>= [
    { key: 'api', icon: <Cloud className="h-5 w-5 text-emerald-600" /> },
    { key: 'database', icon: <Database className="h-5 w-5 text-emerald-600" /> },
    { key: 'email', icon: <Mail className="h-5 w-5 text-emerald-600" /> },
    { key: 'pdf', icon: <FileText className="h-5 w-5 text-emerald-600" /> },
    { key: 'storage', icon: <Cloud className="h-5 w-5 text-emerald-600" /> },
  ];

  function buildKeys() {
    return {
      components: {
        api: t('components.api') as string,
        database: t('components.database') as string,
        email: t('components.email') as string,
        pdf: t('components.pdf') as string,
        storage: t('components.storage') as string,
      },
      status: {
        operational: t('status.operational') as string,
      },
    };
  }

  const L = buildKeys();
  const now = new Date().toLocaleString(i18n.language || undefined);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
          <p className="text-slate-600 mt-1">{t('subtitle')}</p>

          <div className="mt-4 inline-flex items-center space-x-2 rounded-full bg-emerald-50 px-3 py-1 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">{t('allOperational')}</span>
          </div>

          <p className="text-xs text-slate-500 mt-2">{t('lastUpdated', { time: now })}</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Components status */}
        <section className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Bileşenler</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {components.map((comp) => (
              <div key={comp.key as string} className="flex items-center justify-between p-4 rounded-md border border-slate-200">
                <div className="flex items-center space-x-3">
                  {comp.icon}
                  <span className="text-slate-800 font-medium">{L.components[comp.key]}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="h-2.5 w-2.5 inline-flex rounded-full bg-emerald-500" />
                  <span className="text-sm text-emerald-700">{L.status.operational}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Incidents */}
        <section className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">{t('incidents.title')}</h2>
          <div className="flex items-center space-x-3 text-slate-600">
            <AlertTriangle className="h-5 w-5 text-slate-400" />
            <p>{t('incidents.none')}</p>
          </div>
        </section>

        {/* Contact */}
        <section className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">{t('contact.title')}</h2>
          <p className="text-slate-600">{t('contact.text')}</p>
          <p className="mt-2"><a href="mailto:support@comptario.com" className="text-indigo-600 hover:underline">{t('contact.email')}</a></p>
        </section>
      </main>
    </div>
  );
};

export default StatusPage;
