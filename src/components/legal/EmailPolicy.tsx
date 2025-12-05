import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Mail, Shield, Ban } from 'lucide-react';
import { COMPANY_LEGAL } from '../../constants/companyLegal';

const EmailPolicy: React.FC = () => {
  const { currentLanguage } = useLanguage();

  const texts = {
    tr: {
      title: 'E-posta ve Anti-Spam Politikası',
      lastUpdated: 'Son güncelleme: 10.11.2025',
      intro: 'Bu politika Comptario tarafından gönderilen e-postaların kapsamını, amacını ve spam karşıtı yaklaşımımızı açıklar.',
      scope: {
        title: 'Kapsam',
        items: [
          'Bu politika Comptario platformu ve ilişkili alan adları üzerinden gönderilen tüm e-postaları kapsar.',
          'Politika; kullanıcı hesapları, kuruluş üyeliği, güvenlik, faturalama, yasal bildirimler ve kritik işlem akışlarına ilişkin iletileri içerir.'
        ]
      },
      transactionalOnly: {
        title: 'Sadece İşlem ve Zorunlu Bildirim E-postaları',
        items: [
          'Pazarlama, promosyon veya toplu reklam e-postaları göndermiyoruz.',
          'Tüm e-postalar; hesap oluşturma, e-posta doğrulama, şifre sıfırlama, ödeme/fatura bildirimi, güvenlik uyarıları, rol/organizasyon değişiklikleri, yasal zorunlu güncellemeler ve kritik sistem bilgilendirmeleri ile sınırlıdır.',
          'Kullanıcılar gereksiz e-posta kirliliğine maruz bırakılmaz; “asgari gerekli iletişim” yaklaşımı uygulanır.'
        ]
      },
      acceptableUse: {
        title: 'Kabul Edilebilir Kullanım (E-posta)',
        items: [
          'Platform üzerinden yetkisiz şekilde toplu e-posta gönderimi yapılamaz.',
          'Kullanıcı hesaplarına ait iletişim adresleri üçüncü taraflara pazarlama amacıyla aktarılmaz.',
          'Şüpheli yetkisiz erişim tespit edilirse ilgili hesaplara ait e-posta bildirimleri güvenlik amacıyla kısıtlanabilir.'
        ]
      },
      antiSpam: {
        title: 'Anti-Spam Yaklaşımı',
        items: [
          'SPF, DKIM ve DMARC yapılandırmaları uygulanır (e-posta bütünlüğü ve kimlik doğrulama).',
          'Yalnızca güvenilir işlem tetikleyicileri e-posta oluşturabilir.',
          'Gereksiz tekrarlı gönderimler tespit edilirse sistem oran sınırlama (rate limiting) uygular.',
          'Yanıltıcı konu satırı veya gönderen bilgisi kullanılmaz.'
        ]
      },
      infrastructure: {
        title: 'Altyapı ve Teslimat',
        items: [
          `E-posta iletimi: ${COMPANY_LEGAL.emailInfrastructure || 'MailerSend (EU - Frankfurt)'}.`,
          'Teslimat kalitesi düzenli olarak izlenir (bounce/complaint oranları).',
          'Gerekirse teslimat zincirine ek güvenlik katmanları (şifreleme, imzalama) eklenir.'
        ]
      },
      abuse: {
        title: 'Kötüye Kullanım Bildirimi',
        text: `Bu politikayı ihlal eden veya yetkisiz göründüğünü düşündüğünüz bir e-posta aldıysanız lütfen şu adrese bildirin: ${COMPANY_LEGAL.dataProtectionEmail}`
      },
      contact: {
        title: 'İletişim',
        text: `Sorular için ${COMPANY_LEGAL.dataProtectionEmail} veya ${COMPANY_LEGAL.email} adresine ulaşabilirsiniz.`
      }
    },
    en: {
      title: 'Email & Anti-Spam Policy',
      lastUpdated: 'Last updated: 10 Nov 2025',
      intro: 'This policy explains the scope, purpose and anti-abuse posture of emails sent by Comptario.',
      scope: {
        title: 'Scope',
        items: [
          'Applies to all emails sent via the Comptario platform and associated domains.',
          'Covers user account, organization membership, security, billing, legal notices and critical transactional flows.'
        ]
      },
      transactionalOnly: {
        title: 'Transactional & Mandatory Notices Only',
        items: [
          'We do not send marketing, promotional or bulk advertising emails.',
          'All emails are limited to: account creation, email verification, password reset, payment/invoice notifications, security alerts, role/organization changes, legally mandated updates, and critical system advisories.',
          'Users are not exposed to unnecessary email noise; “minimal necessary communication” is applied.'
        ]
      },
      acceptableUse: {
        title: 'Acceptable Email Use',
        items: [
          'Unauthorized bulk dispatch through the platform is prohibited.',
          'User contact addresses are not sold or transferred to third parties for marketing.',
          'If suspicious unauthorized access is detected, outbound notifications may be restricted for security.'
        ]
      },
      antiSpam: {
        title: 'Anti-Spam Measures',
        items: [
          'SPF, DKIM and DMARC are enforced (integrity & authentication).',
          'Only trusted transactional triggers can generate emails.',
          'Rate limiting applies if redundant repetitive sends are detected.',
          'No deceptive subject lines or sender identities.'
        ]
      },
      infrastructure: {
        title: 'Infrastructure & Delivery',
        items: [
          `Delivery infrastructure: ${COMPANY_LEGAL.emailInfrastructure || 'MailerSend (EU - Frankfurt)'}.`,
          'Delivery quality (bounce/complaint rates) is continuously monitored.',
          'Additional cryptographic safeguards may be added where appropriate.'
        ]
      },
      abuse: {
        title: 'Abuse Reporting',
        text: `Report any email you believe violates this policy or appears unauthorized to: ${COMPANY_LEGAL.dataProtectionEmail}`
      },
      contact: {
        title: 'Contact',
        text: `Questions: ${COMPANY_LEGAL.dataProtectionEmail} or ${COMPANY_LEGAL.email}`
      }
    },
    de: {
      title: 'E-Mail- & Anti-Spam-Richtlinie',
      lastUpdated: 'Zuletzt aktualisiert: 10.11.2025',
      intro: 'Diese Richtlinie erläutert den Umfang, Zweck und den Anti-Missbrauch-Ansatz der von Comptario versendeten E-Mails.',
      scope: {
        title: 'Geltungsbereich',
        items: [
          'Gilt für alle über die Comptario-Plattform und zugehörige Domains versendeten E-Mails.',
          'Umfasst Benutzerkonto, Organisationsmitgliedschaft, Sicherheit, Abrechnung, rechtliche Hinweise und kritische transaktionale Abläufe.'
        ]
      },
      transactionalOnly: {
        title: 'Nur Transaktionale & Gesetzlich Erforderliche Mitteilungen',
        items: [
          'Wir versenden keine Marketing-, Werbe- oder Bulk-Mails.',
          'Alle E-Mails beschränken sich auf: Kontoerstellung, E-Mail-Bestätigung, Passwort-Reset, Zahlungs-/Rechnungsbenachrichtigungen, Sicherheitswarnungen, Rollen-/Organisationsänderungen, gesetzlich erforderliche Updates und kritische Systemhinweise.',
          'Es gilt das Prinzip der „minimal notwendigen Kommunikation“. '
        ]
      },
      acceptableUse: {
        title: 'Zulässige Nutzung (E-Mail)',
        items: [
          'Unbefugter Massenversand über die Plattform ist untersagt.',
          'Kontaktdaten der Nutzer werden nicht zu Marketingzwecken verkauft oder übertragen.',
          'Bei verdächtigem unbefugtem Zugriff können ausgehende Benachrichtigungen eingeschränkt werden.'
        ]
      },
      antiSpam: {
        title: 'Anti-Spam-Maßnahmen',
        items: [
          'SPF, DKIM und DMARC sind implementiert.',
          'Nur vertrauenswürdige transaktionale Auslöser können E-Mails erzeugen.',
          'Rate Limiting bei erkannten redundanten Wiederholungen.',
          'Keine irreführenden Betreffzeilen oder Absenderangaben.'
        ]
      },
      infrastructure: {
        title: 'Infrastruktur & Zustellung',
        items: [
          `Versandinfrastruktur: ${COMPANY_LEGAL.emailInfrastructure || 'MailerSend (EU - Frankfurt)'}.`,
          'Zustellqualität (Bounce/Beschwerde-Raten) wird überwacht.',
          'Bei Bedarf zusätzliche kryptografische Schutzmaßnahmen.'
        ]
      },
      abuse: {
        title: 'Meldeweg für Missbrauch',
        text: `Melden Sie verdächtige oder unbefugte E-Mails an: ${COMPANY_LEGAL.dataProtectionEmail}`
      },
      contact: {
        title: 'Kontakt',
        text: `Fragen: ${COMPANY_LEGAL.dataProtectionEmail} oder ${COMPANY_LEGAL.email}`
      }
    },
    fr: {
      title: 'Politique E-mail & Anti-Spam',
      lastUpdated: 'Dernière mise à jour : 10/11/2025',
      intro: 'Cette politique décrit le périmètre, l’objectif et l’approche anti-abus des e-mails envoyés par Comptario.',
      scope: {
        title: 'Périmètre',
        items: [
          'S’applique à tous les e-mails envoyés via la plateforme Comptario et les domaines associés.',
          'Couvre les comptes utilisateurs, l’appartenance aux organisations, la sécurité, la facturation, les notifications légales et les flux transactionnels critiques.'
        ]
      },
      transactionalOnly: {
        title: 'Uniquement Transactionnel & Obligations Légales',
        items: [
          'Nous n’envoyons pas d’e-mails marketing, promotionnels ou publicitaires de masse.',
          'Tous les e-mails se limitent à : création de compte, vérification d’e-mail, réinitialisation de mot de passe, notifications de paiement/facture, alertes de sécurité, changements de rôle/organisation, mises à jour légales obligatoires et avis systèmes critiques.',
          'Principe appliqué : « communication minimale nécessaire ».'
        ]
      },
      acceptableUse: {
        title: 'Utilisation Acceptable (E-mail)',
        items: [
          'Tout envoi massif non autorisé via la plateforme est interdit.',
          'Les adresses des utilisateurs ne sont ni vendues ni transférées à des tiers à des fins marketing.',
          'En cas d’accès non autorisé suspecté, certaines notifications sortantes peuvent être restreintes.'
        ]
      },
      antiSpam: {
        title: 'Mesures Anti-Spam',
        items: [
          'SPF, DKIM et DMARC activés (intégrité & authentification).',
          'Seuls des déclencheurs transactionnels fiables peuvent générer des e-mails.',
          'Limitation de fréquence si des envois répétitifs redondants sont détectés.',
          'Aucun objet ou expéditeur trompeur.'
        ]
      },
      infrastructure: {
        title: 'Infrastructure & Livraison',
        items: [
          `Infrastructure d’envoi : ${COMPANY_LEGAL.emailInfrastructure || 'MailerSend (UE - Francfort)'}.`,
          'Qualité de livraison surveillée (taux de rebond/réclamation).',
          'Des protections cryptographiques additionnelles peuvent être ajoutées si nécessaire.'
        ]
      },
      abuse: {
        title: 'Signalement d’Abus',
        text: `Signalez toute violation ou e-mail suspect à : ${COMPANY_LEGAL.dataProtectionEmail}`
      },
      contact: {
        title: 'Contact',
        text: `Questions : ${COMPANY_LEGAL.dataProtectionEmail} ou ${COMPANY_LEGAL.email}`
      }
    }
  } as const;

  const t = texts[currentLanguage as keyof typeof texts] || texts.en;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-4xl mx-auto px-4 py-12 space-y-10">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center justify-center gap-2">
            <Mail className="h-7 w-7 text-indigo-600" /> {t.title}
          </h1>
          <p className="text-sm text-slate-500">{t.lastUpdated}</p>
          <p className="text-slate-600 mt-4 max-w-2xl mx-auto leading-relaxed">{t.intro}</p>
        </header>

        {/* Scope */}
        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">{t.scope.title}</h2>
          <ul className="space-y-2 list-disc pl-5 text-slate-700">
            {t.scope.items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>

        {/* Transactional Only */}
        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">{t.transactionalOnly.title}</h2>
          <ul className="space-y-2 list-disc pl-5 text-slate-700">
            {t.transactionalOnly.items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>

        {/* Acceptable Use */}
        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">{t.acceptableUse.title}</h2>
          <ul className="space-y-2 list-disc pl-5 text-slate-700">
            {t.acceptableUse.items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>

        {/* Anti-Spam */}
        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">{t.antiSpam.title}</h2>
          <ul className="space-y-2 list-disc pl-5 text-slate-700">
            {t.antiSpam.items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>

        {/* Infrastructure */}
        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">{t.infrastructure.title}</h2>
          <ul className="space-y-2 list-disc pl-5 text-slate-700">
            {t.infrastructure.items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>

        {/* Abuse Reporting */}
        <section className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-indigo-900 mb-3 flex items-center gap-2"><Ban className="h-5 w-5" /> {t.abuse.title}</h2>
          <p className="text-indigo-800 leading-relaxed">{t.abuse.text}</p>
        </section>

        {/* Contact */}
        <section className="bg-slate-100 border border-slate-300 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-3 flex items-center gap-2"><Shield className="h-5 w-5" /> {t.contact.title}</h2>
          <p className="text-slate-700 leading-relaxed">{t.contact.text}</p>
        </section>

        <div className="text-center text-xs text-slate-500 pt-4">
          <p>© {new Date().getFullYear()} {COMPANY_LEGAL.companyName}. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
};

export default EmailPolicy;
