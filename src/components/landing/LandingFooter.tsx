import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calculator, Mail, Globe, Shield } from 'lucide-react';

const LandingFooter: React.FC = () => {
  const { t } = useTranslation('common');
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    {
      title: t('footer.product'),
      links: [
        { name: t('footer.features'), href: '#features' },
        { name: t('footer.pricing'), href: '#pricing' },
        { name: t('footer.security'), href: '#security' },
        { name: t('footer.api'), href: '#' }
      ]
    },
    {
      title: t('footer.company'),
      links: [
        { name: t('footer.about'), href: '#' },
        { name: t('footer.blog'), href: '#' },
        { name: t('footer.careers'), href: '#' },
        { name: t('footer.press'), href: '#' }
      ]
    },
    {
      title: t('footer.support'),
      links: [
        { name: t('footer.helpCenter'), href: '#' },
        { name: t('footer.contactUs'), href: 'mailto:support@comptario.com' },
        { name: t('footer.status'), href: '#' },
        { name: t('footer.community'), href: '#' }
      ]
    },
    {
      title: t('footer.legal'),
      links: [
        { name: t('footer.privacy'), href: '#' },
        { name: t('footer.terms'), href: '#' },
        { name: t('footer.gdpr'), href: '#' },
        { name: t('footer.cookies'), href: '#' }
      ]
    }
  ];  const scrollToSection = (href: string) => {
    if (href.startsWith('#')) {
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
              {t('footer.description')}
            </p>
            
            {/* Contact info */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-gray-400">
                <Mail className="h-4 w-4" />
                <a href="mailto:support@comptario.com" className="hover:text-white transition-colors">
                  {t('footer.email')}
                </a>
              </div>
              <div className="flex items-center space-x-3 text-gray-400">
                <Globe className="h-4 w-4" />
                <span>{t('footer.languages')}</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-400">
                <Shield className="h-4 w-4" />
                <span>{t('footer.gdprCompliant')}</span>
              </div>
            </div>
          </div>

          {/* Footer links */}
          {Object.entries(footerLinks).map(([key, section]) => (
            <div key={key}>
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
              {t('footer.stayUpdated')}
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              {t('footer.updatesDesc')}
            </p>
            <div className="flex space-x-3">
              <input
                type="email"
                placeholder={t('footer.emailPlaceholder')}
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
              />
              <button className="bg-white text-gray-900 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors whitespace-nowrap">
                {t('footer.subscribe')}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center">
          <div className="text-gray-400 text-sm">
            {t('footer.copyright', { year: currentYear })}
          </div>
          
          <div className="flex items-center space-x-6 mt-4 md:mt-0">
            <div className="text-gray-400 text-sm">
              {t('footer.madeWith')}
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