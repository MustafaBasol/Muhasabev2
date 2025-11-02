import React from 'react';
import { useTranslation } from 'react-i18next';
import LegalHeader from '../LegalHeader';

const AboutPage: React.FC = () => {
  const { t } = useTranslation('about');
  return (
    <div className="min-h-screen bg-slate-50">
      <LegalHeader />

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        <header className="mb-2">
          <h1 className="text-3xl font-bold text-slate-900">{t('title')}</h1>
          <p className="text-slate-600 mt-2">{t('subtitle')}</p>
        </header>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t('whoWeAre.title')}</h2>
          <p className="text-slate-700 leading-relaxed">{t('whoWeAre.text')}</p>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t('offerings.title')}</h2>
          <ul className="list-disc pl-6 space-y-2 text-slate-700">
            {(t('offerings.items', { returnObjects: true }) as string[]).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t('approach.title')}</h2>
          <p className="text-slate-700 leading-relaxed">{t('approach.text')}</p>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t('contact.title')}</h2>
          <p className="text-slate-700">
            {t('contact.text')}{' '}
            <a className="text-indigo-600 hover:underline" href="mailto:support@comptario.com">support@comptario.com</a>
          </p>
        </section>
      </main>
    </div>
  );
};

export default AboutPage;
