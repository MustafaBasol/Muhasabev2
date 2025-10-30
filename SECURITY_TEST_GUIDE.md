# 🔒 Güvenlik Sıkılaştırma Test Rehberi

## Test Ortamı
- **Backend URL**: https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev
- **Swagger Docs**: https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/api
- **Test Zamanı**: $(date)

## 1. ✅ Password Hashing Upgrade (bcrypt cost 12+)

### Test 1.1: Admin Login ile Password Hash Kontrolü
```bash
# Test admin login ile yeni hash algoritması
curl -X POST https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

**Beklenen Sonuç**: Login başarılı, SecurityService bcrypt cost 12 kullanıyor

### Test 1.2: User Registration ile Hash Kontrolü
```bash
# Yeni kullanıcı kayıt - hash cost 12 test
curl -X POST https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-security@example.com",
    "password": "TestPassword123!",
    "firstName": "Test",
    "lastName": "Security",
    "tenantId": "existing-tenant-id"
  }'
```

## 2. ✅ Two-Factor Authentication (2FA/TOTP)

### Test 2.1: 2FA Setup
```bash
# Önce login olup JWT token al
JWT_TOKEN="your-jwt-token-here"

# 2FA setup başlat
curl -X POST https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/users/2fa/setup \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Beklenen Sonuç**: 
- QR code URL döner
- Secret key döner
- Backup codes döner
- Manual entry key döner

### Test 2.2: 2FA Enable
```bash
# TOTP app'den 6 haneli kod al ve enable et
curl -X POST https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/users/2fa/enable \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "123456"
  }'
```

### Test 2.3: 2FA Status Kontrolü
```bash
curl -X GET https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/users/2fa/status \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Test 2.4: 2FA Verify (TOTP)
```bash
curl -X POST https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/users/2fa/verify \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "654321"
  }'
```

### Test 2.5: 2FA Verify (Backup Code)
```bash
curl -X POST https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/users/2fa/verify \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "ABCD-EFGH"
  }'
```

## 3. ✅ Rate Limiting

### Test 3.1: Auth Endpoint Rate Limiting
```bash
# 5'ten fazla istek gönder (1 dakika içinde)
for i in {1..7}; do
  echo "Request $i:"
  curl -w "%{http_code} - %{time_total}s\n" \
    -X POST https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "nonexistent@example.com",
      "password": "wrongpassword"
    }'
  sleep 1
done
```

**Beklenen Sonuç**: 
- İlk 5 istek: 401 (Unauthorized)
- 6. ve 7. istek: 429 (Too Many Requests)
- Rate limit headers görünür

### Test 3.2: Rate Limit Headers Kontrolü
```bash
# Rate limit headers kontrolü
curl -I -X POST https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Beklenen Headers**:
- `X-RateLimit-Limit: 5`
- `X-RateLimit-Remaining: 4`
- `X-RateLimit-Reset: timestamp`

### Test 3.3: Admin IP Allowlist
```bash
# Admin endpoint'e erişim testi
curl -w "%{http_code}\n" \
  -X GET https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/admin/users
```

## 4. ✅ HTTPS-Only Secure Cookies

### Test 4.1: Cookie Settings Kontrolü
```bash
# Login response'daki cookie ayarlarını kontrol et
curl -c cookies.txt -b cookies.txt \
  -X POST https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "valid@example.com",
    "password": "validpassword"
  }'

# Cookie dosyasını kontrol et
cat cookies.txt
```

**Beklenen Cookie Attributes**:
- `HttpOnly`
- `Secure` (production'da)
- `SameSite=Lax` (dev) / `SameSite=Strict` (prod)

### Test 4.2: CORS Headers Kontrolü
```bash
curl -H "Origin: https://malicious-site.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: X-Requested-With" \
  -X OPTIONS https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/auth/login
```

## 5. ✅ CSRF Protection

### Test 5.1: CSRF Token Generation
```bash
# GET request ile CSRF token al
curl -c csrf_cookies.txt \
  -X GET https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/admin/users \
  -v
```

**Beklenen Response Headers**:
- `X-CSRF-Token: base64-encoded-token`
- `Set-Cookie: csrf-session=...`

### Test 5.2: CSRF Protection Kontrolü (Token Olmadan)
```bash
# CSRF token olmadan POST request
curl -w "%{http_code}\n" \
  -X POST https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/admin/retention/dry-run \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Beklenen Sonuç**: 403 Forbidden - "CSRF token missing"

### Test 5.3: CSRF Protection Kontrolü (Token ile)
```bash
# Önce token al
CSRF_TOKEN=$(curl -s -c csrf_cookies.txt \
  -X GET https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/admin/users | \
  grep -o 'X-CSRF-Token: [^"]*' | cut -d' ' -f2)

# Token ile POST request
curl -w "%{http_code}\n" \
  -b csrf_cookies.txt \
  -X POST https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/admin/retention/dry-run \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Beklenen Sonuç**: İstek geçer (200/400/401 - token'a bağlı)

## 6. 🔒 Security Headers Kontrolü

### Test 6.1: Security Headers
```bash
curl -I https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/
```

**Beklenen Headers**:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: ...`

### Test 6.2: Helmet.js Security
```bash
# CSP policy kontrolü
curl -H "Accept: text/html" \
  https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/ | \
  grep -i "content-security-policy"
```

## 7. 📊 Performance ve Monitoring

### Test 7.1: Response Time Monitoring
```bash
# Response time ölçümü
curl -w "@curl-format.txt" \
  -o /dev/null -s \
  https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/health

# curl-format.txt dosyası:
# time_namelookup:  %{time_namelookup}s\n
# time_connect:     %{time_connect}s\n
# time_total:       %{time_total}s\n
```

### Test 7.2: Concurrent Request Handling
```bash
# Paralel istekler gönder
seq 1 10 | xargs -n1 -P10 -I{} curl -s -w "%{http_code}\n" \
  https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/health
```

## 8. 🧪 Vulnerability Tests

### Test 8.1: SQL Injection Test
```bash
# Basic SQL injection attempt
curl -X POST https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com'\'' OR 1=1 --",
    "password": "anything"
  }'
```

### Test 8.2: XSS Protection Test
```bash
# XSS payload test
curl -X POST https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "name": "<script>alert(\"XSS\")</script>",
    "email": "test@example.com"
  }'
```

## 9. 📝 Test Sonuçları Kaydetme

```bash
# Test sonuçlarını kaydet
echo "=== Security Test Results ===" > security_test_results.txt
echo "Date: $(date)" >> security_test_results.txt
echo "Backend URL: https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev" >> security_test_results.txt
echo "" >> security_test_results.txt

# Her test sonucunu kaydet
```

## 10. ✅ Test Checklist

- [ ] Password hashing (bcrypt cost 12) çalışıyor
- [ ] 2FA TOTP setup/enable/verify çalışıyor
- [ ] Rate limiting auth endpoints'lerde aktif
- [ ] Secure cookies production'da HTTPS-only
- [ ] CSRF protection POST/PUT/DELETE'lerde aktif
- [ ] Security headers (Helmet.js) aktif
- [ ] Admin IP allowlist çalışıyor
- [ ] Performance acceptable (< 500ms response)
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities

## 11. 🚨 Error Handling Test

```bash
# Hatalı istekler için error handling
curl -X POST https://damp-wraith-7q9x5r7j6qrcgg6-3001.app.github.dev/users/2fa/enable \
  -H "Content-Type: application/json" \
  -d '{
    "token": "invalid-token-format"
  }'
```

**Bu test rehberini kullanarak tüm güvenlik özelliklerini sistematik olarak test edebilirsiniz.**