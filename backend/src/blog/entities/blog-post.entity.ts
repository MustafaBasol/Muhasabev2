import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

const driverHint = (
  process.env.TEST_DB ||
  process.env.TEST_DATABASE ||
  process.env.TEST_DATABASE_TYPE ||
  process.env.DB_TYPE ||
  process.env.DATABASE_CLIENT ||
  process.env.TYPEORM_CONNECTION ||
  process.env.TYPEORM_DRIVER ||
  ''
).toLowerCase();

const isSqliteHint = ['sqlite', 'better-sqlite3'].includes(driverHint);

const __sqliteFriendlyEnv =
  isSqliteHint ||
  (!driverHint &&
    (process.env.DB_SQLITE === 'true' ||
      process.env.NODE_ENV === 'test' ||
      typeof process.env.JEST_WORKER_ID !== 'undefined'));

const timestamptzColumnType = __sqliteFriendlyEnv ? 'datetime' : 'timestamptz';

export enum BlogPostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

export type BlogPostTranslation = {
  title?: string;
  excerpt?: string | null;
  contentHtml?: string;
  contentMarkdown?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  ogImageUrl?: string | null;
  keywords?: string | null;
  noIndex?: boolean;
  jsonLd?: string | null;
};

@Entity('blog_posts')
export class BlogPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 200 })
  slug: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  excerpt?: string | null;

  // Rendered HTML content. Stored sanitized on write.
  @Column({ type: 'text' })
  contentHtml: string;

  // Optional raw markdown input (kept for editing/automation).
  @Column({ type: 'text', nullable: true })
  contentMarkdown?: string | null;

  // === SEO fields (optional) ===
  @Column({ type: 'varchar', length: 255, nullable: true })
  metaTitle?: string | null;

  @Column({ type: 'text', nullable: true })
  metaDescription?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  canonicalUrl?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  ogImageUrl?: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  keywords?: string | null;

  @Column({ type: 'boolean', default: false })
  noIndex: boolean;

  @Column({ type: 'text', nullable: true })
  jsonLd?: string | null;

  // Optional per-language overrides. Stored as JSON string for SQLite compatibility.
  // Shape: { "en": { title, contentHtml, ... }, "de": { ... } }
  @Column({ type: 'simple-json', nullable: true })
  translations?: Record<string, BlogPostTranslation> | null;

  @Column({
    type: 'simple-enum',
    enum: BlogPostStatus,
    default: BlogPostStatus.DRAFT,
  })
  status: BlogPostStatus;

  @Column({ type: timestamptzColumnType, nullable: true })
  publishedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
