import { DataSource } from 'typeorm';

async function checkTenantTable() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5433'),
    username: process.env.DATABASE_USER || 'moneyflow',
    password: process.env.DATABASE_PASSWORD || 'moneyflow123',
    database: process.env.DATABASE_NAME || 'moneyflow_dev',
    entities: [],
    synchronize: false,
    logging: true,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    // Tenant tablosundaki kolonları getir
    const columns = await dataSource.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'tenants' 
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Tenant Table Columns:');
    console.log('========================');
    columns.forEach((col: any) => {
      console.log(`${col.column_name.padEnd(30)} | ${col.data_type.padEnd(20)} | ${col.is_nullable}`);
    });

    // Migration tablosunu kontrol et
    const migrations = await dataSource.query(`
      SELECT name, timestamp FROM migrations ORDER BY timestamp DESC LIMIT 10;
    `);

    console.log('\n🔄 Recent Migrations:');
    console.log('====================');
    migrations.forEach((mig: any) => {
      console.log(`${new Date(mig.timestamp).toISOString()} | ${mig.name}`);
    });

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Database connection error:', error);
  }
}

checkTenantTable();