import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ArrowRight, Star } from 'lucide-react';

interface PricingProps {
  loginUrl: string;
}

const Pricing: React.FC<PricingProps> = ({ loginUrl }) => {
  const { t } = useTranslation();

  const plans = [
    {
      name: t('landing.pricing.starter'),
      price: t('landing.pricing.price.free'),
      description: t('landing.pricing.plans.starter.desc'),
      features: [
        t('landing.pricing.features.invoices5'),
        t('landing.pricing.features.basicExpense'),
        t('landing.pricing.features.vat'),
        t('landing.pricing.features.pdf'),
        t('landing.pricing.features.emailSupport')
      ],
      cta: t('landing.pricing.cta'),
      popular: false
    },
    {
      name: t('landing.pricing.pro'),
      price: t('landing.pricing.price.pro'),
      description: t('landing.pricing.plans.pro.desc'),
      features: [
        t('landing.pricing.features.unlimited'),
        t('landing.pricing.features.advancedExpense'),
        t('landing.pricing.features.multiCurrency'),
        t('landing.pricing.features.customerMgmt'),
        t('landing.pricing.features.prioritySupport'),
        t('landing.pricing.features.api')
      ],
      cta: t('landing.pricing.cta'),
      popular: true
    },
    {
      name: t('landing.pricing.business'),
      price: t('landing.pricing.price.biz'),
      description: t('landing.pricing.plans.business.desc'),
      features: [
        t('landing.pricing.features.everythingPro'),
        t('landing.pricing.features.teamCollaboration'),
        t('landing.pricing.features.advancedReporting'),
        t('landing.pricing.features.whiteLabel'),
        t('landing.pricing.features.dedicatedSupport'),
        t('landing.pricing.features.customIntegrations')
      ],
      cta: t('landing.pricing.cta'),
      popular: false
    }
  ];

  const handlePlanClick = () => {
    // Hash URL ise aynı sekmede hash routing ile git
    if (loginUrl.startsWith('#')) {
      window.location.hash = loginUrl.replace('#', '');
      return;
    }
    // Uyum için bilinen relative yolları hash'e çevir
    if (loginUrl === '/register') {
      window.location.hash = 'register';
      return;
    }
    if (loginUrl === '/login') {
      window.location.hash = 'login';
      return;
    }
    // Diğer durumlarda mevcut sekmede yönlendir
    window.location.href = loginUrl;
  };

  return (
    <section id="pricing" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {t('landing.pricing.title')}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {t('landing.pricing.subtitle')}
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative rounded-2xl border-2 p-8 ${
                plan.popular
                  ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-500 shadow-xl scale-105'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              } transition-all duration-300 hover:shadow-lg`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center shadow-lg">
                    <Star className="h-4 w-4 mr-1 fill-current" />
                    {t('landing.pricing.popular')}
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <div className="text-4xl font-bold text-gray-900 mb-2">
                  {plan.price}
                </div>
                <p className="text-gray-600">
                  {plan.description}
                </p>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center">
                    <Check className={`h-5 w-5 mr-3 flex-shrink-0 ${
                      plan.popular ? 'text-blue-500' : 'text-emerald-500'
                    }`} />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA button */}
              <button
                onClick={handlePlanClick}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center ${
                  plan.popular
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 shadow-lg hover:shadow-xl'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                {plan.cta}
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>

              {/* Additional info for free plan */}
              {index === 0 && (
                <p className="text-center text-sm text-gray-500 mt-4">
                  {t('landing.pricing.features.noCredit')}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* FAQ link */}
        <div className="text-center mt-16">
          <p className="text-gray-600">
            {t('landing.pricing.questions')}{' '}
            <button
              onClick={() => {
                const faqSection = document.getElementById('faq');
                if (faqSection) {
                  faqSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="text-gray-900 font-medium hover:underline"
            >
              {t('landing.pricing.checkFaq')}
            </button>
            {' '}{t('landing.pricing.or')}{' '}
            <a
              href="mailto:support@comptario.com"
              className="text-gray-900 font-medium hover:underline"
            >
              {t('landing.pricing.contactSupport')}
            </a>
          </p>
        </div>

        {/* Money back guarantee */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center px-6 py-3 rounded-full bg-green-100 text-green-700">
            <Check className="h-5 w-5 mr-2" />
            <span className="text-sm font-medium">
              {t('landing.pricing.guarantee')}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;