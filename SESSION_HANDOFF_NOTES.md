# Dev Session Notes (2025-11-24)

## Biten işler
- `src/App.tsx` içindeki legacy runtime `sales` göç efekti tamamen kaldırıldı; tenant scoped cache yazımı artık yalnızca `persistSalesState`/`writeTenantScopedArray` üzerinden gerçekleşiyor ve render sırasında gereksiz localStorage taramaları yapılmıyor.
- Tek seferlik tarayıcı yardımcısı `legacy-sales-migrator.html` eklendi; bu araç legacy `sales`/`sales_cache` anahtarlarını tenant scoped anahtarlara taşıyıp isteğe bağlı olarak eski global anahtarları siliyor. Operasyon akışı `MIGRATIONS.md` içine adım adım belgelendi.
- Bildirim hidrasyon helper'ı (`normalizeStoredNotifications`) ve silme uyarısı modalı tiplenerek `any` kullanımları azaltıldı; API'den gelen `relatedItems` listeleri normalize edilip `DeleteWarningRelatedItem` tipine dönüştürülüyor, böylece `App.tsx` lint borcu birkaç uyarı daha azaldı.
- `handleImportCustomers` ve `handleImportProducts` tüm `console.log`/`console.info` çağrılarını `logger.info`/`logger.debug` telemetrilerine taşıdı; CSV/Excel ayrımları, satır sayısı uyarıları, backend persist denemeleri ve başarısız kayıt raporları structured log olarak izleniyor. Her iki import akışındaki `rows` dizisi `const` yapılarak `prefer-const` uyarıları kapatıldı.
- Bildirim paneli (tıklama, kalıcı/persistent flag), `addNotification`, `currentPage` debug efekti, satış silme, ürün/pf katagori upsert'ları ve gider/fatura cache güncellemeleri `logger` ile instrument edildi; `App.tsx` içindeki tüm `console.log`/`console.info` çağrıları temizlendi ve ilgili telemetri event'leri `app.*` isimleriyle merkezi hale getirildi.
- Fatura oluşturma/güncelleme/silme, otomatik satış oluşturma, veri export helper'ı ve bank/notification import yolları `logger` kullanacak şekilde yeniden yazıldı; `console.warn` dışında kalan tüm console çağrıları sökülerek `no-console` lint uyarıları ~35 adet azaltıldı.
- `tenantScopedId` artık `useMemo` ile tek noktada hesaplanıyor ve tüm storage/migration/persistence efektleri bu referansı paylaşıyor; `resolveTenantScopedId`'in tekrar tekrar çağrılması engellendi, hook dependency array'leri sadeleşti ve render dalgalanmaları azaldı.
- Satış cache'ini yeniden yazan efekt `salesHasDataRef` kullandığı için `sales` state'ine bağımlı değil; tenant değiştirme ve cross-tab sync esnasında gereksiz eslint uyarıları kapanırken veri sızıntısı riski düşürüldü.
- Banka hesapları cache yenilemesinde kalan `console.warn` çağrısı `logger.warn('app.cache.bankAccounts.refreshFailed')` telemetrisiyle değiştirildi; hatalar artık structured log üzerinden izleniyor ve `no-console` uyarıları azaldı.
- Sales persistence, migration listener'ları ve hidrasyon callback'leri `tenantScopedId` memo'sunu kullanacak şekilde güncellendi; storage event zinciri tenant değişiminde stabil kaldı ve `react-hooks/exhaustive-deps` uyarıları temizlendi.
- Cross-tab storage event efekti `tenantScopedSalesId` ile memoize edildi; `react-hooks/exhaustive-deps` uyarısı kapandı ve dinleyici artık tenant değiştikçe doğru kimliği izliyor.
- Offline cache hidrasyonu sırasında kullanılan tüm `console.log`/`console.error` çağrıları `logger.info` / `logger.error` telemetrilerine taşındı; satış, müşteri, tedarikçi, ürün, fatura ve gider cache yüklemeleri structured log ile izleniyor.
- Bildirim temizleme efekti ve hash tabanlı yönlendirme helper'ı `logger` kullanacak şekilde yeniden yazıldı; gereksiz `console.log` kalabalığı temizlenirken hash navigasyonu için merkezi `logger.debug('app.hashRouting.*')` telemetrileri eklendi.
- Tenant değişiminde satış cache'ini yeniden yazan redundant efekt söküldü; `persistSalesState` zaten tenant scoped storage'ı güncellediğinden çift yazım/flush kaynaklı gereksiz React Hooks uyarıları ortadan kalktı.
- `openSaleModal` / `closeSaleModal` çevresindeki debug `console.log` çağrıları `logger.debug` telemetrilerine taşındı; tenant/event handler bloğundaki `no-console` uyarıları temizlendi ve modal yeniden-açma akışı daha okunur hale geldi.
- `src/App.tsx` içindeki tüm `setSales(...)` çağrıları `persistSalesState` helper'ına taşındı; otomatik satış oluşturma, manuel satış CRUD, fatura/satış eşlemesi, teklif→satış dönüşümleri ve import/logout işlemleri artık tek yoldan cache yazıyor. Cross-tab event'leri sadece helper tarafından tetiklendiği için tenant scoped storage tutarlılığı sağlandı.
- Logout akışı `runWithSalesPersistenceSuppressed` + `persistSalesState([])` ile storage'ı boş listeyle ezmeden UI state'ini temizliyor; manuel flag yönetimi kaldırıldı.
- Satış silme, fatura iade/iptal, otomatik satış-link güncellemeleri ve accepted quote sync'i helper'a geçirildi; redundant `writeTenantScopedArray` çağrıları sökülerek tek noktadan hata log'lama (`logger.warn('app.sales.cacheWriteFailed', ...)`) korunmuş oldu.
- `handleImportData` sales kolu da helper'ı kullanıyor; dışarıdan içe aktarılan satışlar tenant cache'iyle anında hizalanıyor.
- Banka/lokal cache hidrasyon efekti yeniden düzenlenerek `bankAccounts` state'ine doğrudan bağımlılık kaldırıldı (`bankAccountsRef` + `fallbackBankList`), `persistSalesState`/`runWithSalesPersistenceSuppressed` bağımlılıklarına sahip olacak şekilde dependency array güncellendi ve React Hooks uyarısı giderildi.
- Tenant değişiminde state temizleyen efektin dependency array'i `isAuthenticated` + `persistSalesState` ile tamamlandı; bu sayede lint uyarısı kapanırken satış temizliği helper yolundan çıkmıyor.
- Cache yüklemesi sonrası tetiklenen tenant reset efektinde eksik kalan `isAuthenticated`/`persistSalesState` bağımlılıkları yeniden eklendi; React Hooks uyarısı tekrar ortaya çıktığında aynı gün içinde kapatıldı.
- Ödeme/gider/düşük stok bildirimlerini tetikleyen efektin dependency array'i `addNotification` ve `tOr` ile genişletildi; interval yalnızca gerçekten ihtiyaç olduğunda yeniden kuruluyor ve lint uyarısı kapandı.
- Teklif (quote) bildirim efekti `addNotification`, `tOr` ve `tenant` referanslarını izleyerek tenant scoped cache değişimlerinde yeniden çalışıyor; eksik dependency uyarısı kapandı ve reminder'lar dil değişikliklerinde doğru şekilde güncelleniyor.
- 2FA hatırlatıcısı + modal efektinde kullanılan tüm `authUser` alanları türetilmiş değişkenlere taşındı; dependency array'i `tenant?.id` yerine türetilmiş `tenantId` referansı ile sadeleşti ve `authUser` eksikliği uyarısı kapandı.
- `addNotification` callback'i artık tenant scoped kimliği `useMemo` ile hesaplayıp `authUserId` ile birlikte izliyor; pref okuma helper'ı `tenantScopedIdForNotifications`/`authUserId` üzerinden çalıştığı için React Hooks uyarısı giderildi.
- Sales cache senkronizasyon efekti `tenant` referansını da izleyerek `react-hooks/exhaustive-deps` uyarısını ortadan kaldırdı; cross-tab güncellemeler yalnızca tenant değiştiğinde yeniden tetikleniyor.
- Global invoice/quote/sale event köprü efekti `openInvoiceModal`, `handleDownloadInvoice`, `openSaleModal` fonksiyonlarının `useCallback` ile sabitlenmesi sayesinde artık stable dependency'lerle çalışıyor.
- `openInvoiceModal`, `openSaleModal` ve `handleDownloadInvoice` fonksiyonları `useCallback` ile sarıldı; event listener'lar her render'da yeniden bağlanmak zorunda kalmıyor ve lint'in "dependency değişiyor" uyarıları kapandı.
- Dashboard `metrics` `useMemo`su sadece kullanılan bağımlılıkları (özellikle `formatCurrency`) izliyor; gereksiz `customers` bağımlılığı kaldırıldı ve lint uyarısı temizlendi.

## Doğrulamalar
- `npx eslint src/App.tsx` (24 Kas 2025, 1x) → 408 warning (konsole temizliği + import logger refaktörleri sonrası `no-console` uyarıları 36 adet azaldı; kalan borç `no-explicit-any` ve `no-empty`).
- `npx eslint src/App.tsx` (24 Kas 2025, 2x) → 445 warning (`tenantScopedId` memo + `salesHasDataRef` sayesinde hedeflenen `react-hooks/exhaustive-deps` uyarıları kapandı; kalanlar çoğunlukla `no-console`/`no-explicit-any`).
- `npx eslint src/App.tsx` (24 Kas 2025, 1x) → 444 warning (banka cache logger geçişi sonrası tek `no-console` uyarısı daha temizlendi; toplam uyarı sayısı 23 Kas 2025'e göre 75 azaldı).
- `npx eslint src/App.tsx` (24 Kas 2025, 1x) → 519 warning (3 adet React Hooks uyarısı kapandı; kalan uyarılar beklenen `no-explicit-any`, `no-console`, eksik dependency vb. borçlar).
- `npx eslint src/App.tsx` (24 Kas 2025, 1x) → 511 warning (2FA/reminder/addNotification düzenlemeleri sayesinde 8 hook uyarısı daha kapandı; kalanlar ağırlıklı olarak `no-explicit-any` + ileri seviye hook bağımlılıkları).
- `npx eslint src/App.tsx` (24 Kas 2025, 1x) → 507 warning (sales cache + event köprüsü + dashboard metrics düzeltmeleriyle 4 hook uyarısı daha kapandı; kalanların büyük çoğunluğu `any`/`no-console`).
- `npx eslint src/App.tsx` (24 Kas 2025, 1x) → 498 warning (`openSaleModal`/`closeSaleModal` logger geçişi sonrası 7 `no-console` uyarısı kapandı; sıradaki hedef 1077. satırdaki tenant cache hidrasyon efekti ve çevresindeki hook eksikleri).
- `npx eslint src/App.tsx` (24 Kas 2025, 1x) → 467 warning (cross-tab storage efekti dependency fix'i ve 1239-1950 arasındaki cache/notification/hash handler logger geçişleriyle 31 `no-console` uyarısı daha temizlendi).
- `npx eslint src/App.tsx` (24 Kas 2025, 1x) → 498 warning (`openSaleModal`/`closeSaleModal` logger geçişi sonrası 7 `no-console` uyarısı kapandı; sıradaki hedef 1077. satırdaki tenant cache hidrasyon efekti ve çevresindeki hook eksikleri).

## Notlar
- Sales state artık yalnızca `persistSalesState` üzerinden değişiyor; yeni kod eklerken storage event'lerinin gereksiz tetiklenmemesi için `runWithSalesPersistenceSuppressed` sarmalayıcısı kullanılmalı (örn. legacy cache hidrasyonları/tenant switch).
- `ReportsPage`/`SalesList` tarafında hâlâ doğrudan cache okuyan/parallel state tutan parçalar var; ileriki oturumda bu bileşenler yeni helper akışına geçirilmeli.

# Dev Session Notes (2025-11-23)

## Biten işler
- `ExpenseList`, `SimpleSalesPage` ve `ArchivePage` paginasyon/saklanan görünüm ayarları `safeLocalStorage` helper'larına geçirildi; page-size whitelist'leri tek yerden yönetiliyor ve hatalı değerler `logger` ile raporlanıyor.
- `SettingsPage` içindeki billing/portal bekleme bayrakları artık doğrudan `safeLocalStorage` API'sini kullanıyor; custom `window.localStorage` sarmalayıcısı kaldırıldı.
- `ReportsPage` quote cache hidrasyonunda `listLocalStorageKeys()` helper'ı kullanılarak `window.localStorage` erişimleri merkezi hale getirildi; `src/utils/localStorageSafe.ts` bu amaçla yeni anahtar enumerator sağlıyor.
- `AuthContext` bozuk cache temizliği `listLocalStorageKeys()` üzerinden ilerliyor; `logger`/`adminAuthStorage` artık `safeLocalStorage` + yeni `safeSessionStorage` yardımcılarını kullanıyor, böylece doğrudan `window.localStorage` erişimleri tamamen helper katmanına taşındı.
- Tenant scoped storage helper seti `src/utils/localStorageSafe.ts` ile stabilize edildi; eski `safeLocalStorage` erişimleri kademeli olarak helper'lara taşındı.
- `LanguageContext` ve `CurrencyContext` tarafında tenant bazlı tercih cache'i helper API'leri üzerinden yönetiliyor.
- `src/App.tsx` içindeki bildirim hidrasyonu tenant kimliğine göre yeniden yazıldı; `normalizeStoredNotifications` + `hydrateNotifications` akışı cross-tenant leak'i çözdü.
- Genel tarama ile kalan global/localStorage kullanımları listelendi; sadece bilinçli (auth bootstrap, legacy sales migration vs.) dokunuşlar bırakıldı.
- `NotificationPreferencesContext` tenant scoped helper'lara geçirildi; `readTenantScopedObject`/`writeTenantScopedObject` ile cache izole edildi ve sadece legacy global anahtardan okuma fall-back olarak tutuldu.
- `CurrencyContext` ve `LanguageContext` global `safeLocalStorage.setItem` yazımlarından arındırıldı; yalnızca tenant scoped anahtarlar güncelleniyor, global anahtarlar sadece okuma fallback'i olarak kaldı.
- `src/utils/localStorageSafe.ts` içine `readLegacySalesCaches` + `clearLegacySalesCaches` eklendi ve `App.tsx`'deki göç efekti bu helper'lara taşındı.
- Legacy auth/tenant/user anahtarları için `readLegacyAuthToken` / `writeLegacyAuthToken` / `readLegacyTenantId` / `writeLegacyTenantId` / `readLegacyUserProfile` helper'ları açıldı ve `src/App.tsx` üzerindeki bootstrap path'i bu helper'ları kullanacak şekilde güncellendi.
- AuthContext ve `src/api/client.ts` token yönetimi yeni helper setine geçirildi; kullanıcı/tenant cache yazımı da `writeLegacyUserProfile` / `writeLegacyTenantProfile` üzerinden merkezileştirildi.
- `clearLegacySessionCaches` helper'ı eklendi; AuthContext `clearCorruptedData` ve `authService.logout()` bu yardımı kullanarak token/user/tenant anahtarlarını ortak bir yoldan temizliyor.
- API client içindeki ardışık 401 çıkışı da `clearLegacySessionCaches` kullanıyor; böylece logout/token temizliği tek kaynaktan ilerliyor.
- `AuditLogComponent` ve `TenantConsolePage` kullanıcı tokenı/tenant cache'i için `readLegacyAuthToken` + `readLegacyTenantProfile` helper'larına geçirildi; admin araçları da aynı kaynağı kullanıyor.
- `SettingsPage` içindeki plan/organization/backup akışları `readLegacyAuthToken` + `readLegacyTenantId` + `writeLegacyUserProfile` kullanacak şekilde güncellendi; localStorage'ya doğrudan erişen `safeStorageJson` kaldırıldı.
- `InviteForm`, `CustomerHistoryModal`, `InvoiceFromSaleModal`, `CustomerHistoryPage`, `QuotesPage`, `ReportsPage`, `QuoteCreateModal`, `QuoteTemplatesManager`, `PublicQuotePage`, `utils/quoteTemplates.ts` ve `utils/pdfGenerator.ts` tenant/auth cache erişimlerini `readLegacyTenantId`/`readLegacyUserProfile` + `safeLocalStorage` helper seti üzerinden çalışacak şekilde temizlendi; quote ve invoice PDF üretimindeki localStorage erişimleri de aynı helper'lara bağlandı.
- `CustomerViewModal` içerisindeki dil belirleme yardımcıları `safeLocalStorage` kullanacak şekilde güncellendi; artık `window.localStorage` erişim hataları modalı düşürmüyor ve tenant/dil seçimi merkezi helper seti üzerinden okunuyor.
- `InvoiceViewModal` da `i18nextLng` tercihini `safeLocalStorage` üzerinden okuyor; SSR sırasında localStorage erişimi patlamıyor ve dil fallback'i i18n state'iyle hizalı.
- `ProductList` dil seçimi + sayfa boyutu cache'i `safeLocalStorage` üzerinden okunup yazılıyor; SSR guard'ları ortak helper'a taşındı ve page size ayarı tek kaynaktan yönetiliyor.
- `ProductViewModal` modalı da dil tercihlerini `safeLocalStorage` üzerinden okuyor; SSR guard'ı helper'a devredildi ve modal render'ı window erişiminden bağımsız.
- `BankList` sayfa boyutu tercihlerini `safeLocalStorage` üzerinden okuyor/yazıyor; global window guard'ı helper seviyesinde çözülerek tablo SSR-safe hale getirildi.
- `CustomerList` dil tespiti + `customers_pageSize` cache'i `safeLocalStorage` ile okunup yazılıyor; page-size validasyonu ortak helper'a taşındı ve SSR guard'ları kaldırıldı.
- `SupplierList` ve `InvoiceList` sayfa boyutu + kaydedilmiş görünüm hidrasyonları `safeLocalStorage` + tipli validator'lara taşındı; `SavedViewsBar` artık `Partial<...ViewState>` kullanıyor ve SSR sırasında window erişimi yapılmıyor.
- `GeneralLedger` tablo paginasyonu `safeLocalStorage` üzerinden okunup yazılıyor; page size whitelist'i ve setter'ı helper'a taşındı.
- `debug-env` helper'ı TypeScript'e taşındı; `safeLocalStorage` kullanıp `window.__enableEnvDebug`/`__disableEnvDebug` üzerinden güvenli toggle sağlıyor, artık direkt `window.localStorage` önerilmiyor.
- `src/utils/logger.ts` açıklamaları yeni debug helper'ına referans veriyor; verbose log aç/kapat yönergeleri helper'a yönlendirildi.
- `AuditLogComponent` fetch akışı `logger` üzerinden raporluyor, `useCallback` ile bağımlılıklar tamamlandı ve `diff` tipleri `Record<string, unknown>` olarak sıkılaştırıldı; component artık eslint'in `no-console` ve `no-explicit-any` uyarılarını üretmiyor.
- `OrganizationMembersPage` tamamen `logger` kullanıyor, data yükleyicisi `useCallback` ile sabitlendi, billing-success event'i SSR güvenli hale getirildi ve pending invite yenilemesi `async/await` akışına taşındı; ESLint'in `no-console` ve `no-empty` uyarıları sıfırlandı.
- `SaleModal` içindeki tüm konsol çağrıları `logger` üzerinden raporlanırken form state'i `SaleFormState` + `buildSaleFormState` helper'larıyla tiplenip sanitize edildi; müşteri/ürün dropdownları `useMemo` ile optimize edildi, locale bazlı tutar gösterimleri i18n dilini kullanıyor ve tüm input setter'ları `sanitizeQuantity`/`sanitizeUnitPrice` üzerinden güvenli hale getirildi.
- `InvoiceModal` yeniden tiplenerek `InvoicePayload` / `InvoiceLineItem` yapıları oluşturuldu, `logger` entegrasyonu ile konsol çağrıları söküldü ve stok kontrolleri `getAvailableStock` helper'ı üzerinden çalışıyor; ayrıca `mapReturnItemsFromOriginal` ile `return` faturaları negatif kalemlerle otomatik yükleniyor.
- `CustomerHistoryPage` yeniden yazılarak tüm `any` kullanımları tipli modellere taşındı, konsol çağrıları `logger` ile değiştirildi, CSV/PDF eylemleri SSR-safe hale getirildi ve `InvoiceViewModal`/`SaleViewModal` state'leri gerçek tiplerle çalışıyor; bu sayfa artık `no-console`, `no-empty` ve `no-explicit-any` uyarıları üretmiyor.
- `CustomerModal` ve `CustomerViewModal` domain tipleriyle güncellendi; `any` kullanımları kaldırıldı, çeviri helper'ları `useTranslation`/`safeLocalStorage` kombinasyonuna taşındı ve `onSave` artık `Partial<Customer>` bekleyerek `App` içerisindeki `upsertCustomer` akışıyla birebir hizalandı.
- `CustomerHistoryModal` satış/teklif filtreleri normalize edilerek memoize edildi, tarih/tutar biçimleyicileri güvence altına alındı ve quote cache okuması case-insensitive hale getirildi; `CustomerList` domain tipleriyle hizalanıp CSV şablon indirme akışı SSR guard'ı ve `logger` telemetry'si ile güçlendirildi.
- `SupplierHistoryModal` gider kayıtları için paylaşılan tipleri kullanıyor, tarih/tutar formatter'ları güvenli hale getirildi ve boş veriler için varsayılanlar eklenirken, `SupplierList` artık API modelleriyle hizalı, eksik alanlarda (isim/e-posta/kategori) kullanıcıya anlamlı fallback metinleri gösteriliyor ve liste filtreleri boş değerleri patlatmıyor.
- `ExpenseList` ardından `ExpenseViewModal` da API `Expense` modelini kullanacak şekilde yeniden tiplenip tüm `any` kalıntıları temizlendi; dil/para formatlayıcıları `safeLocalStorage` + `i18n` ile hizalandı, tedarikçi alanları union-safe guard'larla render ediliyor ve durum rozetleri `normalizeStatusKey` üzerinden tek kaynaktan yönetiliyor.
- `ExpenseList` artık filtrelenmiş verileri CSV olarak dışa aktarabiliyor; header butonu Excel dostu BOM ile `Blob` üretip `logger` üzerinden telemetri bırakıyor, locale bazlı tarih/tutar formatı korunuyor ve tedarikçi/kategori label'ları mevcut helper'larla hizalı.
- `ExpenseModal` tekil gider formu API modeline bağlandı; form state'i tiplenip tedarikçi araması locale-safe filtrelere taşındı, miktar doğrulaması `parseFloat` + virgül düzeltmesiyle sertleştirildi ve kaydetme payload'ı `date/expenseDate` ikilisini otomatik eşleyip null supplier ID'leri netleştiriyor.
- `RecentTransactions` bileşeni faturalar/giderler/satışlar/teklifler için API modellerine bağlandı; `UnifiedTransaction` yapısı `any` kullanımını bitirirken tarih/tutar formatter'ları SSR-safe hale getirildi, quote para birimi guard'ları eklendi ve tablo satırları controlled badge/icon helper'larıyla render ediliyor.
- `ReportsPage` gider sekmesine CSV export eklendi; paid giderler logger guard'lı handler ile BOM'lu `Blob` üzerinden dışa aktarılıyor, tarih/tutar/supplier helper'ları locale-safe hale getirildi ve çökme riskli `new Date(undefined)` çağrıları korumaya alındı.
- `SaleViewModal` locale-aware formatter'larla güncellendi; audit metadata `(sale as any)` cast'leri kaldırıldı, ürün satırları `SaleItem` tipleriyle render ediliyor ve çoklu/tekil ürün toplamları ortak helper'lar üzerinden hesaplanarak currency çıktıları i18n diline göre biçimleniyor.
- `SimpleSalesPage` domain tipleriyle yeniden yazıldı; `SaleWithMetadata` + `InvoiceWithRelations` alias'ları sayesinde state'lerdeki tüm `any` kullanımları temizlendi, tüm console log'lar `logger` telemetrilerine taşındı, filtrelenmiş satışlar için BOM'lu CSV export + yeni buton eklendi ve fatura oluşturma modalına `Loader2` animasyonlu yükleme durumu ile buton disable akışı geldi.
- `SaleViewModal` locale-aware formatter'larla güncellendi; audit metadata `(sale as any)` cast'leri kaldırıldı, ürün satırları `SaleItem` tipleriyle render ediliyor ve çoklu/tekil ürün toplamları ortak helper'lar üzerinden hesaplanarak currency çıktıları i18n diline göre biçimleniyor.
- `ExistingSaleSelectionModal` satış/domain tipleriyle hizalandı; invoice filtreleri `Set` tabanlı hale getirildi, locale bazlı tarih formatlayıcıları `safeLocalStorage` + `i18n` ile çalışıyor, tutar gösterimleri `toNumberSafe` ile sanitize edilip `logger` telemetrisiyle zenginleştirildi ve arama filtresi `normalizeText` kullanarak diakritik-insensitive hale getirildi.
- `InvoiceFromSaleModal` artık domain tiplerini kullanıyor; satış kalemleri ve fatura payload'ı tiplenip `any` bağımlılığı kaldırıldı, tarih/para formatter'ı locale-aware hale geldi, stok uyarıları & kaydetme akışı `logger` telemetrisiyle raporlanıyor ve KDV/ara toplam hesaplamaları `toNumberSafe` ile sanitize edilerek tek kaynaktan hesaplanıyor.
- `App.tsx` üzerindeki `handleCreateInvoiceFromSale` akışı `InvoiceDraftPayload` tipini kullanacak şekilde yeniden yazıldı; müşteri çözümleme/line item senaryoları `logger` telemetrisiyle raporlanıyor, backend payload'ı `BackendInvoicePayload` ile tiplenip tüm tutarlar `toNumberSafe` üzerinden normalize ediliyor ve cache yazımları hata verdiğinde uyarı log'ları bırakılıyor.
- `SimpleSalesPage` entegrasyonu artık `logger` destekli `handleSimpleSalesPageUpdate` üzerinden ilerliyor; aynı helper tenant scoped cache'leri güncel tutuyor ve `GeneralLedger`'ın `onSalesUpdate` prop'u da bu paylaşılan `persistSalesState` fonksiyonuna taşındı.

## Kalan işler ve nasıl ilerleyeceğim

1. **Legacy global storage temizliği**
   - `sales` migrasyonu ve login bootstrap'inde kalan `safeLocalStorage` erişimlerini tara.
   - Gerçekten gerekiyorsa helper'lara sar; değilse feature flag kaldırıp kodu sök.
   - Temizlik sonrası migrations dokümantasyonunu (`MIGRATIONS.md`) güncelle.
   - İnceleme notları (24 Kas 2025):
   - `src/App.tsx` içindeki **legacy sales migration** efekti tamamen kaldırıldı; bundan sonra sadece `legacy-sales-migrator.html` üzerinden manuel taşıma yapılacak.
      - App + AuthContext + API client katmanları legacy helper'lara taşındı; sırada Admin UI/Settings gibi doğrudan `safeLocalStorage`'a dokunan kalan bileşenleri incelemek ve gerekirse aynı migrator mantığını paylaşmak var.
   - ✅ `CurrencyContext` / `LanguageContext` yazma tarafı temizlendi; takipte sadece tenant scoped anahtarlar kalıyor.

2. **Lint borcunu erit**
   - `npx eslint src/App.tsx` çıktılarını grupla (any, empty block, react-hooks, no-console).
   - Önce `react-hooks/exhaustive-deps` uyarılarını düzelt (dependency arraylerini sabitle veya `useRef`/callback patternine geç).
   - Ardından `any` tiplerini domain model tipleriyle değiştir; gerekirse `types/` altında paylaşılan arayüz aç.
   - Boş blokları kaldır ya da TODO yorumuyla doldur; gereksiz `console.log`ları `logger` ile değiştir.
   - `no-console` borcu `App.tsx` özelinde sıfırlandı; yeni hedef `200-700` bandındaki `any` ağırlıklı i18n helper'ları ve `no-empty` blokları tipleyip doldurarak uyarı sayısını 350 altına çekmek (örn. `normalizeStoredNotifications`, `tOr` parametre tipleri, boş `catch` blokları).
   - Satış tarafında sıradaki adım `SalesList` bileşenini yeni tip/helper'larla hizalamak: logger telemetrisi ekle, CSV/export parity'sini koru ve kalan `any` kullanımlarını domain modellerine taşı; `SaleViewModal`, `SimpleSalesPage` ve `ExistingSaleSelectionModal` tamamlandı.
   - `ReportsPage` gelir/quote kartlarında kalan `any` alanları temizleyip CSV/PDF aksiyonlarını tek helper setine taşı; `SaleModal` sonrası hedef olarak dashboard widget'larında da aynı export telemetry'sini paylaş.
   - (24 Kas 2025) `npx eslint src/App.tsx` çalıştırıldı; beklenen legacy uyarılar 507 seviyesine indi ve yeni dependency/durum değişiklikleri ekstra uyarı üretmedi.

3. **Test/regresyon katmanı**
   - Tenant switch senaryosu için manuel script: iki farklı tenant ile giriş yap, bildirim ekranını takip et.
   - Storage helper refactor'ı için smoke test: dil/para birimi ayarlarını değiştirip refresh et.
   - Otomasyon gerekiyorsa Playwright senaryosu taslağı çıkar (henüz yoksa `tests/e2e/` altında yeni dosya aç).

4. **Tip ve util sertleştirme**
   - `src/utils/localStorageSafe.ts` içine `TenantScopedReadOptions` vb. için JSDoc ekle (kendi referansın için yeterli).
   - `pickIdentifier` ve `sanitizeString` kullanımını paylaşan util'leri başka alanlarda da kullan (ör. auth parse eden yerler).
   - Uzun vadede `zod` veya benzeri runtime validator entegre etmeyi değerlendir.

5. **Dokümantasyon güncellemesi**
   - Bu dosyayı yeni oturumda açıp checklist olarak kullan.
   - İşler bittiğinde ilgili `README_CLEAN.md` veya spesifik özellik dokümanlarını (ör. `NOTIFICATION_PREFS.md` yoksa oluştur) güncelle.
