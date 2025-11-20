import 'reflect-metadata';
import { config as dotenv } from 'dotenv';
import dataSource from '../src/config/typeorm.config';
import { User } from '../src/users/entities/user.entity';

// Prefer backend/.env if present so CLI uses same credentials as Nest app
dotenv({ path: __dirname + '/../.env' });

async function main() {
  const ds = dataSource;
  await ds.initialize();
  try {
    const result = await ds
      .createQueryBuilder()
      .update(User)
      .set({
        isEmailVerified: true,
        emailVerifiedAt: () => 'COALESCE("emailVerifiedAt", CURRENT_TIMESTAMP)',
        emailVerificationToken: () => 'NULL',
        emailVerificationSentAt: () => 'NULL',
      })
      .execute();

    const updated = result.affected ?? 0;
    console.log(`✅ Marked ${updated} user(s) as email verified.`);
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('❌ Failed to mark users as verified:', err);
  process.exit(1);
});
