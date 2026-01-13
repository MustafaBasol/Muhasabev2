import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import type { Request } from 'express';
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

const DEFAULT_LANG = 'tr';
const SUPPORTED_LANGS = ['tr', 'en', 'de', 'fr'] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const normalizeLang = (raw: unknown): SupportedLang => {
  const first = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .split('-')[0];

  return (SUPPORTED_LANGS as readonly string[]).includes(first) ? (first as SupportedLang) : DEFAULT_LANG;
};

const appendLangToUrl = (url: string, lang: SupportedLang): string => {
  if (!url) return url;
  if (lang === DEFAULT_LANG) return url;
  const hasQuery = url.includes('?');
  const sep = hasQuery ? '&' : '?';
  return `${url}${sep}lang=${encodeURIComponent(lang)}`;
};

const parseAcceptLanguage = (raw: unknown): SupportedLang[] => {
  // Example: "tr-TR,tr;q=0.9,en;q=0.8,de;q=0.7"
  const header = String(raw || '').trim();
  if (!header) return [];

  const parts = header
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [tagPart, ...params] = chunk.split(';').map((s) => s.trim());
      let q = 1;
      for (const p of params) {
        const m = /^q=([0-9.]+)$/i.exec(p);
        if (m) {
          const parsed = Number(m[1]);
          if (!Number.isNaN(parsed)) q = parsed;
        }
      }
      return { tag: tagPart, q };
    })
    .sort((a, b) => b.q - a.q);

  const langs: SupportedLang[] = [];
  for (const p of parts) {
    const lang = normalizeLang(p.tag);
    if (!langs.includes(lang)) langs.push(lang);
  }
  return langs;
};

const getTranslation = (post: any, lang: SupportedLang): any | null => {
  if (!post?.translations || typeof post.translations !== 'object') return null;
  const hit = post.translations?.[lang];
  return hit && typeof hit === 'object' ? hit : null;
};

const pickLocalized = (post: any, lang: SupportedLang) => {
  const tr = getTranslation(post, lang);
  if (!tr) return post;
  return {
    ...post,
    title: typeof tr.title === 'string' && tr.title.length ? tr.title : post.title,
    excerpt: typeof tr.excerpt === 'string' ? tr.excerpt : tr.excerpt === null ? null : post.excerpt,
    contentHtml: typeof tr.contentHtml === 'string' && tr.contentHtml.length ? tr.contentHtml : post.contentHtml,
    contentMarkdown:
      typeof tr.contentMarkdown === 'string'
        ? tr.contentMarkdown
        : tr.contentMarkdown === null
          ? null
          : post.contentMarkdown,
    metaTitle: typeof tr.metaTitle === 'string' ? tr.metaTitle : tr.metaTitle === null ? null : post.metaTitle,
    metaDescription:
      typeof tr.metaDescription === 'string'
        ? tr.metaDescription
        : tr.metaDescription === null
          ? null
          : post.metaDescription,
    canonicalUrl:
      typeof tr.canonicalUrl === 'string' ? tr.canonicalUrl : tr.canonicalUrl === null ? null : post.canonicalUrl,
    ogImageUrl:
      typeof tr.ogImageUrl === 'string' ? tr.ogImageUrl : tr.ogImageUrl === null ? null : post.ogImageUrl,
    keywords: typeof tr.keywords === 'string' ? tr.keywords : tr.keywords === null ? null : post.keywords,
    noIndex: typeof tr.noIndex === 'boolean' ? tr.noIndex : post.noIndex,
    jsonLd: typeof tr.jsonLd === 'string' ? tr.jsonLd : tr.jsonLd === null ? null : post.jsonLd,
  };
};

const getAvailableLangsForPost = (post: any): SupportedLang[] => {
  const set = new Set<SupportedLang>([DEFAULT_LANG]);
  const translations = post?.translations;
  if (translations && typeof translations === 'object') {
    for (const key of Object.keys(translations)) {
      const lang = normalizeLang(key);
      const value = translations[key];
      if (value && typeof value === 'object') set.add(lang);
    }
  }
  return Array.from(set);
};

const selectEffectiveLang = (rawLang: unknown, acceptLanguageHeader: unknown): SupportedLang => {
  const explicit = String(rawLang || '').trim();
  if (explicit) return normalizeLang(explicit);
  const preferred = parseAcceptLanguage(acceptLanguageHeader);
  return preferred[0] || DEFAULT_LANG;
};

const selectEffectiveLangForPost = (rawLang: unknown, acceptLanguageHeader: unknown, postBase: any): SupportedLang => {
  const explicit = String(rawLang || '').trim();
  if (explicit) return normalizeLang(explicit);

  const preferred = parseAcceptLanguage(acceptLanguageHeader);
  if (!preferred.length) return DEFAULT_LANG;

  // If user prefers a language that exists for this post, pick it.
  const available = new Set(getAvailableLangsForPost(postBase));
  for (const l of preferred) {
    if (available.has(l) && l !== DEFAULT_LANG) return l;
  }

  // Otherwise fall back to default.
  return DEFAULT_LANG;
};

@Controller()
export class BlogPagesController {
  constructor(
    private readonly blogService: BlogService,
    private readonly siteSettingsService: SiteSettingsService,
  ) {}

  @Get('blog')
  async blogIndex(@Res() res: Response, @Req() req: Request, @Query('lang') rawLang?: string) {
    const lang = selectEffectiveLang(rawLang, req.headers['accept-language']);
    const hasExplicitLang = Boolean(String(rawLang || '').trim());
    const settings = await this.siteSettingsService.getSettings();
    const { items } = await this.blogService.list({ status: BlogPostStatus.PUBLISHED, limit: 50, offset: 0 });

    const title = settings.defaultMetaTitle ? `${settings.defaultMetaTitle} | Blog` : 'Blog';
    const desc = settings.defaultMetaDescription || 'Blog yazıları';
    const canonicalBase = settings.canonicalBaseUrl || '';
    const canonical =
      canonicalBase && hasExplicitLang
        ? appendLangToUrl(`${canonicalBase}/blog`, normalizeLang(rawLang))
        : canonicalBase
          ? `${canonicalBase}/blog`
          : undefined;

    const hreflangLinks = canonicalBase
      ? [
          ...SUPPORTED_LANGS.map((l) => {
            const href = l === DEFAULT_LANG ? `${canonicalBase}/blog` : `${canonicalBase}/blog?lang=${l}`;
            return `<link rel="alternate" hreflang="${l}" href="${escapeHtml(href)}" />`;
          }),
          `<link rel="alternate" hreflang="x-default" href="${escapeHtml(`${canonicalBase}/blog`)}" />`,
        ].join('\n  ')
      : '';

    const listLangQuery =
      hasExplicitLang && normalizeLang(rawLang) !== DEFAULT_LANG ? `?lang=${encodeURIComponent(normalizeLang(rawLang))}` : '';

    const listItems = items
      .map((p) => {
        const localized = pickLocalized(p, lang);
        const href = `/blog/${encodeURIComponent(p.slug)}${listLangQuery}`;
        const when = p.publishedAt ? new Date(p.publishedAt).toISOString().slice(0, 10) : '';
        return `<li style="margin: 0 0 14px 0;">
  <a href="${href}" style="text-decoration: underline;">${escapeHtml(localized.title)}</a>
  ${when ? `<div style="opacity:0.7;font-size:12px;">${escapeHtml(when)}</div>` : ''}
  ${localized.excerpt ? `<div style="margin-top:6px;">${escapeHtml(localized.excerpt)}</div>` : ''}
</li>`;
      })
      .join('\n');

    const html = `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(desc)}" />
  ${settings.enableIndexing ? '' : '<meta name="robots" content="noindex, nofollow" />'}
  ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}" />` : ''}
  ${hreflangLinks}
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
  async blogPost(
    @Param('slug') slug: string,
    @Res() res: Response,
    @Req() req: Request,
    @Query('lang') rawLang?: string,
  ) {
    const settings = await this.siteSettingsService.getSettings();
    const postBase = await this.blogService.getPublishedBySlug(slug);
    const lang = selectEffectiveLangForPost(rawLang, req.headers['accept-language'], postBase);
    const hasExplicitLang = Boolean(String(rawLang || '').trim());
    const post = pickLocalized(postBase, lang);

    const metaTitle = post.metaTitle || post.title;
    const metaDesc = post.metaDescription || post.excerpt || settings.defaultMetaDescription || '';
    const canonicalBase = settings.canonicalBaseUrl || '';
    const canonicalBaseUrl =
      post.canonicalUrl || (canonicalBase ? `${canonicalBase}/blog/${encodeURIComponent(post.slug)}` : undefined);
    const canonical =
      canonicalBaseUrl && hasExplicitLang
        ? appendLangToUrl(canonicalBaseUrl, normalizeLang(rawLang))
        : canonicalBaseUrl;
    const ogImage = post.ogImageUrl || settings.defaultOgImageUrl || undefined;

    const jsonLd = post.jsonLd && post.jsonLd.trim().length ? post.jsonLd.trim() : null;
    const robots = post.noIndex || !settings.enableIndexing ? 'noindex, nofollow' : 'index, follow';

    const when = post.publishedAt ? new Date(post.publishedAt).toISOString().slice(0, 10) : '';

    const availableLangs = getAvailableLangsForPost(postBase);
    const hreflangLinks = canonicalBase
      ? [
          ...availableLangs.map((l) => {
            const baseHref = `${canonicalBase}/blog/${encodeURIComponent(postBase.slug)}`;
            const href = l === DEFAULT_LANG ? baseHref : `${baseHref}?lang=${l}`;
            return `<link rel="alternate" hreflang="${l}" href="${escapeHtml(href)}" />`;
          }),
          `<link rel="alternate" hreflang="x-default" href="${escapeHtml(`${canonicalBase}/blog/${encodeURIComponent(postBase.slug)}`)}" />`,
        ].join('\n  ')
      : '';

    const blogIndexHref =
      hasExplicitLang && normalizeLang(rawLang) !== DEFAULT_LANG ? `/blog?lang=${encodeURIComponent(normalizeLang(rawLang))}` : '/blog';

    const html = `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(metaTitle)}</title>
  ${metaDesc ? `<meta name="description" content="${escapeHtml(metaDesc)}" />` : ''}
  <meta name="robots" content="${escapeHtml(robots)}" />
  ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}" />` : ''}
  ${hreflangLinks}
  <meta property="og:title" content="${escapeHtml(metaTitle)}" />
  ${metaDesc ? `<meta property="og:description" content="${escapeHtml(metaDesc)}" />` : ''}
  <meta property="og:type" content="article" />
  ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />` : ''}
  ${post.keywords ? `<meta name="keywords" content="${escapeHtml(post.keywords)}" />` : ''}
  ${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
</head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 24px; line-height: 1.6;">
  <main style="max-width: 900px; margin: 0 auto;">
    <div style="margin-bottom: 18px;"><a href="${blogIndexHref}" style="text-decoration: underline;">← Blog</a></div>
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
