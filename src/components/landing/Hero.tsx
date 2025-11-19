import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Play, FileText, CreditCard } from 'lucide-react';

interface HeroProps {
  onTryForFree: () => void;
  onSignIn: () => void;
  onWatchDemo: () => void;
}

const Hero: React.FC<HeroProps> = ({ onTryForFree, onSignIn, onWatchDemo }) => {
  const { t } = useTranslation();

  return (
    <div className="relative bg-gradient-to-br from-gray-50 via-white to-blue-50/30 pt-24 pb-20 sm:pt-32 sm:pb-24 overflow-hidden">
      {/* Modern background with subtle blur spots */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-br from-blue-100/40 to-indigo-100/40 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-emerald-100/40 to-green-100/40 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-purple-100/30 to-pink-100/30 rounded-full blur-2xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Content - Left side on desktop, top on mobile */}
          <div className="text-center md:text-left">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-700 text-sm font-medium mb-8 shadow-sm">
              <img src="/favicon-32x32.png" alt="Comptario" className="mr-2 w-4 h-4 rounded-sm" />
              {t('landing.hero.badge')}
            </div>

            {/* Main heading */}
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              {t('landing.hero.title')}
            </h1>

            {/* Subtitle */}
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto md:mx-0 leading-relaxed">
              {t('landing.hero.sub')}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start items-center mb-12">
              <button
                onClick={onTryForFree}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {t('landing.cta.try')}
                <ArrowRight className="h-5 w-5" />
              </button>
              
              <button
                onClick={onSignIn}
                className="bg-white/80 backdrop-blur-sm text-gray-900 px-8 py-4 rounded-lg text-lg font-semibold border-2 border-gray-300 hover:border-gray-400 hover:bg-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
              >
                {t('landing.cta.signin')}
              </button>

              <button
                onClick={onWatchDemo}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                <div className="w-10 h-10 bg-gray-100/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                  <Play className="h-5 w-5 ml-0.5" />
                </div>
                {t('landing.cta.watchDemo')}
              </button>
            </div>

            {/* Feature highlights with colored dots */}
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>{t('landing.hero.features.pdf')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>{t('landing.hero.features.currency')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span>{t('landing.hero.features.vat')}</span>
              </div>
            </div>
          </div>

          {/* Mockup - Right side on desktop, bottom on mobile */}
          <div className="relative">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
              {/* Mockup header */}
              <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  </div>
                  <div className="text-sm text-gray-600">comptario.com</div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center overflow-hidden">
                    <img src="/favicon-32x32.png" alt="Comptario" className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">Comptario</span>
                </div>
              </div>
              
              {/* Mockup content */}
              <div className="p-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-4 rounded-2xl border border-emerald-200">
                    <div className="text-emerald-600 font-semibold text-lg">€2,450</div>
                    <div className="text-sm text-gray-600">{t('landing.hero.mockup.revenue')}</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-200">
                    <div className="text-blue-600 font-semibold text-lg">€1,280</div>
                    <div className="text-sm text-gray-600">{t('landing.hero.mockup.expenses')}</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-2xl border border-purple-200">
                    <div className="text-purple-600 font-semibold text-lg">€441</div>
                    <div className="text-sm text-gray-600">{t('landing.hero.mockup.vat')}</div>
                  </div>
                </div>
                
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                        <FileText className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">Invoice #INV-2024-001</div>
                        <div className="text-sm text-gray-500">Client ABC Ltd.</div>
                      </div>
                    </div>
                    <div className="text-emerald-600 font-semibold">€850</div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">Office Supplies</div>
                        <div className="text-sm text-gray-500">Supplier XYZ</div>
                      </div>
                    </div>
                    <div className="text-red-600 font-semibold">€125</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;