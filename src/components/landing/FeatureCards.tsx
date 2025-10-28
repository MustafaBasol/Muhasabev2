import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Receipt, BarChart3, Coins } from 'lucide-react';

const FeatureCards: React.FC = () => {
  const { t } = useTranslation();

  const features = [
    {
      icon: FileText,
      title: t('landing.features.inv.title'),
      description: t('landing.features.inv.desc'),
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      icon: Receipt,
      title: t('landing.features.exp.title'),
      description: t('landing.features.exp.desc'),
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      icon: BarChart3,
      title: t('landing.features.vat.title'),
      description: t('landing.features.vat.desc'),
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
    {
      icon: Coins,
      title: t('landing.features.fx.title'),
      description: t('landing.features.fx.desc'),
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    }
  ];

  return (
    <section id="features" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {t('landing.features.title')}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {t('landing.features.subtitle')}
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className={`relative p-6 rounded-2xl border ${feature.borderColor} ${feature.bgColor} hover:shadow-lg transition-all duration-300 hover:scale-105 group`}
              >
                {/* Icon */}
                <div className={`w-12 h-12 ${feature.bgColor} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`h-6 w-6 ${feature.color}`} />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>

                {/* Hover effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-transparent to-transparent group-hover:from-white/20 group-hover:to-transparent transition-all duration-300 pointer-events-none"></div>
              </div>
            );
          })}
        </div>

        {/* Additional info */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center px-6 py-3 rounded-full bg-gray-100 text-gray-700">
            <span className="text-sm font-medium">
              ✨ {t('landing.value.title')}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeatureCards;