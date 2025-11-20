import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('site_settings')
export class SiteSettings {
  @PrimaryGeneratedColumn()
  id: number;

  // SEO fields
  @Column({ type: 'varchar', length: 255, nullable: true })
  defaultMetaTitle: string;

  @Column({ type: 'text', nullable: true })
  defaultMetaDescription: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  defaultOgImageUrl: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  canonicalBaseUrl: string;

  @Column({ type: 'boolean', default: true })
  enableIndexing: boolean;

  // Analytics & Tracking IDs (public IDs only, no secrets)
  @Column({ type: 'varchar', length: 100, nullable: true })
  googleAnalyticsId: string; // GA4 measurement ID

  @Column({ type: 'varchar', length: 100, nullable: true })
  googleTagManagerId: string; // GTM-XXXXXXX

  @Column({ type: 'varchar', length: 100, nullable: true })
  pinterestTagId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  metaPixelId: string; // Facebook Pixel ID

  @Column({ type: 'varchar', length: 100, nullable: true })
  linkedinInsightTagId: string;

  // Custom HTML injections
  @Column({ type: 'text', nullable: true })
  customHeadHtml: string;

  @Column({ type: 'text', nullable: true })
  customBodyStartHtml: string;

  @Column({ type: 'text', nullable: true })
  customBodyEndHtml: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
