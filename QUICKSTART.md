# 🚀 Hızlı Başlangıç

## Tek Komutla Başlat

```bash
./dev.sh
```

Bu komut:
- ✅ Eski servisleri durdurur
- ✅ Backend'i başlatır (Port: 3002)
- ✅ Frontend'i başlatır (Port: 5174)
- ✅ Durumları kontrol eder ve rapor verir

## Otomatik Yeniden Başlatma (Opsiyonel)

Servisler çökerse otomatik yeniden başlatmak için:

```bash
./watch-services.sh &
```

Bu, arka planda çalışır ve her 10 saniyede bir servisleri kontrol eder.

## Manuel Komutlar

### Servisleri Başlat
```bash
./start-all.sh
```

### Servisleri Durdur
```bash
pkill -f 'nest start' && pkill -f 'vite'
```

### Logları İzle
```bash
# Backend
tail -f /tmp/backend.log

# Frontend
tail -f /tmp/frontend.log
```

## URL'ler

- **Frontend:** http://localhost:5174
- **Backend API:** http://localhost:3002
- **API Docs:** http://localhost:3002/api

## Sorun Giderme

Eğer servisler başlamazsa:

1. Port'ların boş olduğundan emin olun:
```bash
lsof -i :3002
lsof -i :5174
```

2. Tüm servisleri temizleyin:
```bash
pkill -f 'nest start' && pkill -f 'vite' && pkill -f 'node'
```

3. Yeniden başlatın:
```bash
./dev.sh
```
