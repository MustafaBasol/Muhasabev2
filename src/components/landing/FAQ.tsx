import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';

const FAQ: React.FC = () => {
  const { t } = useTranslation();
  const [openItem, setOpenItem] = useState<number | null>(0);

  const faqs = [
    {
      question: t('landing.faq.q1'),
      answer: t('landing.faq.a1')
    },
    {
      question: t('landing.faq.q2'),
      answer: t('landing.faq.a2')
    },
    {
      question: t('landing.faq.q3'),
      answer: t('landing.faq.a3')
    },
    {
      question: t('landing.faq.q4'),
      answer: t('landing.faq.a4')
    },
    {
      question: t('landing.faq.q5'),
      answer: t('landing.faq.a5')
    },
    {
      question: t('landing.faq.q6'),
      answer: t('landing.faq.a6')
    }
  ];

  const toggleItem = (index: number) => {
    setOpenItem(openItem === index ? null : index);
  };

  return (
    <section id="faq" className="py-16 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {t('landing.faq.title')}
          </h2>
          <p className="text-xl text-gray-600">
            {t('landing.faq.subtitle')}{' '}
            <a href="mailto:support@comptario.com" className="text-gray-900 font-medium hover:underline">{t('landing.faq.contactUs')}</a>.
          </p>
        </div>

        {/* FAQ items */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-blue-200 transition-colors"
            >
              <button
                onClick={() => toggleItem(index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                aria-expanded={openItem === index}
              >
                <span className="font-semibold text-gray-900 pr-4">
                  {faq.question}
                </span>
                {openItem === index ? (
                  <ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                )}
              </button>
              
              {openItem === index && (
                <div className="px-6 pb-4">
                  <p className="text-gray-700 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Additional help */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-2xl shadow-sm border border-blue-100">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              {t('landing.faq.support.title')}
            </h3>
            <p className="text-gray-600 mb-6">
              {t('landing.faq.support.desc')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:support@comptario.com"
                className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all duration-300 text-center shadow-lg hover:shadow-xl"
              >
                {t('landing.faq.support.contact')}
              </a>
              <button className="text-gray-700 hover:text-gray-900 px-6 py-3 font-semibold transition-colors">
                {t('landing.faq.support.demo')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQ;