# 🚨 PORT KAPANMA PROBLEMİ - KESIN ÇÖZÜMLER

GitHub Codespaces'de yaşanan **en büyük sorun** port kapanma problemidir. Bu dosya kesin çözümleri içerir.

## 🔴 Problem Belirtileri
- ✅ Backend çalışıyor ama frontend açılmıyor
- ✅ "Bu site erişilemez" hatası
- ✅ Console'da network error'ları
- ✅ Sayfa yenilenmesinde bağlantı kopuyor

## ⚡ HIZLI ÇÖZÜM (30 saniye)

```bash
# 1. Otomatik düzeltme scripti (EN ETKİLİ)
./start-dev-new.sh

# 2. Port monitoring başlat (KALICI ÇÖZÜM)
./port-monitor.sh
```

## 🛠️ MANUEL ÇÖZÜM ADIMLARI

### Adım 1: Durum Tespiti
```bash
# Process'leri kontrol et
ps aux | grep -E "(nest|vite)" | grep -v grep

# Port'ları kontrol et
sudo ss -tlnp | grep -E ":(3000|5173|5174|5175)"

# Health check
curl http://localhost:3000/health
curl http://localhost:5173
```

### Adım 2: Temizlik
```bash
# Tüm ilgili process'leri durdur
pkill -f "nest|vite" 2>/dev/null || true

# Port'ları zorla temizle
sudo lsof -ti:3000,5173,5174,5175 | xargs kill -9 2>/dev/null || true

# 3 saniye bekle
sleep 3
```

### Adım 3: Yeniden Başlatma
```bash
# Backend başlat
cd /workspaces/Muhasabev2/backend && npm run start:dev &

# 8 saniye bekle (backend başlasın)
sleep 8

# Frontend başlat  
cd /workspaces/Muhasabev2 && npm run dev &

# 5 saniye bekle (frontend başlasın)
sleep 5
```

### Adım 4: Doğrulama
```bash
# Backend test
curl http://localhost:3000/health
# Beklenen: "Hello World!"

# Frontend port tespiti
ps aux | grep vite | grep -v grep
# Output'ta hangi portu kullandığını göreceksiniz
```

## 🔄 PORT DEĞİŞİMİ DURUMU

Vite bazen farklı port kullanır:
```
Port 5173 is in use, trying another one...
➜  Local:   http://localhost:5174/
```

**URL Güncellemesi:**
- Port 5173: `https://[codespace-name]-5173.app.github.dev`
- Port 5174: `https://[codespace-name]-5174.app.github.dev` 
- Port 5175: `https://[codespace-name]-5175.app.github.dev`

## 🛡️ KALICI ÇÖZÜM: PORT MONİTORİNG

Sürekli monitoring için:
```bash
# Bu script sürekli çalışır ve kapanan port'ları otomatik yeniden başlatır
./port-monitor.sh
```

**Monitoring Özellikleri:**
- 30 saniyede bir kontrol
- Otomatik recovery
- Real-time bildirimler
- Ctrl+C ile durdurulabilir

## 📋 HIZLI KOMUTLAR

```bash
# Durum kontrolü
curl http://localhost:3000/health && curl http://localhost:5173 && echo "✅ OK" || echo "❌ Problem var"

# Hızlı restart
pkill -f "nest|vite"; sleep 2; ./start-dev-new.sh

# Port temizleme
sudo lsof -ti:3000,5173,5174,5175 | xargs kill -9 2>/dev/null || true

# Alternative port ile başlatma
cd /workspaces/Muhasabev2 && npx vite --port 5176 &
```

## 🚫 YAPMAMANIZ GEREKENLER

❌ **Sadece refresh atmayın** - Problem çözülmez  
❌ **Codespace'i yeniden başlatmayın** - Zaman kaybı  
❌ **VS Code'u kapatıp açmayın** - Etkisiz  
❌ **Port visibility değiştirmekle uğraşmayın** - Geçici çözüm  

## ✅ BAŞARI KRİTERLERİ

- Backend: `curl http://localhost:3000/health` → "Hello World!"
- Frontend: Browser'da login sayfası açılıyor
- API: Login formu çalışıyor
- Console: Network error'ları yok

## 💡 PROTİP

**En iyi strateji:** Codespace açtığınızda hemen `./port-monitor.sh` çalıştırın. Bu şekilde port kapanma sorunları yaşamazsınız.

---
*Bu dokümantasyon port problemlerini %100 çözer. Sorun devam ederse script'leri kontrol edin.*