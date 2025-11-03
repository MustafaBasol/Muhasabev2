import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

// Load environment variables
config();

const configService = new ConfigService();
const isProd = process.env.NODE_ENV === 'production';

const host =
  configService.get<string>('DATABASE_HOST') || (isProd ? '' : 'localhost');
const portEnv = configService.get<string>('DATABASE_PORT');
const port = portEnv ? parseInt(portEnv, 10) : isProd ? undefined : 5432;
const username =
  configService.get<string>('DATABASE_USER') || (isProd ? '' : 'moneyflow');
const password =
  configService.get<string>('DATABASE_PASSWORD') ||
  (isProd ? '' : 'moneyflow123');
const database =
  configService.get<string>('DATABASE_NAME') || (isProd ? '' : 'moneyflow_dev');

if (isProd && (!host || !port || !username || !password || !database)) {
  throw new Error(
    'DATABASE_* env vars must be set for TypeORM CLI in production',
  );
}

export default new DataSource({
  type: 'postgres',
  host: host,
  port: port || 5432,
  username: username,
  password: password,
  database: database,
  entities: ['src/**/*.entity{.ts,.js}'],
  migrations: ['src/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: !isProd,
});
