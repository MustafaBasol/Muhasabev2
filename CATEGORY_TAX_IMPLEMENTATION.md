# Kategori Bazlı KDV Sistemi - İmplementasyon Özeti

## Yapılan Değişiklikler

### Backend

#### 1. Yeni Entity ve DTO'lar
- ✅ `ProductCategory` entity oluşturuldu (`backend/src/products/entities/product-category.entity.ts`)
  - `id`, `name`, `taxRate`, `isActive`, `tenantId`, timestamps
- ✅ `CreateProductCategoryDto` ve `UpdateProductCategoryDto` oluşturuldu
- ✅ `Product` entity'ye `categoryTaxRateOverride` alanı eklendi
- ✅ `CreateProductDto`'ya `categoryTaxRateOverride` alanı eklendi

#### 2. Service ve Controller
- ✅ `ProductCategoriesService` oluşturuldu (`backend/src/products/product-categories.service.ts`)
  - `findAll`, `findOne`, `findByName`, `create`, `update`, `remove` methodları
- ✅ `ProductCategoriesController` oluşturuldu (`backend/src/products/product-categories.controller.ts`)
  - GET `/product-categories` - Tüm kategorileri listele
  - GET `/product-categories/:id` - Kategori detayı
  - POST `/product-categories` - Yeni kategori oluştur
  - PATCH `/product-categories/:id` - Kategori güncelle
  - DELETE `/product-categories/:id` - Kategori sil (soft delete)

#### 3. Module Güncellemeleri
- ✅ `ProductsModule`'e `ProductCategory` entity, service ve controller eklendi

#### 4. Database Migration
- ✅ Migration oluşturuldu: `1729545000000-AddProductCategoriesAndTaxRateOverride.ts`
  - `product_categories` tablosu oluşturuldu
  - `products` tablosuna `categoryTaxRateOverride` kolonu eklendi
  - Gerekli indexler eklendi

### Frontend

#### 1. Tip Tanımları
- ✅ `ProductCategory` interface tanımlandı (`src/types/index.ts`)
- ✅ `Product` interface'ine `categoryTaxRateOverride` alanı eklendi
- ✅ `ProductList.tsx`'teki `Product` interface'ine `categoryTaxRateOverride` eklendi

#### 2. API Client
- ✅ `product-categories.ts` API client oluşturuldu (`src/api/product-categories.ts`)
  - `getAll`, `getOne`, `create`, `update`, `delete` fonksiyonları

#### 3. Modal Güncellemeleri

##### ProductCategoryModal
- ✅ KDV oranı input alanı eklendi
- ✅ `onSubmit` fonksiyonu güncellendi: `(categoryName: string, taxRate: number) => void`
- ✅ Validasyon: KDV oranı 0-100 arası olmalı

##### ProductModal
- ✅ Form state'ine `hasCustomTaxRate` ve `categoryTaxRateOverride` alanları eklendi
- ✅ Checkbox eklendi: "Bu ürün için özel KDV oranı kullan"
- ✅ Checkbox işaretliyse KDV input alanı gösteriliyor
- ✅ `handleSave` fonksiyonu güncellendi: Override değer varsa ürüne ekleniyor
- ❌ KDV dropdown'u kaldırıldı (artık kategori KDV'si kullanılacak)

## Nasıl Çalışıyor?

### 1. Kategori Oluşturma
```
Kullanıcı "Kategori Ekle" butonuna tıklar
↓
ProductCategoryModal açılır
↓
Kategori adı ve KDV oranı girilir (örn: "Elektronik", 18)
↓
Backend'e POST /product-categories isteği
↓
Kategori veritabanına kaydedilir
```

### 2. Ürün Oluşturma (Varsayılan KDV)
```
Kullanıcı "Yeni Ürün" butonuna tıklar
↓
ProductModal açılır, kategori seçilir
↓
Checkbox işaretli değilse → Kategorinin KDV'si kullanılacak
↓
Ürün kaydedilir (categoryTaxRateOverride = null)
```

### 3. Ürün Oluşturma (Özel KDV Override)
```
Kullanıcı "Yeni Ürün" butonuna tıklar
↓
ProductModal açılır, kategori seçilir
↓
"Özel KDV oranı kullan" checkbox'ı işaretlenir
↓
Özel KDV oranı girilir (örn: 8)
↓
Ürün kaydedilir (categoryTaxRateOverride = 8)
```

### 4. KDV Hesaplama (Fatura/Satış)
```
Fatura oluşturulurken ürün seçilir
↓
Ürünün categoryTaxRateOverride değeri var mı kontrol edilir
↓
Varsa → Override KDV kullanılır
Yoksa → Kategorinin varsayılan KDV'si kullanılır
↓
KDV dahil fiyattan KDV hariç tutar hesaplanır:
subtotal = total / (1 + taxRate/100)
```

## Entegrasyon Gereken Yerler

### ⏳ Yapılması Gerekenler

1. **App.tsx Entegrasyonu**
   - `productCategories` state'ini `ProductCategory[]` tipine çevir
   - `handleAddProductCategory` fonksiyonunu güncelle (API çağrısı ekle)
   - `handleEditProductCategory` fonksiyonunu güncelle (API çağrısı ekle)
   - `handleDeleteProductCategory` fonksiyonunu güncelle (API çağrısı ekle)
   - Component mount olduğunda kategorileri backend'den çek

2. **InvoiceModal & SimpleSalesPage**
   - Ürün seçildiğinde:
     1. Önce ürünün `categoryTaxRateOverride` değerine bak
     2. Yoksa ürünün kategorisini bul
     3. Kategorinin `taxRate` değerini al
     4. Bu değeri `taxRate` olarak kullan

3. **ProductModal**
   - Kategori seçildiğinde kategorinin varsayılan KDV oranını göster (bilgilendirme)
   - Örn: "Seçilen kategori varsayılan KDV: %18"

4. **Database Migration Çalıştırma**
   ```bash
   cd backend
   npm run migration:run
   ```

## API Endpoints

### Product Categories
- `GET /product-categories` - Tüm kategorileri listele
- `GET /product-categories/:id` - Kategori detayı
- `POST /product-categories` - Yeni kategori oluştur
  ```json
  {
    "name": "Elektronik",
    "taxRate": 18
  }
  ```
- `PATCH /product-categories/:id` - Kategori güncelle
  ```json
  {
    "name": "Elektronik Ürünler",
    "taxRate": 20
  }
  ```
- `DELETE /product-categories/:id` - Kategori sil (soft delete)

### Products (Güncellenmiş)
- `POST /products` - Yeni ürün oluştur
  ```json
  {
    "name": "Laptop",
    "code": "LAP-001",
    "category": "Elektronik",
    "price": 10000,
    "categoryTaxRateOverride": 8  // Opsiyonel
  }
  ```

## Test Senaryoları

### Senaryo 1: Standart Kategori KDV
1. "Gıda" kategorisi oluştur, KDV %1
2. "Ekmek" ürünü oluştur, "Gıda" kategorisi seç, checkbox işaretleme
3. Fatura oluştur, "Ekmek" ekle
4. Beklenen: %1 KDV ile hesaplanmalı

### Senaryo 2: Override KDV
1. "Kitap" kategorisi oluştur, KDV %8
2. "Dijital Kitap" ürünü oluştur, "Kitap" kategorisi seç
3. Checkbox işaretle, özel KDV %18 gir
4. Fatura oluştur, "Dijital Kitap" ekle
5. Beklenen: %18 KDV ile hesaplanmalı (override)

### Senaryo 3: Çoklu Ürün Farklı KDV
1. "Ekmek" (%1), "Kitap" (%8), "Laptop" (%18) ekle
2. Aynı faturada 3 ürünü de kullan
3. Beklenen: Her ürün kendi KDV'si ile hesaplanmalı

## Notlar

- ⚠️ Geriye dönük uyumluluk için mevcut `taxRate` alanı korundu
- ⚠️ Frontend'de kategoriler hala string[] olarak tutuluyor (sonradan migrate edilebilir)
- ✅ Backend tamamen yeni sistemle çalışıyor
- ✅ Migration mevcut verileri etkilemiyor (yeni kolonlar nullable)
