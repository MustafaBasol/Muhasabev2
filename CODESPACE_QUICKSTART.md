# 📖 Codespace Hızlı Başlatma Rehberi

Yeni bir GitHub Codespace oluşturduğunuzda bu rehberi takip ederek 5 dakikada projeyi çalışır hale getirebilirsiniz.

## 🚀 Tek Komutla Başlatma

```bash
./start-dev-new.sh
```

Bu komut:
- Docker servisleri başlatır
- Backend'i port 3000'de başlatır  
- Frontend'i port 5173'te başlatır
- Health check yapar
- URL'leri gösterir

## 📋 Manuel Kurulum

### 1. Backend Başlat
```bash
cd /workspaces/Muhasabev2/backend
npm run start:dev
```

### 2. Frontend Başlat
```bash
cd /workspaces/Muhasabev2
npm run dev
```

## 🌐 URL'ler

- **Frontend**: `https://[codespace-name]-5173.app.github.dev`
- **Backend**: `https://[codespace-name]-3000.app.github.dev`

## 👤 Demo Login

- **E-posta**: admin@test.com
- **Şifre**: Test123456

## 📚 Detaylı Dokümantasyon

Tam rehber için: [CODESPACE_SETUP_GUIDE.md](./CODESPACE_SETUP_GUIDE.md)

## 🔧 Sorun Giderme

### Port Kapanma Problemi (Sık Yaşanan)
Port'lar kapandığında bu komutları sırayla çalıştır:

```bash
# 1. Hızlı çözüm - Otomatik script
./start-dev-new.sh

# 2. Manuel çözüm
pkill -f "nest|vite"
cd /workspaces/Muhasabev2/backend && npm run start:dev &
cd /workspaces/Muhasabev2 && npm run dev &

# 3. Port test
curl http://localhost:3000/health && echo "Backend OK"
curl http://localhost:5173 && echo "Frontend OK"
```

### Kesin Çözüm Sırası
1. **Otomatik Script**: `./start-dev-new.sh`
2. **Port Temizleme**: `sudo lsof -ti:3000,5173 | xargs kill -9`
3. **Manuel Başlatma**: Yukarıdaki komutlar
4. **VS Code Ports**: PORTS sekmesinde "Public" yap

### ⚠️ Port Değişimi Durumu
Vite bazen otomatik olarak farklı port kullanır:
```
Port 5173 is in use, trying another one...
➜  Local:   http://localhost:5174/
```

Bu durumda yeni URL: `https://[codespace-name]-5174.app.github.dev`

---

## 🛡️ Port Kapanma Önleme (Önemli!)

GitHub Codespaces'de port'lar sık kapanır. Bunu önlemek için:

### Sürekli Monitoring (Önerilen)
```bash
# Otomatik port izleme ve yeniden başlatma
./port-monitor.sh
```

Bu script:
- 30 saniyede bir port'ları kontrol eder
- Kapanan servisleri otomatik yeniden başlatır
- Sürekli çalışır durumda kalır

### Hızlı Manuel Çözüm
```bash
# Port'lar kapandığında bu komutu çalıştır
./start-dev-new.sh
```

**⏱️ Toplam Kurulum Süresi: 3-5 dakika**