import React from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Mail, MapPin, Scale, Info } from 'lucide-react';
import { COMPANY_LEGAL } from '../../constants/companyLegal';

const Imprint: React.FC = () => {
  const { i18n } = useTranslation('common');
  const lang = (i18n.language || 'en').split('-')[0] as 'tr' | 'en' | 'de' | 'fr';

  const content = {
    tr: {
      title: 'Künye',
      intro: 'Bu sayfa, yasal bildirim ve iletişim bilgilerimizi içerir.',
      companyInfo: 'Şirket Bilgileri',
      companyName: 'Şirket Adı',
      address: 'Adres',
      contact: 'İletişim',
      legal: 'Yasal Bilgiler',
      email: 'E-posta',
      responsible: 'Sorumlu Kişi',
      responsibleValue: COMPANY_LEGAL.representative || 'Peaknova adına yönetim',
      companyValue: COMPANY_LEGAL.companyName || 'Peaknova',
      addressValue: COMPANY_LEGAL.address || 'Fransa',
      emailValue: COMPANY_LEGAL.email || 'legal@comptario.com',
      legalNote: 'Comptario, Peaknova tarafından sağlanmaktadır. Bu sayfa, 5651 ve ilgili düzenlemeler çerçevesinde bilgilendirme amaçlıdır.'
    },
    en: {
      title: 'Imprint',
      intro: 'This page contains our legal notice and contact information.',
      companyInfo: 'Company Information',
      companyName: 'Company Name',
      address: 'Address',
      contact: 'Contact',
      legal: 'Legal Information',
      email: 'Email',
      responsible: 'Responsible Person',
      responsibleValue: COMPANY_LEGAL.representative || 'Management on behalf of Peaknova',
      companyValue: COMPANY_LEGAL.companyName || 'Peaknova',
      addressValue: COMPANY_LEGAL.address || 'France',
      emailValue: COMPANY_LEGAL.email || 'legal@comptario.com',
      legalNote: 'Comptario is provided by Peaknova. This page serves as a legal notice as required by applicable regulations.'
    },
    de: {
      title: 'Impressum',
      intro: 'Diese Seite enthält unser rechtliches Impressum und Kontaktinformationen.',
      companyInfo: 'Unternehmensinformationen',
      companyName: 'Unternehmensname',
      address: 'Adresse',
      contact: 'Kontakt',
      legal: 'Rechtliche Informationen',
      email: 'E-Mail',
      responsible: 'Verantwortliche Person',
      responsibleValue: COMPANY_LEGAL.representative || 'Geschäftsführung im Namen von Peaknova',
      companyValue: COMPANY_LEGAL.companyName || 'Peaknova',
      addressValue: COMPANY_LEGAL.address || 'Frankreich',
      emailValue: COMPANY_LEGAL.email || 'legal@comptario.com',
      legalNote: 'Comptario wird von Peaknova bereitgestellt. Diese Seite dient als rechtlicher Hinweis gemäß den geltenden Vorschriften.'
    },
    fr: {
      title: 'Mentions légales',
      intro: 'Cette page contient nos mentions légales et nos informations de contact.',
      companyInfo: 'Informations sur l’entreprise',
      companyName: 'Nom de l’entreprise',
      address: 'Adresse',
      contact: 'Contact',
      legal: 'Informations légales',
      email: 'Email',
      responsible: 'Responsable',
      responsibleValue: COMPANY_LEGAL.representative || 'Direction au nom de Peaknova',
      companyValue: COMPANY_LEGAL.companyName || 'Peaknova',
      addressValue: COMPANY_LEGAL.address || 'France',
      emailValue: COMPANY_LEGAL.email || 'legal@comptario.com',
      legalNote: 'Comptario est fourni par Peaknova. Cette page constitue une mention légale conformément aux réglementations applicables.'
    }
  } as const;

  const t = content[lang] || content.en;

  return (
    <div className="bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
              <Building2 className="h-8 w-8 text-indigo-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{t.title}</h1>
          <p className="text-lg text-gray-600">{t.intro}</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="prose prose-lg max-w-none">
            {/* Company Info */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <Building2 className="h-6 w-6 mr-2 text-indigo-600" />
                {t.companyInfo}
              </h2>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-700 mb-2">
                  <strong>{t.companyName}:</strong> {t.companyValue}
                </p>
                <p className="text-gray-700 mb-2 flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-gray-500" />
                  <span><strong>{t.address}:</strong> {t.addressValue}</span>
                </p>
                <p className="text-gray-700 mb-2 flex items-center">
                  <Mail className="h-5 w-5 mr-2 text-gray-500" />
                  <span><strong>{t.email}:</strong> {t.emailValue}</span>
                </p>
                <p className="text-gray-700">
                  <strong>{t.responsible}:</strong> {t.responsibleValue}
                </p>
              </div>
            </section>

            {/* Legal Note */}
            <section className="mb-2">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <Scale className="h-6 w-6 mr-2 text-rose-600" />
                {t.legal}
              </h2>
              <p className="text-gray-700 leading-relaxed">{t.legalNote}</p>
            </section>

            {/* Hosting & Email Infrastructure */}
            {(COMPANY_LEGAL.hostingProvider || COMPANY_LEGAL.emailInfrastructure || COMPANY_LEGAL.dataProtectionEmail) && (
              <section className="mt-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {lang === 'tr' ? 'Altyapı ve İletişim' : lang === 'de' ? 'Infrastruktur & Kontakt' : lang === 'fr' ? 'Infrastructures & Contact' : 'Infrastructure & Contact'}
                </h3>
                <ul className="text-gray-700 space-y-1">
                  {COMPANY_LEGAL.hostingProvider && (
                    <li>
                      <strong>{lang === 'tr' ? 'Barındırma Sağlayıcı:' : lang === 'de' ? 'Hosting-Anbieter:' : lang === 'fr' ? 'Hébergeur :' : 'Hosting Provider:'}</strong> {COMPANY_LEGAL.hostingProvider}
                    </li>
                  )}
                  {COMPANY_LEGAL.emailInfrastructure && (
                    <li>
                      <strong>{lang === 'tr' ? 'E-posta Altyapısı:' : lang === 'de' ? 'E-Mail-Infrastruktur:' : lang === 'fr' ? 'Infrastructure e-mail :' : 'Email Infrastructure:'}</strong> {COMPANY_LEGAL.emailInfrastructure}
                    </li>
                  )}
                  {COMPANY_LEGAL.dataProtectionEmail && (
                    <li>
                      <strong>{lang === 'tr' ? 'Veri Koruma İletişimi:' : lang === 'de' ? 'Datenschutz Kontakt:' : lang === 'fr' ? 'Contact protection des données :' : 'Data Protection Contact:'}</strong> {COMPANY_LEGAL.dataProtectionEmail}
                    </li>
                  )}
                </ul>
              </section>
            )}

            {/* Optional Identifiers */}
            {(COMPANY_LEGAL.identifiers && (
              COMPANY_LEGAL.identifiers.siren ||
              COMPANY_LEGAL.identifiers.siret ||
              COMPANY_LEGAL.identifiers.tva ||
              COMPANY_LEGAL.identifiers.rcs ||
              COMPANY_LEGAL.identifiers.ape ||
              COMPANY_LEGAL.identifiers.steuernummer ||
              COMPANY_LEGAL.identifiers.umsatzsteuerID ||
              COMPANY_LEGAL.identifiers.handelsregisternummer
            )) ? (
              <section className="mt-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center">
                  <Info className="h-5 w-5 mr-2 text-gray-600" />
                  {lang === 'fr' ? 'Identifiants' : lang === 'de' ? 'Kennnummern' : lang === 'tr' ? 'Kimlik Bilgileri' : 'Identifiers'}
                </h3>
                <ul className="text-gray-700 space-y-1">
                  {COMPANY_LEGAL.identifiers?.siren && (
                    <li><strong>SIREN:</strong> {COMPANY_LEGAL.identifiers.siren}</li>
                  )}
                  {COMPANY_LEGAL.identifiers?.siret && (
                    <li><strong>SIRET:</strong> {COMPANY_LEGAL.identifiers.siret}</li>
                  )}
                  {COMPANY_LEGAL.identifiers?.tva && (
                    <li><strong>TVA:</strong> {COMPANY_LEGAL.identifiers.tva}</li>
                  )}
                  {COMPANY_LEGAL.identifiers?.rcs && (
                    <li><strong>RCS:</strong> {COMPANY_LEGAL.identifiers.rcs}</li>
                  )}
                  {COMPANY_LEGAL.identifiers?.ape && (
                    <li><strong>APE:</strong> {COMPANY_LEGAL.identifiers.ape}</li>
                  )}
                  {COMPANY_LEGAL.identifiers?.steuernummer && (
                    <li><strong>Steuernummer:</strong> {COMPANY_LEGAL.identifiers.steuernummer}</li>
                  )}
                  {COMPANY_LEGAL.identifiers?.umsatzsteuerID && (
                    <li><strong>USt-IdNr.:</strong> {COMPANY_LEGAL.identifiers.umsatzsteuerID}</li>
                  )}
                  {COMPANY_LEGAL.identifiers?.handelsregisternummer && (
                    <li><strong>Handelsregisternummer:</strong> {COMPANY_LEGAL.identifiers.handelsregisternummer}</li>
                  )}
                </ul>
              </section>
            ) : null}
          </div>
        </div>

        {/* Back to app link */}
        <div className="text-center mt-8">
          <a
            href="#"
            onClick={() => window.history.back()}
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
          >
            ← {lang === 'tr' ? 'Uygulamaya Geri Dön' : lang === 'de' ? 'Zurück zur App' : lang === 'fr' ? "Retour à l'application" : 'Back to App'}
          </a>
        </div>
      </div>
    </div>
  );
};

export default Imprint;
