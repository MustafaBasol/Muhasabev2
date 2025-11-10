import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Cookie, Settings } from 'lucide-react';
import { COMPANY_LEGAL } from '../../constants/companyLegal';
import { useCookieConsent } from '../../contexts/CookieConsentContext';

const CookiePolicy: React.FC = () => {
  const { i18n } = useTranslation('common');
  const { openModal } = useCookieConsent();
  const currentLang = i18n.language;

  // Hash ile doğrudan açılışı bu sayfadan da garantiye al
  useEffect(() => {
    try {
      if (window.location.hash === '#cookie-preferences') { openModal(); }
      const onHash = () => {
        const h = window.location.hash;
        if (h === '#cookie-preferences') { openModal(); }
      };
      window.addEventListener('hashchange', onHash);
      return () => window.removeEventListener('hashchange', onHash);
    } catch {}
  }, [openModal]);

  // Content by language
  const content = {
    tr: {
      title: "Çerez Politikası",
      subtitle: "Web sitemizde çerezleri nasıl kullandığımız ve yönetebileceğiniz",
      preferencesTitle: "Çerez Tercihlerinizi Yönetin",
      preferencesDescription: "Hangi çerezlerin saklanacağını seçebilirsiniz. Kişiselleştirme için bazı çerezler gereklidir.",
      manageButton: "Çerez Tercihlerini Yönet",
      sections: {
        whatAre: {
          title: "Çerezler Nedir?",
          content: "Çerezler, web sitesi ziyaretiniz sırasında tarayıcınızda saklanan küçük veri dosyalarıdır. Bu dosyalar, web sitesinin düzgün çalışması ve size daha iyi bir deneyim sunması için kullanılır."
        },
        howWeUse: {
          title: "Çerezleri Nasıl Kullanıyoruz?",
          content: "Comptario olarak çerezleri şu amaçlarla kullanıyoruz: oturum yönetimi, kullanıcı tercihlerini hatırlama, site performansını analiz etme ve güvenliği sağlama."
        },
        consentMode: {
          title: "Onay Modu (Consent Mode)",
          content: "Google Consent Mode v2 ve benzeri mekanizmaları destekliyoruz. Tercihleriniz doğrultusunda ölçüm/analitik etiketleri uyarlanır; onay verilmeden gerekli olmayan çerezler yerleştirilmez. Tercihlerinizi bu sayfadaki butonla dilediğiniz an güncelleyebilirsiniz."
        },
        thirdParty: {
          title: "Üçüncü Taraf Çerezleri",
          content: "Bazı hizmetlerimiz için güvenilir üçüncü taraf sağlayıcılardan çerezler kullanıyoruz:",
          partners: {
            title: "İş Ortaklarımız:",
            analytics: "Web sitesi kullanım istatistikleri",
            payments: "Güvenli ödeme işlemleri",
            support: "Müşteri destek hizmetleri"
          }
        },
        managing: {
          title: "Çerezleri Yönetme",
          content: "Çerez tercihlerinizi istediğiniz zaman değiştirebilirsiniz. Ayrıca tarayıcı ayarlarından da çerezleri yönetebilirsiniz:",
          browsers: {
            chrome: "Ayarlar > Gizlilik ve Güvenlik > Çerezler",
            firefox: "Ayarlar > Gizlilik ve Güvenlik > Çerezler ve Site Verileri",
            safari: "Tercihler > Gizlilik > Çerezleri Yönet",
            edge: "Ayarlar > Çerezler ve Site İzinleri"
          }
        }
      },
      contact: {
        title: "İletişim",
        email: "E-posta",
        cmp: "Çerez Yönetimi",
        cmpNote: "Yukarıdaki butonu kullanarak tercihlerinizi değiştirebilirsiniz",
        privacyEmail: COMPANY_LEGAL.dataProtectionEmail || 'privacy@comptario.com'
      },
      backToApp: "Uygulamaya Geri Dön"
    },
    en: {
      title: "Cookie Policy",
      subtitle: "How we use cookies on our website and how you can manage them",
      preferencesTitle: "Manage Your Cookie Preferences",
      preferencesDescription: "You can choose which cookies to store. Some cookies are necessary for personalization.",
      manageButton: "Manage Cookie Preferences",
      sections: {
        whatAre: {
          title: "What Are Cookies?",
          content: "Cookies are small data files stored in your browser during your website visit. These files are used to help the website function properly and provide you with a better experience."
        },
        howWeUse: {
          title: "How We Use Cookies?",
          content: "At Comptario, we use cookies for the following purposes: session management, remembering user preferences, analyzing site performance, and ensuring security."
        },
        consentMode: {
          title: "Consent Mode",
          content: "We support Google Consent Mode v2 and similar frameworks. Measurement/analytics tags adapt to your choices; non-essential cookies are not set before consent. You can update your preferences at any time using the button above."
        },
        thirdParty: {
          title: "Third-Party Cookies",
          content: "We use cookies from trusted third-party providers for some of our services:",
          partners: {
            title: "Our Partners:",
            analytics: "Website usage statistics",
            payments: "Secure payment processing",
            support: "Customer support services"
          }
        },
        managing: {
          title: "Managing Cookies",
          content: "You can change your cookie preferences at any time. You can also manage cookies through your browser settings:",
          browsers: {
            chrome: "Settings > Privacy and Security > Cookies",
            firefox: "Settings > Privacy and Security > Cookies and Site Data",
            safari: "Preferences > Privacy > Manage Cookies",
            edge: "Settings > Cookies and Site Permissions"
          }
        }
      },
      contact: {
        title: "Contact",
        email: "Email",
        cmp: "Cookie Management",
        cmpNote: "You can change your preferences using the button above",
        privacyEmail: COMPANY_LEGAL.dataProtectionEmail || 'privacy@comptario.com'
      },
      backToApp: "Back to App"
    },
    de: {
      title: "Cookie-Richtlinie",
      subtitle: "Wie wir Cookies auf unserer Website verwenden und wie Sie sie verwalten können",
      preferencesTitle: "Verwalten Sie Ihre Cookie-Einstellungen",
      preferencesDescription: "Sie können wählen, welche Cookies gespeichert werden sollen. Einige Cookies sind für die Personalisierung notwendig.",
      manageButton: "Cookie-Einstellungen verwalten",
      sections: {
        whatAre: {
          title: "Was sind Cookies?",
          content: "Cookies sind kleine Datendateien, die während Ihres Website-Besuchs in Ihrem Browser gespeichert werden. Diese Dateien werden verwendet, um der Website beim ordnungsgemäßen Funktionieren zu helfen und Ihnen eine bessere Erfahrung zu bieten."
        },
        howWeUse: {
          title: "Wie verwenden wir Cookies?",
          content: "Bei Comptario verwenden wir Cookies für folgende Zwecke: Sitzungsverwaltung, Benutzereinstellungen merken, Site-Performance analysieren und Sicherheit gewährleisten."
        },
        consentMode: {
          title: "Einwilligungsmodus",
          content: "Wir unterstützen den Google Consent Mode v2 und ähnliche Rahmenwerke. Mess-/Analyse-Tags passen sich Ihren Entscheidungen an; nicht notwendige Cookies werden ohne Einwilligung nicht gesetzt. Sie können Ihre Einstellungen jederzeit über die oben stehende Schaltfläche ändern."
        },
        thirdParty: {
          title: "Drittanbieter-Cookies",
          content: "Wir verwenden Cookies von vertrauenswürdigen Drittanbietern für einige unserer Dienste:",
          partners: {
            title: "Unsere Partner:",
            analytics: "Website-Nutzungsstatistiken",
            payments: "Sichere Zahlungsabwicklung",
            support: "Kundensupport-Services"
          }
        },
        managing: {
          title: "Cookies verwalten",
          content: "Sie können Ihre Cookie-Einstellungen jederzeit ändern. Sie können Cookies auch über Ihre Browser-Einstellungen verwalten:",
          browsers: {
            chrome: "Einstellungen > Datenschutz und Sicherheit > Cookies",
            firefox: "Einstellungen > Datenschutz und Sicherheit > Cookies und Website-Daten",
            safari: "Einstellungen > Datenschutz > Cookies verwalten",
            edge: "Einstellungen > Cookies und Website-Berechtigungen"
          }
        }
      },
      contact: {
        title: "Kontakt",
        email: "E-Mail",
        cmp: "Cookie-Verwaltung",
        cmpNote: "Sie können Ihre Einstellungen über die obige Schaltfläche ändern",
        privacyEmail: COMPANY_LEGAL.dataProtectionEmail || 'privacy@comptario.com'
      },
      backToApp: "Zurück zur App"
    },
    fr: {
      title: "Politique des cookies",
      subtitle: "Comment nous utilisons les cookies sur notre site web et comment vous pouvez les gérer",
      preferencesTitle: "Gérez vos préférences de cookies",
      preferencesDescription: "Vous pouvez choisir quels cookies stocker. Certains cookies sont nécessaires pour la personnalisation.",
      manageButton: "Gérer les préférences de cookies",
      sections: {
        whatAre: {
          title: "Que sont les cookies ?",
          content: "Les cookies sont de petits fichiers de données stockés dans votre navigateur lors de votre visite sur le site web. Ces fichiers sont utilisés pour aider le site web à fonctionner correctement et vous offrir une meilleure expérience."
        },
        howWeUse: {
          title: "Comment utilisons-nous les cookies ?",
          content: "Chez Comptario, nous utilisons les cookies aux fins suivantes : gestion de session, mémorisation des préférences utilisateur, analyse des performances du site et assurance de la sécurité."
        },
        consentMode: {
          title: "Mode de consentement",
          content: "Nous prenons en charge Google Consent Mode v2 et des cadres similaires. Les balises de mesure/analyse s'adaptent à vos choix ; les cookies non essentiels ne sont pas déposés avant consentement. Vous pouvez mettre à jour vos préférences à tout moment via le bouton ci-dessus."
        },
        thirdParty: {
          title: "Cookies tiers",
          content: "Nous utilisons des cookies de fournisseurs tiers de confiance pour certains de nos services :",
          partners: {
            title: "Nos partenaires :",
            analytics: "Statistiques d'utilisation du site web",
            payments: "Traitement sécurisé des paiements",
            support: "Services de support client"
          }
        },
        managing: {
          title: "Gestion des cookies",
          content: "Vous pouvez modifier vos préférences de cookies à tout moment. Vous pouvez également gérer les cookies via les paramètres de votre navigateur :",
          browsers: {
            chrome: "Paramètres > Confidentialité et sécurité > Cookies",
            firefox: "Paramètres > Confidentialité et sécurité > Cookies et données de site",
            safari: "Préférences > Confidentialité > Gérer les cookies",
            edge: "Paramètres > Cookies et autorisations de site"
          }
        }
      },
      contact: {
        title: "Contact",
        email: "Email",
        cmp: "Gestion des cookies",
        cmpNote: "Vous pouvez modifier vos préférences en utilisant le bouton ci-dessus",
        privacyEmail: COMPANY_LEGAL.dataProtectionEmail || 'privacy@comptario.com'
      },
      backToApp: "Retour à l'application"
    }
  };

  const activeContent = content[currentLang as keyof typeof content] || content.en;

  return (
    <div className="bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
              <Cookie className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {activeContent.title}
          </h1>
          <p className="text-lg text-gray-600">
            {activeContent.subtitle}
          </p>
        </div>

        {/* Cookie Preferences Button */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center justify-center">
              <Settings className="h-6 w-6 mr-2 text-blue-600" />
              {activeContent.preferencesTitle}
            </h2>
            <p className="text-gray-600 mb-6">
              {activeContent.preferencesDescription}
            </p>
            <button
              onClick={() => {
                // Çoklu tetikleme: context + event + hash
                try { openModal(); } catch {}
                try { window.dispatchEvent(new Event('open-cookie-preferences')); } catch {}
                try { window.location.hash = 'cookie-preferences'; } catch {}
              }}
              className="relative px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              data-testid="open-cookie-preferences"
            >
              {activeContent.manageButton}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="prose prose-lg max-w-none">
            {/* Section 1: What are Cookies */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.sections.whatAre.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.whatAre.content}
              </p>
            </section>

            {/* Section 2: How We Use Cookies */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.sections.howWeUse.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.howWeUse.content}
              </p>
            </section>

              {/* Section 2.5: Consent Mode */}
              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  {activeContent.sections.consentMode.title}
                </h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  {activeContent.sections.consentMode.content}
                </p>
              </section>

            {/* Section 3: Third-Party Cookies */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.sections.thirdParty.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.thirdParty.content}
              </p>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <h4 className="font-semibold text-yellow-800 mb-2">
                  {activeContent.sections.thirdParty.partners.title}
                </h4>
                <ul className="text-yellow-700 text-sm space-y-1">
                  <li>• Google Analytics - {activeContent.sections.thirdParty.partners.analytics}</li>
                  <li>• Stripe - {activeContent.sections.thirdParty.partners.payments}</li>
                  <li>• Intercom - {activeContent.sections.thirdParty.partners.support}</li>
                </ul>
              </div>
            </section>

            {/* Section 4: Managing Cookies */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.sections.managing.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.managing.content}
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Chrome</h4>
                  <p className="text-gray-600 text-sm">{activeContent.sections.managing.browsers.chrome}</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Firefox</h4>
                  <p className="text-gray-600 text-sm">{activeContent.sections.managing.browsers.firefox}</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Safari</h4>
                  <p className="text-gray-600 text-sm">{activeContent.sections.managing.browsers.safari}</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Edge</h4>
                  <p className="text-gray-600 text-sm">{activeContent.sections.managing.browsers.edge}</p>
                </div>
              </div>
            </section>

            {/* Section 5: Contact */}
            <section className="border-t border-gray-200 pt-8 mt-12">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.contact.title}
              </h2>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-700 mb-2">
                  <strong>{activeContent.contact.email}:</strong> privacy@comptario.com
                </p>
                <p className="text-gray-700">
                  <strong>{activeContent.contact.cmp}:</strong> {activeContent.contact.cmpNote}
                </p>
                <p className="text-gray-700 mb-2">
                  <strong>{currentLang.startsWith('tr') ? 'Veri Koruma:' : currentLang.startsWith('de') ? 'Datenschutz:' : currentLang.startsWith('fr') ? 'Protection des données :' : 'Data Protection:'}</strong> {activeContent.contact.privacyEmail}
                </p>
              </div>
            </section>
          </div>
        </div>

        {/* Back to app link */}
        <div className="text-center mt-8">
          <a
            href="#"
            onClick={() => window.history.back()}
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
          >
            ← {activeContent.backToApp}
          </a>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicy;