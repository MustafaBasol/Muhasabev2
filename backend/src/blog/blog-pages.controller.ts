import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { BlogService } from './blog.service';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import { BlogPostStatus } from './entities/blog-post.entity';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

@Controller()
export class BlogPagesController {
  constructor(
    private readonly blogService: BlogService,
    private readonly siteSettingsService: SiteSettingsService,
  ) {}

  @Get('blog')
  async blogIndex(@Res() res: Response) {
    const settings = await this.siteSettingsService.getSettings();
    const { items } = await this.blogService.list({ status: BlogPostStatus.PUBLISHED, limit: 50, offset: 0 });

    const title = settings.defaultMetaTitle ? `${settings.defaultMetaTitle} | Blog` : 'Blog';
    const desc = settings.defaultMetaDescription || 'Blog yazıları';
    const canonicalBase = settings.canonicalBaseUrl || '';
    const canonical = canonicalBase ? `${canonicalBase}/blog` : undefined;

    const listItems = items
      .map((p) => {
        const href = `/blog/${encodeURIComponent(p.slug)}`;
        const when = p.publishedAt ? new Date(p.publishedAt).toISOString().slice(0, 10) : '';
        return `<li style="margin: 0 0 14px 0;">
  <a href="${href}" style="text-decoration: underline;">${escapeHtml(p.title)}</a>
  ${when ? `<div style="opacity:0.7;font-size:12px;">${escapeHtml(when)}</div>` : ''}
  ${p.excerpt ? `<div style="margin-top:6px;">${escapeHtml(p.excerpt)}</div>` : ''}
</li>`;
      })
      .join('\n');

    const html = `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(desc)}" />
  ${settings.enableIndexing ? '' : '<meta name="robots" content="noindex, nofollow" />'}
  ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}" />` : ''}
  ${settings.defaultOgImageUrl ? `<meta property="og:image" content="${escapeHtml(settings.defaultOgImageUrl)}" />` : ''}
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(desc)}" />
  <meta property="og:type" content="website" />
</head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 24px; line-height: 1.5;">
  <main style="max-width: 900px; margin: 0 auto;">
    <h1 style="margin: 0 0 18px 0;">Blog</h1>
    <ul style="list-style: none; padding: 0; margin: 0;">${listItems || '<li>Henüz yayınlanmış yazı yok.</li>'}</ul>
  </main>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }

  @Get('blog/:slug')
  async blogPost(@Param('slug') slug: string, @Res() res: Response) {
    const settings = await this.siteSettingsService.getSettings();
    const post = await this.blogService.getPublishedBySlug(slug);

    const metaTitle = post.metaTitle || post.title;
    const metaDesc = post.metaDescription || post.excerpt || settings.defaultMetaDescription || '';
    const canonical =
      post.canonicalUrl ||
      (settings.canonicalBaseUrl ? `${settings.canonicalBaseUrl}/blog/${encodeURIComponent(post.slug)}` : undefined);
    const ogImage = post.ogImageUrl || settings.defaultOgImageUrl || undefined;

    const jsonLd = post.jsonLd && post.jsonLd.trim().length ? post.jsonLd.trim() : null;
    const robots = post.noIndex || !settings.enableIndexing ? 'noindex, nofollow' : 'index, follow';

    const when = post.publishedAt ? new Date(post.publishedAt).toISOString().slice(0, 10) : '';

    const html = `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(metaTitle)}</title>
  ${metaDesc ? `<meta name="description" content="${escapeHtml(metaDesc)}" />` : ''}
  <meta name="robots" content="${escapeHtml(robots)}" />
  ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}" />` : ''}
  <meta property="og:title" content="${escapeHtml(metaTitle)}" />
  ${metaDesc ? `<meta property="og:description" content="${escapeHtml(metaDesc)}" />` : ''}
  <meta property="og:type" content="article" />
  ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />` : ''}
  ${post.keywords ? `<meta name="keywords" content="${escapeHtml(post.keywords)}" />` : ''}
  ${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
</head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 24px; line-height: 1.6;">
  <main style="max-width: 900px; margin: 0 auto;">
    <div style="margin-bottom: 18px;"><a href="/blog" style="text-decoration: underline;">← Blog</a></div>
    <h1 style="margin: 0 0 10px 0;">${escapeHtml(post.title)}</h1>
    ${when ? `<div style="opacity:0.7;font-size:12px;margin-bottom:18px;">${escapeHtml(when)}</div>` : ''}
    <article>${post.contentHtml}</article>
  </main>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }
}
