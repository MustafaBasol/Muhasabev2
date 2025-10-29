import { CookieConsent } from '../contexts/CookieConsentContext';

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

    console.log('📊 Analytics enabled');
  }

  private disableAnalytics(): void {
    // Disable Google Analytics
    this.disableGoogleAnalytics();

    // Disable Matomo
    this.disableMatomo();

    console.log('🚫 Analytics disabled');
  }

  private enableMarketingTracking(): void {
    // Enable Hotjar
    if (this.config.hotjar?.enabled && this.config.hotjar.hjid && this.config.hotjar.hjsv) {
      this.loadHotjar(this.config.hotjar.hjid, this.config.hotjar.hjsv);
    }

    console.log('🎯 Marketing tracking enabled');
  }

  private disableMarketingTracking(): void {
    // Disable Hotjar
    this.disableHotjar();

    console.log('🚫 Marketing tracking disabled');
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
      (window as any).dataLayer = (window as any).dataLayer || [];
      function gtag(...args: any[]) {
        (window as any).dataLayer.push(args);
      }
      gtag('js', new Date());
      gtag('config', measurementId, {
        anonymize_ip: true, // GDPR compliance
        cookie_expires: 63072000, // 2 years in seconds
      });

      // Make gtag globally available
      (window as any).gtag = gtag;
    };
  }

  private disableGoogleAnalytics(): void {
    // Set GA disable flag
    const measurementId = this.config.googleAnalytics?.measurementId;
    if (measurementId) {
      (window as any)[`ga-disable-${measurementId}`] = true;
    }

    // Clear GA cookies
    this.clearCookies(['_ga', '_ga_*', '_gid', '_gat_gtag_*']);
  }

  private loadMatomo(siteId: string, url: string): void {
    // Check if already loaded
    if ((window as any)._paq) {
      return;
    }

    (window as any)._paq = (window as any)._paq || [];
    (window as any)._paq.push(['trackPageView']);
    (window as any)._paq.push(['enableLinkTracking']);

    const script = document.createElement('script');
    script.async = true;
    script.src = `${url}/matomo.js`;
    document.head.appendChild(script);

    script.onload = () => {
      (window as any)._paq.push(['setTrackerUrl', `${url}/matomo.php`]);
      (window as any)._paq.push(['setSiteId', siteId]);
    };
  }

  private disableMatomo(): void {
    if ((window as any)._paq) {
      (window as any)._paq.push(['optUserOut']);
    }

    // Clear Matomo cookies
    this.clearCookies(['_pk_id*', '_pk_ses*']);
  }

  private loadHotjar(hjid: string, hjsv: string): void {
    // Check if already loaded
    if ((window as any).hj) {
      return;
    }

    (window as any).hj = (window as any).hj || function(...args: any[]) {
      ((window as any).hj.q = (window as any).hj.q || []).push(args);
    };
    (window as any)._hjSettings = { hjid, hjsv };

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://static.hotjar.com/c/hotjar-${hjid}.js?sv=${hjsv}`;
    document.head.appendChild(script);
  }

  private disableHotjar(): void {
    // Hotjar doesn't have a built-in disable method, so we clear its data
    if ((window as any).hj) {
      (window as any).hj('stateChange', '/cookie-opt-out');
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
    if ((window as any).gtag) {
      (window as any).gtag('event', action, {
        event_category: category,
        event_label: label,
        value: value,
      });
    }

    // Matomo
    if ((window as any)._paq) {
      (window as any)._paq.push(['trackEvent', category, action, label, value]);
    }
  }

  public trackPageView(path?: string): void {
    if (!this.consent?.analytics) {
      console.warn('🚫 Page view tracking blocked - no consent');
      return;
    }

    // Google Analytics
    if ((window as any).gtag) {
      (window as any).gtag('config', this.config.googleAnalytics?.measurementId, {
        page_path: path || window.location.pathname,
      });
    }

    // Matomo
    if ((window as any)._paq) {
      if (path) {
        (window as any)._paq.push(['setCustomUrl', path]);
      }
      (window as any)._paq.push(['trackPageView']);
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