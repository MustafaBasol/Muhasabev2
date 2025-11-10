import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Eye, Database, Lock, Users, Globe } from 'lucide-react';
import { COMPANY_LEGAL } from '../../constants/companyLegal';

const PrivacyPolicy: React.FC = () => {
  const { i18n } = useTranslation('common');
  const currentLang = i18n.language;

  // Content by language
  const content = {
    tr: {
      title: "Gizlilik Politikası",
      subtitle: "Kişisel verilerinizi nasıl topladığımız, kullandığımız ve koruduğumuz",
      sections: {
        introduction: {
          title: "Giriş",
          content: "Comptario olarak, gizliliğinizi ciddiye alıyoruz. Bu gizlilik politikası, kişisel verilerinizi nasıl topladığımızı, kullandığımızı, paylaştığımızı ve koruduğumuzu açıklar."
        },
        dataController: {
          title: "Veri Sorumlusu",
          content: `Veri sorumlusu: ${COMPANY_LEGAL.companyName}. Adres: ${COMPANY_LEGAL.address}. İletişim: ${COMPANY_LEGAL.dataProtectionEmail || COMPANY_LEGAL.email || 'privacy@comptario.com'}`
        },
        dataCollection: {
          title: "Topladığımız Veriler",
          personal: {
            title: "Kişisel Bilgiler",
            items: [
              "Adınız ve soyadınız",
              "E-posta adresiniz", 
              "Şirket adınız",
              "Telefon numaranız (isteğe bağlı)"
            ]
          },
          business: {
            title: "İş Verileri", 
            items: [
              "Fatura bilgileri ve müşteri verileri",
              "Gider kayıtları ve tedarikçi bilgileri",
              "Müşteri iletişim bilgileri",
              "Finansal raporlar ve vergi bilgileri"
            ]
          }
        },
        dataUsage: {
          title: "Verileri Nasıl Kullanıyoruz",
          items: [
            "Muhasebe hizmetlerini sağlamak",
            "Müşteri desteği sunmak",
            "Hizmetlerimizi geliştirmek",
            "Yasal yükümlülüklerimizi yerine getirmek"
          ]
        },
        dataSecurity: {
          title: "Veri Güvenliği",
          content: "Verilerinizi korumak için endüstri standardı güvenlik önlemleri alıyoruz.",
          items: [
            "SSL/TLS şifreleme",
            "Sınırlı erişim kontrolleri",
            "Sürekli güvenlik izleme",
            "Düzenli veri yedekleme"
          ]
        },
        legalBases: {
          title: "İşleme Hukuki Dayanakları (GDPR md. 6)",
          items: [
            "Açık rıza (md. 6/1-a)",
            "Sözleşmenin ifası için gereklilik (md. 6/1-b)",
            "Hukuki yükümlülüğe uyum (md. 6/1-c)",
            "Meşru menfaat (md. 6/1-f) – kullanıcı beklentileri ve gizlilikle dengelenmiştir"
          ]
        },
        dataRetention: {
          title: "Veri Saklama Süreleri",
          items: [
            "Hesap ve faturalama verileri: vergi mevzuatı gereği en az 10 yıl",
            "Destek kayıtları: en fazla 24 ay",
            "Analitik veriler: 14-26 ay arasında (araç ayarına bağlı)",
            "Çerez tercihleri: tercih süresi boyunca veya silinene kadar"
          ]
        },
        userRights: {
          title: "GDPR Haklarınız",
          content: "GDPR kapsamında aşağıdaki haklara sahipsiniz:",
          items: [
            "Verilerinize erişim hakkı",
            "Verilerin düzeltilmesi hakkı",
            "Verilerin silinmesi hakkı",
            "Veri taşınabilirliği hakkı"
          ]
        },
        complaints: {
          title: "Şikayet ve Başvuru",
          content: "Veri koruma haklarınızın ihlal edildiğini düşünüyorsanız, öncelikle bizimle iletişime geçebilirsiniz. Ayrıca ikamet ettiğiniz ülkedeki yetkili veri koruma otoritesine şikayette bulunma hakkına sahipsiniz."
        },
        contact: {
          title: "İletişim",
          content: "Gizlilik ile ilgili sorularınız için bizimle iletişime geçebilirsiniz:",
          email: COMPANY_LEGAL.dataProtectionEmail || "privacy@comptario.com"
        }
      }
    },
    en: {
      title: "Privacy Policy",
      subtitle: "How we collect, use, and protect your personal data",
      sections: {
        introduction: {
          title: "Introduction",
          content: "At Comptario, we take your privacy seriously. This privacy policy explains how we collect, use, share, and protect your personal data."
        },
        dataController: {
          title: "Data Controller",
          content: `Data Controller: ${COMPANY_LEGAL.companyName}. Address: ${COMPANY_LEGAL.address}. Contact: ${COMPANY_LEGAL.dataProtectionEmail || COMPANY_LEGAL.email || 'privacy@comptario.com'}`
        },
        dataCollection: {
          title: "Data We Collect",
          personal: {
            title: "Personal Information",
            items: [
              "Your name and surname",
              "Your email address",
              "Your company name", 
              "Your phone number (optional)"
            ]
          },
          business: {
            title: "Business Data",
            items: [
              "Invoice information and customer data",
              "Expense records and supplier information", 
              "Customer contact information",
              "Financial reports and tax information"
            ]
          }
        },
        dataUsage: {
          title: "How We Use Your Data",
          items: [
            "To provide accounting services",
            "To provide customer support",
            "To improve our services",
            "To fulfill our legal obligations"
          ]
        },
        dataSecurity: {
          title: "Data Security",
          content: "We implement industry-standard security measures to protect your data.",
          items: [
            "SSL/TLS encryption",
            "Limited access controls",
            "Continuous security monitoring",
            "Regular data backups"
          ]
        },
        legalBases: {
          title: "Legal Bases for Processing (GDPR Art. 6)",
          items: [
            "Consent (Art. 6(1)(a))",
            "Contract necessity (Art. 6(1)(b))",
            "Legal obligation (Art. 6(1)(c))",
            "Legitimate interests (Art. 6(1)(f)) — balanced with user privacy"
          ]
        },
        dataRetention: {
          title: "Data Retention",
          items: [
            "Account and invoicing data: at least 10 years due to tax laws",
            "Support tickets and communications: up to 24 months",
            "Analytics data: 14–26 months (tool configuration dependent)",
            "Cookie preferences: for the duration of your choice or until cleared"
          ]
        },
        userRights: {
          title: "Your GDPR Rights",
          content: "Under GDPR, you have the following rights:",
          items: [
            "Right to access your data",
            "Right to rectify your data",
            "Right to erase your data",
            "Right to data portability"
          ]
        },
        complaints: {
          title: "Complaints",
          content: "If you believe your data protection rights have been violated, please contact us first. You also have the right to lodge a complaint with your local data protection authority."
        },
        contact: {
          title: "Contact",
          content: "For privacy-related questions, please contact us:",
          email: COMPANY_LEGAL.dataProtectionEmail || "privacy@comptario.com"
        }
      }
    },
    de: {
      title: "Datenschutzrichtlinie",
      subtitle: "Wie wir Ihre personenbezogenen Daten sammeln, verwenden und schützen",
      sections: {
        introduction: {
          title: "Einführung",
          content: "Bei Comptario nehmen wir Ihre Privatsphäre ernst. Diese Datenschutzrichtlinie erklärt, wie wir Ihre personenbezogenen Daten sammeln, verwenden, teilen und schützen."
        },
        dataController: {
          title: "Verantwortlicher (Controller)",
          content: `Verantwortlicher: ${COMPANY_LEGAL.companyName}. Adresse: ${COMPANY_LEGAL.address}. Kontakt: ${COMPANY_LEGAL.dataProtectionEmail || COMPANY_LEGAL.email || 'privacy@comptario.com'}`
        },
        dataCollection: {
          title: "Daten, die wir sammeln",
          personal: {
            title: "Persönliche Informationen",
            items: [
              "Ihr Vor- und Nachname",
              "Ihre E-Mail-Adresse",
              "Ihr Firmenname",
              "Ihre Telefonnummer (optional)"
            ]
          },
          business: {
            title: "Geschäftsdaten",
            items: [
              "Rechnungsinformationen und Kundendaten",
              "Ausgabenaufzeichnungen und Lieferanteninformationen",
              "Kundenkontaktinformationen", 
              "Finanzberichte und Steuerinformationen"
            ]
          }
        },
        dataUsage: {
          title: "Wie wir Ihre Daten verwenden",
          items: [
            "Zur Bereitstellung von Buchhaltungsdiensten",
            "Zur Bereitstellung von Kundensupport",
            "Zur Verbesserung unserer Dienste",
            "Zur Erfüllung unserer rechtlichen Verpflichtungen"
          ]
        },
        dataSecurity: {
          title: "Datensicherheit",
          content: "Wir implementieren branchenübliche Sicherheitsmaßnahmen zum Schutz Ihrer Daten.",
          items: [
            "SSL/TLS-Verschlüsselung",
            "Begrenzte Zugriffskontrollen",
            "Kontinuierliche Sicherheitsüberwachung",
            "Regelmäßige Datensicherungen"
          ]
        },
        legalBases: {
          title: "Rechtsgrundlagen der Verarbeitung (Art. 6 DSGVO)",
          items: [
            "Einwilligung (Art. 6 Abs. 1 lit. a)",
            "Vertragserfüllung (Art. 6 Abs. 1 lit. b)",
            "Rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c)",
            "Berechtigte Interessen (Art. 6 Abs. 1 lit. f) — unter Wahrung der Privatsphäre"
          ]
        },
        dataRetention: {
          title: "Aufbewahrungsfristen",
          items: [
            "Konto- und Rechnungsdaten: mindestens 10 Jahre (Steuerrecht)",
            "Support-Kommunikation: bis zu 24 Monate",
            "Analysedaten: 14–26 Monate (werkzeugspezifisch)",
            "Cookie-Einstellungen: für die gewählte Dauer bzw. bis zur Löschung"
          ]
        },
        userRights: {
          title: "Ihre GDPR-Rechte",
          content: "Unter der GDPR haben Sie folgende Rechte:",
          items: [
            "Recht auf Zugang zu Ihren Daten",
            "Recht auf Berichtigung Ihrer Daten",
            "Recht auf Löschung Ihrer Daten",
            "Recht auf Datenübertragbarkeit"
          ]
        },
        complaints: {
          title: "Beschwerderecht",
          content: "Wenn Sie der Ansicht sind, dass Ihre Datenschutzrechte verletzt wurden, kontaktieren Sie uns bitte zunächst. Sie haben außerdem das Recht, eine Beschwerde bei der zuständigen Datenschutzaufsichtsbehörde einzureichen."
        },
        contact: {
          title: "Kontakt",
          content: "Für datenschutzbezogene Fragen kontaktieren Sie uns bitte:",
          email: COMPANY_LEGAL.dataProtectionEmail || "privacy@comptario.com"
        }
      }
    },
    fr: {
      title: "Politique de confidentialité",
      subtitle: "Comment nous collectons, utilisons et protégeons vos données personnelles",
      sections: {
        introduction: {
          title: "Introduction",
          content: "Chez Comptario, nous prenons votre vie privée au sérieux. Cette politique de confidentialité explique comment nous collectons, utilisons, partageons et protégeons vos données personnelles."
        },
        dataController: {
          title: "Responsable du traitement",
          content: `Responsable: ${COMPANY_LEGAL.companyName}. Adresse: ${COMPANY_LEGAL.address}. Contact: ${COMPANY_LEGAL.dataProtectionEmail || COMPANY_LEGAL.email || 'privacy@comptario.com'}`
        },
        dataCollection: {
          title: "Données que nous collectons",
          personal: {
            title: "Informations personnelles",
            items: [
              "Votre nom et prénom",
              "Votre adresse e-mail",
              "Le nom de votre entreprise",
              "Votre numéro de téléphone (optionnel)"
            ]
          },
          business: {
            title: "Données commerciales",
            items: [
              "Informations de facturation et données client",
              "Enregistrements de dépenses et informations fournisseur",
              "Informations de contact client",
              "Rapports financiers et informations fiscales"
            ]
          }
        },
        dataUsage: {
          title: "Comment nous utilisons vos données",
          items: [
            "Pour fournir des services comptables",
            "Pour fournir un support client",
            "Pour améliorer nos services", 
            "Pour respecter nos obligations légales"
          ]
        },
        dataSecurity: {
          title: "Sécurité des données",
          content: "Nous mettons en œuvre des mesures de sécurité standards de l'industrie pour protéger vos données.",
          items: [
            "Chiffrement SSL/TLS",
            "Contrôles d'accès limités",
            "Surveillance de sécurité continue",
            "Sauvegardes régulières des données"
          ]
        },
        legalBases: {
          title: "Bases légales du traitement (RGPD art. 6)",
          items: [
            "Consentement (art. 6(1)(a))",
            "Nécessité contractuelle (art. 6(1)(b))",
            "Obligation légale (art. 6(1)(c))",
            "Intérêts légitimes (art. 6(1)(f)) — équilibrés avec la vie privée"
          ]
        },
        dataRetention: {
          title: "Durées de conservation",
          items: [
            "Données de compte et de facturation : au moins 10 ans (obligations fiscales)",
            "Tickets de support : jusqu'à 24 mois",
            "Données analytiques : 14–26 mois (selon l'outil)",
            "Préférences cookies : pendant la durée choisie ou jusqu'à suppression"
          ]
        },
        userRights: {
          title: "Vos droits GDPR",
          content: "Sous le GDPR, vous avez les droits suivants:",
          items: [
            "Droit d'accès à vos données",
            "Droit de rectification de vos données",
            "Droit d'effacement de vos données",
            "Droit à la portabilité des données"
          ]
        },
        complaints: {
          title: "Réclamations",
          content: "Si vous estimez que vos droits en matière de protection des données ont été violés, veuillez d'abord nous contacter. Vous avez également le droit d'introduire une réclamation auprès de l'autorité de protection des données compétente."
        },
        contact: {
          title: "Contact",
          content: "Pour les questions liées à la confidentialité, veuillez nous contacter:",
          email: COMPANY_LEGAL.dataProtectionEmail || "privacy@comptario.com"
        }
      }
    }
  };

  const activeContent = content[currentLang as keyof typeof content] || content.en;

  return (
    <div className="bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <Shield className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {activeContent.title}
          </h1>
          <p className="text-lg text-gray-600">
            {activeContent.subtitle}
          </p>
          <div className="flex items-center justify-center mt-4 text-sm text-gray-500">
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium">
              GDPR Compliant
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="prose prose-lg max-w-none">
            {/* Section 1: Introduction */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <Eye className="h-6 w-6 mr-2 text-blue-600" />
                {activeContent.sections.introduction.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.introduction.content}
              </p>
            </section>

            {/* Section: Data Controller */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <Users className="h-6 w-6 mr-2 text-blue-600" />
                {activeContent.sections.dataController.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.dataController.content}
              </p>
            </section>

            {/* Section 2: Data We Collect */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <Database className="h-6 w-6 mr-2 text-orange-600" />
                {activeContent.sections.dataCollection.title}
              </h2>
              
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                {activeContent.sections.dataCollection.personal.title}
              </h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-6">
                {activeContent.sections.dataCollection.personal.items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                {activeContent.sections.dataCollection.business.title}
              </h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-6">
                {activeContent.sections.dataCollection.business.items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            {/* Section 3: How We Use Data */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <Lock className="h-6 w-6 mr-2 text-purple-600" />
                {activeContent.sections.dataUsage.title}
              </h2>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                {activeContent.sections.dataUsage.items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            {/* Section 4: Data Security */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <Shield className="h-6 w-6 mr-2 text-red-600" />
                {activeContent.sections.dataSecurity.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.dataSecurity.content}
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                {activeContent.sections.dataSecurity.items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            {/* Section: Legal Bases */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <Shield className="h-6 w-6 mr-2 text-green-600" />
                {activeContent.sections.legalBases.title}
              </h2>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                {activeContent.sections.legalBases.items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            {/* Section: Data Retention */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <Database className="h-6 w-6 mr-2 text-orange-600" />
                {activeContent.sections.dataRetention.title}
              </h2>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                {activeContent.sections.dataRetention.items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            {/* Section 5: Your Rights */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <Users className="h-6 w-6 mr-2 text-green-600" />
                {activeContent.sections.userRights.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.userRights.content}
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                {activeContent.sections.userRights.items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            {/* Section: Complaints */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <Globe className="h-6 w-6 mr-2 text-blue-600" />
                {activeContent.sections.complaints.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.complaints.content}
              </p>
            </section>

            {/* Section 6: Contact */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <Globe className="h-6 w-6 mr-2 text-blue-600" />
                {activeContent.sections.contact.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.contact.content}
              </p>
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                <p className="text-blue-800 font-medium">
                  {activeContent.sections.contact.email}
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;