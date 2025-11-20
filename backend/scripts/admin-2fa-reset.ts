import 'reflect-metadata';
import { config as dotenv } from 'dotenv';
import dataSource from '../src/config/typeorm.config';

// Load env from backend/.env if present (dev uses port 5433)
dotenv({ path: __dirname + '/../.env' });

async function main() {
  const ds = dataSource;
  await ds.initialize();
  try {
    const result = await ds.query(
      `UPDATE admin_config SET "twoFactorEnabled" = false, "twoFactorSecret" = NULL, "recoveryCodes" = NULL WHERE id = 1`
    );
    console.log('2FA reset applied for admin (id=1). Result:', result);
  } finally {
    await ds.destroy();
  }
}

main().catch((e) => {
  console.error('2FA reset failed:', e);
  process.exit(1);
});
