import React from 'react';
import { Calculator, Mail, Globe, Shield } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

const LandingFooter: React.FC = () => {
  const { currentLanguage, changeLanguage, languages } = useLanguage();
  const currentYear = new Date().getFullYear();

  // Çeviri metinleri - dil bazında
  const texts = {
    tr: {
      product: 'ÜRÜN',
      features: 'Özellikler',
      pricing: 'Fiyatlar',
      security: 'Güvenlik',
      api: 'API',
      company: 'ŞİRKET',
      about: 'Hakkında',
  // Removed: Blog, Kariyer, Basın
      support: 'DESTEK',
      helpCenter: 'Yardım Merkezi',
      contactUs: 'İletişim',
  // status kaldırıldı
      community: 'Topluluk',
      legal: 'HUKUKİ',
      privacy: 'Gizlilik Politikası',
      terms: 'Hizmet Şartları',
      cookies: 'Çerez Politikası',
      subprocessors: 'Alt İşleyiciler',
      description: 'Modern işletmeler için basit, güvenli ön muhasebe yazılımı. Faturaları, giderleri ve KDV\'yi güvenle yönetin.',
      email: 'support@comptario.com',
      languages: '4 dilde mevcut',
      gdprCompliant: 'GDPR Uyumlu',
      stayUpdated: 'Güncel kalın',
      updatesDesc: 'Yeni özellikler ve en iyi uygulamalar hakkında güncellemeler alın.',
      emailPlaceholder: 'E-posta adresinizi girin',
      subscribe: 'Abone Ol',
      copyright: `© ${currentYear} Comptario. Tüm hakları saklıdır.`,
      madeWith: 'Avrupa\'da ❤️ ile yapıldı'
    },
    en: {
      product: 'PRODUCT',
      features: 'Features',
      pricing: 'Pricing',
      security: 'Security',
      api: 'API',
      company: 'COMPANY',
      about: 'About',
  // Removed: Blog, Careers, Press
      support: 'SUPPORT',
      helpCenter: 'Help Center',
      contactUs: 'Contact Us',
  // status removed
      community: 'Community',
      legal: 'LEGAL',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      cookies: 'Cookie Policy',
      subprocessors: 'Subprocessors',
      description: 'Simple, secure pre-accounting software for modern businesses. Manage invoices, expenses, and VAT with confidence.',
      email: 'support@comptario.com',
      languages: 'Available in 4 languages',
      gdprCompliant: 'GDPR Compliant',
      stayUpdated: 'Stay updated',
      updatesDesc: 'Get the latest updates on new features and best practices.',
      emailPlaceholder: 'Enter your email',
      subscribe: 'Subscribe',
      copyright: `© ${currentYear} Comptario. All rights reserved.`,
      madeWith: 'Made with ❤️ in Europe'
    },
    de: {
      product: 'PRODUKT',
      features: 'Funktionen',
      pricing: 'Preise',
      security: 'Sicherheit',
      api: 'API',
      company: 'UNTERNEHMEN',
      about: 'Über uns',
  // Removed: Blog, Karriere, Presse
      support: 'SUPPORT',
      helpCenter: 'Hilfe Center',
      contactUs: 'Kontakt',
  // status entfernt
      community: 'Community',
      legal: 'RECHTLICHES',
      privacy: 'Datenschutz',
      terms: 'Nutzungsbedingungen',
      cookies: 'Cookie-Richtlinie',
      subprocessors: 'Unterauftragsverarbeiter',
      description: 'Einfache, sichere Vorbuchhaltungssoftware für moderne Unternehmen. Verwalten Sie Rechnungen, Ausgaben und MwSt. mit Vertrauen.',
      email: 'support@comptario.com',
      languages: 'In 4 Sprachen verfügbar',
      gdprCompliant: 'DSGVO-konform',
      stayUpdated: 'Bleiben Sie auf dem Laufenden',
      updatesDesc: 'Erhalten Sie die neuesten Updates zu neuen Funktionen und bewährten Praktiken.',
      emailPlaceholder: 'E-Mail eingeben',
      subscribe: 'Abonnieren',
      copyright: `© ${currentYear} Comptario. Alle Rechte vorbehalten.`,
      madeWith: 'Mit ❤️ in Europa gemacht'
    },
    fr: {
      product: 'PRODUIT',
      features: 'Fonctionnalités',
      pricing: 'Prix',
      security: 'Sécurité',
      api: 'API',
      company: 'ENTREPRISE',
      about: 'À propos',
  // Removed: Blog, Carrières, Presse
      support: 'SUPPORT',
      helpCenter: 'Centre d\'aide',
      contactUs: 'Nous contacter',
  // statut retiré
      community: 'Communauté',
      legal: 'JURIDIQUE',
      privacy: 'Politique de confidentialité',
      terms: 'Conditions de service',
      cookies: 'Politique des cookies',
      subprocessors: 'Sous-traitants',
      description: 'Logiciel de pré-comptabilité simple et sécurisé pour les entreprises modernes. Gérez les factures, les dépenses et la TVA en toute confiance.',
      email: 'support@comptario.com',
      languages: 'Disponible en 4 langues',
      gdprCompliant: 'Conforme RGPD',
      stayUpdated: 'Restez informé',
      updatesDesc: 'Recevez les dernières mises à jour sur les nouvelles fonctionnalités et les meilleures pratiques.',
      emailPlaceholder: 'Entrez votre e-mail',
      subscribe: 'S\'abonner',
      copyright: `© ${currentYear} Comptario. Tous droits réservés.`,
      madeWith: 'Fait avec ❤️ en Europe'
    }
  };

  const t = texts[currentLanguage];

  const footerLinks = [
    {
      title: t.product,
      links: [
        { name: t.features, href: '#features' },
        { name: t.pricing, href: '#pricing' },
        { name: t.security, href: '#security' },
        { name: t.api, href: '#api' }
      ]
    },
    {
      title: t.company,
      links: [
        { name: t.about, href: '#about' }
      ]
    },
    {
      title: t.support,
      links: [
        { name: t.helpCenter, href: '#help' },
        { name: t.contactUs, href: 'mailto:support@comptario.com' }
      ]
    },
    {
      title: t.legal,
      links: [
        { name: t.privacy, href: '#legal/privacy' },
        { name: t.terms, href: '#legal/terms' },
        { name: t.cookies, href: '#legal/cookies' },
        { name: 'DPA', href: '#legal/dpa' },
        { name: t.subprocessors, href: '#legal/subprocessors' }
      ]
    }
  ];  const scrollToSection = (href: string) => {
    if (href.startsWith('#legal/')) {
      // Legal pages - navigate using hash routing
      window.location.hash = href;
    } else if (href === '#help') {
      // Help Center route
      window.location.hash = 'help';
    } else if (href === '#about') {
      // About page route
      window.location.hash = 'about';
    } else if (href === '#api') {
      // API page route
      window.location.hash = 'api';
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
              {t.description}
            </p>
            
            {/* Contact info */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-gray-400">
                <Mail className="h-4 w-4" />
                <a href="mailto:support@comptario.com" className="hover:text-white transition-colors">
                  {t.email}
                </a>
              </div>
              <div className="flex items-center space-x-3 text-gray-400">
                <Globe className="h-4 w-4" />
                <span>{t.languages}</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-400">
                <Shield className="h-4 w-4" />
                <span>{t.gdprCompliant}</span>
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

        {/* Newsletter signup kaldırıldı */}

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center">
          <div className="text-gray-400 text-sm">
            {t.copyright}
          </div>
          
          <div className="flex items-center space-x-6 mt-4 md:mt-0">
            <div className="text-gray-400 text-sm">
              {t.madeWith}
            </div>
            
            {/* Language selector */}
            <div className="flex items-center space-x-2">
              <Globe className="h-4 w-4 text-gray-400" />
              <div className="flex items-center space-x-1">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={`px-2 py-1 rounded text-sm transition-colors ${
                      currentLanguage === lang.code
                        ? 'bg-white text-gray-900'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title={lang.name}
                  >
                    {lang.flag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;