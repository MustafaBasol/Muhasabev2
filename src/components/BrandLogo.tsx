import React from 'react';

/**
 * Basit marka logosu bileşeni.
 * public/ klasörüne `logo.svg` (tercihen) veya `logo.png` koyduğunuzda otomatik gösterir.
 * Dosya yoksa "Comptario" metnine düşer.
 */
export function BrandLogo({ className = 'h-8 w-auto' }: { className?: string }) {
  const [exists, setExists] = React.useState<'svg' | 'png' | 'none'>('svg');

  React.useEffect(() => {
    // SVG var mı kontrol et; yoksa PNG'yi dene
    fetch('/logo.svg', { method: 'HEAD' })
      .then((r) => {
        if (r.ok) setExists('svg');
        else throw new Error('no svg');
      })
      .catch(() => {
        fetch('/logo.png', { method: 'HEAD' })
          .then((r) => {
            if (r.ok) setExists('png');
            else setExists('none');
          })
          .catch(() => setExists('none'));
      });
  }, []);

  if (exists === 'svg') return <img src="/logo.svg" alt="Comptario" className={className} />;
  if (exists === 'png') return <img src="/logo.png" alt="Comptario" className={className} />;
  return <span className={`font-semibold text-gray-900 ${className.replace(/h-\d+\s?|w-\d+\s?/g, '')}`}>Comptario</span>;
}

export default BrandLogo;
