import React from 'react';
import { useTranslation } from 'react-i18next';
import { Server, Shield, Globe, Building2, Clock, ExternalLink } from 'lucide-react';

interface Subprocessor {
  name: string;
  purpose: string;
  location: string;
  website: string;
  safeguards: string[];
}

const SubprocessorsList: React.FC = () => {
  const { i18n } = useTranslation('common');
  const currentLang = i18n.language;

  // Content by language
  const content = {
    tr: {
      title: "Alt İşleyici Listesi",
      subtitle: "Comptario'nun kişisel veri işleme faaliyetlerinde kullandığı alt işleyicilerin tam listesi",
      lastUpdated: "Son güncelleme: 1 Ocak 2024",
      overview: {
        title: "Genel Bakış",
        content: "GDPR Madde 28 uyarınca, Comptario müşterilerinin kişisel verilerini işlemek için kullandığı tüm alt işleyicileri şeffaf bir şekilde listelemektedir.",
        notification: {
          title: "Bildirim",
          content: "Alt işleyici listesinde yapılan değişiklikler 30 gün önceden e-posta ile bildirilir."
        }
      },
      currentList: "Güncel Alt İşleyiciler",
      processors: {
        aws: { purpose: "Bulut altyapısı ve veri depolama" },
        stripe: { purpose: "Ödeme işlemleri ve fatura yönetimi" },
        sendgrid: { purpose: "E-posta gönderimi ve iletişim" },
        intercom: { purpose: "Müşteri desteği ve canlı sohbet" },
        analytics: { purpose: "Web sitesi analitikleri ve kullanım istatistikleri" }
      },
      safeguards: {
        title: "Güvenlik Önlemleri",
        adequacyDecision: "AB Yeterlilik Kararı",
        dataTransferAgreement: "Veri Transfer Sözleşmesi",
        dataMinimization: "Veri Minimizasyonu"
      },
      dataTransfers: {
        title: "Uluslararası Veri Transferleri",
        content: "Tüm uluslararası veri transferleri GDPR Bölüm V uyarınca aşağıdaki güvenlik mekanizmaları ile korunmaktadır:",
        mechanisms: {
          adequacy: "AB Yeterlilik Kararları",
          scc: "Standart Sözleşme Hükümleri (SCC)",
          bcr: "Bağlayıcı Kurumsal Kurallar (BCR)"
        }
      },
      monitoring: {
        title: "İzleme ve Denetim",
        content: "Tüm alt işleyiciler düzenli olarak izlenir ve denetlenir:",
        activities: {
          audit: "Yıllık güvenlik denetimleri",
          certification: "Uluslararası sertifikasyon kontrolü",
          review: "Aylık uyumluluk gözden geçirmesi"
        }
      },
      contact: {
        title: "İletişim ve Bildirimler",
        content: "Alt işleyici değişiklikleri hakkında bilgi almak veya sorularınız için:",
        email: "E-posta",
        notificationPeriod: "Bildirim Süresi",
        notificationPeriodValue: "Değişikliklerden 30 gün önce"
      },
      backToApp: "Uygulamaya Geri Dön"
    },
    en: {
      title: "Subprocessors List",
      subtitle: "Complete list of subprocessors used by Comptario in personal data processing activities",
      lastUpdated: "Last updated: January 1, 2024",
      overview: {
        title: "Overview",
        content: "Under GDPR Article 28, Comptario transparently lists all subprocessors used to process our customers' personal data.",
        notification: {
          title: "Notification",
          content: "Changes to the subprocessor list are notified 30 days in advance via email."
        }
      },
      currentList: "Current Subprocessors",
      processors: {
        aws: { purpose: "Cloud infrastructure and data storage" },
        stripe: { purpose: "Payment processing and invoice management" },
        sendgrid: { purpose: "Email delivery and communication" },
        intercom: { purpose: "Customer support and live chat" },
        analytics: { purpose: "Website analytics and usage statistics" }
      },
      safeguards: {
        title: "Safeguards",
        adequacyDecision: "EU Adequacy Decision",
        dataTransferAgreement: "Data Transfer Agreement",
        dataMinimization: "Data Minimization"
      },
      dataTransfers: {
        title: "International Data Transfers",
        content: "All international data transfers are protected under GDPR Chapter V with the following security mechanisms:",
        mechanisms: {
          adequacy: "EU Adequacy Decisions",
          scc: "Standard Contractual Clauses (SCC)",
          bcr: "Binding Corporate Rules (BCR)"
        }
      },
      monitoring: {
        title: "Monitoring and Auditing",
        content: "All subprocessors are regularly monitored and audited:",
        activities: {
          audit: "Annual security audits",
          certification: "International certification checks",
          review: "Monthly compliance reviews"
        }
      },
      contact: {
        title: "Contact and Notifications",
        content: "For information about subprocessor changes or questions:",
        email: "Email",
        notificationPeriod: "Notification Period",
        notificationPeriodValue: "30 days before changes"
      },
      backToApp: "Back to App"
    },
    de: {
      title: "Unterauftragsverarbeiter-Liste",
      subtitle: "Vollständige Liste der von Comptario bei der Verarbeitung personenbezogener Daten verwendeten Unterauftragsverarbeiter",
      lastUpdated: "Zuletzt aktualisiert: 1. Januar 2024",
      overview: {
        title: "Überblick",
        content: "Gemäß GDPR Artikel 28 listet Comptario transparent alle Unterauftragsverarbeiter auf, die zur Verarbeitung der personenbezogenen Daten unserer Kunden verwendet werden.",
        notification: {
          title: "Benachrichtigung",
          content: "Änderungen an der Unterauftragsverarbeiter-Liste werden 30 Tage im Voraus per E-Mail mitgeteilt."
        }
      },
      currentList: "Aktuelle Unterauftragsverarbeiter",
      processors: {
        aws: { purpose: "Cloud-Infrastruktur und Datenspeicherung" },
        stripe: { purpose: "Zahlungsabwicklung und Rechnungsmanagement" },
        sendgrid: { purpose: "E-Mail-Versand und Kommunikation" },
        intercom: { purpose: "Kundensupport und Live-Chat" },
        analytics: { purpose: "Website-Analyse und Nutzungsstatistiken" }
      },
      safeguards: {
        title: "Schutzmaßnahmen",
        adequacyDecision: "EU-Angemessenheitsbeschluss",
        dataTransferAgreement: "Datentransfer-Vereinbarung",
        dataMinimization: "Datenminimierung"
      },
      dataTransfers: {
        title: "Internationale Datentransfers",
        content: "Alle internationalen Datentransfers werden unter GDPR Kapitel V mit folgenden Sicherheitsmechanismen geschützt:",
        mechanisms: {
          adequacy: "EU-Angemessenheitsbeschlüsse",
          scc: "Standardvertragsklauseln (SCC)",
          bcr: "Verbindliche interne Datenschutzvorschriften (BCR)"
        }
      },
      monitoring: {
        title: "Überwachung und Prüfung",
        content: "Alle Unterauftragsverarbeiter werden regelmäßig überwacht und geprüft:",
        activities: {
          audit: "Jährliche Sicherheitsprüfungen",
          certification: "Internationale Zertifizierungskontrollen",
          review: "Monatliche Compliance-Überprüfungen"
        }
      },
      contact: {
        title: "Kontakt und Benachrichtigungen",
        content: "Für Informationen über Änderungen bei Unterauftragsverarbeitern oder Fragen:",
        email: "E-Mail",
        notificationPeriod: "Benachrichtigungszeitraum",
        notificationPeriodValue: "30 Tage vor Änderungen"
      },
      backToApp: "Zurück zur App"
    },
    fr: {
      title: "Liste des Sous-traitants Ultérieurs",
      subtitle: "Liste complète des sous-traitants ultérieurs utilisés par Comptario dans les activités de traitement des données personnelles",
      lastUpdated: "Dernière mise à jour : 1er janvier 2024",
      overview: {
        title: "Aperçu",
        content: "Conformément à l'Article 28 du GDPR, Comptario liste de manière transparente tous les sous-traitants ultérieurs utilisés pour traiter les données personnelles de nos clients.",
        notification: {
          title: "Notification",
          content: "Les modifications de la liste des sous-traitants ultérieurs sont notifiées 30 jours à l'avance par e-mail."
        }
      },
      currentList: "Sous-traitants Ultérieurs Actuels",
      processors: {
        aws: { purpose: "Infrastructure cloud et stockage de données" },
        stripe: { purpose: "Traitement des paiements et gestion des factures" },
        sendgrid: { purpose: "Livraison d'e-mails et communication" },
        intercom: { purpose: "Support client et chat en direct" },
        analytics: { purpose: "Analyses de site web et statistiques d'utilisation" }
      },
      safeguards: {
        title: "Mesures de Protection",
        adequacyDecision: "Décision d'Adéquation UE",
        dataTransferAgreement: "Accord de Transfert de Données",
        dataMinimization: "Minimisation des Données"
      },
      dataTransfers: {
        title: "Transferts Internationaux de Données",
        content: "Tous les transferts internationaux de données sont protégés sous le Chapitre V du GDPR avec les mécanismes de sécurité suivants :",
        mechanisms: {
          adequacy: "Décisions d'Adéquation UE",
          scc: "Clauses Contractuelles Types (SCC)",
          bcr: "Règles d'Entreprise Contraignantes (BCR)"
        }
      },
      monitoring: {
        title: "Surveillance et Audit",
        content: "Tous les sous-traitants ultérieurs sont régulièrement surveillés et audités :",
        activities: {
          audit: "Audits de sécurité annuels",
          certification: "Contrôles de certification internationale",
          review: "Révisions de conformité mensuelles"
        }
      },
      contact: {
        title: "Contact et Notifications",
        content: "Pour des informations sur les changements de sous-traitants ultérieurs ou des questions :",
        email: "Email",
        notificationPeriod: "Période de Notification",
        notificationPeriodValue: "30 jours avant les changements"
      },
      backToApp: "Retour à l'application"
    }
  };

  const activeContent = content[currentLang as keyof typeof content] || content.en;

  // Subprocessors data with localized purposes
  const subprocessors: Subprocessor[] = [
    {
      name: 'Amazon Web Services (AWS)',
      purpose: activeContent.processors.aws.purpose,
      location: 'EU (Frankfurt), US',
      website: 'https://aws.amazon.com',
      safeguards: [
        activeContent.safeguards.adequacyDecision,
        activeContent.safeguards.dataTransferAgreement,
        'ISO 27001, SOC 2 Type II'
      ]
    },
    {
      name: 'Stripe',
      purpose: activeContent.processors.stripe.purpose,
      location: 'EU, US',
      website: 'https://stripe.com',
      safeguards: [
        activeContent.safeguards.adequacyDecision,
        'PCI DSS Level 1',
        activeContent.safeguards.dataTransferAgreement
      ]
    },
    {
      name: 'SendGrid (Twilio)',
      purpose: activeContent.processors.sendgrid.purpose,
      location: 'EU, US',
      website: 'https://sendgrid.com',
      safeguards: [
        activeContent.safeguards.adequacyDecision,
        'SOC 2 Type II',
        activeContent.safeguards.dataTransferAgreement
      ]
    },
    {
      name: 'Intercom',
      purpose: activeContent.processors.intercom.purpose,
      location: 'EU, US',
      website: 'https://intercom.com',
      safeguards: [
        activeContent.safeguards.adequacyDecision,
        'ISO 27001',
        activeContent.safeguards.dataTransferAgreement
      ]
    },
    {
      name: 'Google Analytics',
      purpose: activeContent.processors.analytics.purpose,
      location: 'EU, US',
      website: 'https://analytics.google.com',
      safeguards: [
        activeContent.safeguards.adequacyDecision,
        'Google Cloud DPA',
        activeContent.safeguards.dataMinimization
      ]
    }
  ];

  const getLocationIcon = (location: string) => {
    if (location.includes('EU')) return '🇪🇺';
    if (location.includes('US')) return '🇺🇸';
    return '🌍';
  };

  return (
    <div className="bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
              <Server className="h-8 w-8 text-indigo-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {activeContent.title}
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            {activeContent.subtitle}
          </p>
          <div className="flex items-center justify-center mt-6 text-sm text-gray-500">
            <Clock className="h-4 w-4 mr-2" />
            <span>{activeContent.lastUpdated}</span>
          </div>
        </div>

        {/* Introduction */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.overview.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.overview.content}
              </p>
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                <p className="text-blue-800 text-sm">
                  <strong>{activeContent.overview.notification.title}:</strong> {activeContent.overview.notification.content}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Subprocessors List */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
            <Building2 className="h-6 w-6 mr-2 text-gray-600" />
            {activeContent.currentList}
          </h2>
          
          <div className="grid gap-6">
            {subprocessors.map((processor, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                      {processor.name}
                      <a
                        href={processor.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-600 hover:text-blue-700"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </h3>
                    <p className="text-gray-600 mt-1">{processor.purpose}</p>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Globe className="h-4 w-4" />
                    <span>{getLocationIcon(processor.location)} {processor.location}</span>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                    <Shield className="h-4 w-4 mr-1 text-green-600" />
                    {activeContent.safeguards.title}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {processor.safeguards.map((safeguard, safeguardIndex) => (
                      <span
                        key={safeguardIndex}
                        className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium"
                      >
                        {safeguard}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Additional Information */}
        <div className="mt-12 grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {activeContent.dataTransfers.title}
            </h3>
            <p className="text-gray-700 text-sm mb-4">
              {activeContent.dataTransfers.content}
            </p>
            <div className="space-y-2">
              <div className="flex items-center text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                {activeContent.dataTransfers.mechanisms.adequacy}
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                {activeContent.dataTransfers.mechanisms.scc}
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                {activeContent.dataTransfers.mechanisms.bcr}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {activeContent.monitoring.title}
            </h3>
            <p className="text-gray-700 text-sm mb-4">
              {activeContent.monitoring.content}
            </p>
            <div className="space-y-2">
              <div className="flex items-center text-sm text-gray-600">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                {activeContent.monitoring.activities.audit}
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                {activeContent.monitoring.activities.certification}
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                {activeContent.monitoring.activities.review}
              </div>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-gray-100 rounded-lg p-8 mt-12">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              {activeContent.contact.title}
            </h3>
            <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
              {activeContent.contact.content}
            </p>
            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>{activeContent.contact.email}:</strong> dpo@comptario.com</p>
              <p><strong>{activeContent.contact.notificationPeriod}:</strong> {activeContent.contact.notificationPeriodValue}</p>
            </div>
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

export default SubprocessorsList;