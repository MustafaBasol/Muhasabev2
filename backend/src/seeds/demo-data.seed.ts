import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log('🌱 Demo veriler oluşturuluyor...');

  try {
    // 1. Demo Tenant'lar oluştur
    console.log('📦 Tenant\'lar oluşturuluyor...');
    
    const tenant1 = await dataSource.query(`
      INSERT INTO tenants (name, slug, "companyName", "taxNumber", email, phone, address, "subscriptionPlan", status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [
      'Demo Şirket 1',
      'demo-sirket-1',
      'Demo Ticaret A.Ş.',
      '1234567890',
      'demo1@test.com',
      '+90 555 111 2233',
      'İstanbul, Türkiye',
      'professional',
      'active'
    ]);

    const tenant2 = await dataSource.query(`
      INSERT INTO tenants (name, slug, "companyName", "taxNumber", email, phone, address, "subscriptionPlan", status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [
      'Demo Şirket 2',
      'demo-sirket-2',
      'Örnek Danışmanlık Ltd.',
      '9876543210',
      'demo2@test.com',
      '+90 555 444 5566',
      'Ankara, Türkiye',
      'basic',
      'active'
    ]);

    const tenant3 = await dataSource.query(`
      INSERT INTO tenants (name, slug, "companyName", "taxNumber", email, phone, address, "subscriptionPlan", status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [
      'Test Organizasyon',
      'test-organizasyon',
      'Test Muhasebe Ltd.',
      '5555555555',
      'test@test.com',
      '+90 555 777 8899',
      'İzmir, Türkiye',
      'enterprise',
      'active'
    ]);

    const tenant1Id = tenant1[0].id;
    const tenant2Id = tenant2[0].id;
    const tenant3Id = tenant3[0].id;

    console.log('✅ Tenant\'lar oluşturuldu');

    // 2. Demo Kullanıcılar oluştur
    console.log('👤 Kullanıcılar oluşturuluyor...');
    
    const hashedPassword = await bcrypt.hash('Test123456', 10);

    // Tenant 1 kullanıcıları
    await dataSource.query(`
      INSERT INTO users (email, password, "firstName", "lastName", role, "isActive", "tenantId")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password
    `, ['admin@test.com', hashedPassword, 'Admin', 'User', 'tenant_admin', true, tenant1Id]);

    await dataSource.query(`
      INSERT INTO users (email, password, "firstName", "lastName", role, "isActive", "tenantId")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password
    `, ['accountant1@test.com', hashedPassword, 'Ahmet', 'Yılmaz', 'accountant', true, tenant1Id]);

    // Tenant 2 kullanıcıları
    await dataSource.query(`
      INSERT INTO users (email, password, "firstName", "lastName", role, "isActive", "tenantId")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password
    `, ['user2@test.com', hashedPassword, 'Mehmet', 'Demir', 'user', true, tenant2Id]);

    // Tenant 3 kullanıcıları
    await dataSource.query(`
      INSERT INTO users (email, password, "firstName", "lastName", role, "isActive", "tenantId")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password
    `, ['user3@test.com', hashedPassword, 'Ayşe', 'Kaya', 'accountant', true, tenant3Id]);

    // Super Admin
    await dataSource.query(`
      INSERT INTO users (email, password, "firstName", "lastName", role, "isActive", "tenantId")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password
    `, ['superadmin@test.com', hashedPassword, 'Super', 'Admin', 'super_admin', true, tenant1Id]);

    console.log('✅ Kullanıcılar oluşturuldu');

    // 3. Demo Müşteriler
    console.log('👥 Müşteriler oluşturuluyor...');
    
    await dataSource.query(`
      INSERT INTO customers (name, email, phone, address, "taxNumber", company, balance, "tenantId")
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8),
        ($9, $10, $11, $12, $13, $14, $15, $16),
        ($17, $18, $19, $20, $21, $22, $23, $24)
      ON CONFLICT DO NOTHING
    `, [
      'Ahmet Çelik', 'ahmet@example.com', '+90 555 111 2233', 'İstanbul', '1111111111', 'Çelik Ltd.', 5000, tenant1Id,
      'Fatma Kara', 'fatma@example.com', '+90 555 222 3344', 'Ankara', '2222222222', 'Kara A.Ş.', 3000, tenant1Id,
      'Ali Beyaz', 'ali@example.com', '+90 555 333 4455', 'İzmir', '3333333333', 'Beyaz Tic.', 0, tenant2Id
    ]);

    console.log('✅ Müşteriler oluşturuldu');

    // 4. Demo Tedarikçiler
    console.log('🏢 Tedarikçiler oluşturuluyor...');
    
    await dataSource.query(`
      INSERT INTO suppliers (name, email, phone, address, "taxNumber", company, balance, "tenantId")
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8),
        ($9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT DO NOTHING
    `, [
      'Tedarik A.Ş.', 'tedarik@example.com', '+90 555 444 5566', 'İstanbul', '4444444444', 'Tedarik A.Ş.', -2000, tenant1Id,
      'Malzeme Ltd.', 'malzeme@example.com', '+90 555 555 6677', 'Bursa', '5555555555', 'Malzeme Ltd.', -1500, tenant2Id
    ]);

    console.log('✅ Tedarikçiler oluşturuldu');

    // 5. Demo Ürün Kategorileri
    console.log('📂 Ürün kategorileri oluşturuluyor...');
    
    await dataSource.query(`
      INSERT INTO product_categories (name, "taxRate", "isActive", "tenantId")
      VALUES 
        ($1, $2, $3, $4),
        ($5, $6, $7, $8),
        ($9, $10, $11, $12)
      ON CONFLICT DO NOTHING
    `, [
      'Elektronik', 18, true, tenant1Id,
      'Gıda', 8, true, tenant1Id,
      'Tekstil', 18, true, tenant2Id
    ]);

    console.log('✅ Ürün kategorileri oluşturuldu');

    // 6. Demo Ürünler
    console.log('📦 Ürünler oluşturuluyor...');
    
    await dataSource.query(`
      INSERT INTO products (name, code, description, price, cost, stock, "minStock", unit, category, "taxRate", "isActive", "tenantId")
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12),
        ($13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24),
        ($25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36)
      ON CONFLICT (code) DO NOTHING
    `, [
      'Laptop', 'LPT-001', 'Dell Laptop 15"', 15000, 12000, 10, 2, 'adet', 'Elektronik', 18, true, tenant1Id,
      'Mouse', 'MOU-001', 'Kablosuz Mouse', 150, 100, 50, 10, 'adet', 'Elektronik', 18, true, tenant1Id,
      'Ekmek', 'EKM-001', 'Tam Buğday Ekmeği', 10, 5, 100, 20, 'adet', 'Gıda', 8, true, tenant2Id
    ]);

    console.log('✅ Ürünler oluşturuldu');

    // 7. Demo Faturalar
    console.log('📄 Faturalar oluşturuluyor...');
    
    const customers = await dataSource.query(`SELECT id FROM customers WHERE "tenantId" = $1 LIMIT 1`, [tenant1Id]);
    const products = await dataSource.query(`SELECT id, name, price FROM products WHERE "tenantId" = $1 LIMIT 2`, [tenant1Id]);
    
    if (customers.length > 0 && products.length > 0) {
      const invoiceItems1 = [
        { productId: products[0].id, productName: products[0].name, quantity: 2, unitPrice: products[0].price, total: products[0].price * 2 }
      ];
      
      const invoiceItems2 = [
        { productId: products[1]?.id || products[0].id, productName: products[1]?.name || products[0].name, quantity: 5, unitPrice: products[1]?.price || products[0].price, total: (products[1]?.price || products[0].price) * 5 }
      ];

      await dataSource.query(`
        INSERT INTO invoices ("invoiceNumber", "tenantId", "customerId", "issueDate", "dueDate", subtotal, "taxAmount", "discountAmount", total, status, notes, items)
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12),
          ($13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        ON CONFLICT DO NOTHING
      `, [
        'INV-2025-001', tenant1Id, customers[0].id, '2025-10-01', '2025-10-31', 10000, 1800, 0, 11800, 'paid', 'İlk demo fatura', JSON.stringify(invoiceItems1),
        'INV-2025-002', tenant1Id, customers[0].id, '2025-10-15', '2025-11-15', 5000, 900, 200, 5700, 'sent', 'İkinci demo fatura', JSON.stringify(invoiceItems2)
      ]);
    }

    console.log('✅ Faturalar oluşturuldu');

    // 8. Demo Giderler
    console.log('💰 Giderler oluşturuluyor...');
    
    const suppliers = await dataSource.query(`SELECT id FROM suppliers WHERE "tenantId" = $1 LIMIT 1`, [tenant1Id]);
    if (suppliers.length > 0) {
      await dataSource.query(`
        INSERT INTO expenses ("expenseNumber", "tenantId", "supplierId", description, "expenseDate", amount, category, status, notes)
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8, $9),
          ($10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT DO NOTHING
      `, [
        'EXP-2025-001', tenant1Id, suppliers[0].id, 'Ofis Malzemeleri', '2025-10-05', 1500, 'supplies', 'paid', 'Kırtasiye alımı',
        'EXP-2025-002', tenant1Id, suppliers[0].id, 'Elektrik Faturası', '2025-10-10', 800, 'utilities', 'approved', 'Ekim ayı elektrik'
      ]);
    }

    console.log('✅ Giderler oluşturuldu');

    console.log('\n🎉 TÜM DEMO VERİLER BAŞARIYLA OLUŞTURULDU!\n');
    console.log('📋 Giriş Bilgileri:');
    console.log('   Admin: admin@test.com / Test123456');
    console.log('   Muhasebeci: accountant1@test.com / Test123456');
    console.log('   Kullanıcı 2: user2@test.com / Test123456');
    console.log('   Kullanıcı 3: user3@test.com / Test123456');
    console.log('   Super Admin: superadmin@test.com / Test123456');

  } catch (error) {
    console.error('❌ Hata:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
