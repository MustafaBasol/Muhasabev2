import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Calculator, Sparkles } from 'lucide-react';

interface FinalCTAProps {
  loginUrl: string;
}

const FinalCTA: React.FC<FinalCTAProps> = ({ loginUrl }) => {
  const { t } = useTranslation();

  const handleGetStarted = () => {
    window.open(loginUrl, '_blank');
  };

  return (
    <section className="py-16 bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Decorative elements */}
        <div className="relative">
          <div className="absolute -top-10 -left-10 w-20 h-20 bg-blue-500/10 rounded-full blur-xl"></div>
          <div className="absolute -bottom-10 -right-10 w-20 h-20 bg-purple-500/10 rounded-full blur-xl"></div>
          
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-8">
            <Calculator className="h-8 w-8 text-white" />
          </div>

          {/* Main heading */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
            {t('landing.finalCta.title')}
          </h2>

          {/* Subtitle */}
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
            {t('landing.finalCta.subtitle')}
          </p>

          {/* CTA Button */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <button
              onClick={handleGetStarted}
              className="bg-white text-gray-900 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-all duration-300 flex items-center gap-2 shadow-xl hover:shadow-2xl transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              <Sparkles className="h-5 w-5" />
              {t('landing.finalCta.cta')}
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center items-center gap-8 text-gray-400 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>{t('landing.finalCta.trial')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span>{t('landing.finalCta.noSetup')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span>{t('landing.finalCta.cancel')}</span>
            </div>
          </div>
        </div>

        {/* Bottom stats */}
        <div className="mt-16 pt-8 border-t border-gray-700">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-white mb-2">10,000+</div>
              <div className="text-gray-400 text-sm">{t('landing.value.stats.users')}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white mb-2">500,000+</div>
              <div className="text-gray-400 text-sm">{t('landing.value.stats.invoices')}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white mb-2">50+</div>
              <div className="text-gray-400 text-sm">{t('landing.finalCta.stats.countries')}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;