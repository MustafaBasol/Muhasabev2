import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calculator, Mail, Globe, Shield } from 'lucide-react';

const LandingFooter: React.FC = () => {
  const { t, ready } = useTranslation('common');
  const currentYear = new Date().getFullYear();

  // Don't render until translations are ready
  if (!ready) {
    return (
      <footer id="contact" className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center text-gray-400">
            Loading footer...
          </div>
        </div>
      </footer>
    );
  }



  const footerLinks = [
    {
      title: t('footer.product', 'PRODUCT'),
      links: [
        { name: t('footer.features', 'Features'), href: '#features' },
        { name: t('footer.pricing', 'Pricing'), href: '#pricing' },
        { name: t('footer.security', 'Security'), href: '#security' },
        { name: t('footer.api', 'API'), href: '#' }
      ]
    },
    {
      title: t('footer.company', 'COMPANY'),
      links: [
        { name: t('footer.about', 'About'), href: '#' },
        { name: t('footer.blog', 'Blog'), href: '#' },
        { name: t('footer.careers', 'Careers'), href: '#' },
        { name: t('footer.press', 'Press'), href: '#' }
      ]
    },
    {
      title: t('footer.support', 'SUPPORT'),
      links: [
        { name: t('footer.helpCenter', 'Help Center'), href: '#' },
        { name: t('footer.contactUs', 'Contact Us'), href: 'mailto:support@comptario.com' },
        { name: t('footer.status', 'Status'), href: '#' },
        { name: t('footer.community', 'Community'), href: '#' }
      ]
    },
    {
      title: t('footer.legal', 'LEGAL'),
      links: [
        { name: t('footer.privacy', 'Privacy Policy'), href: '#legal/privacy' },
        { name: t('footer.terms', 'Terms of Service'), href: '#legal/terms' },
        { name: t('footer.cookies', 'Cookie Policy'), href: '#legal/cookies' },
        { name: 'DPA', href: '#legal/dpa' }
      ]
    }
  ];  const scrollToSection = (href: string) => {
    if (href.startsWith('#legal/')) {
      // Legal pages - navigate using hash routing
      window.location.hash = href;
    } else if (href.startsWith('#')) {
      // Normal scroll to section
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <footer id="contact" className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Main footer content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
          {/* Company info */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <Calculator className="h-5 w-5 text-gray-900" />
              </div>
              <span className="text-xl font-bold">Comptario</span>
            </div>
            <p className="text-gray-400 mb-6 leading-relaxed">
              {t('footer.description', 'Simple, secure pre-accounting software for modern businesses. Manage invoices, expenses, and VAT with confidence.')}
            </p>
            
            {/* Contact info */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-gray-400">
                <Mail className="h-4 w-4" />
                <a href="mailto:support@comptario.com" className="hover:text-white transition-colors">
                  {t('footer.email', 'support@comptario.com')}
                </a>
              </div>
              <div className="flex items-center space-x-3 text-gray-400">
                <Globe className="h-4 w-4" />
                <span>{t('footer.languages', 'Available in 4 languages')}</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-400">
                <Shield className="h-4 w-4" />
                <span>{t('footer.gdprCompliant', 'GDPR Compliant')}</span>
              </div>
            </div>
          </div>

          {/* Footer links */}
          {footerLinks.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">
                {section.title}
              </h3>
              <ul className="space-y-3">
                {section.links.map((link, index) => (
                  <li key={index}>
                    {link.href.startsWith('#') ? (
                      <button
                        onClick={() => scrollToSection(link.href)}
                        className="text-gray-400 hover:text-white transition-colors text-sm"
                      >
                        {link.name}
                      </button>
                    ) : (
                      <a
                        href={link.href}
                        className="text-gray-400 hover:text-white transition-colors text-sm"
                        {...(link.href.startsWith('mailto:') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                      >
                        {link.name}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter signup */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="max-w-md">
            <h3 className="text-lg font-semibold text-white mb-2">
              {t('footer.stayUpdated', 'Stay updated')}
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              {t('footer.updatesDesc', 'Get the latest updates on new features and best practices.')}
            </p>
            <div className="flex space-x-3">
              <input
                type="email"
                placeholder={t('footer.emailPlaceholder', 'Enter your email')}
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
              />
              <button className="bg-white text-gray-900 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors whitespace-nowrap">
                {t('footer.subscribe', 'Subscribe')}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center">
          <div className="text-gray-400 text-sm">
            {t('footer.copyright', { year: currentYear, defaultValue: `© ${currentYear} Comptario. All rights reserved.` })}
          </div>
          
          <div className="flex items-center space-x-6 mt-4 md:mt-0">
            <div className="text-gray-400 text-sm">
              {t('footer.madeWith', 'Made with ❤️ in Europe')}
            </div>
            
            {/* Language selector (simplified) */}
            <div className="flex items-center space-x-2 text-gray-400 text-sm">
              <Globe className="h-4 w-4" />
              <span>🇬🇧 🇹🇷 🇩🇪 🇫🇷</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;