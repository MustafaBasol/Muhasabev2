import { useEffect } from 'react';
import { siteSettingsApi } from '../api/site-settings';

/**
 * SeoInjector component - fetches site settings and injects SEO/analytics
 * into the document head and body dynamically.
 * 
 * This component should be included once at the root level of the app.
 */
export function SeoInjector() {
  useEffect(() => {
    let mounted = true;

    const loadAndInjectSettings = async () => {
      try {
        const settings = await siteSettingsApi.getSettings();
        
        if (!mounted) return;

        // Only inject in production or if explicitly enabled
        const isDev = import.meta.env.DEV;
        const enableTrackingInDev = import.meta.env.VITE_ENABLE_TRACKING_IN_DEV === 'true';
        const shouldInjectTracking = !isDev || enableTrackingInDev;

        // === SEO Meta Tags ===
        
        // Update document title if set
        if (settings.defaultMetaTitle && !document.title) {
          document.title = settings.defaultMetaTitle;
        }

        // Meta description
        if (settings.defaultMetaDescription) {
          let metaDesc = document.querySelector('meta[name="description"]');
          if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
          }
          metaDesc.setAttribute('content', settings.defaultMetaDescription);
        }

        // Robots meta (noindex if indexing disabled)
        if (!settings.enableIndexing) {
          let robotsMeta = document.querySelector('meta[name="robots"]');
          if (!robotsMeta) {
            robotsMeta = document.createElement('meta');
            robotsMeta.setAttribute('name', 'robots');
            document.head.appendChild(robotsMeta);
          }
          robotsMeta.setAttribute('content', 'noindex, nofollow');
        }

        // Open Graph tags
        if (settings.defaultOgImageUrl) {
          // OG Image
          let ogImage = document.querySelector('meta[property="og:image"]');
          if (!ogImage) {
            ogImage = document.createElement('meta');
            ogImage.setAttribute('property', 'og:image');
            document.head.appendChild(ogImage);
          }
          ogImage.setAttribute('content', settings.defaultOgImageUrl);

          // OG Title
          if (settings.defaultMetaTitle) {
            let ogTitle = document.querySelector('meta[property="og:title"]');
            if (!ogTitle) {
              ogTitle = document.createElement('meta');
              ogTitle.setAttribute('property', 'og:title');
              document.head.appendChild(ogTitle);
            }
            ogTitle.setAttribute('content', settings.defaultMetaTitle);
          }

          // OG Description
          if (settings.defaultMetaDescription) {
            let ogDesc = document.querySelector('meta[property="og:description"]');
            if (!ogDesc) {
              ogDesc = document.createElement('meta');
              ogDesc.setAttribute('property', 'og:description');
              document.head.appendChild(ogDesc);
            }
            ogDesc.setAttribute('content', settings.defaultMetaDescription);
          }
        }

        // Canonical URL
        if (settings.canonicalBaseUrl) {
          let canonical = document.querySelector('link[rel="canonical"]');
          if (!canonical) {
            canonical = document.createElement('link');
            canonical.setAttribute('rel', 'canonical');
            document.head.appendChild(canonical);
          }
          const path = window.location.pathname + window.location.search;
          canonical.setAttribute('href', settings.canonicalBaseUrl + path);
        }

        // === Analytics & Tracking (only in prod or if enabled in dev) ===
        if (shouldInjectTracking) {
          // Google Analytics (GA4)
          if (settings.googleAnalyticsId) {
            injectGA4(settings.googleAnalyticsId);
          }

          // Google Tag Manager
          if (settings.googleTagManagerId) {
            injectGTM(settings.googleTagManagerId);
          }

          // Pinterest Tag
          if (settings.pinterestTagId) {
            injectPinterestTag(settings.pinterestTagId);
          }

          // Meta/Facebook Pixel
          if (settings.metaPixelId) {
            injectMetaPixel(settings.metaPixelId);
          }

          // LinkedIn Insight Tag
          if (settings.linkedinInsightTagId) {
            injectLinkedInTag(settings.linkedinInsightTagId);
          }
        }

        // === Custom HTML Injections ===
        // Custom head HTML
        if (settings.customHeadHtml) {
          const container = document.createElement('div');
          container.innerHTML = settings.customHeadHtml;
          Array.from(container.children).forEach(child => {
            document.head.appendChild(child.cloneNode(true));
          });
        }

        // Custom body start HTML
        if (settings.customBodyStartHtml) {
          const container = document.createElement('div');
          container.innerHTML = settings.customBodyStartHtml;
          Array.from(container.children).forEach(child => {
            document.body.insertBefore(child.cloneNode(true), document.body.firstChild);
          });
        }

        // Custom body end HTML
        if (settings.customBodyEndHtml) {
          const container = document.createElement('div');
          container.innerHTML = settings.customBodyEndHtml;
          Array.from(container.children).forEach(child => {
            document.body.appendChild(child.cloneNode(true));
          });
        }

      } catch (error) {
        console.error('Failed to load site settings for SEO injection:', error);
      }
    };

    loadAndInjectSettings();

    return () => {
      mounted = false;
    };
  }, []);

  return null; // This component doesn't render anything
}

// === Helper functions for injecting tracking scripts ===

function injectGA4(measurementId: string) {
  // Check if already injected
  if (document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${measurementId}"]`)) {
    return;
  }

  // Inject gtag.js script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  // Inject config script
  const configScript = document.createElement('script');
  configScript.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${measurementId}');
  `;
  document.head.appendChild(configScript);
}

function injectGTM(gtmId: string) {
  // Check if already injected
  if (document.querySelector(`script[src*="googletagmanager.com/gtm.js?id=${gtmId}"]`)) {
    return;
  }

  // Inject GTM script in head
  const headScript = document.createElement('script');
  headScript.innerHTML = `
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${gtmId}');
  `;
  document.head.appendChild(headScript);

  // Inject GTM noscript in body (right after body start)
  const noscript = document.createElement('noscript');
  noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
  document.body.insertBefore(noscript, document.body.firstChild);
}

function injectPinterestTag(tagId: string) {
  // Check if already injected
  if (document.querySelector(`script[src*="pintrk"]`)) {
    return;
  }

  const script = document.createElement('script');
  script.innerHTML = `
    !function(e){if(!window.pintrk){window.pintrk = function () {
    window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var
      n=window.pintrk;n.queue=[],n.version="3.0";var
      t=document.createElement("script");t.async=!0,t.src=e;var
      r=document.getElementsByTagName("script")[0];
      r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
    pintrk('load', '${tagId}');
    pintrk('page');
  `;
  document.head.appendChild(script);
}

function injectMetaPixel(pixelId: string) {
  // Check if already injected
  if (document.querySelector(`script[src*="connect.facebook.net"]`)) {
    return;
  }

  const script = document.createElement('script');
  script.innerHTML = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${pixelId}');
    fbq('track', 'PageView');
  `;
  document.head.appendChild(script);

  // Noscript pixel
  const noscript = document.createElement('noscript');
  noscript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/>`;
  document.body.appendChild(noscript);
}

function injectLinkedInTag(partnerId: string) {
  // Check if already injected
  if (document.querySelector(`script[src*="snap.licdn.com"]`)) {
    return;
  }

  const script = document.createElement('script');
  script.innerHTML = `
    _linkedin_partner_id = "${partnerId}";
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    window._linkedin_data_partner_ids.push(_linkedin_partner_id);
  `;
  document.head.appendChild(script);

  const trackScript = document.createElement('script');
  trackScript.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
  trackScript.async = true;
  document.head.appendChild(trackScript);

  // Noscript pixel
  const noscript = document.createElement('noscript');
  noscript.innerHTML = `<img height="1" width="1" style="display:none;" alt="" src="https://px.ads.linkedin.com/collect/?pid=${partnerId}&fmt=gif" />`;
  document.body.appendChild(noscript);
}
