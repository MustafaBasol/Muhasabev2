import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Server, Lock, FileCheck, Globe, Zap, ShieldCheck, Award } from 'lucide-react';

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
    <section id="security" className="py-16 bg-white">
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

        {/* Certifications and compliance (Enhanced UI) */}
        <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-2xl p-8 md:p-10 border border-green-100/60 shadow-sm text-center">
          <h3 className="text-2xl font-semibold text-gray-900 mb-3">
            {t('landing.security.trusted.title')}
          </h3>
          <p className="text-gray-600 mb-8 max-w-3xl mx-auto">
            {t('landing.security.trusted.desc')}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 items-stretch">
            {/* GDPR */}
            <div aria-label="GDPR" className="group relative overflow-hidden rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200 hover:border-blue-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col items-center justify-center p-5 md:p-6">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="text-sm font-semibold text-gray-800">GDPR</div>
                <div className="text-xs text-gray-500">{t('landing.security.trusted.gdpr')}</div>
              </div>
            </div>

            {/* ISO 27001 */}
            <div aria-label="ISO 27001" className="group relative overflow-hidden rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200 hover:border-blue-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col items-center justify-center p-5 md:p-6">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <Award className="h-5 w-5" />
                </div>
                <div className="text-sm font-semibold text-gray-800">ISO 27001</div>
                <div className="text-xs text-gray-500">{t('landing.security.trusted.iso')}</div>
              </div>
            </div>

            {/* SOC 2 */}
            <div aria-label="SOC 2" className="group relative overflow-hidden rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200 hover:border-blue-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col items-center justify-center p-5 md:p-6">
                <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="text-sm font-semibold text-gray-800">SOC 2</div>
                <div className="text-xs text-gray-500">{t('landing.security.trusted.soc')}</div>
              </div>
            </div>

            {/* SSL */}
            <div aria-label="SSL" className="group relative overflow-hidden rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200 hover:border-blue-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col items-center justify-center p-5 md:p-6">
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                  <Lock className="h-5 w-5" />
                </div>
                <div className="text-sm font-semibold text-gray-800">SSL</div>
                <div className="text-xs text-gray-500">{t('landing.security.trusted.ssl')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Security;