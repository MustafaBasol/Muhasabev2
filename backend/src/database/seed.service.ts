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
      // Check if database is empty
      const userCount = await this.dataSource.query('SELECT COUNT(*) as count FROM users');
      
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
}
