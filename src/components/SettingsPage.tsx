import React, { useEffect, useState } from 'react';
import {
  Settings,
  User,
  Building2,
  Bell,
  Shield,
  Database,
  Download,
  Upload,
  Save,
  Eye,
  EyeOff,
  AlertTriangle,
  Info,
} from 'lucide-react';
import type { CompanyProfile } from '../utils/pdfGenerator';

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
  onImportData?: (data: any) => void;
  language?: 'tr' | 'en' | 'fr';
}

// Yalnızca ekranda önizleme için (CompanyProfile + logoFile)
type LocalCompanyState = CompanyProfile & { logoFile?: File | null };

const SUPPORTED_LANGUAGES = ['tr', 'en', 'fr'] as const;
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
  tabs: {
    profile: string;
    company: string;
    notifications: string;
    system: string;
    security: string;
    data: string;
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
    languageLabel: string;
    timezoneLabel: string;
    currencies: Record<'TRY' | 'USD' | 'EUR', string>;
    languages: Record<'tr' | 'en' | 'fr', string>;
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
  data: {
    title: string;
    export: { title: string; description: string; button: string };
    import: { title: string; description: string };
  };
  alerts: {
    importSuccess: string;
    importError: string;
  };
  dangerZone: {
    title: string;
    description: string;
    deleteAll: string;
    closeAccount: string;
  };
};

const settingsTranslations: Record<SettingsLanguage, SettingsTranslations> = {
  tr: {
    header: {
      title: 'Ayarlar',
      subtitle: 'Sistem ve hesap ayarlarınızı yönetin',
      unsavedChanges: 'Kaydedilmemiş değişiklikler var',
      save: 'Kaydet',
    },
    tabs: {
      profile: 'Profil',
      company: 'Şirket',
      notifications: 'Bildirimler',
      system: 'Sistem',
      security: 'Güvenlik',
      data: 'Veri Yönetimi',
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
        invalidFileType: 'Lütfen sadece resim dosyası seçin.',
        fileTooLarge: 'Dosya boyutu 5MB\'dan küçük olmalıdır.',
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
      currencyLabel: '{text.system.currencyLabel}',
      dateFormatLabel: '{text.system.dateFormatLabel}',
      languageLabel: 'Dil',
      timezoneLabel: '{text.system.timezoneLabel}',
      currencies: {
        TRY: '{text.system.currencies.TRY}',
        USD: '{text.system.currencies.USD}',
        EUR: '{text.system.currencies.EUR}',
      },
      languages: {
        tr: 'Türkçe',
        en: 'English',
        fr: 'Français',
      },
      timezones: {
        'Europe/Istanbul': 'İstanbul',
        UTC: 'UTC',
        'America/New_York': 'New York',
      },
      backup: {
        title: 'Yedekleme',
        toggleLabel: '{text.system.backup.toggleLabel}',
        toggleDescription: '{text.system.backup.toggleDescription}',
        frequencyLabel: '{text.system.backup.frequencyLabel}',
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
    data: {
      title: 'Veri İçe/Dışa Aktarma',
      export: {
        title: 'Veri Dışa Aktarma',
        description: 'Tüm verilerinizi JSON formatında indirin',
        button: 'Verileri Dışa Aktar',
      },
      import: {
        title: 'Veri İçe Aktarma',
        description: 'JSON dosyasından veri yükleyin',
      },
    },
    alerts: {
      importSuccess: 'Veriler başarıyla içe aktarıldı!',
      importError: 'Dosya formatı hatalı!',
    },
    dangerZone: {
      title: 'Tehlikeli Bölge',
      description: 'Bu işlemler geri alınamaz. Lütfen dikkatli olun.',
      deleteAll: 'Tüm Verileri Sil',
      closeAccount: 'Hesabı Kapat',
    },
  },
  en: {
    header: {
      title: 'Settings',
      subtitle: 'Manage your system and account settings',
      unsavedChanges: 'There are unsaved changes',
      save: 'Save',
    },
    tabs: {
      profile: 'Profile',
      company: 'Company',
      notifications: 'Notifications',
      system: 'System',
      security: 'Security',
      data: 'Data Management',
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
        invalidFileType: 'Please select an image file.',
        fileTooLarge: 'File size must be under 5MB.',
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
      languageLabel: 'Language',
      timezoneLabel: 'Time Zone',
      currencies: {
        TRY: '₺ Turkish Lira',
        USD: '$ US Dollar',
        EUR: '{text.system.currencies.EUR}',
      },
      languages: {
        tr: 'Türkçe',
        en: 'English',
        fr: 'Français',
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
    data: {
      title: 'Data Import / Export',
      export: {
        title: 'Export Data',
        description: 'Download all your data in JSON format',
        button: 'Export Data',
      },
      import: {
        title: 'Import Data',
        description: 'Upload data from a JSON file',
      },
    },
    alerts: {
      importSuccess: 'Data imported successfully!',
      importError: 'Invalid file format!',
    },
    dangerZone: {
      title: 'Danger Zone',
      description: 'These actions cannot be undone. Proceed with caution.',
      deleteAll: 'Delete All Data',
      closeAccount: 'Close Account',
    },
  },
  fr: {
    header: {
      title: 'Paramètres',
      subtitle: 'Gérez les paramètres du système et du compte',
      unsavedChanges: 'Des modifications non enregistrées',
      save: 'Enregistrer',
    },
    tabs: {
      profile: 'Profil',
      company: 'Entreprise',
      notifications: 'Notifications',
      system: 'Système',
      security: 'Sécurité',
      data: 'Gestion des données',
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
        invalidFileType: 'Veuillez sélectionner un fichier image.',
        fileTooLarge: 'La taille du fichier doit être inférieure à 5 Mo.',
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
      languageLabel: 'Langue',
      timezoneLabel: 'Fuseau horaire',
      currencies: {
        TRY: '₺ Livre turque',
        USD: '$ Dollar américain',
        EUR: '{text.system.currencies.EUR}',
      },
      languages: {
        tr: 'Türkçe',
        en: 'English',
        fr: 'Français',
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
    data: {
      title: 'Import / Export des données',
      export: {
        title: 'Exporter les données',
        description: 'Téléchargez toutes vos données au format JSON',
        button: 'Exporter les données',
      },
      import: {
        title: 'Importer des données',
        description: 'Téléversez des données depuis un fichier JSON',
      },
    },
    alerts: {
      importSuccess: 'Les données ont été importées avec succès !',
      importError: 'Format de fichier invalide !',
    },
    dangerZone: {
      title: 'Zone dangereuse',
      description: 'Ces actions sont irréversibles. Faites preuve de prudence.',
      deleteAll: 'Supprimer toutes les données',
      closeAccount: 'Fermer le compte',
    },
  },
};

const ensureLanguage = (value?: string): SettingsLanguage => {
  if (value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)) {
    return value as SettingsLanguage;
  }
  return 'tr';
};

export default function SettingsPage({
  user = { name: 'Demo User', email: 'demo@moneyflow.com' },
  company,
  bankAccounts = [],
  onUserUpdate,
  onCompanyUpdate,
  onExportData,
  onImportData,
  language = 'tr',
}: SettingsPageProps): JSX.Element {
  const [activeTab, setActiveTab] = useState('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  const currentLanguage = ensureLanguage(language);
  const text = settingsTranslations[currentLanguage];
  const notificationLabels = text.notifications.labels;

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
    name: company?.name ?? 'MoneyFlow Muhasebe',
    address: company?.address ?? 'İstanbul, Türkiye',
    taxNumber: company?.taxNumber ?? '1234567890',
    taxOffice: company?.taxOffice ?? '',
    phone: company?.phone ?? '+90 212 123 45 67',
    email: company?.email ?? 'info@moneyflow.com',
    website: company?.website ?? 'www.moneyflow.com',
    logoDataUrl: company?.logoDataUrl ?? '',
    iban: company?.iban ?? '',
    bankAccountId: company?.bankAccountId ?? undefined,
    bankName: company?.bankName ?? undefined,
    bankAccountName: company?.bankAccountName ?? undefined,
    manualBankName: company?.manualBankName ?? '',
    logoFile: null,
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
      iban: company?.iban ?? prev.iban,
      bankAccountId: company?.bankAccountId ?? prev.bankAccountId,
      bankName: company?.bankName ?? prev.bankName,
      bankAccountName: company?.bankAccountName ?? prev.bankAccountName,
      manualBankName: company?.manualBankName ?? prev.manualBankName,
    }));
    setUnsavedChanges(false);
  }, [company]);

  const formatIban = (v?: string) =>
    (v || '').replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

  // Notifications
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    invoiceReminders: true,
    expenseAlerts: true,
    paymentNotifications: true,
    weeklyReports: false,
    monthlyReports: true,
  });

  // System
  const [systemSettings, setSystemSettings] = useState({
    language: 'tr',
    currency: 'TRY',
    dateFormat: 'DD/MM/YYYY',
    timezone: 'Europe/Istanbul',
    theme: 'light',
    autoBackup: true,
    backupFrequency: 'daily',
  });

  const tabs = [
    { id: 'profile', label: text.tabs.profile, icon: User },
    { id: 'company', label: text.tabs.company, icon: Building2 },
    { id: 'notifications', label: text.tabs.notifications, icon: Bell },
    { id: 'system', label: text.tabs.system, icon: Settings },
    { id: 'security', label: text.tabs.security, icon: Shield },
    { id: 'data', label: text.tabs.data, icon: Database },
  ];

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
      alert(text.company.logo.invalidFileType);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert(text.company.logo.fileTooLarge);
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
    setSystemSettings(prev => ({ ...prev, [field]: value }));
    setUnsavedChanges(true);
  };

  const handleSave = () => {
  if (onUserUpdate) onUserUpdate(profileData);

  if (onCompanyUpdate) {
    const selected = bankAccounts.find(b => b.id === companyData.bankAccountId);
    const cleaned: CompanyProfile = {
      ...companyData,
      logoFile: undefined,
      iban: (companyData.iban ?? '').replace(/\s+/g, ''),
      bankName: companyData.bankAccountId ? selected?.bankName : (companyData.manualBankName || undefined),
      bankAccountName: companyData.bankAccountId ? selected?.accountName : undefined,
    };
    onCompanyUpdate(cleaned);
  }

  setUnsavedChanges(false);
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

      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-800">{text.dangerZone.title}</h4>
            <p className="text-sm text-red-700 mt-1">{text.dangerZone.description}</p>
            <div className="mt-4 space-y-2">
              <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                {text.dangerZone.deleteAll}
              </button>
              <button className="ml-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
                {text.dangerZone.closeAccount}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const renderCompanyTab = () => {
  const hasBanks = bankAccounts.length > 0;
  const selectedBank = bankAccounts.find(b => b.id === companyData.bankAccountId);

const handleExport = () => {
  onExportData?.();
};

const handleDataImport = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target?.result as string);
      onImportData?.(data);
      alert(text.alerts.importSuccess);
    } catch {
      alert(text.alerts.importError);
    }
  };
  reader.readAsText(file);
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

  const renderSystemTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{text.system.title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{text.system.currencyLabel}</label>
            <select
              value={systemSettings.currency}
              onChange={e => handleSystemChange('currency', e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">{text.system.languageLabel}</label>
            <select
              value={systemSettings.language}
              onChange={e => handleSystemChange('language', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="tr">{text.system.languages.tr}</option>
              <option value="en">{text.system.languages.en}</option>
              <option value="fr">{text.system.languages.fr}</option>
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
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{text.system.backup.title}</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">{text.system.backup.toggleLabel}</div>
              <div className="text-sm text-gray-500">{text.system.backup.toggleDescription}</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={systemSettings.autoBackup}
                onChange={e => handleSystemChange('autoBackup', e.target.checked)}
                className="sr-only peer"
              />
              <div className='w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[""] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600'></div>
            </label>
          </div>

          {systemSettings.autoBackup && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{text.system.backup.frequencyLabel}</label>
              <select
                value={systemSettings.backupFrequency}
                onChange={e => handleSystemChange('backupFrequency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="daily">{text.system.backup.options.daily}</option>
                <option value="weekly">{text.system.backup.options.weekly}</option>
                <option value="monthly">{text.system.backup.options.monthly}</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );

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

      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-800">{text.dangerZone.title}</h4>
            <p className="text-sm text-red-700 mt-1">{text.dangerZone.description}</p>
            <div className="mt-4 space-y-2">
              <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                {text.dangerZone.deleteAll}
              </button>
              <button className="ml-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
                {text.dangerZone.closeAccount}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const renderDataTab = () => (
  <div className="space-y-6">
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{text.data.title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center space-x-3 mb-3">
            <Download className="w-6 h-6 text-green-600" />
            <div>
              <h4 className="font-medium text-gray-900">{text.data.export.title}</h4>
              <p className="text-sm text-gray-500">{text.data.export.description}</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            {text.data.export.button}
          </button>
        </div>

        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center space-x-3 mb-3">
            <Upload className="w-6 h-6 text-blue-600" />
            <div>
              <h4 className="font-medium text-gray-900">{text.data.import.title}</h4>
              <p className="text-sm text-gray-500">{text.data.import.description}</p>
            </div>
          </div>
          <input
            type="file"
            accept=".json"
            onChange={handleDataImport}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-800">{text.dangerZone.title}</h4>
            <p className="text-sm text-red-700 mt-1">{text.dangerZone.description}</p>
            <div className="mt-4 space-y-2">
              <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                {text.dangerZone.deleteAll}
              </button>
              <button className="ml-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
                {text.dangerZone.closeAccount}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{text.company.title}</h3>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.logo.label}</label>
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
              {companyData.logoDataUrl ? (
                <img
                  src={companyData.logoDataUrl}
                  alt={text.company.logo.label}
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <Building2 className="w-8 h-8 text-gray-400" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  <span className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                    <Upload className="w-4 h-4 mr-2" />
                    {text.company.logo.upload}
                  </span>
                </label>

                {companyData.logoDataUrl && (
                  <button
                    onClick={handleRemoveLogo}
                    className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                  >
                    {text.company.logo.remove}
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">{text.company.logo.helper}</p>
              {companyData.logoFile && (
                <p className="text-xs text-green-600 mt-1">
                  {text.company.logo.uploaded({
                    name: companyData.logoFile.name,
                    sizeKB: ((companyData.logoFile.size ?? 0) / 1024).toFixed(1),
                  })}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.fields.name}</label>
            <input
              type="text"
              value={companyData.name ?? ''}
              onChange={e => handleCompanyChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="md:col-span-2 mt-2 space-y-3">
          <label className="block text-sm font-medium text-gray-700">{text.company.iban.sectionTitle}</label>

          <div className="p-3 border border-gray-200 rounded-lg space-y-3">
            <div className="flex items-center">
              <input
                type="radio"
                id="iban-source-bank"
                name="iban-source"
                className="mr-2"
                disabled={!hasBanks}
                checked={!!companyData.bankAccountId}
                onChange={() => {
                  if (!hasBanks) return;
                  const first = selectedBank ?? bankAccounts[0];
                  setCompanyData(prev => ({
                    ...prev,
                    bankAccountId: first.id,
                    iban: first.iban,
                    bankName: first.bankName,
                    bankAccountName: first.accountName,
                  }));
                  setUnsavedChanges(true);
                }}
              />
              <label htmlFor="iban-source-bank" className="font-medium text-gray-900">
                {text.company.iban.bankOption}
              </label>
              {!hasBanks && (
                <span className="ml-2 text-xs text-gray-500">{text.company.iban.noBanks}</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                disabled={!companyData.bankAccountId}
                value={companyData.bankAccountId ?? ''}
                onChange={e => {
                  const sel = bankAccounts.find(b => b.id === e.target.value);
                  setCompanyData(prev => ({
                    ...prev,
                    bankAccountId: sel?.id,
                    iban: sel?.iban ?? '',
                    bankName: sel?.bankName,
                    bankAccountName: sel?.accountName,
                  }));
                  setUnsavedChanges(true);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {!companyData.bankAccountId && (
                  <option value="">{text.company.iban.bankSelectPlaceholder}</option>
                )}
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} — {b.accountName}
                  </option>
                ))}
              </select>
              <input
                type="text"
                disabled={!companyData.bankAccountId}
                value={companyData.bankAccountId ? (selectedBank?.iban ?? '') : ''}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="p-3 border border-gray-200 rounded-lg space-y-3">
            <div className="flex items-center">
              <input
                type="radio"
                id="iban-source-manual"
                name="iban-source"
                className="mr-2"
                checked={!companyData.bankAccountId}
                onChange={() => {
                  setCompanyData(prev => ({
                    ...prev,
                    bankAccountId: undefined,
                    bankName: undefined,
                    bankAccountName: undefined,
                  }));
                  setUnsavedChanges(true);
                }}
              />
              <label htmlFor="iban-source-manual" className="font-medium text-gray-900">
                {text.company.iban.manualOption}
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                disabled={!!companyData.bankAccountId}
                value={companyData.bankAccountId ? '' : (companyData.iban ?? '')}
                onChange={e => {
                  setCompanyData(prev => ({ ...prev, iban: e.target.value }));
                  setUnsavedChanges(true);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={text.company.iban.ibanPlaceholder}
              />
              <input
                type="text"
                disabled={!!companyData.bankAccountId}
                value={companyData.bankAccountId ? '' : (companyData.manualBankName ?? '')}
                onChange={e => {
                  setCompanyData(prev => ({ ...prev, manualBankName: e.target.value }));
                  setUnsavedChanges(true);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={text.company.iban.bankNamePlaceholder}
              />
            </div>

            <p className="text-xs text-gray-500">
              {companyData.iban
                ? text.company.iban.preview(formatIban(companyData.iban))
                : text.company.iban.previewExample}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.fields.taxNumber}</label>
            <input
              type="text"
              value={companyData.taxNumber ?? ''}
              onChange={e => handleCompanyChange('taxNumber', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.fields.taxOffice}</label>
            <input
              type="text"
              value={companyData.taxOffice ?? ''}
              onChange={e => handleCompanyChange('taxOffice', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.fields.phone}</label>
            <input
              type="tel"
              value={companyData.phone ?? ''}
              onChange={e => handleCompanyChange('phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.fields.email}</label>
            <input
              type="email"
              value={companyData.email ?? ''}
              onChange={e => handleCompanyChange('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.fields.website}</label>
            <input
              type="url"
              value={companyData.website ?? ''}
              onChange={e => handleCompanyChange('website', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.fields.address}</label>
          <textarea
            value={companyData.address ?? ''}
            onChange={e => handleCompanyChange('address', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
        </div>
      </div>
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
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex">
          {/* Sidebar */}
          <div className="w-64 bg-gray-50 border-r border-gray-200">
            <nav className="p-4 space-y-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700 border-r-4 border-blue-600'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Body */}
          <div className="flex-1 p-6">
            {activeTab === 'profile' && renderProfileTab()}
            {activeTab === 'company' && renderCompanyTab()}
            {activeTab === 'notifications' && renderNotificationsTab()}
            {activeTab === 'system' && renderSystemTab()}
            {activeTab === 'security' && renderSecurityTab()}
            {activeTab === 'data' && renderDataTab()}
          </div>
        </div>
      </div>
    </div>
  );
}




