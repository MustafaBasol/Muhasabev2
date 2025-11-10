import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Calendar, User, Shield } from 'lucide-react';
import { TERMS_LAST_UPDATED } from '../../constants/legal';
import { COMPANY_LEGAL } from '../../constants/companyLegal';

const TermsOfService: React.FC = () => {
  const { i18n } = useTranslation('common');
  const currentLang = i18n.language;

  // Content by language
  const content = {
    tr: {
      title: "Hizmet Şartları",
      subtitle: "Comptario muhasebe hizmetlerini kullanımınız için şartlar ve koşullar",
  lastUpdated: TERMS_LAST_UPDATED.tr,
      sections: {
        acceptance: {
          title: "Şartların Kabulü",
          content: "Bu hizmet şartları, Comptario muhasebe platformunu kullanımınızı düzenler. Hizmeti kullanarak bu şartları kabul etmiş sayılırsınız."
        },
        service: {
          title: "Hizmet Tanımı",
          content: "Comptario, küçük ve orta ölçekli işletmeler için bulut tabanlı muhasebe çözümleri sunar:",
          features: {
            invoicing: "Fatura oluşturma ve yönetimi",
            expenses: "Gider takibi ve kategorilendirme",
            reporting: "Finansal raporlama ve analiz",
            multiTenant: "Çoklu müşteri yönetimi"
          }
        },
        serviceEmails: {
          title: "Hizmet E-postaları",
          content: "E-posta iletişimi yalnızca işlem ve hesapla ilgili bildirimler (doğrulama, güvenlik uyarıları, faturalama gibi) için kullanılır. Pazarlama amaçlı toplu e-posta gönderilmez."
        },
        responsibilities: {
          title: "Kullanıcı Sorumlulukları",
          content: "Hizmetimizi kullanırken aşağıdaki sorumluluklarınız bulunmaktadır:",
          items: {
            accuracy: "Girdiğiniz verilerin doğruluğunu sağlamak",
            compliance: "Yasal düzenlemelere uyum göstermek",
            security: "Hesap güvenliğinizi korumak",
            backups: "Verilerinizin yedeklerini almak"
          }
        },
        dataProtection: {
          title: "Veri Koruma",
          content: "Kişisel verileriniz GDPR ve KVKK düzenlemelerine uygun olarak işlenir. Detaylı bilgi için gizlilik politikamızı inceleyiniz."
        },
        acceptableUse: {
          title: "Kabul Edilebilir Kullanım",
          items: [
            "Hizmet spam, kötü amaçlı yazılım dağıtımı veya yetkisiz veri toplama için kullanılamaz",
            "Hesap paylaşımı veya sistemin kötüye kullanımı yasaktır",
            "Hukuka aykırı içerik barındırılamaz veya iletilemez"
          ]
        },
        liability: {
          title: "Sorumluluk Sınırlaması",
          content: "Comptario, hizmet kesintileri veya veri kayıpları nedeniyle oluşabilecek dolaylı zararlardan sorumlu değildir."
        },
        termination: {
          title: "Hizmet Sonlandırma",
          content: "Bu sözleşme, taraflardan biri tarafından 30 gün önceden bildirimde bulunularak sonlandırılabilir."
        },
        changes: {
          title: "Şart Değişiklikleri",
          content: "Bu şartlar zaman zaman güncellenebilir. Önemli değişiklikler e-posta yoluyla bildirilecektir."
        }
      },
      contact: {
        title: "İletişim Bilgileri",
        email: "E-posta",
        address: "Adres",
        company: "Şirket",
        addressValue: COMPANY_LEGAL.address || "Fransa",
        companyValue: COMPANY_LEGAL.companyName || "Peaknova"
      },
      backToApp: "Uygulamaya Geri Dön"
    },
    en: {
      title: "Terms of Service",
      subtitle: "Terms and conditions for using Comptario accounting services",
  lastUpdated: TERMS_LAST_UPDATED.en,
      sections: {
        acceptance: {
          title: "Acceptance of Terms",
          content: "These terms of service govern your use of the Comptario accounting platform. By using the service, you agree to these terms."
        },
        service: {
          title: "Service Description",
          content: "Comptario provides cloud-based accounting solutions for small and medium businesses:",
          features: {
            invoicing: "Invoice creation and management",
            expenses: "Expense tracking and categorization",
            reporting: "Financial reporting and analysis",
            multiTenant: "Multi-client management"
          }
        },
        serviceEmails: {
          title: "Service Emails",
          content: "We use email only for transactional and account-related communications (e.g., verification, security alerts, billing). We do not send marketing bulk emails."
        },
        responsibilities: {
          title: "User Responsibilities",
          content: "When using our service, you have the following responsibilities:",
          items: {
            accuracy: "Ensure the accuracy of data you enter",
            compliance: "Comply with legal regulations",
            security: "Protect your account security",
            backups: "Backup your data"
          }
        },
        dataProtection: {
          title: "Data Protection",
          content: "Your personal data is processed in accordance with GDPR regulations. Please review our privacy policy for detailed information."
        },
        acceptableUse: {
          title: "Acceptable Use",
          items: [
            "You may not use the service for spam, malware distribution, or unauthorized data scraping",
            "Account sharing or abuse of system resources is prohibited",
            "Illegal content may not be hosted or transmitted"
          ]
        },
        liability: {
          title: "Limitation of Liability",
          content: "Comptario is not responsible for indirect damages that may occur due to service interruptions or data loss."
        },
        termination: {
          title: "Service Termination",
          content: "This agreement may be terminated by either party with 30 days' prior notice."
        },
        changes: {
          title: "Changes to Terms",
          content: "These terms may be updated from time to time. Important changes will be notified via email."
        }
      },
      contact: {
        title: "Contact Information",
        email: "Email",
        address: "Address",
        company: "Company",
        addressValue: COMPANY_LEGAL.address || "France",
        companyValue: COMPANY_LEGAL.companyName || "Peaknova"
      },
      backToApp: "Back to App"
    },
    de: {
      title: "Nutzungsbedingungen",
      subtitle: "Geschäftsbedingungen für die Nutzung der Comptario Buchhaltungsdienste",
  lastUpdated: TERMS_LAST_UPDATED.de,
      sections: {
        acceptance: {
          title: "Annahme der Bedingungen",
          content: "Diese Nutzungsbedingungen regeln Ihre Nutzung der Comptario Buchhaltungsplattform. Durch die Nutzung des Dienstes stimmen Sie diesen Bedingungen zu."
        },
        service: {
          title: "Servicebeschreibung",
          content: "Comptario bietet cloud-basierte Buchhaltungslösungen für kleine und mittlere Unternehmen:",
          features: {
            invoicing: "Rechnungserstellung und -verwaltung",
            expenses: "Ausgabenverfolgung und -kategorisierung",
            reporting: "Finanzberichterstattung und -analyse",
            multiTenant: "Multi-Kunden-Management"
          }
        },
        serviceEmails: {
          title: "Service-E-Mails",
          content: "E-Mails werden ausschließlich für transaktionale und kontobezogene Mitteilungen verwendet (z. B. Verifizierung, Sicherheitswarnungen, Abrechnung). Marketing-Massenmails werden nicht versendet."
        },
        responsibilities: {
          title: "Benutzerverantwortlichkeiten",
          content: "Bei der Nutzung unseres Dienstes haben Sie folgende Verantwortlichkeiten:",
          items: {
            accuracy: "Sicherstellen der Genauigkeit der eingegebenen Daten",
            compliance: "Einhaltung gesetzlicher Vorschriften",
            security: "Schutz Ihrer Kontosicherheit",
            backups: "Sicherung Ihrer Daten"
          }
        },
        dataProtection: {
          title: "Datenschutz",
          content: "Ihre personenbezogenen Daten werden gemäß GDPR-Vorschriften verarbeitet. Bitte lesen Sie unsere Datenschutzrichtlinie für detaillierte Informationen."
        },
        acceptableUse: {
          title: "Zulässige Nutzung",
          items: [
            "Keine Nutzung für Spam, Malware-Verteilung oder unbefugtes Datenscraping",
            "Kontoteilung oder Missbrauch von Systemressourcen ist untersagt",
            "Illegale Inhalte dürfen nicht gehostet oder übertragen werden"
          ]
        },
        liability: {
          title: "Haftungsbeschränkung",
          content: "Comptario ist nicht verantwortlich für indirekte Schäden, die durch Serviceunterbrechungen oder Datenverlust entstehen können."
        },
        termination: {
          title: "Service-Kündigung",
          content: "Diese Vereinbarung kann von beiden Parteien mit 30-tägiger Vorankündigung gekündigt werden."
        },
        changes: {
          title: "Änderungen der Bedingungen",
          content: "Diese Bedingungen können von Zeit zu Zeit aktualisiert werden. Wichtige Änderungen werden per E-Mail mitgeteilt."
        }
      },
      contact: {
        title: "Kontaktinformationen",
        email: "E-Mail",
        address: "Adresse",
        company: "Unternehmen",
        addressValue: COMPANY_LEGAL.address || "Frankreich",
        companyValue: COMPANY_LEGAL.companyName || "Peaknova"
      },
      backToApp: "Zurück zur App"
    },
    fr: {
      title: "Conditions d'utilisation",
      subtitle: "Termes et conditions pour l'utilisation des services comptables Comptario",
  lastUpdated: TERMS_LAST_UPDATED.fr,
      sections: {
        acceptance: {
          title: "Acceptation des conditions",
          content: "Ces conditions d'utilisation régissent votre utilisation de la plateforme comptable Comptario. En utilisant le service, vous acceptez ces conditions."
        },
        service: {
          title: "Description du service",
          content: "Comptario fournit des solutions comptables basées sur le cloud pour les petites et moyennes entreprises :",
          features: {
            invoicing: "Création et gestion de factures",
            expenses: "Suivi et catégorisation des dépenses",
            reporting: "Rapports financiers et analyse",
            multiTenant: "Gestion multi-clients"
          }
        },
        serviceEmails: {
          title: "E-mails de service",
          content: "Nous utilisons l'e-mail uniquement pour les communications transactionnelles et liées au compte (vérification, alertes de sécurité, facturation). Nous n'envoyons pas d'e-mails marketing en masse."
        },
        responsibilities: {
          title: "Responsabilités de l'utilisateur",
          content: "Lors de l'utilisation de notre service, vous avez les responsabilités suivantes :",
          items: {
            accuracy: "Assurer l'exactitude des données que vous saisissez",
            compliance: "Respecter les réglementations légales",
            security: "Protéger la sécurité de votre compte",
            backups: "Sauvegarder vos données"
          }
        },
        dataProtection: {
          title: "Protection des données",
          content: "Vos données personnelles sont traitées conformément aux réglementations GDPR. Veuillez consulter notre politique de confidentialité pour des informations détaillées."
        },
        acceptableUse: {
          title: "Utilisation acceptable",
          items: [
            "Le service ne peut pas être utilisé pour le spam, la distribution de logiciels malveillants ou le scraping non autorisé",
            "Le partage de compte ou l'abus des ressources système est interdit",
            "Les contenus illégaux ne peuvent pas être hébergés ni transmis"
          ]
        },
        liability: {
          title: "Limitation de responsabilité",
          content: "Comptario n'est pas responsable des dommages indirects qui peuvent survenir en raison d'interruptions de service ou de perte de données."
        },
        termination: {
          title: "Résiliation du service",
          content: "Cet accord peut être résilié par l'une ou l'autre partie avec un préavis de 30 jours."
        },
        changes: {
          title: "Modifications des conditions",
          content: "Ces conditions peuvent être mises à jour de temps à autre. Les modifications importantes seront notifiées par e-mail."
        }
      },
      contact: {
        title: "Informations de contact",
        email: "Email",
        address: "Adresse",
        company: "Entreprise",
        addressValue: COMPANY_LEGAL.address || "France",
        companyValue: COMPANY_LEGAL.companyName || "Peaknova"
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
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {activeContent.title}
          </h1>
          <p className="text-lg text-gray-600">
            {activeContent.subtitle}
          </p>
          <div className="flex items-center justify-center mt-4 text-sm text-gray-500">
            <Calendar className="h-4 w-4 mr-2" />
            <span>{activeContent.lastUpdated}</span>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="prose prose-lg max-w-none">
            {/* Section 1: Acceptance */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <User className="h-6 w-6 mr-2 text-blue-600" />
                {activeContent.sections.acceptance.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.acceptance.content}
              </p>
            </section>

              {/* Section: Service Emails */}
              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  {activeContent.sections.serviceEmails.title}
                </h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  {activeContent.sections.serviceEmails.content}
                </p>
              </section>

            {/* Section 2: Service Description */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.sections.service.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.service.content}
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>{activeContent.sections.service.features.invoicing}</li>
                <li>{activeContent.sections.service.features.expenses}</li>
                <li>{activeContent.sections.service.features.reporting}</li>
                <li>{activeContent.sections.service.features.multiTenant}</li>
              </ul>
            </section>

            {/* Section 3: User Responsibilities */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.sections.responsibilities.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.responsibilities.content}
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>{activeContent.sections.responsibilities.items.accuracy}</li>
                <li>{activeContent.sections.responsibilities.items.compliance}</li>
                <li>{activeContent.sections.responsibilities.items.security}</li>
                <li>{activeContent.sections.responsibilities.items.backups}</li>
              </ul>
            </section>

            {/* Section 4: Data Protection */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <Shield className="h-6 w-6 mr-2 text-green-600" />
                {activeContent.sections.dataProtection.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.dataProtection.content}
              </p>
            </section>

            {/* Section 5: Limitation of Liability */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.sections.liability.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.liability.content}
              </p>
            </section>

            {/* Section: Acceptable Use */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.sections.acceptableUse.title}
              </h2>
              {Array.isArray((activeContent.sections.acceptableUse as any).items) ? (
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  {(activeContent.sections.acceptableUse as any).items.map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-700 leading-relaxed mb-4">
                  {(activeContent.sections.acceptableUse as any).content}
                </p>
              )}
            </section>

            {/* Section 6: Termination */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.sections.termination.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.termination.content}
              </p>
            </section>

            {/* Section 7: Changes */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.sections.changes.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.changes.content}
              </p>
            </section>

            {/* Contact Information */}
            <section className="border-t border-gray-200 pt-8 mt-12">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.contact.title}
              </h2>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-700 mb-2">
                  <strong>{activeContent.contact.email}:</strong> {COMPANY_LEGAL.email || 'legal@comptario.com'}
                </p>
                <p className="text-gray-700 mb-2">
                  <strong>{activeContent.contact.address}:</strong> {activeContent.contact.addressValue}
                </p>
                <p className="text-gray-700">
                  <strong>{activeContent.contact.company}:</strong> {activeContent.contact.companyValue}
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

export default TermsOfService;