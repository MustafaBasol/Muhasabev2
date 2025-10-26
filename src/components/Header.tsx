import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Search,
  Bell,
  Settings as SettingsIcon,
  LogOut,
  User,
  Menu,
  Globe,
  Check
} from 'lucide-react';

export interface HeaderNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  type?: 'info' | 'warning' | 'success' | 'danger';
  read?: boolean;
  readAt?: number; // Timestamp: okunma zamanı (1 gün sonra silinecek)
  link?: string; // Bildirime tıklandığında gidilecek sayfa
  persistent?: boolean; // Kalıcı bildirim - koşul sağlandığı sürece her gün tekrar göster
  repeatDaily?: boolean; // Her gün tekrar göster (ödeme tarihi geçenler için)
  relatedId?: string; // İlgili kayıt ID (fatura/gider ID)
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
  onToggleSidebar?: () => void;
  notifications?: HeaderNotification[];
  unreadCount?: number;
  isNotificationsOpen?: boolean;
  onToggleNotifications?: () => void;
  onCloseNotifications?: () => void;
  onNotificationClick?: (notification: HeaderNotification) => void;
  language?: 'tr' | 'en' | 'fr';
  onLanguageChange?: (language: 'tr' | 'en' | 'fr') => void;
}

const Header: React.FC<HeaderProps> = ({
  user = { name: 'Demo User', email: 'demo@moneyflow.com' },
  onLogout,
  onNewInvoice,
  onNewSale,
  activePage = 'dashboard',
  onToggleSidebar,
  notifications = [],
  unreadCount = 0,
  isNotificationsOpen = false,
  onToggleNotifications,
  onCloseNotifications,
  onNotificationClick,
  language = 'tr',
  onLanguageChange,
}) => {
  const formatTitle = (value: string) =>
    value
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const formattedTitle =
    activePage === 'dashboard' ? 'Dashboard' : formatTitle(activePage);

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

    const languageOptions: Array<{ code: 'tr' | 'en' | 'fr'; label: string; nativeLabel: string }> = [
    { code: 'tr', label: 'Turkish', nativeLabel: 'Türkçe' },
    { code: 'en', label: 'English', nativeLabel: 'English' },
    { code: 'fr', label: 'French', nativeLabel: 'Français' },
  ];
  const selectedLanguage =
    languageOptions.find(option => option.code === language) ?? languageOptions[0];

  const handleLanguageSelect = (code: 'tr' | 'en' | 'fr') => {
    onLanguageChange?.(code);
    setIsLanguageMenuOpen(false);
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
              Yeni Fatura
            </button>
            <button
              type="button"
              onClick={onNewSale}
              className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Yeni Satış
            </button>
          </div>

          <div className="order-last w-full sm:w-auto md:order-none md:max-w-xs">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
              <input
                type="text"
                placeholder="Ara..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden md:block" ref={languageMenuRef}>
              <button
                type="button"
                onClick={() => setIsLanguageMenuOpen(prev => !prev)}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm transition hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200"
                aria-haspopup="listbox"
                aria-expanded={isLanguageMenuOpen}
                aria-label="Dil seçimi"
              >
                <Globe className="h-4 w-4 text-blue-500" aria-hidden />
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Dil
                  </span>
                  <span className="text-sm font-medium text-gray-700">{selectedLanguage.nativeLabel}</span>
                </div>
              </button>

              {isLanguageMenuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                  <ul className="divide-y divide-gray-100" role="listbox" aria-label="Dil seçenekleri">
                    {languageOptions.map(option => {
                      const isActive = option.code === language;
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
                            <span>{option.nativeLabel}</span>
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
                  aria-label="Bildirimler"
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
                        Bildirimler
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date().toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-500">
                        Yeni bildiriminiz yok.
                      </div>
                    ) : (
                      <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
                        {notifications.map(notification => {
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
                                  {notification.title}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {notification.description}
                                </p>
                                <span className="mt-1 block text-xs text-gray-400">
                                  {notification.time}
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
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="Ayarlar"
            >
              <SettingsIcon className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
                <User className="h-4 w-4 text-white" />
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-600"
              title="Çıkış Yap"
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



