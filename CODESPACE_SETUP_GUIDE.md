# 🚀 GitHub Codespaces Kurulum Rehberi

Bu rehber ile yeni bir Codespace oluşturduğunuzda projeyi tarayıcıda görüntülemek için gerekli adımları hızlıca uygulayabilirsiniz.

## ⚡ Hızlı Başlangıç (5 dakika)

### 1. 📋 Ön Koşullar Kontrol
```bash
# Docker servislerin çalıştığını kontrol et
docker ps
# PostgreSQL, Redis, pgAdmin çalışıyor mu?
```

### 2. 🛠️ Backend Kurulum
```bash
# Backend dizinine git
cd /workspaces/Muhasabev2/backend

# Bağımlılıkları yükle (sadece ilk seferinde)
npm install

# Backend'i başlat (PORT 3000)
npm run start:dev
```

**Backend başlayınca göreceğiniz çıktı:**
```
🚀 Application is running on: https://[codespace-name]-3000.app.github.dev
📚 Swagger documentation: https://[codespace-name]-3000.app.github.dev/api
🔗 Local access: http://localhost:3000
```

### 3. 🎨 Frontend Kurulum
```bash
# Ana dizine git
cd /workspaces/Muhasabev2

# Bağımlılıkları yükle (sadece ilk seferinde)
npm install

# Frontend'i başlat (PORT 5173)
npm run dev
```

**Frontend başlayınca göreceğiniz çıktı:**
```
VITE v7.1.10  ready in 200ms
➜  Local:   http://localhost:5173/
➜  Network: http://10.0.0.108:5173/
```

### 4. 🌐 Tarayıcıda Açma
Frontend URL'i:
```
https://[codespace-name]-5173.app.github.dev
```

## 🎯 Demo Login Bilgileri
- **E-posta**: admin@test.com
- **Şifre**: Test123456

## 🔧 Konfigürasyon Dosyaları

### Backend Port Konfigürasyonu
`backend/src/main.ts`:
```typescript
const port = parseInt(process.env.PORT || '3000', 10);
const host = '0.0.0.0';
await app.listen(port, host);
```

### Frontend Proxy Konfigürasyonu  
`vite.config.ts`:
```typescript
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

## 🚨 Sorun Çözme

### ⚠️ PORT KAPANMA PROBLEMİ (En Yaygın Sorun)

GitHub Codespaces'de port'lar zaman zaman beklenmedik şekilde kapanır. Bu durum için:

**🔴 Problem Belirtileri:**
- Sayfa açılmıyor
- "Bu site erişilemez" hatası
- Console'da network error'ları

**✅ KESIN ÇÖZÜM 1: Process Kontrol & Yeniden Başlatma**
```bash
# 1. Mevcut durumu kontrol et
ps aux | grep -E "(nest|vite)" | grep -v grep

# 2. Port'ları kontrol et  
sudo ss -tlnp | grep -E ":(3000|5173)"

# 3. Eğer process yok ama port meşgulse, port'u temizle
sudo lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sudo lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# 4. Tüm process'leri temizle ve yeniden başlat
pkill -f "nest|vite" 2>/dev/null || true
sleep 3
cd /workspaces/Muhasabev2/backend && npm run start:dev &
sleep 5
cd /workspaces/Muhasabev2 && npm run dev &
```

**✅ KESIN ÇÖZÜM 2: Otomatik Script Kullanımı**
```bash
# En garantili yöntem
./start-dev-new.sh
```

**✅ KESIN ÇÖZÜM 3: Port Visibility Kontrol**
```bash
# GitHub Codespaces'de port visibility'yi kontrol et:
# 1. VS Code'da PORTS sekmesine git
# 2. Port 3000 ve 5173'ü bulun
# 3. Visibility'yi "Public" yapın
# 4. "Open in Browser" tıklayın
```

### Port Çakışması Durumunda

**📍 Vite Otomatik Port Değiştirme**
Vite, port 5173 meşgulse otomatik olarak başka bir port kullanır:
```
Port 5173 is in use, trying another one...
➜  Local:   http://localhost:5174/
```

Bu durumda yeni URL:
- **Frontend**: `https://[codespace-name]-5174.app.github.dev`

**🔧 Manuel Port Kontrolü**
```bash
# Kullanılan port'ları kontrol et
sudo ss -tlnp | grep -E ":(517[3-9]|518[0-9])"

# Belirli port ile çalıştır
cd /workspaces/Muhasabev2 && npx vite --port 5175 &

# Backend alternatif port
PORT=3001 cd /workspaces/Muhasabev2/backend && npm run start:dev &
```

### ⏰ Port Kapanma Önleme Stratejileri

**🔄 Otomatik Yeniden Başlatma (Önerilen)**
```bash
# Terminal'de sürekli izleme scripti
while true; do
  if ! curl -s http://localhost:5173 > /dev/null; then
    echo "⚠️  Frontend kapanmış, yeniden başlatılıyor..."
    cd /workspaces/Muhasabev2 && npm run dev &
  fi
  if ! curl -s http://localhost:3000/health > /dev/null; then  
    echo "⚠️  Backend kapanmış, yeniden başlatılıyor..."
    cd /workspaces/Muhasabev2/backend && npm run start:dev &
  fi
  sleep 30
done
```

**🏃‍♂️ Hızlı Test Komutu**
```bash
# Port'ların çalışıp çalışmadığını hızlı test
curl -s http://localhost:3000/health && curl -s http://localhost:5173 && echo "✅ Her şey çalışıyor" || echo "❌ Bir şeyler yanlış"
```

### API Bağlantısı Test
```bash
# Backend health check
curl "http://localhost:3000/health"
# Beklenen çıktı: Hello World!

# Login API test
curl -X POST "http://localhost:3000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Test123456"}'
# Beklenen çıktı: JWT token içeren JSON
```

### Port Visibility Ayarları
GitHub Codespaces'de port'ların "Public" olarak ayarlandığından emin olun:
1. Terminal'de "PORTS" sekmesine git
2. Port 3000 ve 5173'ü "Public" yap
3. Gerekirse "Reload in Browser" tıkla

## 📂 Proje Yapısı
```
/workspaces/Muhasabev2/
├── backend/          # NestJS API (Port 3000)
├── src/              # React Frontend
├── vite.config.ts    # Frontend konfigürasyonu
├── docker-compose.yml # PostgreSQL, Redis, pgAdmin
└── CODESPACE_SETUP_GUIDE.md # Bu dosya
```

## 🎉 Başarı Kriterleri

✅ **Backend çalışıyor**: http://localhost:3000/health → "Hello World!"  
✅ **Frontend çalışıyor**: https://[codespace-name]-5173.app.github.dev  
✅ **API bağlantısı**: Login formu çalışıyor  
✅ **Database**: Docker containers aktif  

**⏰ Toplam Süre**
- **İlk kurulum**: ~5-7 dakika (npm install dahil)
- **Sonraki başlatmalar**: ~2-3 dakika

## 🔄 Otomatik Başlatma Scripti

### Tek Seferlik Başlatma
```bash
# Normal başlatma
./start-dev-new.sh
```

### Sürekli Monitoring (ÖNERİLEN)
```bash
# Port'lar kapandığında otomatik yeniden başlatır
./port-monitor.sh
```

**🛡️ Port Monitoring Özellikleri:**
- 30 saniyede bir health check
- Otomatik servis recovery
- Kapanan port'ları temizleme
- Real-time durum bildirimi
- Ctrl+C ile durdurulabilir

Script içeriği (`start-dev.sh`):
```bash
#!/bin/bash
echo "🚀 Codespace geliştirme ortamı başlatılıyor..."

# Backend'i başlat
cd /workspaces/Muhasabev2/backend
npm run start:dev &
BACKEND_PID=$!

# 5 saniye bekle (backend başlasın)
sleep 5

# Frontend'i başlat  
cd /workspaces/Muhasabev2
npm run dev &
FRONTEND_PID=$!

echo "✅ Backend PID: $BACKEND_PID (Port 3000)"
echo "✅ Frontend PID: $FRONTEND_PID (Port 5173)"
echo "🌐 Frontend URL: https://$(echo $CODESPACE_NAME)-5173.app.github.dev"

wait
```

## 📞 Destek
Bu rehberi takip ettikten sonra hala sorun yaşıyorsanız:
1. Terminal output'larını kontrol edin
2. Browser console'da hata mesajlarına bakın
3. Port durumunu kontrol edin: `sudo ss -tlnp | grep -E ":(3000|5173)"`

---
*Son güncelleme: 22 Ekim 2025*