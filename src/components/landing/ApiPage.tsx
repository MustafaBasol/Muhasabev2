import React from 'react';
import { useTranslation } from 'react-i18next';
import LegalHeader from '../LegalHeader';

const ApiPage: React.FC = () => {
  const { t } = useTranslation('api');
  return (
    <div className="min-h-screen bg-slate-50">
      <LegalHeader />
      <div className="max-w-3xl mx-auto px-4 py-14">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">{t('title')}</h1>
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
          <p className="text-slate-700 leading-relaxed">{t('underConstruction')}</p>
        </div>
      </div>
    </div>
  );
};

export default ApiPage;
