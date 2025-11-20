import React, { useEffect, useState, useRef } from 'react';
import { siteSettingsApi, SiteSettings } from '../api/site-settings';

export type AnnouncementBarProps = {
  settings?: Partial<SiteSettings>;
};

const toneClasses: Record<string, string> = {
  info: 'bg-blue-50 text-blue-800 border border-blue-200',
  warning: 'bg-amber-50 text-amber-800 border border-amber-200',
  critical: 'bg-red-50 text-red-800 border border-red-200',
};

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ settings: provided }) => {
  const [settings, setSettings] = useState<Partial<SiteSettings> | null>(provided || null);

  useEffect(() => {
    let cancelled = false;
    if (provided) return; // if parent provides, no fetch
    (async () => {
      try {
        const s = await siteSettingsApi.getSettings();
        if (!cancelled) setSettings(s);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [provided]);

  // Listen for global updates from Admin page to refresh without full reload
  useEffect(() => {
    if (provided) return; // parent-controlled
    const handler = async () => {
      try {
        const s = await siteSettingsApi.getSettings();
        setSettings(s);
      } catch {}
    };
    window.addEventListener('siteSettingsUpdated', handler as EventListener);
    return () => {
      window.removeEventListener('siteSettingsUpdated', handler as EventListener);
    };
  }, [provided]);

  const s = (settings || {}) as Partial<SiteSettings>;
  const enabled = !!s.announcementEnabled && !!(s.announcementMessage || '').toString().trim();
  const type = (s.announcementType as string) || 'info';

  const maintenanceOn = !!s.maintenanceModeEnabled;
  const maintenanceMsg = (s.maintenanceMessage || '').toString().trim();

  // Body padding yönetimi: etkinse body'e sınıf ekle
  useEffect(() => {
    if (enabled || maintenanceOn) {
      document.body.classList.add('has-announcement-bar');
    } else {
      document.body.classList.remove('has-announcement-bar');
    }
    return () => {
      document.body.classList.remove('has-announcement-bar');
    };
  }, [enabled, maintenanceOn]);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Ölç ve CSS değişkenine yaz
    const h = el.offsetHeight;
    document.documentElement.style.setProperty('--announcement-bar-height', h + 'px');
  }, [enabled, maintenanceOn, s.announcementMessage]);

  if (!enabled && !maintenanceOn) {
    document.documentElement.style.setProperty('--announcement-bar-height', '0px');
    return null;
  }

  return (
    <div ref={containerRef} className="fixed top-0 left-0 w-full z-[100] font-medium shadow-sm">
      {maintenanceOn && (
        <div className="w-full text-center text-xs md:text-sm px-3 py-1 bg-yellow-50 text-yellow-900 border-b border-yellow-200">
          {maintenanceMsg ? (
            <>Bakım modu aktif: {maintenanceMsg}</>
          ) : (
            <>Bakım modu aktif: Sistem geçici olarak salt okunur.</>
          )}
        </div>
      )}
      {enabled && (
        <div className={`w-full ${toneClasses[type] || toneClasses.info} px-0 py-0 border-t-0`}>          
          <div className="announcement-marquee-wrapper h-11 flex items-center">
            <div className="announcement-marquee text-sm">
              {s.announcementMessage}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementBar;
