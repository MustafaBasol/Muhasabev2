import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Server, Lock, FileCheck, Globe, Zap } from 'lucide-react';

const Security: React.FC = () => {
  const { t } = useTranslation();

  const securityFeatures = [
    {
      icon: Shield,
      title: t('landing.security.features.hosting.title'),
      description: t('landing.security.features.hosting.desc')
    },
    {
      icon: Lock,
      title: t('landing.security.features.encryption.title'),
      description: t('landing.security.features.encryption.desc')
    },
    {
      icon: Server,
      title: t('landing.security.features.backups.title'),
      description: t('landing.security.features.backups.desc')
    },
    {
      icon: FileCheck,
      title: t('landing.security.features.gdpr.title'),
      description: t('landing.security.features.gdpr.desc')
    },
    {
      icon: Globe,
      title: t('landing.security.features.monitoring.title'),
      description: t('landing.security.features.monitoring.desc')
    },
    {
      icon: Zap,
      title: t('landing.security.features.uptime.title'),
      description: t('landing.security.features.uptime.desc')
    }
  ];

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-100 text-green-700 text-sm font-medium mb-4">
            <Shield className="h-4 w-4 mr-2" />
            {t('landing.security.badge')}
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {t('landing.security.title')}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {t('landing.security.items')}
          </p>
        </div>

        {/* Security features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {securityFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="text-center p-6 rounded-xl border border-gray-200 hover:border-green-200 hover:shadow-lg transition-all duration-300 hover:bg-green-50/30"
              >
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Icon className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Certifications and compliance */}
          <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-semibold text-gray-900 mb-6">
            {t('landing.security.trusted.title')}
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center opacity-60">
            {/* Placeholder for compliance badges */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-sm font-semibold text-gray-700">GDPR</div>
              <div className="text-xs text-gray-500">{t('landing.security.trusted.gdpr')}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-sm font-semibold text-gray-700">ISO 27001</div>
              <div className="text-xs text-gray-500">{t('landing.security.trusted.iso')}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-sm font-semibold text-gray-700">SOC 2</div>
              <div className="text-xs text-gray-500">{t('landing.security.trusted.soc')}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-sm font-semibold text-gray-700">SSL</div>
              <div className="text-xs text-gray-500">{t('landing.security.trusted.ssl')}</div>
            </div>
          </div>

          <p className="text-gray-600 mt-8 max-w-2xl mx-auto">
            {t('landing.security.trusted.desc')}
          </p>
        </div>
      </div>
    </section>
  );
};

export default Security;