import React, { useEffect, useRef, useState } from 'react';

interface TurnstileCaptchaProps {
  onToken: (token: string | null) => void;
  className?: string;
  disabled?: boolean;
  /** If true, will render invisible variant */
  invisible?: boolean;
}

// Cloudflare Turnstile entegrasyonu.
// Ortam değişkeni yoksa (site key), komponent uyarı loglar ve hemen "başarılı" kabul eder (fail-open).
export function TurnstileCaptcha({ onToken, className, disabled, invisible }: TurnstileCaptchaProps) {
  const siteKey = (import.meta as any).env?.VITE_TURNSTILE_SITE_KEY || '';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loadedScript, setLoadedScript] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  // Fail-open davranışı: site key yoksa token'ı null yerine özel bir sentinel ile iletelim.
  useEffect(() => {
    if (!siteKey) {
      console.warn('[TurnstileCaptcha] VITE_TURNSTILE_SITE_KEY tanımlı değil; doğrulama atlanacak.');
      onToken('TURNSTILE_SKIPPED');
    }
  }, [siteKey, onToken]);

  useEffect(() => {
    if (!siteKey) return; // Fail-open: script yükleme gereksiz
    if (loadedScript) return;
    const existing = document.querySelector('script[data-turnstile-script]');
    if (existing) {
      setLoadedScript(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.setAttribute('data-turnstile-script', 'true');
    script.onload = () => setLoadedScript(true);
    script.onerror = () => setScriptError('Turnstile script yüklenemedi');
    document.head.appendChild(script);
  }, [siteKey, loadedScript]);

  useEffect(() => {
    if (!siteKey) return;
    if (!loadedScript) return;
    if (!containerRef.current) return;
    if (!(window as any).turnstile) {
      const interval = setInterval(() => {
        if ((window as any).turnstile) {
          clearInterval(interval);
          setReady(true);
        }
      }, 100);
      return () => clearInterval(interval);
    }
    setReady(true);
  }, [siteKey, loadedScript]);

  useEffect(() => {
    if (!ready) return;
    if (!containerRef.current) return;
    if (!siteKey) return;
    const turnstile = (window as any).turnstile;
    if (!turnstile) return;

    // Mevcut widget varsa yeniden oluştur.
    if (widgetIdRef.current) {
      try { turnstile.remove(widgetIdRef.current); } catch {}
      widgetIdRef.current = null;
    }

    widgetIdRef.current = turnstile.render(containerRef.current, {
      sitekey: siteKey,
      size: invisible ? 'invisible' : 'normal',
      theme: 'auto',
      callback: (token: string) => {
        onToken(token || null);
      },
      'error-callback': () => {
        console.warn('[TurnstileCaptcha] error-callback tetiklendi');
        onToken(null);
      },
      'expired-callback': () => {
        onToken(null);
      }
    });
  }, [ready, siteKey, invisible, onToken]);

  // Disabled ise token'ı sıfırla (backend bu durumda doğrulama yapmayacak)
  useEffect(() => {
    if (disabled) {
      onToken(null);
    }
  }, [disabled, onToken]);

  return (
    <div className={className}>
      {siteKey ? (
        <>
          {!loadedScript && !scriptError && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              <span>Doğrulama bileşeni yükleniyor...</span>
            </div>
          )}
          {scriptError && <div className="text-xs text-red-600">{scriptError}</div>}
          <div ref={containerRef} />
        </>
      ) : (
        <div className="text-xs text-gray-500 italic">
          Captcha dev ortamda atlandı (site key yok)
        </div>
      )}
    </div>
  );
}

export default TurnstileCaptcha;