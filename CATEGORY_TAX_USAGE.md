# Kategori Bazlı KDV Sistemi - Kullanım Kılavuzu

## ✅ Tamamlanan İşler

### Backend
- ✅ ProductCategory entity ve tablo oluşturuldu
- ✅ Product entity'ye categoryTaxRateOverride kolonu eklendi
- ✅ ProductCategoriesService ve Controller hazır
- ✅ API endpoint'leri aktif:
  - GET `/product-categories` - Liste
  - POST `/product-categories` - Yeni kategori
  - PATCH `/product-categories/:id` - Güncelle
  - DELETE `/product-categories/:id` - Sil
- ✅ Database migration çalıştırıldı
- ✅ Backend başarıyla çalışıyor

### Frontend
- ✅ ProductCategory interface tanımlandı
- ✅ product-categories.ts API client oluşturuldu
- ✅ ProductCategoryModal'a KDV input eklendi
- ✅ ProductModal'a override checkbox sistemi eklendi
- ✅ TypeScript tipleri güncellendi

## 🔧 Kullanım

### 1. Kategori Oluşturma

**Kullanıcı Arayüzü:**
```
Ürünler sayfası → "Yeni Kategori" butonu → Modal açılır
├─ Kategori Adı: "Gıda"
├─ KDV Oranı: 1
└─ Kaydet
```

**API Çağrısı (Örnek):**
```typescript
import { productCategoriesApi } from './api/product-categories';

await productCategoriesApi.create({
  name: "Gıda",
  taxRate: 1
});
```

**Backend Response:**
```json
{
  "id": "uuid-here",
  "name": "Gıda",
  "taxRate": 1,
  "isActive": true,
  "tenantId": "tenant-uuid",
  "createdAt": "2025-10-21T14:00:00.000Z",
  "updatedAt": "2025-10-21T14:00:00.000Z"
}
```

### 2. Ürün Oluşturma (Kategorinin KDV'sini Kullan)

**Kullanıcı Arayüzü:**
```
Ürünler sayfası → "Yeni Ürün" → ProductModal
├─ Ad: "Ekmek"
├─ SKU: "EKM-001"
├─ Kategori: "Gıda" (seç)
├─ [ ] Bu ürün için özel KDV oranı kullan ← İŞARETSİZ
└─ Kaydet
```

**Sonuç:**
- Ürün kaydedilir
- `categoryTaxRateOverride` = null
- Faturada kullanılınca "Gıda" kategorisinin %1 KDV'si uygulanır

### 3. Ürün Oluşturma (Özel KDV Override)

**Kullanıcı Arayüzü:**
```
Ürünler sayfası → "Yeni Ürün" → ProductModal
├─ Ad: "E-Kitap"
├─ SKU: "EKIT-001"
├─ Kategori: "Kitap" (varsayılan %8)
├─ [✓] Bu ürün için özel KDV oranı kullan ← İŞARETLİ
│   └─ Özel KDV Oranı: 18
└─ Kaydet
```

**Sonuç:**
- Ürün kaydedilir
- `categoryTaxRateOverride` = 18
- Faturada kullanılınca kategori KDV'si (%8) yerine özel KDV (%18) uygulanır

### 4. Faturada KDV Hesaplama

**InvoiceModal / SimpleSalesPage'de:**

```typescript
// Ürün seçildiğinde
const product = selectedProduct;

// 1. Önce override'a bak
let taxRate = product.categoryTaxRateOverride;

// 2. Override yoksa kategori KDV'sini al
if (taxRate == null) {
  const category = await productCategoriesApi.getByName(product.category);
  taxRate = category?.taxRate ?? 18; // Varsayılan %18
}

// 3. KDV hesapla (KDV DAHİL fiyattan)
const itemTotal = product.price * quantity; // KDV dahil
const itemSubtotal = itemTotal / (1 + taxRate / 100); // KDV hariç
const itemTax = itemTotal - itemSubtotal; // KDV tutarı
```

## 📊 Örnekler

### Örnek 1: Gıda Ürünü
```
Kategori: Gıda (KDV %1)
Ürün: Ekmek
Override: Yok
─────────────────────
Fiyat (KDV Dahil): 10.10 TL
KDV Hariç: 10.00 TL
KDV (%1): 0.10 TL
```

### Örnek 2: Dijital Kitap (Override)
```
Kategori: Kitap (KDV %8)
Ürün: E-Kitap
Override: %18
─────────────────────
Fiyat (KDV Dahil): 118.00 TL
KDV Hariç: 100.00 TL
KDV (%18): 18.00 TL (Override kullanıldı!)
```

### Örnek 3: Çoklu Ürün Faturası
```
Fatura:
1. Ekmek (Gıda %1)     → 10.10 TL (KDV: 0.10)
2. Kitap (Kitap %8)    → 108.00 TL (KDV: 8.00)
3. Laptop (Elektronik %18) → 11,800 TL (KDV: 1,800)
───────────────────────────────────────────────
Toplam KDV Hariç: 10,000 TL
Toplam KDV: 1,808.10 TL
Genel Toplam: 11,808.10 TL
```

## 🔗 Entegrasyon Adımları

### App.tsx'te Yapılması Gerekenler

1. **State değişikliği** (Opsiyonel - geriye dönük uyumlu):
```typescript
// Şu an: string[]
const [productCategories, setProductCategories] = useState<string[]>([]);

// Sonra: ProductCategory[] (önerilir)
const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
```

2. **Kategori yükle**:
```typescript
useEffect(() => {
  const loadCategories = async () => {
    const categories = await productCategoriesApi.getAll();
    setProductCategories(categories);
  };
  loadCategories();
}, []);
```

3. **handleAddProductCategory güncelle**:
```typescript
const handleAddProductCategory = async (name: string, taxRate: number) => {
  const newCategory = await productCategoriesApi.create({ name, taxRate });
  setProductCategories(prev => [...prev, newCategory]);
};
```

4. **handleEditProductCategory güncelle**:
```typescript
const handleEditProductCategory = async (id: string, name: string, taxRate: number) => {
  const updated = await productCategoriesApi.update(id, { name, taxRate });
  setProductCategories(prev => 
    prev.map(cat => cat.id === id ? updated : cat)
  );
};
```

5. **handleDeleteProductCategory güncelle**:
```typescript
const handleDeleteProductCategory = async (id: string) => {
  await productCategoriesApi.delete(id);
  setProductCategories(prev => prev.filter(cat => cat.id !== id));
};
```

### InvoiceModal / SimpleSalesPage Güncellemeleri

**handleSelectProduct'ta:**
```typescript
const handleSelectProduct = async (product: Product) => {
  // Ürünün KDV oranını belirle
  let taxRate = product.categoryTaxRateOverride;
  
  if (taxRate == null && product.category) {
    // Kategori KDV'sini al
    const categories = await productCategoriesApi.getAll();
    const category = categories.find(c => c.name === product.category);
    taxRate = category?.taxRate ?? 18;
  }
  
  // Item'e ekle
  const newItem = {
    productId: product.id,
    productName: product.name,
    quantity: 1,
    unitPrice: product.price, // KDV dahil
    total: product.price,
    taxRate: taxRate ?? 18
  };
  
  setItems([...items, newItem]);
};
```

## 🧪 Test Checklist

- [ ] Yeni kategori oluştur (örn: Gıda, %1)
- [ ] Kategoriyi düzenle (isim ve KDV oranı değiştir)
- [ ] Override olmadan ürün oluştur
- [ ] Override ile ürün oluştur
- [ ] Tek ürünlü fatura oluştur, KDV hesaplamasını kontrol et
- [ ] Çoklu ürünlü (farklı KDV'li) fatura oluştur
- [ ] Satıştan fatura oluştur, KDV'nin doğru geldiğini kontrol et
- [ ] Kategoriyi sil, ürünlerin durumunu kontrol et

## ⚠️ Önemli Notlar

1. **Geriye Dönük Uyumluluk**: Mevcut `taxRate` alanı ürünlerde korundu ama artık kullanılmıyor
2. **NULL Check**: Override null ise kategori KDV'si kullanılır
3. **Varsayılan KDV**: Hiçbiri yoksa %18 kullanılır
4. **Soft Delete**: Kategori silindiğinde `isActive = false` yapılır, fiziksel olarak silinmez
5. **Tenant İzolasyonu**: Her tenant kendi kategorilerini görür

## 📝 TODO

- [ ] App.tsx entegrasyonu (kategori CRUD)
- [ ] InvoiceModal entegrasyonu (kategori KDV'sini kullan)
- [ ] SimpleSalesPage entegrasyonu (kategori KDV'sini kullan)
- [ ] ProductModal'da kategori seçildiğinde varsayılan KDV'yi göster
- [ ] Kategori silme durumunda ürünleri "Genel" kategorisine taşı
- [ ] Frontend state'i ProductCategory[] tipine çevir (opsiyonel)
