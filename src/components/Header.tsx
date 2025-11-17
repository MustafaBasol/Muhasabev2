import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Search,
  Bell,
  LogOut,
  User,
  Menu,
  Globe,
  Check
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslation } from 'react-i18next';

export interface HeaderNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  firstSeenAt?: number; // İlk gösterildiği zaman (ms)
  type?: 'info' | 'warning' | 'success' | 'danger';
  read?: boolean;
  readAt?: number; // Timestamp: okunma zamanı (1 gün sonra silinecek)
  link?: string; // Bildirime tıklandığında gidilecek sayfa
  persistent?: boolean; // Kalıcı bildirim - koşul sağlandığı sürece her gün tekrar göster
  repeatDaily?: boolean; // Her gün tekrar göster (ödeme tarihi geçenler için)
  relatedId?: string; // İlgili kayıt ID (fatura/gider ID)
  // i18n yeniden yerelleştirme için meta
  i18nTitleKey?: string;
  i18nDescKey?: string;
  i18nParams?: Record<string, any>;
}

interface HeaderProps {
  user?: {
    name: string;
    email: string;
  };
  onLogout: () => void;
  onNewInvoice: () => void;
  onNewSale: () => void;
  activePage?: string;
  customTitle?: string;
  onToggleSidebar?: () => void;
  notifications?: HeaderNotification[];
  unreadCount?: number;
  isNotificationsOpen?: boolean;
  onToggleNotifications?: () => void;
  onCloseNotifications?: () => void;
  onNotificationClick?: (notification: HeaderNotification) => void;
  onOpenSettingsProfile?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  user = { name: 'Demo User', email: 'demo@moneyflow.com' },
  onLogout,
  onNewInvoice,
  onNewSale,
  activePage = 'dashboard',
  customTitle,
  onToggleSidebar,
  notifications = [],
  unreadCount = 0,
  isNotificationsOpen = false,
  onToggleNotifications,
  onCloseNotifications,
  onNotificationClick,
  onOpenSettingsProfile,
}) => {
  const { currentLanguage, changeLanguage, languages } = useLanguage();
  const { t } = useTranslation();
  // Yerelleştirme yardımcıları: anahtar yoksa fallback'i kullan
  const tOr = (key: string, fallback: string, params?: Record<string, any>): string => {
    try {
      const val = t(key as any, params as any) as unknown as string;
      return val === key ? fallback : String(val);
    } catch {
      return fallback;
    }
  };
  const tOrFirst = (keys: string[], fallback: string, params?: Record<string, any>): string => {
    for (const key of keys) {
      try {
        const val = t(key as any, params as any) as unknown as string;
        if (val !== key) return String(val);
      } catch {}
    }
    return fallback;
  };
  // Eğer metin bir i18n anahtarı gibi görünüyorsa (boşluk yok, noktalı yapı), çeviriye zorla
  const resolveMaybeI18nKey = (text: string, params?: Record<string, any>): string => {
    if (!text || typeof text !== 'string') return text as unknown as string;
    const original = text;
    const key = original.trim();
    const looksLikeKey = key.includes('.') && !/\s/.test(key);
    if (!looksLikeKey) return original as string;
    try {
      let translated = t(key as any, (params || {}) as any) as unknown as string;
      if (translated === key) return original as string;
      // Eğer parametreler yoksa, çeviride kalan {{...}} placeholder'larını temizle
      if (!params || Object.keys(params).length === 0) {
        translated = translated
          .replace(/\{\{[^}]+\}\}/g, '') // placeholder'ları sil
          .replace(/\s{2,}/g, ' ') // fazla boşlukları daralt
          .replace(/\s+([:;,.-])/g, '$1') // noktalama öncesi boşluğu temizle
          .trim();
      }
      return translated as string;
    } catch {
      return original as string;
    }
  };
  
  // Page title mapping to translation keys
  const getPageTitle = (page: string): string => {
    const pageMap: Record<string, string> = {
      'dashboard': 'sidebar.dashboard',
      'invoices': 'sidebar.invoices',
      'expenses': 'sidebar.expenses',
      'customers': 'sidebar.customers',
      'products': 'sidebar.products',
      'suppliers': 'sidebar.suppliers',
      'banks': 'sidebar.banks',
      'sales': 'sidebar.sales',
      'reports': 'sidebar.reports',
      'general-ledger': 'sidebar.accounting',
      'chart-of-accounts': 'sidebar.chartOfAccounts',
      'archive': 'sidebar.archive',
      'settings': 'sidebar.settings',
    };
    
    return pageMap[page] ? t(pageMap[page]) : page
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const formattedTitle = customTitle && customTitle.trim().length > 0 ? customTitle : getPageTitle(activePage);

  const notificationsButtonRef = useRef<HTMLButtonElement | null>(null);
  const notificationsPanelRef = useRef<HTMLDivElement | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);

  useEffect(() => {
    if (!isNotificationsOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        notificationsPanelRef.current &&
        !notificationsPanelRef.current.contains(target) &&
        notificationsButtonRef.current &&
        !notificationsButtonRef.current.contains(target)
      ) {
        onCloseNotifications?.();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseNotifications?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isNotificationsOpen, onCloseNotifications]);

  useEffect(() => {
    if (!isLanguageMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (languageMenuRef.current && !languageMenuRef.current.contains(target)) {
        setIsLanguageMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLanguageMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLanguageMenuOpen]);

  const notificationColors: Record<
    NonNullable<HeaderNotification['type']>,
    string
  > = {
    info: 'bg-blue-500',
    warning: 'bg-amber-500',
    success: 'bg-green-500',
    danger: 'bg-red-500',
  };

  const selectedLanguage =
    languages.find(option => option.code === currentLanguage) ?? languages[0];

  const handleLanguageSelect = (code: string) => {
    changeLanguage(code as 'tr' | 'en' | 'de' | 'fr');
    setIsLanguageMenuOpen(false);
  };

  // Genel amaçlı: Çözülmemiş i18n placeholder'larını temizle
  const sanitizePlaceholders = (text: string): string => {
    try {
      if (!text || typeof text !== 'string') return text as unknown as string;
      if (text.includes('{{') && text.includes('}}')) {
        return text
          .replace(/\{\{[^}]+\}\}/g, '')
          .replace(/\s{2,}/g, ' ')
          .replace(/\s+([:;,.-])/g, '$1')
          .trim();
      }
      return text;
    } catch {
      return text;
    }
  };

  // Sadece noktalama/boşluk mu? (ör. "-:")
  const isPunctOnly = (text: string): boolean => {
    if (!text) return true;
    return /^[\s:;.,\-]*$/.test(text);
  };

  // sales.created için akıllı fallback
  const buildSalesDescFallback = (n: HeaderNotification): string => {
    const p = n.i18nParams || {};
    const parts: string[] = [];
    if (p.customerName) parts.push(String(p.customerName));
    if (p.summary) parts.push(String(p.summary));
    const amount = p.totalAmount != null ? String(p.totalAmount) : '';
    if (parts.length === 0 && !amount) {
      return t('notifications.sales.created.title'); // Basit fallback
    }
    return parts.length > 0
      ? `${parts.join(' - ')}${amount ? `: ${amount}` : ''}`
      : amount;
  };

  return (
    <header className="sticky top-0 z-40 bg-white px-4 py-3 shadow-sm sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="rounded-lg border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 md:hidden"
              aria-label="Menüyü aç"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <h1 className="text-xl font-bold text-gray-900 capitalize sm:text-2xl">
            {formattedTitle}
          </h1>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 md:flex-nowrap">
          <div className="hidden items-center gap-2 lg:flex">
            <button
              type="button"
              onClick={onNewInvoice}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('header.newInvoice')}
            </button>
            <button
              type="button"
              onClick={onNewSale}
              className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('header.newSale')}
            </button>
          </div>

          <div className="order-last w-full sm:w-auto md:order-none md:max-w-xs">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
              <input
                type="text"
                placeholder={t('header.search')}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative block" ref={languageMenuRef}>
              <button
                type="button"
                onClick={() => setIsLanguageMenuOpen(prev => !prev)}
                className="flex items-center gap-2 md:gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm transition hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200"
                aria-haspopup="listbox"
                aria-expanded={isLanguageMenuOpen}
                aria-label="Dil seçimi"
              >
                <Globe className="h-4 w-4 text-blue-500" aria-hidden />
                {/* Mobilde kompakt gösterim: bayrak veya kod */}
                <span className="md:hidden text-sm font-medium text-gray-700">
                  {selectedLanguage.flag || selectedLanguage.code.toUpperCase()}
                </span>
                {/* Masaüstünde detaylı iki satır */}
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {t('header.language')}
                  </span>
                  <span className="text-sm font-medium text-gray-700">{selectedLanguage.name}</span>
                </div>
              </button>

              {isLanguageMenuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                  <ul className="divide-y divide-gray-100" role="listbox" aria-label="Dil seçenekleri">
                    {languages.map(option => {
                      const isActive = option.code === currentLanguage;
                      const itemClasses = isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50';

                      return (
                        <li key={option.code}>
                          <button
                            type="button"
                            onClick={() => handleLanguageSelect(option.code)}
                            className={`flex w-full items-center justify-between px-4 py-2 text-sm transition ${itemClasses}`}
                          >
                            <span className="flex items-center gap-2">
                              <span>{option.flag}</span>
                              <span>{option.name}</span>
                            </span>
                            {isActive && <Check className="h-4 w-4 text-blue-500" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            {onToggleNotifications && (
              <div className="relative">
                <button
                  type="button"
                  ref={notificationsButtonRef}
                  onClick={onToggleNotifications}
                  className={`rounded-lg p-2 transition-colors ${
                    isNotificationsOpen
                      ? 'text-blue-600 hover:bg-blue-50'
                      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                  }`}
                  aria-label={t('header.notifications')}
                  aria-expanded={isNotificationsOpen}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <div
                    ref={notificationsPanelRef}
                    className="absolute right-0 z-50 mt-2 w-80 origin-top-right rounded-lg border border-gray-200 bg-white shadow-xl"
                  >
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                      <span className="text-sm font-semibold text-gray-900">
                        {t('header.notifications')}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date().toLocaleDateString(currentLanguage)}
                      </span>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-500">
                        {t('header.noNotifications')}
                      </div>
                    ) : (
                      <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
                        {notifications.map(notification => {
                          // Görüntüleme anında da i18n meta ve bilinen pattern'lerle yeniden yerelleştir
                          let displayTitle = notification.title;
                          let displayDesc = notification.description;
                          if (notification.relatedId === 'twofa-reminder') {
                            displayTitle = tOrFirst(['security.twofa.reminderTitle','sales.security.twofa.reminderTitle'], displayTitle, notification.i18nParams);
                            displayDesc = tOrFirst(['security.twofa.reminderDesc','sales.security.twofa.reminderDesc'], displayDesc, notification.i18nParams);
                          } else if (notification.i18nTitleKey || notification.i18nDescKey) {
                            // Parametre yoksa, çeviriyi zorlamayıp mevcut metni koru
                            if (notification.i18nTitleKey && notification.i18nParams) {
                              displayTitle = tOr(notification.i18nTitleKey, displayTitle, notification.i18nParams);
                            }
                            if (notification.i18nDescKey && notification.i18nParams) {
                              displayDesc = tOr(notification.i18nDescKey, displayDesc, notification.i18nParams);
                            }
                          } else if (notification.relatedId?.startsWith('out-of-stock-')) {
                            displayTitle = tOr('notifications.products.outOfStock.title', displayTitle);
                            displayDesc = tOr('notifications.products.outOfStock.desc', displayDesc, notification.i18nParams);
                          } else if (notification.relatedId?.startsWith('low-stock-')) {
                            displayTitle = tOr('notifications.products.lowStock.title', displayTitle);
                            displayDesc = tOr('notifications.products.lowStock.desc', displayDesc, notification.i18nParams);
                          } else if (notification.relatedId?.startsWith('invoice-')) {
                            // İlgili güncel durumuna göre başlık belirsiz olabilir; genel başlıkları kullan
                            displayTitle = tOr('notifications.invoices.overdue.title', displayTitle);
                          } else if (notification.relatedId?.startsWith('expense-')) {
                            displayTitle = tOr('notifications.expenses.overdue.title', displayTitle);
                          } else if (!notification.i18nTitleKey && notification.link === 'expenses') {
                            // Oluşturma bildirimleri (legacy) için genel başlık
                            displayTitle = tOr('notifications.expenses.created.title', displayTitle);
                            // Parametre yoksa çeviriyi zorlamayıp mevcut metni koru (aksi halde {{...}} görünür)
                            if (notification.i18nParams) {
                              displayDesc = tOr('notifications.expenses.created.desc', displayDesc, notification.i18nParams);
                            }
                          } else if (!notification.i18nTitleKey && notification.link === 'customers') {
                            displayTitle = tOr('notifications.customers.created.title', displayTitle);
                            if (notification.i18nParams) {
                              displayDesc = tOr('notifications.customers.created.desc', displayDesc, notification.i18nParams);
                            }
                          } else if (!notification.i18nTitleKey && notification.link === 'suppliers') {
                            displayTitle = tOr('notifications.suppliers.created.title', displayTitle);
                            if (notification.i18nParams) {
                              displayDesc = tOr('notifications.suppliers.created.desc', displayDesc, notification.i18nParams);
                            }
                          } else if (!notification.i18nTitleKey && notification.link === 'invoices') {
                            displayTitle = tOr('notifications.invoices.created.title', displayTitle);
                            if (notification.i18nParams) {
                              displayDesc = tOr('notifications.invoices.created.desc', displayDesc, notification.i18nParams);
                            }
                          } else if (!notification.i18nTitleKey && notification.link === 'sales') {
                            displayTitle = tOr('notifications.sales.created.title', displayTitle);
                            if (notification.i18nParams) {
                              displayDesc = tOr('notifications.sales.created.desc', displayDesc, notification.i18nParams);
                            }
                          } else if (notification.relatedId?.startsWith('quote-expired-')) {
                            displayTitle = tOr('notifications.quotes.expired.title', displayTitle);
                            displayDesc = tOr('notifications.quotes.expired.desc', displayDesc, notification.i18nParams);
                          } else if (notification.relatedId?.startsWith('quote-due-')) {
                            displayTitle = tOr('notifications.quotes.dueSoon.title', displayTitle);
                            displayDesc = tOr('notifications.quotes.dueSoon.desc', displayDesc, notification.i18nParams);
                          }
                          // Son aşama: Başlık/açıklama anahtar gibi ise çeviriyi zorla
                          displayTitle = resolveMaybeI18nKey(displayTitle, notification.i18nParams);
                          displayDesc = resolveMaybeI18nKey(displayDesc, notification.i18nParams);
                          // Ve kalan {{...}} placeholder'larını temizle
                          displayTitle = sanitizePlaceholders(displayTitle);
                          displayDesc = sanitizePlaceholders(displayDesc);
                          // Eğer açıklama noktalama/boşluk dışında boşsa, akıllı fallback uygula (özellikle sales.created)
                          if (isPunctOnly(displayDesc)) {
                            if ((!notification.i18nParams || Object.keys(notification.i18nParams).length === 0) && notification.link === 'sales') {
                              displayDesc = buildSalesDescFallback(notification);
                            } else {
                              // Genel fallback: başlığı tekrarlama, kısa bir açıklama göster
                              displayDesc = t('notifications.sales.created.title');
                            }
                          }
                          const indicatorClass =
                            notification.type && notificationColors[notification.type]
                              ? notificationColors[notification.type]
                              : 'bg-gray-300';

                          return (
                            <button
                              key={notification.id}
                              type="button"
                              onClick={() => {
                                if (onNotificationClick) {
                                  onNotificationClick(notification);
                                }
                              }}
                              className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus:bg-gray-100 focus:outline-none"
                            >
                              <span
                                className={`mt-1 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full ${indicatorClass}`}
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {displayTitle}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {displayDesc}
                                </p>
                                <span className="mt-1 block text-xs text-gray-400">
                                  {notification.firstSeenAt
                                    ? new Date(notification.firstSeenAt).toLocaleString(currentLanguage)
                                    : notification.time}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => onOpenSettingsProfile && onOpenSettingsProfile()}
              className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-gray-100"
              title={t('sidebar.settings')}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
                <User className="h-4 w-4 text-white" />
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-600"
              title={t('header.logout')}
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;



