import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Building2, TrendingUp, Check } from 'lucide-react';

const Value: React.FC = () => {
  const { t } = useTranslation();

  const REGISTER_URL = import.meta.env.VITE_REGISTER_URL || '#register';

  const handleTryForFree = () => {
    // Hash URL ise aynı sekmede hash routing ile git
    if (REGISTER_URL.startsWith('#')) {
      window.location.hash = REGISTER_URL.replace('#', '');
      return;
    }
    // Uyum için bilinen relative yolları hash'e çevir
    if (REGISTER_URL === '/register') {
      window.location.hash = 'register';
      return;
    }
    if (REGISTER_URL === '/login') {
      window.location.hash = 'login';
      return;
    }
    // Diğer durumlarda mevcut sekmede yönlendir
    window.location.href = REGISTER_URL;
  };

  const benefits = [
    {
      icon: Users,
      title: t('landing.value.freelancers.title'),
      description: t('landing.value.freelancers.desc'),
      features: [
        t('landing.value.freelancers.basic'), 
        t('landing.value.freelancers.expense'), 
        t('landing.value.freelancers.tax')
      ]
    },
    {
      icon: Building2,
      title: t('landing.value.small.title'),
      description: t('landing.value.small.desc'),
      features: [
        t('landing.value.small.currency'), 
        t('landing.value.small.customer'), 
        t('landing.value.small.reporting')
      ]
    },
    {
      icon: TrendingUp,
      title: t('landing.value.growing.title'),
      description: t('landing.value.growing.desc'),
      features: [
        t('landing.value.growing.team'), 
        t('landing.value.growing.api'), 
        t('landing.value.growing.support')
      ]
    }
  ];

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {t('landing.value.title')}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {t('landing.value.subtitle')}
          </p>
        </div>

        {/* Benefits grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={index}
                className={`bg-white p-8 rounded-2xl shadow-sm border transition-all duration-300 hover:shadow-lg ${
                  index === 0 ? 'border-blue-200 hover:border-blue-300' : 
                  index === 1 ? 'border-emerald-200 hover:border-emerald-300' : 
                  'border-purple-200 hover:border-purple-300'
                }`}
              >
                {/* Icon */}
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 ${
                  index === 0 ? 'bg-blue-500' : 
                  index === 1 ? 'bg-emerald-500' : 
                  'bg-purple-500'
                }`}>
                  <Icon className="h-7 w-7 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {benefit.title}
                </h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {benefit.description}
                </p>

                {/* Features list */}
                <ul className="space-y-3">
                  {benefit.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center text-sm text-gray-700">
                      <Check className={`h-4 w-4 mr-3 flex-shrink-0 ${
                        index === 0 ? 'text-blue-500' : 
                        index === 1 ? 'text-emerald-500' : 
                        'text-purple-500'
                      }`} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* CTA section */
        }
        <div className="mt-16 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-2xl mx-auto">
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">
              {t('landing.value.cta.title')}
            </h3>
            <p className="text-gray-600 mb-6">
              {t('landing.value.cta.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleTryForFree}
                className="bg-gray-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
              >
                {t('landing.value.cta.trial')}
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-gray-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">10k+</div>
                <div className="text-sm text-gray-600">{t('landing.value.stats.users')}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">50k+</div>
                <div className="text-sm text-gray-600">{t('landing.value.stats.invoices')}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">99.9%</div>
                <div className="text-sm text-gray-600">{t('landing.value.stats.uptime')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Value;