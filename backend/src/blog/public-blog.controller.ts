import { Controller, Get, Param, Query } from '@nestjs/common';
import { BlogService } from './blog.service';
import { BlogPostStatus } from './entities/blog-post.entity';

@Controller('public/blog')
export class PublicBlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get('posts')
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const { items, total } = await this.blogService.list({
      status: BlogPostStatus.PUBLISHED,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });

    // Public payload: do not expose drafts.
    return {
      total,
      items: items.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        publishedAt: p.publishedAt,
        updatedAt: p.updatedAt,
        metaTitle: p.metaTitle,
        metaDescription: p.metaDescription,
        canonicalUrl: p.canonicalUrl,
        ogImageUrl: p.ogImageUrl,
        keywords: p.keywords,
        noIndex: p.noIndex,
        jsonLd: p.jsonLd,
      })),
    };
  }

  @Get('posts/:slug')
  async getBySlug(@Param('slug') slug: string) {
    const p = await this.blogService.getPublishedBySlug(slug);
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      contentHtml: p.contentHtml,
      contentMarkdown: p.contentMarkdown,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      canonicalUrl: p.canonicalUrl,
      ogImageUrl: p.ogImageUrl,
      keywords: p.keywords,
      noIndex: p.noIndex,
      jsonLd: p.jsonLd,
    };
  }
}
