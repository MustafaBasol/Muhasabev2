import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LandingNavbar from './LandingNavbar';
import Hero from './Hero';
import FeatureCards from './FeatureCards';
import Value from './Value';
import Security from './Security';
import Testimonials from './Testimonials';
import Pricing from './Pricing';
import FAQ from './FAQ';
import FinalCTA from './FinalCTA';
import LandingFooter from './LandingFooter';
import VideoModal from './VideoModal';

const LandingPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [showVideoModal, setShowVideoModal] = useState(false);
  
  const LOGIN_URL = import.meta.env.VITE_LOGIN_URL || "/login";
  const REGISTER_URL = import.meta.env.VITE_REGISTER_URL || "#register";

  // SEO meta tags
  useEffect(() => {
    document.title = t('landing.seo.title');
    
    // Meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', t('landing.seo.description'));
    } else {
      const newMetaDescription = document.createElement('meta');
      newMetaDescription.name = 'description';
      newMetaDescription.content = t('landing.seo.description');
      document.head.appendChild(newMetaDescription);
    }

    // Open Graph tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', t('landing.seo.title'));
    } else {
      const newOgTitle = document.createElement('meta');
      newOgTitle.setAttribute('property', 'og:title');
      newOgTitle.content = t('landing.seo.title');
      document.head.appendChild(newOgTitle);
    }

    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
      ogDescription.setAttribute('content', t('landing.seo.description'));
    } else {
      const newOgDescription = document.createElement('meta');
      newOgDescription.setAttribute('property', 'og:description');
      newOgDescription.content = t('landing.seo.description');
      document.head.appendChild(newOgDescription);
    }

    // Canonical URL
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', window.location.origin);
    } else {
      const newCanonicalLink = document.createElement('link');
      newCanonicalLink.rel = 'canonical';
      newCanonicalLink.href = window.location.origin;
      document.head.appendChild(newCanonicalLink);
    }

    // Language alternate links
    const languages = ['tr', 'en', 'de', 'fr'];
    languages.forEach(lang => {
      const existingLink = document.querySelector(`link[hreflang="${lang}"]`);
      if (existingLink) {
        existingLink.setAttribute('href', `${window.location.origin}?lang=${lang}`);
      } else {
        const hrefLangLink = document.createElement('link');
        hrefLangLink.rel = 'alternate';
        hrefLangLink.hreflang = lang;
        hrefLangLink.href = `${window.location.origin}?lang=${lang}`;
        document.head.appendChild(hrefLangLink);
      }
    });

    // JSON-LD for FAQ
    const faqJsonLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": t('landing.faq.q1'),
          "acceptedAnswer": {
            "@type": "Answer",
            "text": t('landing.faq.a1')
          }
        },
        {
          "@type": "Question",
          "name": t('landing.faq.q2'),
          "acceptedAnswer": {
            "@type": "Answer",
            "text": t('landing.faq.a2')
          }
        },
        {
          "@type": "Question",
          "name": t('landing.faq.q3'),
          "acceptedAnswer": {
            "@type": "Answer",
            "text": t('landing.faq.a3')
          }
        },
        {
          "@type": "Question",
          "name": t('landing.faq.q4'),
          "acceptedAnswer": {
            "@type": "Answer",
            "text": t('landing.faq.a4')
          }
        },
        {
          "@type": "Question",
          "name": t('landing.faq.q5'),
          "acceptedAnswer": {
            "@type": "Answer",
            "text": t('landing.faq.a5')
          }
        },
        {
          "@type": "Question",
          "name": t('landing.faq.q6'),
          "acceptedAnswer": {
            "@type": "Answer",
            "text": t('landing.faq.a6')
          }
        }
      ]
    };

    // Remove existing JSON-LD if any
    const existingJsonLd = document.querySelector('script[type="application/ld+json"]');
    if (existingJsonLd) {
      existingJsonLd.remove();
    }

    // Add new JSON-LD
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(faqJsonLd);
    document.head.appendChild(script);

    return () => {
      // Cleanup on unmount
      document.title = 'Comptario';
    };
  }, [t, i18n.language]);

  const handleTryForFree = () => {
    // Ücretsiz dene: kayıt sayfasına yönlendir
    if (REGISTER_URL.startsWith('#')) {
      // Hash routing
      window.location.hash = REGISTER_URL.replace('#', '');
    } else if (REGISTER_URL === '/register') {
      // Uyum için hash'e çevir
      window.location.hash = 'register';
    } else {
      // Harici/absolute URL
      window.location.href = REGISTER_URL;
    }
  };

  const handleSignIn = () => {
    // Hash routing kullanarak login sayfasına yönlendir
    if (LOGIN_URL === '/login' || LOGIN_URL.endsWith('#login')) {
      window.location.hash = '#login';
    } else {
      // External URL ise aynı sekmede aç
      window.location.href = LOGIN_URL;
    }
  };

  const handleWatchDemo = () => {
    setShowVideoModal(true);
  };

  // Skip-to-content link for accessibility
  const skipToContent = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const mainContent = document.getElementById('main-content');
      if (mainContent) {
        mainContent.focus();
        mainContent.scrollIntoView();
      }
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium"
        onKeyDown={skipToContent}
      >
        Skip to main content
      </a>

      {/* Navigation */}
      <LandingNavbar 
        onTryForFree={handleTryForFree}
        onSignIn={handleSignIn}
      />

      {/* Main Content */}
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <Hero 
          onTryForFree={handleTryForFree}
          onSignIn={handleSignIn}
          onWatchDemo={handleWatchDemo}
        />
        <FeatureCards />
        <Value />
        <Security />
        <Testimonials />
        {/* CTA butonları kayıt sayfasına götürmeli */}
        <Pricing loginUrl={REGISTER_URL} />
        <FAQ />
        <FinalCTA loginUrl={REGISTER_URL} />
      </main>

      {/* Footer */}
      <LandingFooter />

      {/* Video Modal */}
      {showVideoModal && (
        <VideoModal onClose={() => setShowVideoModal(false)} />
      )}
    </div>
  );
};

export default LandingPage;