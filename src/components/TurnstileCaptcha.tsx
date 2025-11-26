import React, { useEffect, useRef, useState } from 'react';

const isCodespaceHost = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname || '';
  return host.endsWith('.github.dev') || host.endsWith('.githubpreview.dev') || host.includes('.app.github.dev');
};

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
  const isDev = Boolean((import.meta as any).env?.DEV);
  const codespace = isCodespaceHost();
  const skipVerification = !siteKey || codespace;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loadedScript, setLoadedScript] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [hardFailed, setHardFailed] = useState(false);
  const errorCountRef = useRef(0);

  // Fail-open davranışı: site key yoksa token'ı null yerine özel bir sentinel ile iletelim.
  useEffect(() => {
    if (!skipVerification) return;
    if (!siteKey) {
      console.warn('[TurnstileCaptcha] VITE_TURNSTILE_SITE_KEY tanımlı değil; doğrulama atlanacak.');
    } else if (codespace) {
      console.warn('[TurnstileCaptcha] GitHub Codespace ortamı algılandı; Cloudflare domain kısıtı nedeniyle doğrulama atlandı.');
    }
    onToken('TURNSTILE_SKIPPED');
  }, [skipVerification, siteKey, codespace, onToken]);

  useEffect(() => {
    if (skipVerification) return; // Fail-open: script yükleme gereksiz
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
  }, [siteKey, loadedScript, skipVerification]);

  useEffect(() => {
    if (skipVerification || hardFailed) return;
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
  }, [siteKey, loadedScript, hardFailed, skipVerification]);

  useEffect(() => {
    if (!ready || hardFailed || skipVerification) return;
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
        errorCountRef.current = 0;
      },
      'error-callback': () => {
        if (errorCountRef.current === 0) {
          console.warn('[TurnstileCaptcha] error-callback tetiklendi');
        }
        errorCountRef.current += 1;
        const shouldFailOpen = isDev && errorCountRef.current >= 3;
        if (errorCountRef.current >= 3) {
          setHardFailed(true);
          if (shouldFailOpen) {
            onToken('TURNSTILE_SKIPPED');
          } else {
            onToken(null);
          }
        } else {
          onToken(null);
        }
      },
      'expired-callback': () => {
        onToken(null);
      }
    });
  }, [ready, siteKey, invisible, onToken, hardFailed, isDev, skipVerification]);

  useEffect(() => {
    if (!hardFailed) return;
    const turnstile = (window as any).turnstile;
    if (turnstile && widgetIdRef.current) {
      try { turnstile.remove(widgetIdRef.current); } catch {}
      widgetIdRef.current = null;
    }
  }, [hardFailed]);

  // Disabled ise token'ı sıfırla (backend bu durumda doğrulama yapmayacak)
  useEffect(() => {
    if (disabled) {
      onToken(null);
    }
  }, [disabled, onToken]);

  return (
    <div className={className}>
      {siteKey && !hardFailed && !skipVerification ? (
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
          {hardFailed
            ? (isDev
                ? 'Captcha geliştirici modunda başarısız oldu, doğrulama atlandı.'
                : 'Captcha şu anda yüklenemiyor. Lütfen sayfayı yenileyin veya destekle iletişime geçin.')
            : (codespace
                ? 'GitHub Codespace ortamında doğrulama atlandı; üretimde Turnstile aktif olacak.'
                : 'Captcha dev ortamda atlandı (site key yok)')}
        </div>
      )}
    </div>
  );
}

export default TurnstileCaptcha;