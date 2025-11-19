# Comptario Marka Varlıkları (Logo & Ikon)

Aşağıdaki dosyaları `public/` klasörüne ekleyin. Vite bu klasörü kökten servis eder; bileşenler ve `index.html` bu yolları kullanır.

Önerilen dosyalar (tercihli formatlar ve boyutlar):

- Logo (uygulama içi kullanım)
  - `public/logo.svg` (tercih edilen)
  - Alternatif: `public/logo.png` (şeffaf, ~512px genişlik)

- Favicon & PWA ikonları
  - `public/favicon-32x32.png` (32×32)
  - `public/favicon-16x16.png` (16×16)
  - `public/apple-touch-icon.png` (180×180, yuvarlatmasız, köşe boşluklarıyla)
  - `public/android-chrome-192x192.png` (192×192)
  - `public/android-chrome-512x512.png` (512×512, maskable güvenli)

İsteğe bağlı:
- `public/safari-pinned-tab.svg` (siyah tek renk, macOS Safari pinned tab)

Renkler:
- `theme_color` (PWA): `#10b981` (Tailwind `emerald-500` benzeri)
- `background_color`: `#ffffff`

`index.html` bağlantıları hazır:
- `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">`
- `<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">`
- `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`
- `<link rel="manifest" href="/site.webmanifest">`

`public/site.webmanifest` oluşturuldu ve `android-chrome-192x192.png` ile `android-chrome-512x512.png` bekliyor.

Kullanım (React):
- Header veya Navbar içinde: `import { BrandLogo } from '@/components/BrandLogo'` ve `<BrandLogo className="h-8" />`
- `BrandLogo` otomatik olarak `public/logo.svg` > `public/logo.png` > metin fallback sırasıyla çalışır.

Dosyaları ekledikten sonra geliştirme modunda tarayıcıyı yenilemeniz yeterli. Production için yeniden build gerekir.
