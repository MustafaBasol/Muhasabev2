import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Check, Download, AlertCircle, UserCheck } from 'lucide-react';
import { safeLocalStorage } from '../../utils/localStorageSafe';

const DataProcessingAddendum: React.FC = () => {
  const { i18n } = useTranslation('common');
  const currentLang = i18n.language;
  const [isAccepted, setIsAccepted] = useState(false);
  const [acceptanceDate, setAcceptanceDate] = useState<string | null>(null);

  // Content by language
  const content = {
    tr: {
      title: "Veri İşleme Sözleşmesi",
      subtitle: "GDPR Madde 28 uyarınca Veri İşleme Sözleşmesi",
      acceptanceConfirmed: "Veri İşleme Sözleşmesi kabul edildi!",
      download: "İndir",
      sections: {
        introduction: {
          title: "Giriş",
          content: "Bu Veri İşleme Sözleşmesi (VİS), Comptario'nun müşterilerimizin kişisel verilerini nasıl işlediğini ve koruduğunu açıklar. GDPR Madde 28 gereksinimlerine tam uyum sağlar.",
          note: {
            title: "Önemli Not",
            content: "Bu sözleşme, Comptario hizmetlerini kullanmaya başladığınızda otomatik olarak yürürlüğe girer."
          }
        },
        definitions: {
          title: "Tanımlar",
          controller: {
            title: "Veri Sorumlusu",
            desc: "Kişisel verilerin işlenmesinin amaç ve vasıtalarını belirleyen kişi (müşteri şirketi)."
          },
          processor: {
            title: "Veri İşleyici",
            desc: "Veri sorumlusu adına kişisel verileri işleyen kuruluş (Comptario)."
          },
          personalData: {
            title: "Kişisel Veri",
            desc: "Belirli veya belirlenebilir gerçek kişiye ilişkin her türlü bilgi."
          }
        },
        processing: {
          title: "İşleme Detayları",
          subject: {
            title: "İşleme Konusu",
            desc: "Muhasebe hizmetlerinin sağlanması ve müşteri desteği"
          },
          duration: {
            title: "İşleme Süresi",
            desc: "Hizmet sözleşmesi süresince ve yasal saklama sürelerine uygun olarak"
          },
          purpose: {
            title: "İşleme Amaçları",
            service: "Muhasebe hizmetlerinin sağlanması",
            support: "Müşteri desteği ve teknik yardım",
            security: "Sistem güvenliği ve veri koruması",
            compliance: "Yasal yükümlülüklerin yerine getirilmesi"
          }
        },
        dataCategories: {
          title: "Veri Kategorileri",
          personal: {
            title: "Kişisel Veriler",
            name: "Ad ve soyad bilgileri",
            email: "E-posta adresleri",
            phone: "Telefon numaraları",
            company: "Şirket ve iş bilgileri"
          },
          technical: {
            title: "Teknik Veriler",
            ip: "IP adresleri",
            logs: "Sistem günlükleri",
            usage: "Kullanım verileri",
            device: "Cihaz bilgileri"
          }
        },
        security: {
          title: "Güvenlik Önlemleri",
          content: "Comptario, kişisel verilerin güvenliğini sağlamak için aşağıdaki teknik ve organizasyonel önlemleri almıştır:",
          measures: {
            technical: {
              title: "Teknik Önlemler",
              encryption: "SSL/TLS şifreleme",
              access: "Erişim kontrol sistemleri",
              monitoring: "7/24 güvenlik izleme"
            },
            organizational: {
              title: "Organizasyonel Önlemler",
              training: "Personel eğitimi ve bilinçlendirme",
              policies: "Veri güvenliği politikaları",
              incident: "Veri ihlali müdahale planları"
            }
          }
        },
        subprocessors: {
          title: "Alt İşleyiciler",
          content: "Comptario, hizmet kalitesini artırmak için bazı güvenilir üçüncü taraf hizmet sağlayıcılarla çalışır.",
          list: {
            title: "Tam Liste",
            desc: "Alt işleyici listesini görüntülemek için",
            link: "buraya tıklayın"
          }
        },
        dataSubjectRights: {
          title: "Veri Sahibi Hakları",
          content: "Comptario, veri sahiplerinin GDPR kapsamındaki tüm haklarının kullanılmasına destek sağlar ve bu hakların kullanımını kolaylaştırır."
        },
        dataBreach: {
          title: "Veri İhlali Bildirimi",
          content: "Herhangi bir veri güvenliği ihlali durumunda, Comptario derhal gerekli adımları atar ve ilgili makamları bilgilendirir.",
          notification: {
            title: "Bildirim Süresi",
            content: "Veri ihlali durumunda 72 saat içinde müşteri ve ilgili makamlar bilgilendirilir."
          }
        }
      },
      acceptance: {
        title: "Sözleşme Kabulü",
        description: "Bu Veri İşleme Sözleşmesini okuyup anladığınızı ve şartlarını kabul ettiğinizi onaylayın.",
        checkbox: "Veri İşleme Sözleşmesini okudum ve kabul ediyorum",
        button: "Sözleşmeyi Kabul Et",
        status: {
          accepted: "Veri İşleme Sözleşmesi kabul edildi",
          date: "Kabul tarihi"
        }
      },
      backToApp: "Uygulamaya Geri Dön"
    },
    en: {
      title: "Data Processing Addendum",
      subtitle: "Data Processing Addendum under GDPR Article 28",
      acceptanceConfirmed: "Data Processing Addendum accepted!",
      download: "Download",
      sections: {
        introduction: {
          title: "Introduction",
          content: "This Data Processing Addendum (DPA) explains how Comptario processes and protects our customers' personal data. It fully complies with GDPR Article 28 requirements.",
          note: {
            title: "Important Note",
            content: "This agreement automatically comes into effect when you start using Comptario services."
          }
        },
        definitions: {
          title: "Definitions",
          controller: {
            title: "Data Controller",
            desc: "The entity that determines the purposes and means of processing personal data (customer company)."
          },
          processor: {
            title: "Data Processor",
            desc: "The entity that processes personal data on behalf of the data controller (Comptario)."
          },
          personalData: {
            title: "Personal Data",
            desc: "Any information relating to an identified or identifiable natural person."
          }
        },
        processing: {
          title: "Processing Details",
          subject: {
            title: "Subject Matter",
            desc: "Provision of accounting services and customer support"
          },
          duration: {
            title: "Duration",
            desc: "During the service contract period and in accordance with legal retention periods"
          },
          purpose: {
            title: "Processing Purposes",
            service: "Provision of accounting services",
            support: "Customer support and technical assistance",
            security: "System security and data protection",
            compliance: "Fulfillment of legal obligations"
          }
        },
        dataCategories: {
          title: "Data Categories",
          personal: {
            title: "Personal Data",
            name: "Name and surname information",
            email: "Email addresses",
            phone: "Phone numbers",
            company: "Company and business information"
          },
          technical: {
            title: "Technical Data",
            ip: "IP addresses",
            logs: "System logs",
            usage: "Usage data",
            device: "Device information"
          }
        },
        security: {
          title: "Security Measures",
          content: "Comptario has implemented the following technical and organizational measures to ensure the security of personal data:",
          measures: {
            technical: {
              title: "Technical Measures",
              encryption: "SSL/TLS encryption",
              access: "Access control systems",
              monitoring: "24/7 security monitoring"
            },
            organizational: {
              title: "Organizational Measures",
              training: "Staff training and awareness",
              policies: "Data security policies",
              incident: "Data breach response plans"
            }
          }
        },
        subprocessors: {
          title: "Subprocessors",
          content: "Comptario works with some trusted third-party service providers to improve service quality.",
          list: {
            title: "Complete List",
            desc: "To view the subprocessor list",
            link: "click here"
          }
        },
        dataSubjectRights: {
          title: "Data Subject Rights",
          content: "Comptario supports the exercise of all data subject rights under GDPR and facilitates the use of these rights."
        },
        dataBreach: {
          title: "Data Breach Notification",
          content: "In case of any data security breach, Comptario immediately takes necessary steps and informs relevant authorities.",
          notification: {
            title: "Notification Period",
            content: "In case of a data breach, customers and relevant authorities are notified within 72 hours."
          }
        }
      },
      acceptance: {
        title: "Agreement Acceptance",
        description: "Please confirm that you have read and understood this Data Processing Addendum and agree to its terms.",
        checkbox: "I have read and accept the Data Processing Addendum",
        button: "Accept Agreement",
        status: {
          accepted: "Data Processing Addendum accepted",
          date: "Acceptance date"
        }
      },
      backToApp: "Back to App"
    },
    de: {
      title: "Auftragsverarbeitungsvertrag",
      subtitle: "Auftragsverarbeitungsvertrag gemäß GDPR Artikel 28",
      acceptanceConfirmed: "Auftragsverarbeitungsvertrag akzeptiert!",
      download: "Herunterladen",
      sections: {
        introduction: {
          title: "Einführung",
          content: "Dieser Auftragsverarbeitungsvertrag (AVV) erklärt, wie Comptario die personenbezogenen Daten unserer Kunden verarbeitet und schützt. Er entspricht vollständig den Anforderungen von GDPR Artikel 28.",
          note: {
            title: "Wichtiger Hinweis",
            content: "Diese Vereinbarung tritt automatisch in Kraft, wenn Sie die Comptario-Dienste nutzen."
          }
        },
        definitions: {
          title: "Definitionen",
          controller: {
            title: "Verantwortlicher",
            desc: "Die Stelle, die die Zwecke und Mittel der Verarbeitung personenbezogener Daten bestimmt (Kundenunternehmen)."
          },
          processor: {
            title: "Auftragsverarbeiter",
            desc: "Die Stelle, die personenbezogene Daten im Auftrag des Verantwortlichen verarbeitet (Comptario)."
          },
          personalData: {
            title: "Personenbezogene Daten",
            desc: "Alle Informationen, die sich auf eine identifizierte oder identifizierbare natürliche Person beziehen."
          }
        },
        processing: {
          title: "Verarbeitungsdetails",
          subject: {
            title: "Verarbeitungsgegenstand",
            desc: "Bereitstellung von Buchhaltungsdienstleistungen und Kundensupport"
          },
          duration: {
            title: "Verarbeitungsdauer",
            desc: "Während der Vertragslaufzeit und gemäß gesetzlichen Aufbewahrungsfristen"
          },
          purpose: {
            title: "Verarbeitungszwecke",
            service: "Bereitstellung von Buchhaltungsdienstleistungen",
            support: "Kundensupport und technische Unterstützung",
            security: "Systemsicherheit und Datenschutz",
            compliance: "Erfüllung rechtlicher Verpflichtungen"
          }
        },
        dataCategories: {
          title: "Datenkategorien",
          personal: {
            title: "Personenbezogene Daten",
            name: "Vor- und Nachname",
            email: "E-Mail-Adressen",
            phone: "Telefonnummern",
            company: "Unternehmens- und Geschäftsinformationen"
          },
          technical: {
            title: "Technische Daten",
            ip: "IP-Adressen",
            logs: "Systemprotokolle",
            usage: "Nutzungsdaten",
            device: "Geräteinformationen"
          }
        },
        security: {
          title: "Sicherheitsmaßnahmen",
          content: "Comptario hat folgende technische und organisatorische Maßnahmen implementiert, um die Sicherheit personenbezogener Daten zu gewährleisten:",
          measures: {
            technical: {
              title: "Technische Maßnahmen",
              encryption: "SSL/TLS-Verschlüsselung",
              access: "Zugriffskontrollsysteme",
              monitoring: "24/7 Sicherheitsüberwachung"
            },
            organizational: {
              title: "Organisatorische Maßnahmen",
              training: "Mitarbeiterschulung und Sensibilisierung",
              policies: "Datensicherheitsrichtlinien",
              incident: "Datenschutzverletzung-Reaktionspläne"
            }
          }
        },
        subprocessors: {
          title: "Unterauftragsverarbeiter",
          content: "Comptario arbeitet mit einigen vertrauenswürdigen Drittanbietern zusammen, um die Servicequalität zu verbessern.",
          list: {
            title: "Vollständige Liste",
            desc: "Um die Unterauftragsverarbeiter-Liste zu sehen",
            link: "hier klicken"
          }
        },
        dataSubjectRights: {
          title: "Betroffenenrechte",
          content: "Comptario unterstützt die Ausübung aller Betroffenenrechte unter der GDPR und erleichtert die Nutzung dieser Rechte."
        },
        dataBreach: {
          title: "Datenschutzverletzung-Meldung",
          content: "Im Falle einer Datensicherheitsverletzung ergreift Comptario sofort notwendige Maßnahmen und informiert die zuständigen Behörden.",
          notification: {
            title: "Meldezeitraum",
            content: "Im Falle einer Datenschutzverletzung werden Kunden und zuständige Behörden innerhalb von 72 Stunden benachrichtigt."
          }
        }
      },
      acceptance: {
        title: "Vertragsannahme",
        description: "Bitte bestätigen Sie, dass Sie diesen Auftragsverarbeitungsvertrag gelesen und verstanden haben und den Bedingungen zustimmen.",
        checkbox: "Ich habe den Auftragsverarbeitungsvertrag gelesen und akzeptiere ihn",
        button: "Vertrag akzeptieren",
        status: {
          accepted: "Auftragsverarbeitungsvertrag akzeptiert",
          date: "Annahmedatum"
        }
      },
      backToApp: "Zurück zur App"
    },
    fr: {
      title: "Accord de Traitement des Données",
      subtitle: "Accord de Traitement des Données selon l'Article 28 du GDPR",
      acceptanceConfirmed: "Accord de Traitement des Données accepté !",
      download: "Télécharger",
      sections: {
        introduction: {
          title: "Introduction",
          content: "Cet Accord de Traitement des Données (ATD) explique comment Comptario traite et protège les données personnelles de nos clients. Il respecte entièrement les exigences de l'Article 28 du GDPR.",
          note: {
            title: "Note Importante",
            content: "Cet accord entre automatiquement en vigueur lorsque vous commencez à utiliser les services Comptario."
          }
        },
        definitions: {
          title: "Définitions",
          controller: {
            title: "Responsable du Traitement",
            desc: "L'entité qui détermine les finalités et les moyens du traitement des données personnelles (entreprise cliente)."
          },
          processor: {
            title: "Sous-traitant",
            desc: "L'entité qui traite des données personnelles pour le compte du responsable du traitement (Comptario)."
          },
          personalData: {
            title: "Données Personnelles",
            desc: "Toute information se rapportant à une personne physique identifiée ou identifiable."
          }
        },
        processing: {
          title: "Détails du Traitement",
          subject: {
            title: "Objet du Traitement",
            desc: "Fourniture de services comptables et support client"
          },
          duration: {
            title: "Durée",
            desc: "Pendant la période du contrat de service et conformément aux périodes de conservation légales"
          },
          purpose: {
            title: "Finalités du Traitement",
            service: "Fourniture de services comptables",
            support: "Support client et assistance technique",
            security: "Sécurité du système et protection des données",
            compliance: "Respect des obligations légales"
          }
        },
        dataCategories: {
          title: "Catégories de Données",
          personal: {
            title: "Données Personnelles",
            name: "Informations de nom et prénom",
            email: "Adresses e-mail",
            phone: "Numéros de téléphone",
            company: "Informations d'entreprise et professionnelles"
          },
          technical: {
            title: "Données Techniques",
            ip: "Adresses IP",
            logs: "Journaux système",
            usage: "Données d'utilisation",
            device: "Informations d'appareil"
          }
        },
        security: {
          title: "Mesures de Sécurité",
          content: "Comptario a mis en place les mesures techniques et organisationnelles suivantes pour assurer la sécurité des données personnelles :",
          measures: {
            technical: {
              title: "Mesures Techniques",
              encryption: "Chiffrement SSL/TLS",
              access: "Systèmes de contrôle d'accès",
              monitoring: "Surveillance de sécurité 24h/24 et 7j/7"
            },
            organizational: {
              title: "Mesures Organisationnelles",
              training: "Formation et sensibilisation du personnel",
              policies: "Politiques de sécurité des données",
              incident: "Plans de réponse aux violations de données"
            }
          }
        },
        subprocessors: {
          title: "Sous-traitants Ultérieurs",
          content: "Comptario travaille avec certains fournisseurs de services tiers de confiance pour améliorer la qualité du service.",
          list: {
            title: "Liste Complète",
            desc: "Pour voir la liste des sous-traitants ultérieurs",
            link: "cliquez ici"
          }
        },
        dataSubjectRights: {
          title: "Droits des Personnes Concernées",
          content: "Comptario soutient l'exercice de tous les droits des personnes concernées sous le GDPR et facilite l'utilisation de ces droits."
        },
        dataBreach: {
          title: "Notification de Violation de Données",
          content: "En cas de violation de la sécurité des données, Comptario prend immédiatement les mesures nécessaires et informe les autorités compétentes.",
          notification: {
            title: "Période de Notification",
            content: "En cas de violation de données, les clients et les autorités compétentes sont notifiés dans les 72 heures."
          }
        }
      },
      acceptance: {
        title: "Acceptation de l'Accord",
        description: "Veuillez confirmer que vous avez lu et compris cet Accord de Traitement des Données et que vous acceptez ses termes.",
        checkbox: "J'ai lu et j'accepte l'Accord de Traitement des Données",
        button: "Accepter l'Accord",
        status: {
          accepted: "Accord de Traitement des Données accepté",
          date: "Date d'acceptation"
        }
      },
      backToApp: "Retour à l'application"
    }
  };

  const activeContent = content[currentLang as keyof typeof content] || content.en;

  const handleAcceptance = () => {
    const timestamp = new Date().toISOString();
    setIsAccepted(true);
    setAcceptanceDate(timestamp);
    
    // Store acceptance in localStorage (in real app, this would go to backend)
    safeLocalStorage.setItem('dpa-acceptance', JSON.stringify({
      accepted: true,
      timestamp,
      version: '1.0'
    }));
    
    alert(activeContent.acceptanceConfirmed);
  };

  const downloadDPA = () => {
    // In a real application, this would download a PDF version of the DPA
    const blob = new Blob([`Data Processing Addendum - Comptario\n\nAccepted on: ${acceptanceDate || 'Not yet accepted'}\nVersion: 1.0`], {
      type: 'text/plain'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Comptario-DPA-v1.0.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
              <FileText className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {activeContent.title}
          </h1>
          <p className="text-lg text-gray-600">
            {activeContent.subtitle}
          </p>
          <div className="flex items-center justify-center mt-4 space-x-4">
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
              GDPR Article 28
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              Version 1.0
            </span>
          </div>
        </div>

        {/* Acceptance Status */}
        {isAccepted && acceptanceDate && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8 flex items-center">
            <Check className="h-5 w-5 text-green-600 mr-3" />
            <div>
              <p className="text-green-800 font-medium">{activeContent.acceptance.status.accepted}</p>
              <p className="text-green-700 text-sm">
                {activeContent.acceptance.status.date}: {new Date(acceptanceDate).toLocaleString()}
              </p>
            </div>
            <button
              onClick={downloadDPA}
              className="ml-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              {activeContent.download}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="prose prose-lg max-w-none">
            {/* Introduction */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.sections.introduction.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.introduction.content}
              </p>
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                <p className="text-blue-800">
                  <strong>{activeContent.sections.introduction.note.title}:</strong> {activeContent.sections.introduction.note.content}
                </p>
              </div>
            </section>

            {/* Section 1: Definitions */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.sections.definitions.title}
              </h2>
              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">{activeContent.sections.definitions.controller.title}</h4>
                  <p className="text-gray-700 text-sm">{activeContent.sections.definitions.controller.desc}</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">{activeContent.sections.definitions.processor.title}</h4>
                  <p className="text-gray-700 text-sm">{activeContent.sections.definitions.processor.desc}</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">{activeContent.sections.definitions.personalData.title}</h4>
                  <p className="text-gray-700 text-sm">{activeContent.sections.definitions.personalData.desc}</p>
                </div>
              </div>
            </section>

            {/* Section 2: Processing Details */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.sections.processing.title}
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">{activeContent.sections.processing.subject.title}</h3>
                  <p className="text-gray-700 text-sm mb-4">{activeContent.sections.processing.subject.desc}</p>
                  
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">{activeContent.sections.processing.duration.title}</h3>
                  <p className="text-gray-700 text-sm">{activeContent.sections.processing.duration.desc}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">{activeContent.sections.processing.purpose.title}</h3>
                  <ul className="text-gray-700 text-sm space-y-1 list-disc list-inside">
                    <li>{activeContent.sections.processing.purpose.service}</li>
                    <li>{activeContent.sections.processing.purpose.support}</li>
                    <li>{activeContent.sections.processing.purpose.security}</li>
                    <li>{activeContent.sections.processing.purpose.compliance}</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 3: Data Categories */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.sections.dataCategories.title}
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">{activeContent.sections.dataCategories.personal.title}</h3>
                  <ul className="text-gray-700 text-sm space-y-1 list-disc list-inside">
                    <li>{activeContent.sections.dataCategories.personal.name}</li>
                    <li>{activeContent.sections.dataCategories.personal.email}</li>
                    <li>{activeContent.sections.dataCategories.personal.phone}</li>
                    <li>{activeContent.sections.dataCategories.personal.company}</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">{activeContent.sections.dataCategories.technical.title}</h3>
                  <ul className="text-gray-700 text-sm space-y-1 list-disc list-inside">
                    <li>{activeContent.sections.dataCategories.technical.ip}</li>
                    <li>{activeContent.sections.dataCategories.technical.logs}</li>
                    <li>{activeContent.sections.dataCategories.technical.usage}</li>
                    <li>{activeContent.sections.dataCategories.technical.device}</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 4: Security Measures */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.sections.security.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.security.content}
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">{activeContent.sections.security.measures.technical.title}</h4>
                  <ul className="text-gray-700 text-sm space-y-1">
                    <li>• {activeContent.sections.security.measures.technical.encryption}</li>
                    <li>• {activeContent.sections.security.measures.technical.access}</li>
                    <li>• {activeContent.sections.security.measures.technical.monitoring}</li>
                  </ul>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">{activeContent.sections.security.measures.organizational.title}</h4>
                  <ul className="text-gray-700 text-sm space-y-1">
                    <li>• {activeContent.sections.security.measures.organizational.training}</li>
                    <li>• {activeContent.sections.security.measures.organizational.policies}</li>
                    <li>• {activeContent.sections.security.measures.organizational.incident}</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 5: Subprocessors */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.sections.subprocessors.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.subprocessors.content}
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 text-sm">
                  <strong>{activeContent.sections.subprocessors.list.title}:</strong> {activeContent.sections.subprocessors.list.desc}
                  <a href="#legal/subprocessors" className="text-yellow-700 underline ml-1">
                    {activeContent.sections.subprocessors.list.link}
                  </a>
                </p>
              </div>
            </section>

            {/* Section 6: Data Subject Rights */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.sections.dataSubjectRights.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.dataSubjectRights.content}
              </p>
            </section>

            {/* Section 7: Data Breach */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <AlertCircle className="h-6 w-6 mr-2 text-red-600" />
                {activeContent.sections.dataBreach.title}
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {activeContent.sections.dataBreach.content}
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">
                  <strong>{activeContent.sections.dataBreach.notification.title}:</strong> {activeContent.sections.dataBreach.notification.content}
                </p>
              </div>
            </section>
          </div>
        </div>

        {/* Acceptance Section */}
        {!isAccepted && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mt-8">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <UserCheck className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                {activeContent.acceptance.title}
              </h3>
              <p className="text-gray-600 mb-6 max-w-2xl mx-auto leading-relaxed">
                {activeContent.acceptance.description}
              </p>
              <div className="flex items-center justify-center mb-6">
                <input
                  type="checkbox"
                  id="accept-dpa"
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  checked={isAccepted}
                  onChange={(e) => setIsAccepted(e.target.checked)}
                />
                <label htmlFor="accept-dpa" className="ml-3 text-gray-700">
                  {activeContent.acceptance.checkbox}
                </label>
              </div>
              <button
                onClick={handleAcceptance}
                disabled={!isAccepted}
                className={`px-8 py-3 rounded-lg font-semibold transition-colors ${
                  isAccepted
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {activeContent.acceptance.button}
              </button>
            </div>
          </div>
        )}

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

export default DataProcessingAddendum;