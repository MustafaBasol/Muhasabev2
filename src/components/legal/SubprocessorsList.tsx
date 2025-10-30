import React, { useState, useEffect } from 'react';
import { Server, Clock, CheckCircle, Globe } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface Subprocessor {
  id: string;
  name: string;
  purpose: string;
  region: string;
  dataCategories: string[];
  dpaLink: string;
  lastUpdated: string;
}

interface SubprocessorsData {
  subprocessors: Subprocessor[];
  lastModified: string;
  version: string;
  changelog: any[];
}

const SubprocessorsList: React.FC = () => {
  const [subprocessorsData, setSubprocessorsData] = useState<SubprocessorsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentLanguage } = useLanguage();

  // Çoklu dil metinleri
  const texts = {
    tr: {
      title: 'Alt İşlemci Listesi',
      subtitle: 'Comptario tarafından kişisel veri işleme faaliyetleri için kullanılan alt işlemcilerin tam listesi',
      lastUpdated: 'Son güncelleme',
      loading: 'Alt işlemciler yükleniyor...',
      error: 'Alt işlemciler yüklenirken hata oluştu',
      retry: 'Tekrar Dene',
      noData: 'Veri bulunamadi',
      provider: 'Sağlayıcı',
      purpose: 'Amaç',
      region: 'Bölge',
      dataCategories: 'Veri Kategorileri',
      dpaStatus: 'DPA Durumu',
      available: 'Mevcut',
      purposes: {
        hosting: 'Bulut barındırma ve altyapı hizmetleri',
        payment: 'Ödeme işleme ve finansal hizmetler',
        email: 'E-posta teslimat ve iletişim hizmetleri',
        analytics: 'Web sitesi analitik ve performans izleme',
        cdn: 'İçerik dağıtım ağı ve güvenlik hizmetleri'
      },
      categories: {
        technical: 'Teknik veri',
        user: 'Kullanıcı verisi',
        transaction: 'İşlem verisi',
        payment: 'Ödeme verisi',
        customer: 'Müşteri verisi',
        email: 'E-posta adresleri',
        communication: 'İletişim verisi',
        usage: 'Kullanım verisi',
        analytics: 'Analitik veri',
        security: 'Güvenlik kayıtları'
      }
    },
    en: {
      title: 'Subprocessors List',
      subtitle: 'Complete list of subprocessors used by Comptario for personal data processing activities',
      lastUpdated: 'Last updated',
      loading: 'Loading subprocessors...',
      error: 'Error loading subprocessors',
      retry: 'Retry',
      noData: 'No data available',
      provider: 'Provider',
      purpose: 'Purpose',
      region: 'Region',
      dataCategories: 'Data Categories',
      dpaStatus: 'DPA Status',
      available: 'Available',
      purposes: {
        hosting: 'Cloud hosting and infrastructure services',
        payment: 'Payment processing and financial services',
        email: 'Email delivery and communication services',
        analytics: 'Website analytics and performance monitoring',
        cdn: 'Content delivery network and security services'
      },
      categories: {
        technical: 'Technical data',
        user: 'User data',
        transaction: 'Transaction data',
        payment: 'Payment data',
        customer: 'Customer data',
        email: 'Email addresses',
        communication: 'Communication data',
        usage: 'Usage data',
        analytics: 'Analytics data',
        security: 'Security logs'
      }
    },
    de: {
      title: 'Auftragsverarbeiter Liste',
      subtitle: 'Vollständige Liste der von Comptario für die Verarbeitung personenbezogener Daten verwendeten Auftragsverarbeiter',
      lastUpdated: 'Zuletzt aktualisiert',
      loading: 'Auftragsverarbeiter werden geladen...',
      error: 'Fehler beim Laden der Auftragsverarbeiter',
      retry: 'Wiederholen',
      noData: 'Keine Daten verfügbar',
      provider: 'Anbieter',
      purpose: 'Zweck',
      region: 'Region',
      dataCategories: 'Datenkategorien',
      dpaStatus: 'DPA Status',
      available: 'Verfügbar',
      purposes: {
        hosting: 'Cloud-Hosting und Infrastrukturdienste',
        payment: 'Zahlungsabwicklung und Finanzdienstleistungen',
        email: 'E-Mail-Zustellung und Kommunikationsdienste',
        analytics: 'Website-Analyse und Leistungsüberwachung',
        cdn: 'Content Delivery Network und Sicherheitsdienste'
      },
      categories: {
        technical: 'Technische Daten',
        user: 'Benutzerdaten',
        transaction: 'Transaktionsdaten',
        payment: 'Zahlungsdaten',
        customer: 'Kundendaten',
        email: 'E-Mail-Adressen',
        communication: 'Kommunikationsdaten',
        usage: 'Nutzungsdaten',
        analytics: 'Analysedaten',
        security: 'Sicherheitsprotokolle'
      }
    },
    fr: {
      title: 'Liste des Sous-traitants',
      subtitle: 'Liste complète des sous-traitants utilisés par Comptario pour les activités de traitement des données personnelles',
      lastUpdated: 'Dernière mise à jour',
      loading: 'Chargement des sous-traitants...',
      error: 'Erreur lors du chargement des sous-traitants',
      retry: 'Réessayer',
      noData: 'Aucune donnée disponible',
      provider: 'Fournisseur',
      purpose: 'Objectif',
      region: 'Région',
      dataCategories: 'Catégories de Données',
      dpaStatus: 'Statut DPA',
      available: 'Disponible',
      purposes: {
        hosting: 'Services d\'hébergement cloud et d\'infrastructure',
        payment: 'Services de traitement des paiements et financiers',
        email: 'Services de livraison d\'e-mails et de communication',
        analytics: 'Analyse de site web et surveillance des performances',
        cdn: 'Réseau de diffusion de contenu et services de sécurité'
      },
      categories: {
        technical: 'Données techniques',
        user: 'Données utilisateur',
        transaction: 'Données de transaction',
        payment: 'Données de paiement',
        customer: 'Données client',
        email: 'Adresses e-mail',
        communication: 'Données de communication',
        usage: 'Données d\'utilisation',
        analytics: 'Données analytiques',
        security: 'Journaux de sécurité'
      }
    }
  };

  useEffect(() => {
    console.log('SubprocessorsList component mounted');
    const fetchSubprocessors = async () => {
      try {
        console.log('Loading subprocessors data...');
        // Hardcoded data for now - backend connection issues
        const data: SubprocessorsData = {
          subprocessors: [
            {
              id: '1',
              name: 'Amazon Web Services (AWS)',
              purpose: 'Cloud hosting and infrastructure services',
              region: 'US, EU',
              dataCategories: ['Technical data', 'User data', 'Transaction data'],
              dpaLink: 'https://aws.amazon.com/service-terms/',
              lastUpdated: '2025-10-30'
            },
            {
              id: '2',
              name: 'Stripe Inc.',
              purpose: 'Payment processing and financial services',
              region: 'US, EU',
              dataCategories: ['Payment data', 'Transaction data', 'Customer data'],
              dpaLink: 'https://stripe.com/privacy',
              lastUpdated: '2025-10-30'
            },
            {
              id: '3',
              name: 'SendGrid Inc.',
              purpose: 'Email delivery and communication services',
              region: 'US',
              dataCategories: ['Email addresses', 'Communication data'],
              dpaLink: 'https://sendgrid.com/policies/privacy/',
              lastUpdated: '2025-10-30'
            },
            {
              id: '4',
              name: 'Google Analytics',
              purpose: 'Website analytics and performance monitoring',
              region: 'US, EU',
              dataCategories: ['Usage data', 'Analytics data', 'Technical data'],
              dpaLink: 'https://privacy.google.com/businesses/processorterms/',
              lastUpdated: '2025-10-30'
            },
            {
              id: '5',
              name: 'Cloudflare Inc.',
              purpose: 'Content delivery network and security services',
              region: 'Global',
              dataCategories: ['Technical data', 'Security logs'],
              dpaLink: 'https://www.cloudflare.com/cloudflare-customer-dpa/',
              lastUpdated: '2025-10-30'
            }
          ],
          lastModified: '2025-10-30T10:00:00Z',
          version: '1.0',
          changelog: [
            {
              date: '2025-10-30',
              version: '1.0',
              changes: ['Initial subprocessors list created'],
              author: 'Legal Team'
            }
          ]
        };
        console.log('Using hardcoded data:', data);
        setSubprocessorsData(data);
      } catch (error) {
        console.error('Error loading subprocessors:', error);
        setError('Failed to load subprocessors');
      } finally {
        setLoading(false);
      }
    };

    fetchSubprocessors();
  }, []);

  const getLocationIcon = (location: string) => {
    if (location.includes('EU')) return '🇪🇺';
    if (location.includes('US')) return '🇺🇸';
    if (location.includes('Global')) return '🌍';
    return '🌍';
  };

  const getTranslatedData = (processor: Subprocessor) => {
    const translations = {
      tr: {
        'Amazon Web Services (AWS)': {
          name: 'Amazon Web Services (AWS)',
          purpose: 'Bulut barındırma ve altyapı hizmetleri',
          categories: ['Teknik veri', 'Kullanıcı verisi', 'İşlem verisi']
        },
        'Stripe Inc.': {
          name: 'Stripe Inc.',
          purpose: 'Ödeme işleme ve finansal hizmetler',
          categories: ['Ödeme verisi', 'İşlem verisi', 'Müşteri verisi']
        },
        'SendGrid Inc.': {
          name: 'SendGrid Inc.',
          purpose: 'E-posta teslimat ve iletişim hizmetleri',
          categories: ['E-posta adresleri', 'İletişim verisi']
        },
        'Google Analytics': {
          name: 'Google Analytics',
          purpose: 'Web sitesi analitik ve performans izleme',
          categories: ['Kullanım verisi', 'Analitik veri', 'Teknik veri']
        },
        'Cloudflare Inc.': {
          name: 'Cloudflare Inc.',
          purpose: 'İçerik dağıtım ağı ve güvenlik hizmetleri',
          categories: ['Teknik veri', 'Güvenlik kayıtları']
        }
      }
    };

    if (currentLanguage === 'tr' && translations.tr[processor.name as keyof typeof translations.tr]) {
      return translations.tr[processor.name as keyof typeof translations.tr];
    }
    
    return {
      name: processor.name,
      purpose: processor.purpose,
      categories: processor.dataCategories
    };
  };

  const t = texts[currentLanguage];

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{t.error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            {t.retry}
          </button>
        </div>
      </div>
    );
  }

  if (!subprocessorsData) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">{t.noData}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
              <Server className="h-8 w-8 text-indigo-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {t.title}
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            {t.subtitle}
          </p>
          <div className="flex items-center justify-center mt-6 text-sm text-gray-500">
            <Clock className="h-4 w-4 mr-2" />
            <span>{t.lastUpdated}: {new Date(subprocessorsData.lastModified).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Masaüstü - Tablo Görünümü */}
        <div className="hidden lg:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.provider}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.purpose}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.region}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.dataCategories}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.dpaStatus}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {subprocessorsData.subprocessors.map((processor, index) => {
                  const translated = getTranslatedData(processor);
                  return (
                    <tr key={processor.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {translated.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{translated.purpose}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <span className="mr-2">{getLocationIcon(processor.region)}</span>
                          {processor.region}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {translated.categories.join(', ')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          <a
                            href={processor.dpaLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-indigo-600 hover:text-indigo-800 underline"
                          >
                            {t.available}
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile - Kart Görünümü */}
        <div className="lg:hidden space-y-6">
          {subprocessorsData.subprocessors.map((processor) => {
            const translated = getTranslatedData(processor);
            return (
              <div key={processor.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">
                      {translated.name}
                    </h3>
                    <div className="flex items-center text-sm text-gray-500">
                      <Globe className="h-4 w-4 mr-1" />
                      <span className="mr-2">{getLocationIcon(processor.region)}</span>
                      {processor.region}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    <a 
                      href={processor.dpaLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:text-indigo-800 underline"
                    >
                      DPA
                    </a>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">{t.purpose}</dt>
                    <dd className="mt-1 text-sm text-gray-900">{translated.purpose}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">{t.dataCategories}</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <div className="flex flex-wrap gap-1">
                        {translated.categories.map((category, idx) => (
                          <span 
                            key={idx} 
                            className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded"
                          >
                            {category}
                          </span>
                        ))}
                      </div>
                    </dd>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Alt Bilgi */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>
            {t.lastUpdated}: {new Date(subprocessorsData.lastModified).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubprocessorsList;
