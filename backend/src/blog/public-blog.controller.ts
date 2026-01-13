import { Controller, Get, Param, Query } from '@nestjs/common';
import { BlogService } from './blog.service';
import { BlogPostStatus } from './entities/blog-post.entity';

const normalizeLang = (raw?: string): string | null => {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return null;
  // Accept e.g. "en-US" -> "en"
  return v.split(/[-_]/)[0] || null;
};

const pickLocalized = (post: any, lang: string | null) => {
  const tr = lang ? post?.translations?.[lang] : null;
  const t = tr && typeof tr === 'object' ? tr : null;

  return {
    title: typeof t?.title === 'string' && t.title.trim().length ? t.title : post.title,
    excerpt: t?.excerpt !== undefined ? t.excerpt : post.excerpt,
    contentHtml:
      typeof t?.contentHtml === 'string' && t.contentHtml.trim().length ? t.contentHtml : post.contentHtml,
    contentMarkdown: t?.contentMarkdown !== undefined ? t.contentMarkdown : post.contentMarkdown,
    metaTitle: t?.metaTitle !== undefined ? t.metaTitle : post.metaTitle,
    metaDescription: t?.metaDescription !== undefined ? t.metaDescription : post.metaDescription,
    canonicalUrl: t?.canonicalUrl !== undefined ? t.canonicalUrl : post.canonicalUrl,
    ogImageUrl: t?.ogImageUrl !== undefined ? t.ogImageUrl : post.ogImageUrl,
    keywords: t?.keywords !== undefined ? t.keywords : post.keywords,
    noIndex: typeof t?.noIndex === 'boolean' ? t.noIndex : post.noIndex,
    jsonLd: t?.jsonLd !== undefined ? t.jsonLd : post.jsonLd,
  };
};

@Controller('public/blog')
export class PublicBlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get('posts')
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('lang') lang?: string,
  ) {
    const preferredLang = normalizeLang(lang);
    const { items, total } = await this.blogService.list({
      status: BlogPostStatus.PUBLISHED,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });

    // Public payload: do not expose drafts.
    return {
      total,
      items: items.map((p) => ({
        ...pickLocalized(p as any, preferredLang),
        id: p.id,
        slug: p.slug,
        publishedAt: p.publishedAt,
        updatedAt: p.updatedAt,
      })),
    };
  }

  @Get('posts/:slug')
  async getBySlug(@Param('slug') slug: string, @Query('lang') lang?: string) {
    const p = await this.blogService.getPublishedBySlug(slug);
    const preferredLang = normalizeLang(lang);
    const v: any = pickLocalized(p as any, preferredLang);
    return {
      id: p.id,
      slug: p.slug,
      title: v.title,
      excerpt: v.excerpt,
      contentHtml: v.contentHtml,
      contentMarkdown: v.contentMarkdown,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
      metaTitle: v.metaTitle,
      metaDescription: v.metaDescription,
      canonicalUrl: v.canonicalUrl,
      ogImageUrl: v.ogImageUrl,
      keywords: v.keywords,
      noIndex: v.noIndex,
      jsonLd: v.jsonLd,
    };
  }
}
