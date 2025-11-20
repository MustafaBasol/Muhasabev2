import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteSettings } from './entities/site-settings.entity';

@Injectable()
export class SiteSettingsService {
  private readonly logger = new Logger(SiteSettingsService.name);
  private cachedSettings: SiteSettings | null = null;
  private lastCacheTime = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache

  constructor(
    @InjectRepository(SiteSettings)
    private readonly siteSettingsRepo: Repository<SiteSettings>,
  ) {}

  /**
   * Get the singleton site settings row (id=1).
   * Creates default settings if none exist.
   * Cached in memory for performance.
   */
  async getSettings(): Promise<SiteSettings> {
    try {
      const now = Date.now();
      
      // Return cached if still valid
      if (this.cachedSettings && now - this.lastCacheTime < this.CACHE_TTL) {
        return this.cachedSettings;
      }

      let settings = await this.siteSettingsRepo.findOne({ where: { id: 1 } });

      if (!settings) {
        // Create default settings
        this.logger.log('Creating default site settings...');
        settings = this.siteSettingsRepo.create({
          id: 1,
          enableIndexing: true,
          defaultMetaTitle: 'Comptario - Accounting Dashboard',
          defaultMetaDescription:
            'Professional accounting and invoicing solution for small businesses.',
        });
        settings = await this.siteSettingsRepo.save(settings);
        this.logger.log('✅ Created default site settings');
      }

      this.cachedSettings = settings;
      this.lastCacheTime = now;
      return settings;
    } catch (error) {
      this.logger.error('Failed to get site settings:', error);
      throw error;
    }
  }

  /**
   * Update the site settings (admin only).
   * Clears cache after update.
   */
  async updateSettings(updates: Partial<SiteSettings>): Promise<SiteSettings> {
    let settings = await this.siteSettingsRepo.findOne({ where: { id: 1 } });

    if (!settings) {
      settings = this.siteSettingsRepo.create({ id: 1, ...updates });
    } else {
      Object.assign(settings, updates);
    }

    const saved = await this.siteSettingsRepo.save(settings);
    
    // Clear cache
    this.cachedSettings = null;
    this.logger.log('Site settings updated');
    
    return saved;
  }

  /**
   * Manually clear cache (e.g., after external update)
   */
  clearCache(): void {
    this.cachedSettings = null;
    this.lastCacheTime = 0;
  }
}
