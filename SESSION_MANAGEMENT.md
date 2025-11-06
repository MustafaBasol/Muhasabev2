# Oturum Yönetimi (Idle Logout + Sliding Token Refresh)

Bu doküman kullanıcıların **hareketsizlik nedeniyle otomatik logout** edilmesi ve **aktif kullanım sırasında beklenmedik şekilde çıkış yapmalarını engelleyen kayar (sliding) oturum yenileme** mekanizmasını açıklar.

## Genel Mimari
- **Access Token (JWT)**: `15m` (AuthModule `expiresIn: '15m'`).
- **İnaktif Oturum Sonu (Idle Timeout)**: Varsayılan `30 dakika` (frontend). Değiştirmek için `VITE_IDLE_TIMEOUT_MINUTES`.
- **Sliding Refresh**: Kullanıcı aktifse (sekme görünür + son 5 dk içinde etkileşim) token süresi bitmeye 5 dakikadan az kaldığında otomatik `/auth/refresh` çağrısı ile yenilenir.
- **Depolama**: Token `localStorage` içinde `auth_token` anahtarıyla saklanır.

## Bileşenler
| Katman | Dosya | Amaç |
|--------|-------|------|
| Backend | `backend/src/auth/auth.controller.ts` | `/auth/refresh` ve (yedek) `/auth/refresh-token` endpointleri |
| Backend | `backend/src/auth/auth.service.ts` | `refresh(user)` yeni kısa ömürlü JWT üretir |
| Frontend | `src/utils/sessionManager.ts` | Aktivite takibi, idle kontrol, token yenileme |
| Frontend | `src/contexts/AuthContext.tsx` | Login sonrası SessionManager başlatma / logout ile durdurma |
| Frontend | `src/api/auth.ts` | `authService.refresh()` (önce `/auth/refresh-token`, hata olursa `/auth/refresh`) |

## SessionManager Çalışma Akışı
1. Login veya register sonrası `AuthContext` içinde `createSessionManager(...).start()` çağrılır.
2. Aşağıdaki event'ler aktivite sayılır: `click, keydown, mousemove, scroll, touchstart, visibilitychange, hashchange`.
3. Her dakikada bir (`checkIntervalSeconds = 60`):
   - Son aktivite zamanı > `idleTimeoutMinutes` ise `logout()` tetiklenir.
   - Token kalan süre < `refreshBeforeSeconds` (varsayılan 300 sn) ve sekme görünür + kullanıcı son 5 dk içinde etkileşimli ise refresh çağrılır.
4. Refresh başarılı ise yeni token localStorage'a yazılır ve sonraki döngüde süre yeniden değerlendirilir.

## Idle Timeout Mantığı
- Süre hesabı: `Date.now() - lastActiveAt > idleTimeoutMinutes * 60 * 1000`.
- Idle tespitinde session manager durur ve `onLogout()` çağrısı ile güvenli çıkış yapılır.
- Kullanıcı yeniden login olursa yeni döngü başlatılır.

## Refresh Mantığı
- Token'ın `exp` alanı JWT payload'dan base64 decode edilerek okunur (client side decoding; backend doğrulaması login/guard aşamasında).
- Kalan süre `secondsLeft <= refreshBeforeSeconds` ise ve kullanıcı aktif kabul ediliyorsa `authService.refresh()` çağrılır.
- Refresh başarısız olursa (ör. 401), axios interceptor mevcut token'ı temizler ve ana sayfaya yönlendirir.

## Alternatif Endpoint Neden Var?
Bazı geliştirme senaryolarında (aynı portta eski build kalması vb.) `/auth/refresh` erişilemediğinde fallback sağlayabilmek için `/auth/refresh-token` eklendi. İleride sorun kalmazsa kaldırılabilir.

## Yapılandırılabilir Değerler
| Değişken | Varsayılan | Açıklama |
|----------|-----------|----------|
| `VITE_IDLE_TIMEOUT_MINUTES` | 30 | Kullanıcı inaktif süresi (dakika) |
| (kod içi) `refreshBeforeSeconds` | 300 | Token süresi bitimine kalan eşik (sn) |
| (kod içi) `checkIntervalSeconds` | 60 | Kontrol döngüsü periyodu (sn) |

## Güvenlik Notları
- Kısa ömürlü access token + sık yenileme, çalınan token riskini azaltır.
- Idle logout tarayıcı açık unutulsa bile hesap güvenliğini artırır.
- Refresh işlemi mevcut access token ile guard korumalı yapılır; ayrı uzun ömürlü refresh token modeli ileride eklenebilir.

## Manuel Test Adımları
```bash
# 1. Login ol (email/password ile)
# 2. DevTools > Application > Local Storage 'auth_token' exp payload kontrol et
# 3. Konsolda activity üret (scroll/click) ve 10+ dakika bekle; exp süresinden 5 dk önce yenilendiğini gözlemlersin.
# 4. Sekmeyi arka plana al: refresh yapılmaz (visibilityState hidden).
# 5. 30 dakika hiç etkileşim yapma: otomatik logout olur ve localStorage temizlenir.
```

## Olası İyileştirmeler
- Gerçek refresh token (HttpOnly cookie) yapısı eklenebilir.
- Multi-tab senkronizasyonu için BroadcastChannel ile tek refresh yapan lider sekme seçimi.
- Kullanıcıya "5 dakika sonra çıkış yapılacak" uyarısı (modal / toast).
- Token decode işlemi için güvenli fallback (decode hatasında zorunlu logout).

## Sık Karşılaşılan Sorunlar
| Sorun | Neden | Çözüm |
|-------|-------|-------|
| `/auth/refresh` 404 | Eski backend süreci (dist) portu tutuyor | Eski süreci öldür, watch modunu yeniden başlat veya farklı porta taşı | 
| Token yenilenmiyor | Sekme gizli ya da kullanıcı 5 dk boyunca pasif | Sekmeyi öne getir, etkileşim yap | 
| Anlık logout | Token süresi bitmiş ve refresh başarısız | Network / backend loglarını incele, guard hata kodu | 

---
Bu dokümanla birlikte oturum yönetimi tam entegrasyon durumuna geçti.
