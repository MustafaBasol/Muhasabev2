import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  User,
  Users,
  Calendar,
  Building2,
  Bell,
  Shield,
  Lock,
  Download,
  Save,
  Eye,
  EyeOff,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import InfoModal from './InfoModal';
import OrganizationMembersPage from './OrganizationMembersPage';
import FiscalPeriodsPage from './FiscalPeriodsPage';
import type { CompanyProfile } from '../utils/pdfGenerator';
import { useCurrency } from '../contexts/CurrencyContext';
import { useAuth } from '../contexts/AuthContext';
import { usersApi } from '../api/users';
import { tenantsApi } from '../api/tenants';
import { AuditLogComponent } from './AuditLogComponent';

type BankAccount = {
  id: string;
  bankName: string;
  accountName: string;
  iban: string;
};

interface SettingsPageProps {
  user?: { name: string; email: string };
  company?: CompanyProfile;
  bankAccounts?: BankAccount[];
  onUserUpdate?: (user: any) => void;
  onCompanyUpdate?: (company: CompanyProfile) => void;
  onExportData?: () => void;
  onImportData?: (payload: any) => void;
  language?: 'tr' | 'en' | 'fr' | 'de';
  initialTab?: string;
}

// Yalnızca ekranda önizleme için (CompanyProfile + logoFile)
// Ülke seçimi öncesi boş değer için country alanını genişletiyoruz
type LocalCompanyState = Omit<CompanyProfile, 'country'> & {
  country?: CompanyProfile['country'] | '';
  logoFile?: File | null;
};

const SUPPORTED_LANGUAGES = ['tr', 'en', 'fr', 'de'] as const;
type SettingsLanguage = typeof SUPPORTED_LANGUAGES[number];

type NotificationKey =
  | 'emailNotifications'
  | 'invoiceReminders'
  | 'expenseAlerts'
  | 'paymentNotifications'
  | 'weeklyReports'
  | 'monthlyReports';

type SettingsTranslations = {
  header: {
    title: string;
    subtitle: string;
    unsavedChanges: string;
    save: string;
  };
  modals: {
    saveSuccess: { title: string; message: string; confirm: string };
    saveError: { title: string; message: string; confirm: string };
    fileTypeError: { title: string; message: string; confirm: string };
    fileSizeError: { title: string; message: string; confirm: string };
    authRequired: { title: string; message: string; confirm: string };
    sessionExpired: { title: string; message: string; confirm: string };
    deleteRequested: { title: string; message: string; confirm: string };
    deleteFailed: { title: string; message: string; confirm: string };
  };
  tabs: {
    profile: string;
    company: string;
    notifications: string;
    organization?: string;
    fiscalPeriods?: string;
    system: string;
    security: string;
    privacy: string;
  };
  profile: {
    title: string;
    fields: {
      name: string;
      email: string;
      phone: string;
    };
    passwordTitle: string;
    passwordFields: {
      current: string;
      new: string;
      confirm: string;
    };
  };
  company: {
    title: string;
    logo: {
      label: string;
      upload: string;
      remove: string;
      helper: string;
      uploaded: (params: { name: string; sizeKB: string }) => string;
    };
    fields: {
      name: string;
      address: string;
      taxNumber: string;
      taxOffice: string;
      phone: string;
      email: string;
      website: string;
    };
    legalFields: {
      title: string;
      subtitle: string;
      countryHelp?: string;
      countrySelectLabel?: string;
      countryOptions?: { TR: string; US: string; DE: string; FR: string; OTHER: string };
      turkey: {
        title: string;
        mersisNumber: string;
        kepAddress: string;
      };
      france: {
        title: string;
        siretNumber: string;
        sirenNumber: string;
        apeCode: string;
        tvaNumber: string;
        rcsNumber: string;
      };
      germany: {
        title: string;
        steuernummer: string;
        umsatzsteuerID: string;
        handelsregisternummer: string;
        geschaeftsfuehrer: string;
      };
      usa: {
        title: string;
        einNumber: string;
        taxId: string;
        businessLicenseNumber: string;
        stateOfIncorporation: string;
      };
      other: {
        title: string;
        registrationNumber: string;
        vatNumber: string;
        taxId: string;
        stateOrRegion: string;
      };
    };
    iban: {
      sectionTitle: string;
      bankOption: string;
      noBanks: string;
      bankSelectPlaceholder: string;
      manualOption: string;
      ibanPlaceholder: string;
      bankNamePlaceholder: string;
      preview: (value: string) => string;
      previewExample: string;
    };
  };
  notifications: {
    title: string;
    labels: Record<NotificationKey, string>;
  };
  system: {
    title: string;
    currencyLabel: string;
    dateFormatLabel: string;
    timezoneLabel: string;
    currencies: Record<'TRY' | 'USD' | 'EUR', string>;
    timezones: Record<'Europe/Istanbul' | 'UTC' | 'America/New_York', string>;
    backup: {
      title: string;
      toggleLabel: string;
      toggleDescription: string;
      frequencyLabel: string;
      options: Record<'daily' | 'weekly' | 'monthly', string>;
    };
  };
  security: {
    tipsTitle: string;
    tips: string[];
    title: string;
    cards: {
      twoFactor: { title: string; description: string; action: string };
      sessionHistory: { title: string; description: string; action: string };
      activeSessions: { title: string; description: string; action: string };
    };
  };
  privacy: {
    title: string;
    gdpr: {
      title: string;
      description: string;
      export: {
        title: string;
        description: string;
        button: string;
        disclaimer: string;
      };
      delete: {
        title: string;
        description: string;
        button: string;
        warning: string;
        confirmDialog: {
          title: string;
          message: string;
          retention: string;
          confirm: string;
          cancel: string;
        };
      };
    };
  };

};

// Basit daraltılabilir bölüm (Accordion benzeri)
const Section: React.FC<{
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, subtitle, defaultOpen = true, children }) => {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {open ? (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-500" />
        )}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};

const settingsTranslations: Record<SettingsLanguage, SettingsTranslations> = {
  tr: {
    header: {
      title: 'Ayarlar',
      subtitle: 'Sistem ve hesap ayarlarınızı yönetin',
      unsavedChanges: 'Kaydedilmemiş değişiklikler var',
      save: 'Kaydet',
    },
    modals: {
      saveSuccess: {
        title: 'Kaydedildi',
        message: 'Değişiklikleriniz başarıyla kaydedildi.',
        confirm: 'Tamam',
      },
      saveError: {
        title: 'Hata',
        message: 'Ayarlar kaydedilirken bir hata oluştu.',
        confirm: 'Kapat',
      },
      fileTypeError: { title: 'Dosya tipi hatalı', message: 'Lütfen sadece resim dosyası seçin.', confirm: 'Tamam' },
      fileSizeError: { title: 'Dosya boyutu çok büyük', message: 'Dosya boyutu 5MB\'dan küçük olmalıdır.', confirm: 'Tamam' },
      authRequired: { title: 'Oturum gerekli', message: 'Lütfen önce giriş yapın.', confirm: 'Tamam' },
      sessionExpired: { title: 'Oturum süresi doldu', message: 'Lütfen tekrar giriş yapın.', confirm: 'Tamam' },
      deleteRequested: { title: 'Talep alındı', message: 'Hesap silme talebiniz başarıyla iletildi.', confirm: 'Tamam' },
      deleteFailed: { title: 'İşlem başarısız', message: 'Hesap silme isteği gönderilemedi. Lütfen tekrar deneyin.', confirm: 'Kapat' },
    },
    tabs: {
      profile: 'Profil',
      company: 'Şirket',
      notifications: 'Bildirimler',
      organization: 'Organizasyon',
      fiscalPeriods: 'Mali Dönemler',
      system: 'Sistem',
      security: 'Güvenlik',
      privacy: 'Gizlilik',
    },
    profile: {
      title: 'Profil Bilgileri',
      fields: {
        name: 'Ad Soyad',
        email: 'E-posta',
        phone: 'Telefon',
      },
      passwordTitle: 'Şifre Değiştir',
      passwordFields: {
        current: 'Mevcut Şifre',
        new: 'Yeni Şifre',
        confirm: 'Şifre Tekrar',
      },
    },
    company: {
      title: 'Şirket Bilgileri',
      logo: {
        label: 'Şirket Logosu',
        upload: 'Logo Yükle',
        remove: 'Kaldır',
        helper: 'PNG, JPG veya GIF formatında, maksimum 5MB boyutunda dosya yükleyebilirsiniz.',
        uploaded: ({ name, sizeKB }) => `Logo ${name} (${sizeKB} KB)`,
      },
      fields: {
        name: 'Şirket Adı',
        address: 'Adres',
        taxNumber: 'Vergi Numarası',
        taxOffice: 'Vergi Dairesi',
        phone: 'Telefon',
        email: 'E-posta',
        website: 'Website',
      },
      legalFields: {
        title: 'Yasal Gereklilik Alanları',
        subtitle: 'Uluslararası faturalama standartları için gerekli bilgiler',
        countryHelp: 'Şirket bilgilerini girebilmek için lütfen şirket ülkesini seçin.',
        countrySelectLabel: 'Ülke',
        countryOptions: { TR: 'Türkiye', US: 'Amerika', DE: 'Almanya', FR: 'Fransa', OTHER: 'Diğer' },
        turkey: {
          title: 'Türkiye',
          mersisNumber: 'Mersis Numarası',
          kepAddress: 'KEP Adresi',
        },
        france: {
          title: 'Fransa',
          siretNumber: 'SIRET Numarası',
          sirenNumber: 'SIREN Numarası',
          apeCode: 'APE/NAF Kodu',
          tvaNumber: 'TVA Numarası',
          rcsNumber: 'RCS Numarası',
        },
        germany: {
          title: 'Almanya',
          steuernummer: 'Steuernummer',
          umsatzsteuerID: 'Umsatzsteuer-ID',
          handelsregisternummer: 'Handelsregisternummer',
          geschaeftsfuehrer: 'Geschäftsführer',
        },
        usa: {
          title: 'Amerika',
          einNumber: 'EIN Numarası',
          taxId: 'Tax ID',
          businessLicenseNumber: 'Business License No',
          stateOfIncorporation: 'Kuruluş Eyaleti',
        },
        other: {
          title: 'Diğer Ülkeler',
          registrationNumber: 'Kayıt No',
          vatNumber: 'KDV/VAT No',
          taxId: 'Vergi Kimliği',
          stateOrRegion: 'Eyalet/Bölge',
        },
      },
      iban: {
        sectionTitle: 'Faturalarda Kullanılacak IBAN',
        bankOption: 'Kaydedilmiş bankalardan seç',
        noBanks: '(Kaydedilmiş banka yok)',
        bankSelectPlaceholder: 'Banka seçin',
        manualOption: 'Elle IBAN gir',
        ibanPlaceholder: 'TR00 0000 0000 0000 0000 0000 00',
        bankNamePlaceholder: 'Banka adı (ör. Ziraat Bankası)',
        preview: value => `Önizleme: ${value}`,
        previewExample: 'Örn: TRxx xxxx xxxx xxxx xxxx xxxx xx',
      },
    },
    notifications: {
      title: 'Bildirim Tercihleri',
      labels: {
        emailNotifications: 'E-posta Bildirimleri',
        invoiceReminders: 'Fatura Hatırlatmaları',
        expenseAlerts: 'Gider Uyarıları',
        paymentNotifications: 'Ödeme Bildirimleri',
        weeklyReports: 'Haftalık Raporlar',
        monthlyReports: 'Aylık Raporlar',
      },
    },
    system: {
      title: 'Sistem Ayarları',
      currencyLabel: 'Para Birimi',
      dateFormatLabel: 'Tarih Formatı',
      timezoneLabel: 'Saat Dilimi',
      currencies: {
        TRY: '₺ Türk Lirası',
        USD: '$ ABD Doları',
        EUR: '€ Euro',
      },
      timezones: {
        'Europe/Istanbul': 'İstanbul',
        UTC: 'UTC',
        'America/New_York': 'New York',
      },
      backup: {
        title: 'Yedekleme',
        toggleLabel: 'Otomatik Yedekleme',
        toggleDescription: 'Verilerinizi otomatik olarak yedekleyin',
        frequencyLabel: 'Yedekleme Sıklığı',
        options: {
          daily: 'Günlük',
          weekly: 'Haftalık',
          monthly: 'Aylık',
        },
      },
    },
    security: {
      tipsTitle: 'Güvenlik Önerileri',
      tips: [
        '• Güçlü bir şifre kullanın (en az 8 karakter, büyük/küçük harf, sayı)',
        '• Şifrenizi düzenli olarak değiştirin',
        '• İki faktörlü kimlik doğrulamayı etkinleştirin',
        '• Şüpheli aktiviteleri takip edin',
      ],
      title: 'Güvenlik Ayarları',
      cards: {
        twoFactor: {
          title: 'İki Faktörlü Kimlik Doğrulama',
          description: 'Hesabınız için ek güvenlik katmanı',
          action: 'Etkinleştir',
        },
        sessionHistory: {
          title: 'Oturum Geçmişi',
          description: 'Son giriş aktivitelerinizi görüntüleyin',
          action: 'Görüntüle',
        },
        activeSessions: {
          title: 'Aktif Oturumlar',
          description: 'Diğer cihazlardaki oturumları yönetin',
          action: 'Tümünü Sonlandır',
        },
      },
    },

    privacy: {
      title: 'GDPR ve Veri Hakları',
      gdpr: {
        title: 'Kişisel Veri Yönetimi',
        description: 'GDPR uyumluluk kapsamında kişisel verilerinizi yönetin',
        export: {
          title: 'Verilerimi İndir',
          description: 'Tüm kişisel verilerinizi ZIP formatında indirin',
          button: 'Verilerimi İndir',
          disclaimer: 'İndirilen dosya JSON ve CSV formatlarında verilerinizi içerir.',
        },
        delete: {
          title: 'Hesabımı Sil',
          description: 'Hesabınızı ve tüm kişisel verilerinizi kalıcı olarak silin',
          button: 'Hesap Silme Talebi',
          warning: 'Bu işlem geri alınamaz ve tüm verileriniz silinir.',
          confirmDialog: {
            title: 'Hesap Silme Onayı',
            message: 'Hesabınızı silmek istediğinizden emin misiniz?',
            retention: 'Not: Muhasebe kayıtları yasal gereklilikler nedeniyle 10 yıl süreyle saklanacaktır.',
            confirm: 'Evet, Hesabımı Sil',
            cancel: 'İptal',
          },
        },
      },
    },

  },
  en: {
    header: {
      title: 'Settings',
      subtitle: 'Manage your system and account settings',
      unsavedChanges: 'There are unsaved changes',
      save: 'Save',
    },
    modals: {
      saveSuccess: {
        title: 'Saved',
        message: 'Your changes have been saved successfully.',
        confirm: 'OK',
      },
      saveError: {
        title: 'Error',
        message: 'An error occurred while saving your settings.',
        confirm: 'Close',
      },
      fileTypeError: { title: 'Invalid file type', message: 'Please select an image file only.', confirm: 'OK' },
      fileSizeError: { title: 'File too large', message: 'The file size must be less than 5MB.', confirm: 'OK' },
      authRequired: { title: 'Authentication required', message: 'Please sign in first.', confirm: 'OK' },
      sessionExpired: { title: 'Session expired', message: 'Please sign in again.', confirm: 'OK' },
      deleteRequested: { title: 'Request received', message: 'Your account deletion request has been submitted.', confirm: 'OK' },
      deleteFailed: { title: 'Request failed', message: 'Could not submit account deletion. Please try again.', confirm: 'Close' },
    },
    tabs: {
      profile: 'Profile',
      company: 'Company',
      notifications: 'Notifications',
      organization: 'Organization',
      fiscalPeriods: 'Fiscal Periods',
      system: 'System',
      security: 'Security',
      privacy: 'Privacy',
    },
    profile: {
      title: 'Profile Information',
      fields: {
        name: 'Full Name',
        email: 'Email Address',
        phone: 'Phone',
      },
      passwordTitle: 'Change Password',
      passwordFields: {
        current: 'Current Password',
        new: 'New Password',
        confirm: 'Confirm Password',
      },
    },
    company: {
      title: 'Company Information',
      logo: {
        label: 'Company Logo',
        upload: 'Upload Logo',
        remove: 'Remove',
        helper: 'You can upload PNG, JPG or GIF files up to 5MB.',
        uploaded: ({ name, sizeKB }) => `Logo ${name} (${sizeKB} KB)`,
      },
      fields: {
        name: 'Company Name',
        address: 'Address',
        taxNumber: 'Tax Number',
        taxOffice: 'Tax Office',
        phone: 'Phone',
        email: 'Email',
        website: 'Website',
      },
      legalFields: {
        title: 'Legal Compliance Fields',
        subtitle: 'Required information for international invoicing standards',
        countryHelp: "To enter company details, please select the company's country.",
        countrySelectLabel: 'Country',
        countryOptions: { TR: 'Turkey', US: 'United States', DE: 'Germany', FR: 'France', OTHER: 'Other' },
        turkey: {
          title: 'Turkey',
          mersisNumber: 'Mersis Number',
          kepAddress: 'KEP Address',
        },
        france: {
          title: 'France',
          siretNumber: 'SIRET Number',
          sirenNumber: 'SIREN Number',
          apeCode: 'APE/NAF Code',
          tvaNumber: 'TVA Number',
          rcsNumber: 'RCS Number',
        },
        germany: {
          title: 'Germany',
          steuernummer: 'Steuernummer',
          umsatzsteuerID: 'Umsatzsteuer-ID',
          handelsregisternummer: 'Handelsregisternummer',
          geschaeftsfuehrer: 'Geschäftsführer',
        },
        usa: {
          title: 'USA',
          einNumber: 'EIN Number',
          taxId: 'Tax ID',
          businessLicenseNumber: 'Business License No',
          stateOfIncorporation: 'State of Incorporation',
        },
        other: {
          title: 'Other Countries',
          registrationNumber: 'Registration No',
          vatNumber: 'VAT Number',
          taxId: 'Tax ID',
          stateOrRegion: 'State/Region',
        },
      },
      iban: {
        sectionTitle: 'IBAN to use on invoices',
        bankOption: 'Select from saved bank accounts',
        noBanks: '(No saved bank account)',
        bankSelectPlaceholder: 'Choose a bank',
        manualOption: 'Enter IBAN manually',
        ibanPlaceholder: 'TR00 0000 0000 0000 0000 0000 00',
        bankNamePlaceholder: 'Bank name (e.g. Ziraat Bankası)',
        preview: value => `Preview: ${value}`,
        previewExample: 'Ex: TRxx xxxx xxxx xxxx xxxx xxxx xx',
      },
    },
    notifications: {
      title: 'Notification Preferences',
      labels: {
        emailNotifications: 'Email Notifications',
        invoiceReminders: 'Invoice Reminders',
        expenseAlerts: 'Expense Alerts',
        paymentNotifications: 'Payment Notifications',
        weeklyReports: 'Weekly Reports',
        monthlyReports: 'Monthly Reports',
      },
    },
    system: {
      title: 'System Settings',
      currencyLabel: 'Currency',
      dateFormatLabel: 'Date Format',
      timezoneLabel: 'Time Zone',
      currencies: {
        TRY: '₺ Turkish Lira',
        USD: '$ US Dollar',
        EUR: '€ Euro',
      },
      timezones: {
        'Europe/Istanbul': 'Istanbul',
        UTC: 'UTC',
        'America/New_York': 'New York',
      },
      backup: {
        title: 'Backups',
        toggleLabel: 'Automatic Backup',
        toggleDescription: 'Back up your data automatically',
        frequencyLabel: 'Backup Frequency',
        options: {
          daily: 'Daily',
          weekly: 'Weekly',
          monthly: 'Monthly',
        },
      },
    },
    security: {
      tipsTitle: 'Security Tips',
      tips: [
        '• Use a strong password (at least 8 characters, upper/lowercase, numbers)',
        '• Change your password regularly',
        '• Enable two-factor authentication',
        '• Monitor suspicious activity',
      ],
      title: 'Security Settings',
      cards: {
        twoFactor: {
          title: 'Two-Factor Authentication',
          description: 'Additional security layer for your account',
          action: 'Enable',
        },
        sessionHistory: {
          title: 'Session History',
          description: 'Review recent login activity',
          action: 'View',
        },
        activeSessions: {
          title: 'Active Sessions',
          description: 'Manage sessions on other devices',
          action: 'Sign out all',
        },
      },
    },

    privacy: {
      title: 'GDPR & Data Rights',
      gdpr: {
        title: 'Personal Data Management',
        description: 'Manage your personal data under GDPR compliance',
        export: {
          title: 'Export My Data',
          description: 'Download all your personal data in ZIP format',
          button: 'Export My Data',
          disclaimer: 'The downloaded file contains your data in JSON and CSV formats.',
        },
        delete: {
          title: 'Delete My Account',
          description: 'Permanently delete your account and all personal data',
          button: 'Request Account Deletion',
          warning: 'This action cannot be undone and will delete all your data.',
          confirmDialog: {
            title: 'Account Deletion Confirmation',
            message: 'Are you sure you want to delete your account?',
            retention: 'Note: Accounting records will be retained for 10 years due to legal requirements.',
            confirm: 'Yes, Delete My Account',
            cancel: 'Cancel',
          },
        },
      },
    },

  },
  fr: {
    header: {
      title: 'Paramètres',
      subtitle: 'Gérez les paramètres du système et du compte',
      unsavedChanges: 'Des modifications non enregistrées',
      save: 'Enregistrer',
    },
    modals: {
      saveSuccess: {
        title: 'Enregistré',
        message: 'Vos modifications ont été enregistrées avec succès.',
        confirm: 'OK',
      },
      saveError: {
        title: 'Erreur',
        message: "Une erreur s'est produite lors de l'enregistrement des paramètres.",
        confirm: 'Fermer',
      },
      fileTypeError: { title: 'Type de fichier invalide', message: 'Veuillez sélectionner uniquement une image.', confirm: 'OK' },
      fileSizeError: { title: 'Fichier trop volumineux', message: 'La taille du fichier doit être inférieure à 5 Mo.', confirm: 'OK' },
      authRequired: { title: 'Authentification requise', message: 'Veuillez vous connecter d\'abord.', confirm: 'OK' },
      sessionExpired: { title: 'Session expirée', message: 'Veuillez vous reconnecter.', confirm: 'OK' },
      deleteRequested: { title: 'Demande reçue', message: 'Votre demande de suppression de compte a été envoyée.', confirm: 'OK' },
      deleteFailed: { title: 'Échec de la demande', message: 'La suppression du compte n\'a pas pu être soumise. Veuillez réessayer.', confirm: 'Fermer' },
    },
    tabs: {
      profile: 'Profil',
      company: 'Entreprise',
      notifications: 'Notifications',
      organization: 'Organisation',
      fiscalPeriods: 'Périodes fiscales',
      system: 'Système',
      security: 'Sécurité',
      privacy: 'Confidentialité',
    },
    profile: {
      title: 'Informations du profil',
      fields: {
        name: 'Nom complet',
        email: 'Adresse e-mail',
        phone: 'Téléphone',
      },
      passwordTitle: 'Changer le mot de passe',
      passwordFields: {
        current: 'Mot de passe actuel',
        new: 'Nouveau mot de passe',
        confirm: 'Confirmer le mot de passe',
      },
    },
    company: {
      title: "Informations sur l’entreprise",
      logo: {
        label: "Logo de l’entreprise",
        upload: 'Télécharger le logo',
        remove: 'Supprimer',
        helper: 'Vous pouvez téléverser des fichiers PNG, JPG ou GIF jusqu’à 5 Mo.',
        uploaded: ({ name, sizeKB }) => `Logo ${name} (${sizeKB} Ko)`,
      },
      fields: {
        name: "Nom de l’entreprise",
        address: 'Adresse',
        taxNumber: 'Numéro fiscal',
        taxOffice: 'Centre des impôts',
        phone: 'Téléphone',
        email: 'E-mail',
        website: 'Site Web',
      },
      legalFields: {
        title: 'Champs de conformité légale',
        subtitle: 'Informations requises pour les normes de facturation internationales',
        countryHelp: "Pour saisir les informations de l’entreprise, veuillez sélectionner le pays de l’entreprise.",
        countrySelectLabel: 'Pays',
        countryOptions: { TR: 'Turquie', US: 'États-Unis', DE: 'Allemagne', FR: 'France', OTHER: 'Autre' },
        turkey: {
          title: 'Turquie',
          mersisNumber: 'Numéro Mersis',
          kepAddress: 'Adresse KEP',
        },
        france: {
          title: 'France',
          siretNumber: 'Numéro SIRET',
          sirenNumber: 'Numéro SIREN',
          apeCode: 'Code APE/NAF',
          tvaNumber: 'Numéro TVA',
          rcsNumber: 'Numéro RCS',
        },
        germany: {
          title: 'Allemagne',
          steuernummer: 'Steuernummer',
          umsatzsteuerID: 'Umsatzsteuer-ID',
          handelsregisternummer: 'Handelsregisternummer',
          geschaeftsfuehrer: 'Geschäftsführer',
        },
        usa: {
          title: 'États-Unis',
          einNumber: 'Numéro EIN',
          taxId: 'Tax ID',
          businessLicenseNumber: 'N° de licence commerciale',
          stateOfIncorporation: 'État de constitution',
        },
        other: {
          title: 'Autres pays',
          registrationNumber: 'N° d\'enregistrement',
          vatNumber: 'N° TVA',
          taxId: 'Tax ID',
          stateOrRegion: 'État/Région',
        },
      },
      iban: {
        sectionTitle: 'IBAN utilisé sur les factures',
        bankOption: 'Choisir parmi les comptes bancaires enregistrés',
        noBanks: '(Aucun compte bancaire enregistré)',
        bankSelectPlaceholder: 'Choisissez une banque',
        manualOption: 'Saisir l’IBAN manuellement',
        ibanPlaceholder: 'TR00 0000 0000 0000 0000 0000 00',
        bankNamePlaceholder: 'Nom de la banque (ex. Ziraat Bankası)',
        preview: value => `Aperçu : ${value}`,
        previewExample: 'Ex : TRxx xxxx xxxx xxxx xxxx xxxx xx',
      },
    },
    notifications: {
      title: 'Préférences de notification',
      labels: {
        emailNotifications: 'Notifications par e-mail',
        invoiceReminders: 'Rappels de facture',
        expenseAlerts: 'Alertes de dépenses',
        paymentNotifications: 'Notifications de paiement',
        weeklyReports: 'Rapports hebdomadaires',
        monthlyReports: 'Rapports mensuels',
      },
    },
    system: {
      title: 'Paramètres du système',
      currencyLabel: 'Devise',
      dateFormatLabel: 'Format de date',
      timezoneLabel: 'Fuseau horaire',
      currencies: {
        TRY: '₺ Livre turque',
        USD: '$ Dollar américain',
        EUR: '€ Euro',
      },
      timezones: {
        'Europe/Istanbul': 'Istanbul',
        UTC: 'UTC',
        'America/New_York': 'New York',
      },
      backup: {
        title: 'Sauvegardes',
        toggleLabel: 'Sauvegarde automatique',
        toggleDescription: 'Sauvegardez vos données automatiquement',
        frequencyLabel: 'Fréquence de sauvegarde',
        options: {
          daily: 'Quotidienne',
          weekly: 'Hebdomadaire',
          monthly: 'Mensuelle',
        },
      },
    },
    security: {
      tipsTitle: 'Conseils de sécurité',
      tips: [
        '• Utilisez un mot de passe solide (au moins 8 caractères, majuscules/minuscules, chiffres)',
        '• Changez votre mot de passe régulièrement',
        '• Activez l’authentification à deux facteurs',
        '• Surveillez les activités suspectes',
      ],
      title: 'Paramètres de sécurité',
      cards: {
        twoFactor: {
          title: 'Authentification à deux facteurs',
          description: 'Une couche de sécurité supplémentaire pour votre compte',
          action: 'Activer',
        },
        sessionHistory: {
          title: 'Historique des sessions',
          description: 'Consultez vos connexions récentes',
          action: 'Afficher',
        },
        activeSessions: {
          title: 'Sessions actives',
          description: 'Gérez les sessions sur les autres appareils',
          action: 'Tout déconnecter',
        },
      },
    },

    privacy: {
      title: 'RGPD et Droits des Données',
      gdpr: {
        title: 'Gestion des Données Personnelles',
        description: 'Gérez vos données personnelles conformément au RGPD',
        export: {
          title: 'Exporter mes Données',
          description: 'Téléchargez toutes vos données personnelles au format ZIP',
          button: 'Exporter mes Données',
          disclaimer: 'Le fichier téléchargé contient vos données aux formats JSON et CSV.',
        },
        delete: {
          title: 'Supprimer mon Compte',
          description: 'Supprimez définitivement votre compte et toutes vos données personnelles',
          button: 'Demander la Suppression du Compte',
          warning: 'Cette action est irréversible et supprimera toutes vos données.',
          confirmDialog: {
            title: 'Confirmation de Suppression du Compte',
            message: 'Êtes-vous sûr de vouloir supprimer votre compte ?',
            retention: 'Note : Les registres comptables seront conservés 10 ans pour des raisons légales.',
            confirm: 'Oui, Supprimer mon Compte',
            cancel: 'Annuler',
          },
        },
      },
    },

  },
  de: {
    header: {
      title: 'Einstellungen',
      subtitle: 'System- und Kontoeinstellungen verwalten',
      unsavedChanges: 'Ungespeicherte Änderungen',
      save: 'Speichern',
    },
    modals: {
      saveSuccess: {
        title: 'Gespeichert',
        message: 'Ihre Änderungen wurden erfolgreich gespeichert.',
        confirm: 'OK',
      },
      saveError: {
        title: 'Fehler',
        message: 'Beim Speichern der Einstellungen ist ein Fehler aufgetreten.',
        confirm: 'Schließen',
      },
      fileTypeError: { title: 'Ungültiger Dateityp', message: 'Bitte wählen Sie nur eine Bilddatei aus.', confirm: 'OK' },
      fileSizeError: { title: 'Datei zu groß', message: 'Die Datei darf nicht größer als 5 MB sein.', confirm: 'OK' },
      authRequired: { title: 'Anmeldung erforderlich', message: 'Bitte melden Sie sich zuerst an.', confirm: 'OK' },
      sessionExpired: { title: 'Sitzung abgelaufen', message: 'Bitte melden Sie sich erneut an.', confirm: 'OK' },
      deleteRequested: { title: 'Anfrage erhalten', message: 'Ihre Kontolöschungsanfrage wurde übermittelt.', confirm: 'OK' },
      deleteFailed: { title: 'Anfrage fehlgeschlagen', message: 'Kontolöschung konnte nicht gesendet werden. Bitte erneut versuchen.', confirm: 'Schließen' },
    },
    tabs: {
      profile: 'Profil',
      company: 'Unternehmen',
      notifications: 'Benachrichtigungen',
      organization: 'Organisation',
      fiscalPeriods: 'Finanzperioden',
      system: 'System',
      security: 'Sicherheit',
      privacy: 'Datenschutz',
    },
    profile: {
      title: 'Profilinformationen',
      fields: {
        name: 'Vollständiger Name',
        email: 'E-Mail-Adresse',
        phone: 'Telefon',
      },
      passwordTitle: 'Passwort ändern',
      passwordFields: {
        current: 'Aktuelles Passwort',
        new: 'Neues Passwort',
        confirm: 'Passwort bestätigen',
      },
    },
    company: {
      title: 'Unternehmensinformationen',
      logo: {
        label: 'Unternehmenslogo',
        upload: 'Logo hochladen',
        remove: 'Entfernen',
        helper: 'Sie können PNG-, JPG- oder GIF-Dateien bis 5 MB hochladen.',
        uploaded: ({ name, sizeKB }) => `Logo ${name} (${sizeKB} KB)`,
      },
      fields: {
        name: 'Unternehmensname',
        address: 'Adresse',
        taxNumber: 'Steuernummer',
        taxOffice: 'Finanzamt',
        phone: 'Telefon',
        email: 'E-Mail',
        website: 'Webseite',
      },
      legalFields: {
        title: 'Rechtliche Compliance-Felder',
        subtitle: 'Erforderliche Informationen für internationale Rechnungsstandards',
        countryHelp: 'Um Unternehmensdaten einzugeben, wählen Sie bitte das Unternehmensland.',
        countrySelectLabel: 'Land',
        countryOptions: { TR: 'Türkei', US: 'USA', DE: 'Deutschland', FR: 'Frankreich', OTHER: 'Andere' },
        turkey: {
          title: 'Türkei',
          mersisNumber: 'Mersis-Nummer',
          kepAddress: 'KEP-Adresse',
        },
        france: {
          title: 'Frankreich',
          siretNumber: 'SIRET-Nummer',
          sirenNumber: 'SIREN-Nummer',
          apeCode: 'APE/NAF-Code',
          tvaNumber: 'TVA-Nummer',
          rcsNumber: 'RCS-Nummer',
        },
        germany: {
          title: 'Deutschland',
          steuernummer: 'Steuernummer',
          umsatzsteuerID: 'Umsatzsteuer-ID',
          handelsregisternummer: 'Handelsregisternummer',
          geschaeftsfuehrer: 'Geschäftsführer',
        },
        usa: {
          title: 'USA',
          einNumber: 'EIN-Nummer',
          taxId: 'Tax ID',
          businessLicenseNumber: 'Gewerbelizenznummer',
          stateOfIncorporation: 'Gründungsstaat',
        },
        other: {
          title: 'Andere Länder',
          registrationNumber: 'Registernummer',
          vatNumber: 'USt/VAT-Nr.',
          taxId: 'Steuer-ID',
          stateOrRegion: 'Staat/Region',
        },
      },
      iban: {
        sectionTitle: 'IBAN für Rechnungen',
        bankOption: 'Aus registrierten Bankkonten auswählen',
        noBanks: '(Keine Bankkonten registriert)',
        bankSelectPlaceholder: 'Bank auswählen',
        manualOption: 'IBAN manuell eingeben',
        ibanPlaceholder: 'DE00 0000 0000 0000 0000 00',
        bankNamePlaceholder: 'Bankname (z.B. Deutsche Bank)',
        preview: value => `Vorschau: ${value}`,
        previewExample: 'z.B.: DExx xxxx xxxx xxxx xxxx xx',
      },
    },
    notifications: {
      title: 'Benachrichtigungseinstellungen',
      labels: {
        emailNotifications: 'E-Mail-Benachrichtigungen',
        invoiceReminders: 'Rechnungserinnerungen',
        expenseAlerts: 'Ausgabenwarnungen',
        paymentNotifications: 'Zahlungsbenachrichtigungen',
        weeklyReports: 'Wöchentliche Berichte',
        monthlyReports: 'Monatliche Berichte',
      },
    },
    system: {
      title: 'Systemeinstellungen',
      currencyLabel: 'Währung',
      dateFormatLabel: 'Datumsformat',
      timezoneLabel: 'Zeitzone',
      currencies: {
        TRY: '₺ Türkische Lira',
        USD: '$ US-Dollar',
        EUR: '€ Euro',
      },
      timezones: {
        'Europe/Istanbul': 'Istanbul',
        UTC: 'UTC',
        'America/New_York': 'New York',
      },
      backup: {
        title: 'Sicherungen',
        toggleLabel: 'Automatische Sicherung',
        toggleDescription: 'Sichern Sie Ihre Daten automatisch',
        frequencyLabel: 'Sicherungshäufigkeit',
        options: {
          daily: 'Täglich',
          weekly: 'Wöchentlich',
          monthly: 'Monatlich',
        },
      },
    },
    security: {
      tipsTitle: 'Sicherheitstipps',
      tips: [
        '• Verwenden Sie ein starkes Passwort (mindestens 8 Zeichen, Groß-/Kleinbuchstaben, Zahlen)',
        '• Ändern Sie Ihr Passwort regelmäßig',
        '• Aktivieren Sie die Zwei-Faktor-Authentifizierung',
        '• Überwachen Sie verdächtige Aktivitäten',
      ],
      title: 'Sicherheitseinstellungen',
      cards: {
        twoFactor: {
          title: 'Zwei-Faktor-Authentifizierung',
          description: 'Eine zusätzliche Sicherheitsebene für Ihr Konto',
          action: 'Aktivieren',
        },
        sessionHistory: {
          title: 'Sitzungsverlauf',
          description: 'Sehen Sie Ihre letzten Anmeldungen',
          action: 'Anzeigen',
        },
        activeSessions: {
          title: 'Aktive Sitzungen',
          description: 'Verwalten Sie Sitzungen auf anderen Geräten',
          action: 'Alle abmelden',
        },
      },
    },

    privacy: {
      title: 'DSGVO & Datenrechte',
      gdpr: {
        title: 'Persönliche Datenverwaltung',
        description: 'Verwalten Sie Ihre persönlichen Daten gemäß DSGVO',
        export: {
          title: 'Meine Daten Exportieren',
          description: 'Laden Sie alle Ihre persönlichen Daten im ZIP-Format herunter',
          button: 'Meine Daten Exportieren',
          disclaimer: 'Die heruntergeladene Datei enthält Ihre Daten in JSON- und CSV-Formaten.',
        },
        delete: {
          title: 'Mein Konto Löschen',
          description: 'Löschen Sie Ihr Konto und alle persönlichen Daten dauerhaft',
          button: 'Kontolöschung Beantragen',
          warning: 'Diese Aktion kann nicht rückgängig gemacht werden und löscht alle Ihre Daten.',
          confirmDialog: {
            title: 'Bestätigung der Kontolöschung',
            message: 'Sind Sie sicher, dass Sie Ihr Konto löschen möchten?',
            retention: 'Hinweis: Buchhaltungsunterlagen werden aus rechtlichen Gründen 10 Jahre aufbewahrt.',
            confirm: 'Ja, Mein Konto Löschen',
            cancel: 'Abbrechen',
          },
        },
      },
    },

  },
};

export default function SettingsPage({
  user = { name: 'Demo User', email: 'demo@moneyflow.com' },
  company,
  bankAccounts = [],
  onUserUpdate,
  onCompanyUpdate,
  initialTab,
}: Omit<SettingsPageProps, 'language'>): JSX.Element {
  const [activeTab, setActiveTab] = useState('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showSaveError, setShowSaveError] = useState(false);
  const [infoModal, setInfoModal] = useState<{ open: boolean; title: string; message: string; tone: 'success' | 'error' | 'info' }>({ open: false, title: '', message: '', tone: 'info' });
  const openInfo = (title: string, message: string, tone: 'success' | 'error' | 'info' = 'info') => setInfoModal({ open: true, title, message, tone });
  
  // Privacy tab states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // i18next entegrasyonu
  const { i18n } = useTranslation();
  
  // i18next dilini kullan (tr/en/fr/de formatında)
  const i18nLanguage = i18n.language.toLowerCase().substring(0, 2);
  
  // SettingsPage için dil mapping
  const currentLanguage: SettingsLanguage = 
    (SUPPORTED_LANGUAGES.includes(i18nLanguage as any)) 
      ? i18nLanguage as SettingsLanguage 
      : 'tr'; // default Turkish
  
  const text = settingsTranslations[currentLanguage];
  const notificationLabels = text.notifications.labels;
  
  // Auth context - profil güncellemesi için
  const { refreshUser, user: authUser } = useAuth();
  // Tenant sahibi/ADMİN kontrolü: farklı sistemlerde rol isimleri değişebiliyor
  const roleNorm = (authUser?.role || '').toUpperCase();
  const isTenantOwner = roleNorm === 'TENANT_ADMIN' || roleNorm === 'OWNER' || roleNorm === 'ADMIN';

  // Resmi şirket adı (backend tenant.name) için yerel state
  const [officialCompanyName, setOfficialCompanyName] = useState<string>('');
  const [officialLoaded, setOfficialLoaded] = useState<boolean>(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await tenantsApi.getMyTenant();
        if (!cancelled) {
          // Resmi şirket adı: kullanıcı ismine otomatik düşmeyelim; companyName yoksa boş kalsın
          setOfficialCompanyName(me?.companyName ?? '');
          setOfficialLoaded(true);
        }
      } catch (e) {
        if (!cancelled) setOfficialLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  
  // Currency context
  const { currency, setCurrency } = useCurrency();
  
  console.log('[SettingsPage] Current currency from context:', currency);
  
  // Debug: currency değişimini izle
  useEffect(() => {
    console.log('[SettingsPage] Current currency:', currency);
  }, [currency]);

  // Profile
  const [profileData, setProfileData] = useState({
    name: user.name,
    email: user.email,
    phone: '+90 555 123 45 67',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Company (App’ten gelen company ile senkron)
  const [companyData, setCompanyData] = useState<LocalCompanyState>(() => ({
    name: company?.name ?? '',
    address: company?.address ?? '',
    taxNumber: company?.taxNumber ?? '',
    taxOffice: company?.taxOffice ?? '',
    phone: company?.phone ?? '',
    email: company?.email ?? '',
    website: company?.website ?? '',
    logoDataUrl: company?.logoDataUrl ?? '',
    bankAccountId: company?.bankAccountId ?? undefined,
    // Ülke seçimi yapılmadıysa TR (Türkiye) ile başlayalım; alanlar varsayılan olarak görünsün
    country: company?.country ?? 'TR',
    logoFile: null,
    
    // Türkiye yasal alanları
    mersisNumber: company?.mersisNumber ?? '',
    kepAddress: company?.kepAddress ?? '',
    
    // Fransa yasal alanları
    siretNumber: company?.siretNumber ?? '',
    sirenNumber: company?.sirenNumber ?? '',
    apeCode: company?.apeCode ?? '',
    tvaNumber: company?.tvaNumber ?? '',
    rcsNumber: company?.rcsNumber ?? '',
    
    // Almanya yasal alanları
    steuernummer: company?.steuernummer ?? '',
    umsatzsteuerID: company?.umsatzsteuerID ?? '',
    handelsregisternummer: company?.handelsregisternummer ?? '',
    geschaeftsfuehrer: company?.geschaeftsfuehrer ?? '',
    
    // Amerika yasal alanları
    einNumber: company?.einNumber ?? '',
    taxId: company?.taxId ?? '',
    businessLicenseNumber: company?.businessLicenseNumber ?? '',
    stateOfIncorporation: company?.stateOfIncorporation ?? '',

    // Diğer ülkeler (genel)
    registrationNumber: company?.registrationNumber ?? '',
    vatNumberGeneric: company?.vatNumberGeneric ?? '',
    taxIdGeneric: company?.taxIdGeneric ?? '',
    stateOrRegion: company?.stateOrRegion ?? '',
  }));

  // Props.company değişirse formu güncelle
  useEffect(() => {
    setCompanyData(prev => ({
      ...prev,
      name: company?.name ?? prev.name,
      address: company?.address ?? prev.address,
      taxNumber: company?.taxNumber ?? prev.taxNumber,
      taxOffice: company?.taxOffice ?? prev.taxOffice,
      phone: company?.phone ?? prev.phone,
      email: company?.email ?? prev.email,
      website: company?.website ?? prev.website,
      logoDataUrl: company?.logoDataUrl ?? prev.logoDataUrl,
      bankAccountId: company?.bankAccountId ?? prev.bankAccountId,
  country: company?.country ?? prev.country,
      
      // Yasal alanları da güncelle
      mersisNumber: company?.mersisNumber ?? prev.mersisNumber,
      kepAddress: company?.kepAddress ?? prev.kepAddress,
      siretNumber: company?.siretNumber ?? prev.siretNumber,
      sirenNumber: company?.sirenNumber ?? prev.sirenNumber,
      apeCode: company?.apeCode ?? prev.apeCode,
      tvaNumber: company?.tvaNumber ?? prev.tvaNumber,
      rcsNumber: company?.rcsNumber ?? prev.rcsNumber,
      steuernummer: company?.steuernummer ?? prev.steuernummer,
      umsatzsteuerID: company?.umsatzsteuerID ?? prev.umsatzsteuerID,
      handelsregisternummer: company?.handelsregisternummer ?? prev.handelsregisternummer,
      geschaeftsfuehrer: company?.geschaeftsfuehrer ?? prev.geschaeftsfuehrer,
      einNumber: company?.einNumber ?? prev.einNumber,
      taxId: company?.taxId ?? prev.taxId,
      businessLicenseNumber: company?.businessLicenseNumber ?? prev.businessLicenseNumber,
      stateOfIncorporation: company?.stateOfIncorporation ?? prev.stateOfIncorporation,

      registrationNumber: company?.registrationNumber ?? prev.registrationNumber,
      vatNumberGeneric: company?.vatNumberGeneric ?? prev.vatNumberGeneric,
      taxIdGeneric: company?.taxIdGeneric ?? prev.taxIdGeneric,
      stateOrRegion: company?.stateOrRegion ?? prev.stateOrRegion,
    }));
    setUnsavedChanges(false);
  }, [company]);

  // Notifications
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    invoiceReminders: true,
    expenseAlerts: true,
    paymentNotifications: true,
    weeklyReports: false,
    monthlyReports: true,
  });

  // System (currency context'ten geliyor, burada tutmuyoruz)
  const [systemSettings, setSystemSettings] = useState({
    language: 'tr',
    dateFormat: 'DD/MM/YYYY',
    timezone: 'Europe/Istanbul',
    theme: 'light',
    // TODO: Otomatik yedekleme - Backend servisi eklendiğinde aktif edilecek
    // autoBackup: true,
    // backupFrequency: 'daily',
  });

  const tabs = [
    { id: 'profile', label: text.tabs.profile, icon: User },
    { id: 'company', label: text.tabs.company, icon: Building2 },
    { id: 'organization', label: text.tabs.organization || 'Organization', icon: Users },
    { id: 'fiscal-periods', label: text.tabs.fiscalPeriods || 'Fiscal Periods', icon: Calendar },
    { id: 'notifications', label: text.tabs.notifications, icon: Bell },
    // System tab kaldırıldı, ayarları Şirket sekmesine taşındı
    { id: 'security', label: text.tabs.security, icon: Shield },
    { id: 'privacy', label: text.tabs.privacy, icon: Lock },
  ];

  // initialTab verilirse ilk açılışta ona geç
  useEffect(() => {
    if (!initialTab) return;
    const validTabIds = tabs.map(t => t.id);
    if (validTabIds.includes(initialTab)) {
      setActiveTab(initialTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  const handleProfileChange = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
    setUnsavedChanges(true);
  };

  const handleCompanyChange = (field: keyof LocalCompanyState, value: string) => {
    setCompanyData(prev => ({ ...prev, [field]: value }));
    setUnsavedChanges(true);
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      openInfo(text.modals.fileTypeError.title, text.modals.fileTypeError.message, 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      openInfo(text.modals.fileSizeError.title, text.modals.fileSizeError.message, 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      setCompanyData(prev => ({
        ...prev,
        logoDataUrl: e.target?.result as string,
        logoFile: file,
      }));
      setUnsavedChanges(true);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setCompanyData(prev => ({ ...prev, logoDataUrl: '', logoFile: null }));
    setUnsavedChanges(true);
  };

  const handleNotificationChange = (field: string, value: boolean) => {
    setNotificationSettings(prev => ({ ...prev, [field]: value }));
    setUnsavedChanges(true);
  };

  const handleSystemChange = (field: string, value: string | boolean) => {
    // Currency değişikliği context'e git
    if (field === 'currency') {
      console.log('[SettingsPage] handleSystemChange - Setting currency to:', value);
      setCurrency(value as 'TRY' | 'USD' | 'EUR');
    } else {
      setSystemSettings(prev => ({ ...prev, [field]: value }));
    }
    setUnsavedChanges(true);
  };

  const handleSave = async () => {
    console.log('🚀 KAYDET BUTONU BASILDI! profileData:', profileData);
    console.log('📤 Backend\'e gönderilecek veri:', {
      name: profileData.name,
      phone: profileData.phone,
    });
    
    try {
      // ✅ KULLANICI PROFİLİNİ BACKEND'E KAYDET
      console.log('🔄 usersApi.updateProfile ÇAĞRILIYOR...');
      const updatedUser = await usersApi.updateProfile({
        name: profileData.name,
        phone: profileData.phone,
      });
      console.log('✅ usersApi.updateProfile TAMAMLANDI, response:', updatedUser);
      
      // ⚠️ KRİTİK: Backend'den dönen updatedUser'ı DOĞRUDAN localStorage'a yaz
      localStorage.setItem('user', JSON.stringify(updatedUser));
      console.log('✅ localStorage user güncellendi:', updatedUser);
      
      // AuthContext'i de güncelle
      try {
        await refreshUser();
        console.log('✅ refreshUser() başarıyla tamamlandı!');
      } catch (refreshError) {
        console.error('⚠️ refreshUser() hatası (normal, localStorage güncel):', refreshError);
      }
      
      // UI update için App.tsx'e bildir (opsiyonel - zaten refreshUser yapıyor)
      if (onUserUpdate) {
        const userToUpdate = {
          name: `${updatedUser.firstName} ${updatedUser.lastName}`,
          email: updatedUser.email,
          phone: profileData.phone,
        };
        onUserUpdate(userToUpdate);
        console.log('✅ onUserUpdate prop çağrıldı');
      }
      
      console.log('✅✅✅ PROFİL DEĞİŞİKLİĞİ KALICI OLARAK KAYDEDİLDİ! ✅✅✅');
      console.log('💾 Database\'de kayıtlı:', updatedUser);

      // Resmi şirket adı değiştiyse ve kullanıcı tenant sahibi ise, backend'e yaz
      try {
        if (isTenantOwner && officialLoaded) {
          // Değişiklik kontrolü basitçe yapılır; gerçek senaryoda trim/normalize edilebilir
          // Backend tarafı sadece TENANT_ADMIN'e izin veriyor
          // companyData.name markalama alanı, officialCompanyName ise resmi alan
          const myTenant = await tenantsApi.getMyTenant();
          const currentOfficial = (myTenant?.companyName || myTenant?.name || '');
          if ((officialCompanyName || '') !== (currentOfficial || '')) {
            await tenantsApi.updateMyTenant({ companyName: officialCompanyName });
            // Backend kaydı değişti; App genelinde tenant adını yeniden çekmek istersen burada olay yayınlanabilir
          }
        }
      } catch (e) {
        console.error('Resmi şirket adı güncellenemedi:', e);
        // Kullanıcıya sessiz geçebiliriz; önemli olan engellenmemesi. Dilersen uyarı göster.
      }

      // Şirket bilgilerini BACKEND'E kaydet (tenant bazlı)
      let tenantUpdateOk = true;
      try {
        const brandSettings = {
          brand: {
            logoDataUrl: companyData.logoDataUrl || '',
            bankAccountId: companyData.bankAccountId || undefined,
            country: companyData.country || '',
          }
        };
        const payload: any = {
          // Temel alanlar
          companyName: officialCompanyName || companyData.name || undefined,
          address: companyData.address || undefined,
          taxNumber: companyData.taxNumber || undefined,
          taxOffice: companyData.taxOffice || undefined,
          phone: companyData.phone || undefined,
          email: companyData.email || undefined,
          website: companyData.website || undefined,
          // Yasal alanlar
          mersisNumber: companyData.mersisNumber || undefined,
          kepAddress: companyData.kepAddress || undefined,
          siretNumber: companyData.siretNumber || undefined,
          sirenNumber: companyData.sirenNumber || undefined,
          apeCode: companyData.apeCode || undefined,
          tvaNumber: companyData.tvaNumber || undefined,
          rcsNumber: companyData.rcsNumber || undefined,
          steuernummer: companyData.steuernummer || undefined,
          umsatzsteuerID: companyData.umsatzsteuerID || undefined,
          handelsregisternummer: companyData.handelsregisternummer || undefined,
          geschaeftsfuehrer: companyData.geschaeftsfuehrer || undefined,
          einNumber: companyData.einNumber || undefined,
          taxId: companyData.taxId || undefined,
          businessLicenseNumber: companyData.businessLicenseNumber || undefined,
          stateOfIncorporation: companyData.stateOfIncorporation || undefined,
          // Settings blob: logo, default bank, country
          settings: brandSettings,
        } as any;

        // Şirket sahibi değilse kimlik alanını hiç göndermeyelim
        if (!isTenantOwner) {
          delete payload.companyName;
        }

        await tenantsApi.updateMyTenant(payload);
      } catch (e) {
        console.error('Tenant settings update failed', e);
        tenantUpdateOk = false;
      }

      // UI hızlı güncelleme ve cache için App'e bildir
      if (onCompanyUpdate) {
        const cleaned: CompanyProfile = {
          name: companyData.name,
          address: companyData.address,
          taxNumber: companyData.taxNumber,
          taxOffice: companyData.taxOffice,
          phone: companyData.phone,
          email: companyData.email,
          website: companyData.website,
          logoDataUrl: companyData.logoDataUrl,
          bankAccountId: companyData.bankAccountId,
          country: (companyData.country ? (companyData.country as any) : undefined),
          // Yasal alanlar
          mersisNumber: companyData.mersisNumber,
          kepAddress: companyData.kepAddress,
          siretNumber: companyData.siretNumber,
          sirenNumber: companyData.sirenNumber,
          apeCode: companyData.apeCode,
          tvaNumber: companyData.tvaNumber,
          rcsNumber: companyData.rcsNumber,
          steuernummer: companyData.steuernummer,
          umsatzsteuerID: companyData.umsatzsteuerID,
          handelsregisternummer: companyData.handelsregisternummer,
          geschaeftsfuehrer: companyData.geschaeftsfuehrer,
          einNumber: companyData.einNumber,
          taxId: companyData.taxId,
          businessLicenseNumber: companyData.businessLicenseNumber,
          stateOfIncorporation: companyData.stateOfIncorporation,
          // Diğer (genel)
          registrationNumber: companyData.registrationNumber,
          vatNumberGeneric: companyData.vatNumberGeneric,
          taxIdGeneric: companyData.taxIdGeneric,
          stateOrRegion: companyData.stateOrRegion,
        };
        onCompanyUpdate(cleaned);
      }

      setUnsavedChanges(false);
      if (tenantUpdateOk) {
        setShowSaveSuccess(true);
      } else {
        setShowSaveError(true);
      }
    } catch (error) {
      console.error('Ayarlar kaydedilirken hata:', error);
      setShowSaveError(true);
    }
  };

  const renderProfileTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{text.profile.title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{text.profile.fields.name}</label>
          <input
            type="text"
            value={profileData.name}
            onChange={e => handleProfileChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{text.profile.fields.email}</label>
          <input
            type="email"
            value={profileData.email}
            onChange={e => handleProfileChange('email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{text.profile.fields.phone}</label>
          <input
            type="tel"
            value={profileData.phone}
            onChange={e => handleProfileChange('phone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>

    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{text.profile.passwordTitle}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{text.profile.passwordFields.current}</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={profileData.currentPassword}
              onChange={e => handleProfileChange('currentPassword', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{text.profile.passwordFields.new}</label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={profileData.newPassword}
            onChange={e => handleProfileChange('newPassword', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{text.profile.passwordFields.confirm}</label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={profileData.confirmPassword}
            onChange={e => handleProfileChange('confirmPassword', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>


    </div>
  </div>
  );

  const renderCompanyTab = () => {
    const hasBanks = bankAccounts.length > 0;
    const selectedBank = bankAccounts.find(b => b.id === companyData.bankAccountId);
    const hasCountry = Boolean(companyData.country && String(companyData.country).trim() !== '');
    // Ülke seçimi dilden bağımsız: şirket ayarındaki country alanına göre
    const legalCountry: 'turkey' | 'france' | 'germany' | 'usa' | 'other' =
      companyData.country === 'TR' ? 'turkey'
      : companyData.country === 'FR' ? 'france'
      : companyData.country === 'DE' ? 'germany'
      : companyData.country === 'US' ? 'usa'
      : 'other';
    
    return (
      <div className="space-y-6">
        {/* Genel Bilgiler (Ülke + temel alanlar) */}
        <Section title={text.company.title}>
          {/* Bilgilendirme metni */}
          <div className="mb-4 flex items-start gap-2 rounded-md bg-blue-50 p-3 text-blue-800">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{text.company.legalFields.countryHelp || 'Şirket bilgilerini girebilmek için lütfen şirket ülkesini seçin.'}</span>
          </div>
          {/* Ülke seçimi en üstte */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.countrySelectLabel || 'Ülke'}</label>
              <select
                value={companyData.country}
                onChange={e => handleCompanyChange('country', e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="TR">{text.company.legalFields.countryOptions?.TR || 'Türkiye'}</option>
                <option value="US">{text.company.legalFields.countryOptions?.US || 'Amerika'}</option>
                <option value="DE">{text.company.legalFields.countryOptions?.DE || 'Almanya'}</option>
                <option value="FR">{text.company.legalFields.countryOptions?.FR || 'Fransa'}</option>
                <option value="OTHER">{text.company.legalFields.countryOptions?.OTHER || 'Diğer'}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Resmi Şirket Adı (Backend) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Resmi Şirket Adı</label>
              <input
                type="text"
                value={officialCompanyName}
                onChange={e => {
                  setOfficialCompanyName(e.target.value);
                  setUnsavedChanges(true);
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${!isTenantOwner ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`}
                disabled={!isTenantOwner}
                title={!isTenantOwner ? 'Şirket adını yalnızca şirket sahibi veya yönetici güncelleyebilir' : undefined}
              />
              {!isTenantOwner && (
                <p className="mt-1 text-xs text-gray-500">Bu alan yalnızca şirket sahibi tarafından değiştirilebilir.</p>
              )}
            </div>

            {/* Fatura/Marka Adı (Yerel) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fatura/Marka Adı</label>
              <input
                type="text"
                value={companyData.name}
                onChange={e => handleCompanyChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Bu alan faturada/ekranda marka adı olarak kullanılabilir.</p>
            </div>
            {hasCountry && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.fields.phone}</label>
                  <input
                    type="tel"
                    value={companyData.phone}
                    onChange={e => handleCompanyChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.fields.email}</label>
                  <input
                    type="email"
                    value={companyData.email}
                    onChange={e => handleCompanyChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.fields.website}</label>
                  <input
                    type="url"
                    value={companyData.website}
                    onChange={e => handleCompanyChange('website', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.fields.address}</label>
                  <textarea
                    value={companyData.address}
                    onChange={e => handleCompanyChange('address', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Logo */}
        {hasCountry && (
          <Section title={text.company.logo.label} defaultOpen={false}>
            <div className="flex items-center space-x-4">
              {companyData.logoDataUrl ? (
                <div className="relative">
                  <img
                    src={companyData.logoDataUrl}
                    alt="Company Logo"
                    className="w-24 h-24 object-contain border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={handleRemoveLogo}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div>
                <input
                  type="file"
                  id="logo-upload"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <label
                  htmlFor="logo-upload"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer inline-block"
                >
                  {text.company.logo.upload}
                </label>
                <p className="text-sm text-gray-500 mt-2">{text.company.logo.helper}</p>
              </div>
            </div>
          </Section>
        )}

        {/* Yasal Gereklilik Alanları */}
        {hasCountry && (
          <Section title={text.company.legalFields.title} subtitle={text.company.legalFields.subtitle} defaultOpen={false}>
            {/* Türkiye */}
            {legalCountry === 'turkey' && (
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">🇹🇷 {text.company.legalFields.turkey.title}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.turkey.mersisNumber}</label>
                    <input
                      type="text"
                      value={companyData.mersisNumber}
                      onChange={e => handleCompanyChange('mersisNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0123456789012345"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.turkey.kepAddress}</label>
                    <input
                      type="email"
                      value={companyData.kepAddress}
                      onChange={e => handleCompanyChange('kepAddress', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="sirket@hs01.kep.tr"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Fransa */}
            {legalCountry === 'france' && (
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">🇫🇷 {text.company.legalFields.france.title}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.france.siretNumber}</label>
                    <input
                      type="text"
                      value={companyData.siretNumber}
                      onChange={e => handleCompanyChange('siretNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="12345678901234"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.france.sirenNumber}</label>
                    <input
                      type="text"
                      value={companyData.sirenNumber}
                      onChange={e => handleCompanyChange('sirenNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="123456789"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.france.apeCode}</label>
                    <input
                      type="text"
                      value={companyData.apeCode}
                      onChange={e => handleCompanyChange('apeCode', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="6202A"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.france.tvaNumber}</label>
                    <input
                      type="text"
                      value={companyData.tvaNumber}
                      onChange={e => handleCompanyChange('tvaNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="FR12345678901"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.france.rcsNumber}</label>
                    <input
                      type="text"
                      value={companyData.rcsNumber}
                      onChange={e => handleCompanyChange('rcsNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="123 456 789 RCS Paris"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Almanya */}
            {legalCountry === 'germany' && (
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">🇩🇪 {text.company.legalFields.germany.title}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.germany.steuernummer}</label>
                    <input
                      type="text"
                      value={companyData.steuernummer}
                      onChange={e => handleCompanyChange('steuernummer', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="12/345/67890"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.germany.umsatzsteuerID}</label>
                    <input
                      type="text"
                      value={companyData.umsatzsteuerID}
                      onChange={e => handleCompanyChange('umsatzsteuerID', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="DE123456789"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.germany.handelsregisternummer}</label>
                    <input
                      type="text"
                      value={companyData.handelsregisternummer}
                      onChange={e => handleCompanyChange('handelsregisternummer', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="HRB 12345"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.germany.geschaeftsfuehrer}</label>
                    <input
                      type="text"
                      value={companyData.geschaeftsfuehrer}
                      onChange={e => handleCompanyChange('geschaeftsfuehrer', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Max Mustermann"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Amerika */}
            {legalCountry === 'usa' && (
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">🇺🇸 {text.company.legalFields.usa.title}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.usa.einNumber}</label>
                    <input
                      type="text"
                      value={companyData.einNumber}
                      onChange={e => handleCompanyChange('einNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="12-3456789"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.usa.taxId}</label>
                    <input
                      type="text"
                      value={companyData.taxId}
                      onChange={e => handleCompanyChange('taxId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="123-45-6789"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.usa.businessLicenseNumber}</label>
                    <input
                      type="text"
                      value={companyData.businessLicenseNumber}
                      onChange={e => handleCompanyChange('businessLicenseNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="BL123456"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.usa.stateOfIncorporation}</label>
                    <input
                      type="text"
                      value={companyData.stateOfIncorporation}
                      onChange={e => handleCompanyChange('stateOfIncorporation', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Delaware"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Diğer Ülkeler */}
            {legalCountry === 'other' && (
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">🌐 {text.company.legalFields.other.title}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.other.registrationNumber}</label>
                    <input
                      type="text"
                      value={companyData.registrationNumber}
                      onChange={e => handleCompanyChange('registrationNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.other.vatNumber}</label>
                    <input
                      type="text"
                      value={companyData.vatNumberGeneric}
                      onChange={e => handleCompanyChange('vatNumberGeneric', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.other.taxId}</label>
                    <input
                      type="text"
                      value={companyData.taxIdGeneric}
                      onChange={e => handleCompanyChange('taxIdGeneric', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.other.stateOrRegion}</label>
                    <input
                      type="text"
                      value={companyData.stateOrRegion}
                      onChange={e => handleCompanyChange('stateOrRegion', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </Section>
        )}

        {/* IBAN bölümü ayrı bir section */}
        {hasCountry && (
          <Section title={text.company.iban.sectionTitle} defaultOpen={false}>
            {hasBanks ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.iban.bankOption}</label>
                <select
                  value={companyData.bankAccountId || ''}
                  onChange={e => handleCompanyChange('bankAccountId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{text.company.iban.bankSelectPlaceholder}</option>
                  {bankAccounts.map(bank => (
                    <option key={bank.id} value={bank.id}>
                      {bank.bankName} - {bank.accountName}
                    </option>
                  ))}
                </select>
                {selectedBank && (
                  <p className="text-sm text-gray-500 mt-1">IBAN: {selectedBank.iban}</p>
                )}
              </div>
            ) : (
              <p className="text-gray-600">{text.company.iban.noBanks}</p>
            )}
          </Section>
        )}

        {/* Sistem Ayarları ayrı bir section */}
        {hasCountry && (
          <Section title={text.system.title} defaultOpen={false}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{text.system.currencyLabel}</label>
                <select
                  value={currency}
                  onChange={e => {
                    console.log('[SettingsPage] Currency dropdown changed to:', e.target.value);
                    handleSystemChange('currency', e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="TRY">{text.system.currencies.TRY}</option>
                  <option value="USD">{text.system.currencies.USD}</option>
                  <option value="EUR">{text.system.currencies.EUR}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{text.system.dateFormatLabel}</label>
                <select
                  value={systemSettings.dateFormat}
                  onChange={e => handleSystemChange('dateFormat', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{text.system.timezoneLabel}</label>
                <select
                  value={systemSettings.timezone}
                  onChange={e => handleSystemChange('timezone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Europe/Istanbul">{text.system.timezones['Europe/Istanbul']}</option>
                  <option value="UTC">{text.system.timezones['UTC']}</option>
                  <option value="America/New_York">{text.system.timezones['America/New_York']}</option>
                </select>
              </div>
            </div>
          </Section>
        )}
      </div>
    );
  };

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{text.notifications.title}</h3>
        <div className="space-y-4">
          {Object.entries(notificationSettings).map(([key, value]) => {
            const label =
              notificationLabels[key as NotificationKey] ?? key;

            return (
              <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">{label}</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={e => handleNotificationChange(key, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className='w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[""] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600'></div>
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // System sekmesi kaldırıldı; ayarlar şirket sekmesine taşındı

  const renderSecurityTab = () => (
  <div className="space-y-6">
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
        <div>
          <h4 className="font-medium text-yellow-800">{text.security.tipsTitle}</h4>
          <ul className="text-sm text-yellow-700 mt-2 space-y-1">
            {text.security.tips.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>

    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{text.security.title}</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <div className="font-medium text-gray-900">{text.security.cards.twoFactor.title}</div>
            <div className="text-sm text-gray-500">{text.security.cards.twoFactor.description}</div>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            {text.security.cards.twoFactor.action}
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <div className="font-medium text-gray-900">{text.security.cards.sessionHistory.title}</div>
            <div className="text-sm text-gray-500">{text.security.cards.sessionHistory.description}</div>
          </div>
          <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
            {text.security.cards.sessionHistory.action}
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <div className="font-medium text-gray-900">{text.security.cards.activeSessions.title}</div>
            <div className="text-sm text-gray-500">{text.security.cards.activeSessions.description}</div>
          </div>
          <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            {text.security.cards.activeSessions.action}
          </button>
        </div>
      </div>
    </div>

    {/* Audit Logs Section */}
    <div className="border-t pt-6">
      <AuditLogComponent />
    </div>
  </div>
);

  const renderPrivacyTab = () => {

    const handleExportData = async () => {
      try {
        setIsExporting(true);
        
        const token = localStorage.getItem('auth_token');
        console.log('Token found:', token ? 'YES' : 'NO');
        if (!token) {
          openInfo(text.modals.authRequired.title, text.modals.authRequired.message, 'error');
          return;
        }

        console.log('Making export request...');
        const response = await fetch('/api/users/me/export', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        console.log('Response status:', response.status);
        if (!response.ok) {
          if (response.status === 401) {
            openInfo(text.modals.sessionExpired.title, text.modals.sessionExpired.message, 'error');
            return;
          }
          const errorText = await response.text();
          console.error('Export error:', response.status, errorText);
          throw new Error(`Export failed: ${response.status} - ${errorText}`);
        }

        // Download the ZIP file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `my-data-${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Lokalize edilmemiş; isterseniz modala çevrilebilir
        alert('Data exported successfully!');
      } catch (error) {
        console.error('Export error:', error);
        alert(`Failed to export data: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsExporting(false);
      }
    };

    const handleDeleteAccount = async () => {
      try {
        setIsDeletingAccount(true);
        
        const token = localStorage.getItem('auth_token');
        if (!token) {
          openInfo(text.modals.authRequired.title, text.modals.authRequired.message, 'error');
          setIsDeletingAccount(false);
          return;
        }

        const response = await fetch('/api/users/me/delete', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            openInfo(text.modals.sessionExpired.title, text.modals.sessionExpired.message, 'error');
            setIsDeletingAccount(false);
            return;
          }
          throw new Error('Account deletion request failed');
        }

        const result = await response.json();
        openInfo(text.modals.deleteRequested.title, result?.message || text.modals.deleteRequested.message, 'success');
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error('Account deletion error:', error);
        openInfo(text.modals.deleteFailed.title, text.modals.deleteFailed.message, 'error');
      } finally {
        setIsDeletingAccount(false);
      }
    };

    return (
      <div className="space-y-6">
        {/* Local Data Recovery panel kaldırıldı - backend persist zorunlu */}

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{text.privacy.title}</h3>
          <p className="text-gray-600 mb-6">{text.privacy.gdpr.description}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export Data */}
            <div className="p-6 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3 mb-4">
                <Download className="w-6 h-6 text-blue-600" />
                <div>
                  <h4 className="font-medium text-gray-900">{text.privacy.gdpr.export.title}</h4>
                  <p className="text-sm text-gray-500">{text.privacy.gdpr.export.description}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-4">{text.privacy.gdpr.export.disclaimer}</p>
              <button
                onClick={handleExportData}
                disabled={isExporting}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isExporting ? 'Exporting...' : text.privacy.gdpr.export.button}
              </button>
            </div>

            {/* Delete Account */}
            <div className="p-6 border border-red-200 rounded-lg bg-red-50">
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
                <div>
                  <h4 className="font-medium text-red-800">{text.privacy.gdpr.delete.title}</h4>
                  <p className="text-sm text-red-600">{text.privacy.gdpr.delete.description}</p>
                </div>
              </div>
              <p className="text-xs text-red-600 mb-4">{text.privacy.gdpr.delete.warning}</p>
              <button
                onClick={() => setIsDeleteDialogOpen(true)}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                {text.privacy.gdpr.delete.button}
              </button>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        {isDeleteDialogOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {text.privacy.gdpr.delete.confirmDialog.title}
              </h3>
              <p className="text-gray-600 mb-4">
                {text.privacy.gdpr.delete.confirmDialog.message}
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  {text.privacy.gdpr.delete.confirmDialog.retention}
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setIsDeleteDialogOpen(false)}
                  disabled={isDeletingAccount}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  {text.privacy.gdpr.delete.confirmDialog.cancel}
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isDeletingAccount ? 'Processing...' : text.privacy.gdpr.delete.confirmDialog.confirm}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
  {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Settings className="w-8 h-8 text-blue-600 mr-3" />
              {text.header.title}
            </h1>
            <p className="text-gray-600">{text.header.subtitle}</p>
          </div>
          {unsavedChanges && (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-orange-600">
                <Info className="w-4 h-4" />
                <span className="text-sm">{text.header.unsavedChanges}</span>
              </div>
              <button
                onClick={handleSave}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{text.header.save}</span>
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 border-b border-gray-200 mt-6 sticky top-16 z-20 bg-white">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium text-sm">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6">
          {activeTab === 'profile' && renderProfileTab()}
          {activeTab === 'company' && renderCompanyTab()}
          {activeTab === 'organization' && <OrganizationMembersPage />}
          {activeTab === 'fiscal-periods' && <FiscalPeriodsPage />}
          {activeTab === 'notifications' && renderNotificationsTab()}
          {/* System sekmesi kaldırıldı */}
          {activeTab === 'security' && renderSecurityTab()}
          {activeTab === 'privacy' && renderPrivacyTab()}
        </div>
      </div>

      {/* Save result modals */}
      <InfoModal
        isOpen={showSaveSuccess}
        onClose={() => setShowSaveSuccess(false)}
        title={text.modals.saveSuccess.title}
        message={text.modals.saveSuccess.message}
        confirmLabel={text.modals.saveSuccess.confirm}
        tone="success"
        autoCloseMs={1800}
      />
      <InfoModal
        isOpen={showSaveError}
        onClose={() => setShowSaveError(false)}
        title={text.modals.saveError.title}
        message={text.modals.saveError.message}
        confirmLabel={text.modals.saveError.confirm}
        tone="error"
      />
      <InfoModal
        isOpen={infoModal.open}
        onClose={() => setInfoModal(m => ({ ...m, open: false }))}
        title={infoModal.title}
        message={infoModal.message}
        confirmLabel={text.modals.saveSuccess.confirm}
        tone={infoModal.tone}
      />
    </div>
  );
}
