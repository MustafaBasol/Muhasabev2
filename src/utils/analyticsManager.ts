import { CookieConsent } from '../contexts/CookieConsentContext';
import { logger } from './logger';

// Types for analytics services
export interface AnalyticsConfig {
  googleAnalytics?: {
    measurementId: string;
    enabled: boolean;
  };
  matomo?: {
    siteId: string;
    url: string;
    enabled: boolean;
  };
  hotjar?: {
    hjid: string;
    hjsv: string;
    enabled: boolean;
  };
}

// Extend window with optional analytics fields (typed safely)
type GTagFunction = (...args: unknown[]) => void;
type MatomoQueue = { push: (args: unknown[]) => void } | undefined;
type HotjarFn = ((...args: unknown[]) => void) & { q?: unknown[] };
interface AnalyticsWindow extends Window {
  dataLayer?: unknown[];
  gtag?: GTagFunction;
  _paq?: MatomoQueue;
  hj?: HotjarFn;
  _hjSettings?: { hjid: string; hjsv: string };
  [key: string]: unknown;
}

class AnalyticsManager {
  private static instance: AnalyticsManager;
  private consent: CookieConsent | null = null;
  private config: AnalyticsConfig = {};

  private constructor() {}

  public static getInstance(): AnalyticsManager {
    if (!AnalyticsManager.instance) {
      AnalyticsManager.instance = new AnalyticsManager();
    }
    return AnalyticsManager.instance;
  }

  public setConfig(config: AnalyticsConfig): void {
    this.config = config;
  }

  public updateConsent(consent: CookieConsent): void {
    const previousConsent = this.consent;
    this.consent = consent;

    // If analytics consent changed, update tracking
    if (!previousConsent || previousConsent.analytics !== consent.analytics) {
      if (consent.analytics) {
        this.enableAnalytics();
      } else {
        this.disableAnalytics();
      }
    }

    // If marketing consent changed, update marketing tracking
    if (!previousConsent || previousConsent.marketing !== consent.marketing) {
      if (consent.marketing) {
        this.enableMarketingTracking();
      } else {
        this.disableMarketingTracking();
      }
    }
  }

  private enableAnalytics(): void {
    // Enable Google Analytics
    if (this.config.googleAnalytics?.enabled && this.config.googleAnalytics.measurementId) {
      this.loadGoogleAnalytics(this.config.googleAnalytics.measurementId);
    }

    // Enable Matomo
    if (this.config.matomo?.enabled && this.config.matomo.siteId && this.config.matomo.url) {
      this.loadMatomo(this.config.matomo.siteId, this.config.matomo.url);
    }

  logger.info('📊 Analytics enabled');
  }

  private disableAnalytics(): void {
    // Disable Google Analytics
    this.disableGoogleAnalytics();

    // Disable Matomo
    this.disableMatomo();

  logger.warn('🚫 Analytics disabled');
  }

  private enableMarketingTracking(): void {
    // Enable Hotjar
    if (this.config.hotjar?.enabled && this.config.hotjar.hjid && this.config.hotjar.hjsv) {
      this.loadHotjar(this.config.hotjar.hjid, this.config.hotjar.hjsv);
    }

  logger.info('🎯 Marketing tracking enabled');
  }

  private disableMarketingTracking(): void {
    // Disable Hotjar
    this.disableHotjar();

  logger.warn('🚫 Marketing tracking disabled');
  }

  private loadGoogleAnalytics(measurementId: string): void {
    // Check if already loaded
    if (document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${measurementId}"]`)) {
      return;
    }

    // Load Google Analytics script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    // Initialize gtag
    script.onload = () => {
      const w = window as unknown as AnalyticsWindow;
      w.dataLayer = w.dataLayer || [];
      function gtag(...args: unknown[]) {
        (w.dataLayer as unknown[]).push(args);
      }
      gtag('js', new Date());
      gtag('config', measurementId, {
        anonymize_ip: true, // GDPR compliance
        cookie_expires: 63072000, // 2 years in seconds
      });

      // Make gtag globally available
      (window as unknown as AnalyticsWindow).gtag = gtag;
    };
  }

  private disableGoogleAnalytics(): void {
    // Set GA disable flag
    const measurementId = this.config.googleAnalytics?.measurementId;
    if (measurementId) {
      (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = true;
    }

    // Clear GA cookies
    this.clearCookies(['_ga', '_ga_*', '_gid', '_gat_gtag_*']);
  }

  private loadMatomo(siteId: string, url: string): void {
    // Check if already loaded
    if ((window as unknown as AnalyticsWindow)._paq) {
      return;
    }

    const w = window as unknown as AnalyticsWindow;
    w._paq = w._paq || ({ push: () => { /* noop until loaded */ } } as MatomoQueue);
    w._paq?.push(['trackPageView']);
    w._paq?.push(['enableLinkTracking']);

    const script = document.createElement('script');
    script.async = true;
    script.src = `${url}/matomo.js`;
    document.head.appendChild(script);

    script.onload = () => {
      const win = window as unknown as AnalyticsWindow;
      win._paq?.push(['setTrackerUrl', `${url}/matomo.php`]);
      win._paq?.push(['setSiteId', siteId]);
    };
  }

  private disableMatomo(): void {
    if ((window as unknown as AnalyticsWindow)._paq) {
      (window as unknown as AnalyticsWindow)._paq?.push(['optUserOut']);
    }

    // Clear Matomo cookies
    this.clearCookies(['_pk_id*', '_pk_ses*']);
  }

  private loadHotjar(hjid: string, hjsv: string): void {
    // Check if already loaded
    if ((window as unknown as AnalyticsWindow).hj) {
      return;
    }

    const w = window as unknown as AnalyticsWindow;
    w.hj = w.hj || (function(...args: unknown[]) {
      /* queue until loaded */
      const hj = (w.hj as HotjarFn);
      (hj.q = hj.q || []).push(args);
    } as HotjarFn);
    w._hjSettings = { hjid, hjsv };

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://static.hotjar.com/c/hotjar-${hjid}.js?sv=${hjsv}`;
    document.head.appendChild(script);
  }

  private disableHotjar(): void {
    // Hotjar doesn't have a built-in disable method, so we clear its data
    if ((window as unknown as AnalyticsWindow).hj) {
      (window as unknown as AnalyticsWindow).hj?.('stateChange', '/cookie-opt-out');
    }

    // Clear Hotjar cookies
    this.clearCookies(['_hjid', '_hjFirstSeen', '_hjIncludedInSessionSample_*', '_hjSession_*', '_hjSessionUser_*']);
  }

  private clearCookies(patterns: string[]): void {
    patterns.forEach(pattern => {
      if (pattern.includes('*')) {
        // Handle wildcard patterns
        const prefix = pattern.replace('*', '');
        document.cookie.split(';').forEach(cookie => {
          const cookieName = cookie.split('=')[0].trim();
          if (cookieName.startsWith(prefix)) {
            this.deleteCookie(cookieName);
          }
        });
      } else {
        this.deleteCookie(pattern);
      }
    });
  }

  private deleteCookie(name: string): void {
    // Delete for current domain
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    
    // Delete for current domain with leading dot
    const domain = window.location.hostname;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${domain};`;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain};`;
  }

  // Public methods for manual tracking (when consent is given)
  public trackEvent(action: string, category: string, label?: string, value?: number): void {
    if (!this.consent?.analytics) {
      console.warn('🚫 Analytics tracking blocked - no consent');
      return;
    }

    // Google Analytics
    if ((window as unknown as AnalyticsWindow).gtag) {
      (window as unknown as AnalyticsWindow).gtag?.('event', action, {
        event_category: category,
        event_label: label,
        value: value,
      });
    }

    // Matomo
    if ((window as unknown as AnalyticsWindow)._paq) {
      (window as unknown as AnalyticsWindow)._paq?.push(['trackEvent', category, action, label, value]);
    }
  }

  public trackPageView(path?: string): void {
    if (!this.consent?.analytics) {
      console.warn('🚫 Page view tracking blocked - no consent');
      return;
    }

    // Google Analytics
    if ((window as unknown as AnalyticsWindow).gtag) {
      (window as unknown as AnalyticsWindow).gtag?.('config', this.config.googleAnalytics?.measurementId, {
        page_path: path || window.location.pathname,
      });
    }

    // Matomo
    if ((window as unknown as AnalyticsWindow)._paq) {
      if (path) {
        (window as unknown as AnalyticsWindow)._paq?.push(['setCustomUrl', path]);
      }
      (window as unknown as AnalyticsWindow)._paq?.push(['trackPageView']);
    }
  }

  // Get current consent status
  public hasAnalyticsConsent(): boolean {
    return this.consent?.analytics ?? false;
  }

  public hasMarketingConsent(): boolean {
    return this.consent?.marketing ?? false;
  }
}

// Export singleton instance
export const analyticsManager = AnalyticsManager.getInstance();

// Convenience functions
export const trackEvent = (action: string, category: string, label?: string, value?: number) => {
  analyticsManager.trackEvent(action, category, label, value);
};

export const trackPageView = (path?: string) => {
  analyticsManager.trackPageView(path);
};

export const hasAnalyticsConsent = () => analyticsManager.hasAnalyticsConsent();
export const hasMarketingConsent = () => analyticsManager.hasMarketingConsent();