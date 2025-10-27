# 🛡️ VERİLERİNİZ ARTIK GÜVENLİ!

## ✅ Yapılan Düzeltmeler

### Sorun
- `synchronize: true` ayarı her backend başlatıldığında tabloları yeniden oluşturuyordu
- Veriler kayboluyordu

### Çözüm
1. ✅ `synchronize: false` - Tablolar asla silinmez
2. ✅ Docker volume ile kalıcı depolama
3. ✅ Otomatik yedekleme sistemi
4. ✅ Kolay geri yükleme

## 🚀 Hızlı Başlatma

```bash
./start-safe.sh
```

Bu script:
- ✅ Docker servisleri başlatır
- ✅ Backend ve Frontend'i başlatır
- ✅ Veritabanı bağlantısını kontrol eder
- ✅ Veri sayısını gösterir

## 💾 Yedekleme

### Yedek Al
```bash
./quick-backup.sh
```

### Yedeği Geri Yükle
```bash
./restore-backup.sh
```

## 🔍 Veri Kontrolü

Verilerinizi kontrol etmek için:
```bash
docker exec -it moneyflow-db psql -U moneyflow -d moneyflow_dev

# PostgreSQL konsolunda:
SELECT * FROM users;
SELECT * FROM invoices;
\q  # Çıkış
```

## 📦 Mevcut Veriler

Şu anda veritabanında:
- ✅ 5 kullanıcı
- ✅ 3 tenant (şirket)
- ✅ 2 fatura
- ✅ 3 müşteri
- ✅ 2 tedarikçi
- ✅ 3 ürün
- ✅ 2 gider

## 🌐 Erişim

- **Frontend:** https://${CODESPACE_NAME}-5173.app.github.dev
- **Backend:** https://${CODESPACE_NAME}-3000.app.github.dev

## 👤 Giriş Bilgileri

- **Email:** admin@test.com
- **Şifre:** Test123456

## ⚠️ ÖNEMLİ NOTLAR

1. **Asla `synchronize: true` yapmayın** - Verileriniz kaybolur!
2. **Düzenli yedek alın** - Her önemli işlem öncesi
3. **Docker container'ları silmeyin** - Veriler kaybolabilir
4. **Volume'leri koruyun** - `docker-compose down -v` YAPMAYIN!

## 📚 Dokümantasyon

Detaylı bilgi için: `DATA_PERSISTENCE.md`

---

**Son Güncelleme:** 27 Ekim 2025  
**Durum:** ✅ VERİLER GÜVENLİ - YEDEKLEME AKTİF
