import React from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Quote } from 'lucide-react';

const Testimonials: React.FC = () => {
  const { t } = useTranslation();

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: t('landing.testimonials.sarah.role'),
      company: t('landing.testimonials.sarah.company'),
      content: t('landing.testimonials.sarah.content'),
      rating: 5,
      avatar: '👩‍💼'
    },
    {
      name: 'Marcus Weber',
      role: t('landing.testimonials.marcus.role'),
      company: t('landing.testimonials.marcus.company'),
      content: t('landing.testimonials.marcus.content'),
      rating: 5,
      avatar: '👨‍💻'
    },
    {
      name: 'Elena Rodriguez',
      role: t('landing.testimonials.elena.role'),
      company: t('landing.testimonials.elena.company'),
      content: t('landing.testimonials.elena.content'),
      rating: 5,
      avatar: '👩‍🍳'
    }
  ];

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {t('landing.testimonials.title')}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {t('landing.testimonials.subtitle')}
          </p>
        </div>

        {/* Testimonials grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-300 relative"
            >
              {/* Quote icon */}
              <div className="absolute top-6 right-6 text-gray-200">
                <Quote className="h-8 w-8" />
              </div>

              {/* Rating */}
              <div className="flex items-center mb-4">
                {[...Array(testimonial.rating)].map((_, starIndex) => (
                  <Star
                    key={starIndex}
                    className="h-5 w-5 text-yellow-400 fill-current"
                  />
                ))}
              </div>

              {/* Content */}
              <blockquote className="text-gray-700 mb-6 leading-relaxed">
                "{testimonial.content}"
              </blockquote>

              {/* Author */}
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-2xl mr-4">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {testimonial.role}, {testimonial.company}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust indicators */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center space-x-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">4.9/5</div>
              <div className="text-sm text-gray-600">{t('landing.testimonials.stats.rating')}</div>
            </div>
            <div className="w-px h-12 bg-gray-300"></div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">10,000+</div>
              <div className="text-sm text-gray-600">{t('landing.testimonials.stats.customers')}</div>
            </div>
            <div className="w-px h-12 bg-gray-300"></div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">50+</div>
              <div className="text-sm text-gray-600">{t('landing.testimonials.stats.countries')}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;