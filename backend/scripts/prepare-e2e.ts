import 'reflect-metadata';
import '../src/database/patch-typeorm-for-tests';
import { Client } from 'pg';
import { DataSource, DataSourceOptions, QueryFailedError } from 'typeorm';
import { MigrationExecutor } from 'typeorm/migration/MigrationExecutor';
import { Logger } from '@nestjs/common';
import { SeedService } from '../src/database/seed.service';

interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean | { rejectUnauthorized: boolean };
}

interface AdminConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean | { rejectUnauthorized: boolean };
  targetOwner: string;
}

const logger = new Logger('e2e-db');

const coercePort = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const booleanFromEnv = (value: string | undefined): boolean =>
  typeof value === 'string' && value.toLowerCase() === 'true';

const quoteIdentifier = (value: string): string => {
  const safe = value.replace(/"/g, '""');
  return `"${safe}"`;
};

const resolveTargetConfig = (): DatabaseConfig => {
  const host =
    process.env.TEST_DATABASE_HOST ||
    process.env.DATABASE_HOST ||
    '127.0.0.1';
  const port = coercePort(
    process.env.TEST_DATABASE_PORT || process.env.DATABASE_PORT,
    5432,
  );
  const username =
    process.env.TEST_DATABASE_USER ||
    process.env.DATABASE_USER ||
    'moneyflow';
  const password =
    process.env.TEST_DATABASE_PASSWORD ||
    process.env.DATABASE_PASSWORD ||
    'moneyflow123';
  const database =
    process.env.TEST_DATABASE_NAME ||
    process.env.DATABASE_NAME ||
    'app_test';
  const ssl = booleanFromEnv(process.env.TEST_DATABASE_SSL)
    ? { rejectUnauthorized: false }
    : false;

  return { host, port, username, password, database, ssl };
};

const resolveAdminConfig = (target: DatabaseConfig): AdminConfig => {
  const host = process.env.TEST_DATABASE_ADMIN_HOST || target.host;
  const port = coercePort(
    process.env.TEST_DATABASE_ADMIN_PORT,
    target.port,
  );
  const username =
    process.env.TEST_DATABASE_ADMIN_USER || target.username;
  const password =
    process.env.TEST_DATABASE_ADMIN_PASSWORD || target.password;
  const database = process.env.TEST_DATABASE_ADMIN_DB || 'postgres';
  const ssl = booleanFromEnv(process.env.TEST_DATABASE_ADMIN_SSL)
    ? { rejectUnauthorized: false }
    : false;

  return {
    host,
    port,
    username,
    password,
    database,
    ssl,
    targetOwner: target.username,
  };
};

const terminateConnections = async (
  client: Client,
  database: string,
): Promise<void> => {
  await client.query(
    'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1;',
    [database],
  );
};

const recreateDatabase = async (
  target: DatabaseConfig,
  admin: AdminConfig,
): Promise<void> => {
  const client = new Client({
    host: admin.host,
    port: admin.port,
    user: admin.username,
    password: admin.password,
    database: admin.database,
    ssl: admin.ssl,
  });

  await client.connect();
  logger.log(`🧹 Resetting database ${target.database}...`);
  await terminateConnections(client, target.database);
  await client.query(
    `DROP DATABASE IF EXISTS ${quoteIdentifier(target.database)};`,
  );
  await client.query(
    `CREATE DATABASE ${quoteIdentifier(target.database)} OWNER ${quoteIdentifier(admin.targetOwner)} ENCODING 'UTF8' TEMPLATE template0;`,
  );
  await client.end();
};

const buildDataSource = (config: DatabaseConfig): DataSource => {
  const options: DataSourceOptions = {
    type: 'postgres',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database,
    entities: ['src/**/*.entity{.ts,.js}'],
    migrations: ['src/migrations/*{.ts,.js}'],
    synchronize: false,
    logging: false,
    ssl: config.ssl,
  };

  return new DataSource(options);
};

const migrateAndSeed = async (config: DatabaseConfig): Promise<void> => {
  const dataSource = buildDataSource(config);
  await dataSource.initialize();
  try {
    logger.log('🧱 Synchronizing base schema from entities...');
    await dataSource.synchronize();
    await runMigrationsWithConflictsHandled(dataSource);
    const seedService = new SeedService(dataSource);
    await seedService.seed();
  } finally {
    await dataSource.destroy();
  }
};

const ensureExtensions = async (config: DatabaseConfig): Promise<void> => {
  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    ssl: config.ssl,
  });
  await client.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  } finally {
    await client.end();
  }
};

const SKIPPABLE_PG_ERROR_CODES = new Set(['42P07', '42701']);

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const isSchemaConflictError = (error: unknown): boolean => {
  if (error instanceof QueryFailedError) {
    const code = (error.driverError as { code?: string } | undefined)?.code;
    if (code && SKIPPABLE_PG_ERROR_CODES.has(code)) {
      return true;
    }
  }
  const message = toErrorMessage(error);
  return /already exists/i.test(message);
};

const runMigrationsWithConflictsHandled = async (
  dataSource: DataSource,
): Promise<void> => {
  const executor = new MigrationExecutor(dataSource);
  const pending = await executor.getPendingMigrations();
  if (!pending.length) {
    logger.log('✅ No pending migrations for e2e database.');
    return;
  }
  logger.log(`🚀 Applying ${pending.length} migration(s) for e2e database...`);
  for (const migration of pending) {
    try {
      await executor.executeMigration(migration);
    } catch (error) {
      if (isSchemaConflictError(error)) {
        logger.warn(
          `⚠️ Migration ${migration.name} skipped due to existing schema state: ${toErrorMessage(error)}`,
        );
        await executor.insertMigration(migration);
        continue;
      }
      throw error;
    }
  }
};
const main = async () => {
  process.env.NODE_ENV = 'test';
  const target = resolveTargetConfig();
  const admin = resolveAdminConfig(target);
  await recreateDatabase(target, admin);
  await ensureExtensions(target);
  await migrateAndSeed(target);
  logger.log('✅ Postgres test database ready for e2e suite.');
};

main().catch((error) => {
  const message = (() => {
    if (error instanceof Error) {
      return error.stack || error.message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  })();
  logger.error(`❌ Failed to prepare Postgres for e2e tests: ${message}`);
  process.exit(1);
});
