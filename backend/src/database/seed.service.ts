import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async seed() {
    try {
      // Şema uyumluluğunu sağla (idempotent düzeltmeler)
      await this.ensureSchemaCompatibility();

      // Check if database is empty
      const userCount = await this.dataSource.query(
        'SELECT COUNT(*) as count FROM users',
      );

      if (userCount[0].count > 0) {
        this.logger.log('✅ Database already has data, skipping seed');
        return;
      }

      this.logger.log('📦 Seeding database with initial data...');

      const seedFile = path.join(__dirname, 'seeds', 'seed-data.sql');

      if (!fs.existsSync(seedFile)) {
        this.logger.warn('⚠️ Seed file not found, skipping seed');
        return;
      }

      const seedData = fs.readFileSync(seedFile, 'utf-8');

      // Execute seed data
      await this.dataSource.query(seedData);

      this.logger.log('✅ Database seeded successfully!');
    } catch (error) {
      this.logger.error('❌ Error seeding database:', error);
      // Don't throw - allow app to start even if seeding fails
    }
  }

  private async ensureSchemaCompatibility() {
    try {
      // Tenants tablosundaki yeni alanlar için güvenli (idempotent) eklemeler
      await this.dataSource.query(`
        DO $$
        BEGIN
          -- Website URL
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tenants' AND column_name = 'website'
          ) THEN
            ALTER TABLE "tenants" ADD "website" character varying;
          END IF;

          -- Türkiye
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tenants' AND column_name = 'taxOffice'
          ) THEN
            ALTER TABLE "tenants" ADD "taxOffice" character varying;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tenants' AND column_name = 'mersisNumber'
          ) THEN
            ALTER TABLE "tenants" ADD "mersisNumber" character varying;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tenants' AND column_name = 'kepAddress'
          ) THEN
            ALTER TABLE "tenants" ADD "kepAddress" character varying;
          END IF;

          -- Fransa
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tenants' AND column_name = 'siretNumber'
          ) THEN
            ALTER TABLE "tenants" ADD "siretNumber" character varying;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tenants' AND column_name = 'sirenNumber'
          ) THEN
            ALTER TABLE "tenants" ADD "sirenNumber" character varying;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tenants' AND column_name = 'apeCode'
          ) THEN
            ALTER TABLE "tenants" ADD "apeCode" character varying;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tenants' AND column_name = 'tvaNumber'
          ) THEN
            ALTER TABLE "tenants" ADD "tvaNumber" character varying;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tenants' AND column_name = 'rcsNumber'
          ) THEN
            ALTER TABLE "tenants" ADD "rcsNumber" character varying;
          END IF;

          -- Almanya
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tenants' AND column_name = 'steuernummer'
          ) THEN
            ALTER TABLE "tenants" ADD "steuernummer" character varying;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tenants' AND column_name = 'umsatzsteuerID'
          ) THEN
            ALTER TABLE "tenants" ADD "umsatzsteuerID" character varying;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tenants' AND column_name = 'handelsregisternummer'
          ) THEN
            ALTER TABLE "tenants" ADD "handelsregisternummer" character varying;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tenants' AND column_name = 'geschaeftsfuehrer'
          ) THEN
            ALTER TABLE "tenants" ADD "geschaeftsfuehrer" character varying;
          END IF;

          -- Amerika
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tenants' AND column_name = 'einNumber'
          ) THEN
            ALTER TABLE "tenants" ADD "einNumber" character varying;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tenants' AND column_name = 'taxId'
          ) THEN
            ALTER TABLE "tenants" ADD "taxId" character varying;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tenants' AND column_name = 'businessLicenseNumber'
          ) THEN
            ALTER TABLE "tenants" ADD "businessLicenseNumber" character varying;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tenants' AND column_name = 'stateOfIncorporation'
          ) THEN
            ALTER TABLE "tenants" ADD "stateOfIncorporation" character varying;
          END IF;
        END$$;`);
    } catch (e) {
      this.logger.warn(
        `⚠️ Schema compatibility check skipped: ${e?.message || e}`,
      );
    }
  }
}
