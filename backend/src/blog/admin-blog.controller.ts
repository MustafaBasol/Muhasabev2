import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminService } from '../admin/admin.service';
import type { AdminHeaderMap } from '../admin/utils/admin-token.util';
import { resolveAdminHeaders } from '../admin/utils/admin-token.util';
import { BlogPost, BlogPostStatus } from './entities/blog-post.entity';
import { BlogService } from './blog.service';
import { CreateBlogPostDto, UpdateBlogPostDto } from './dto/admin-blog.dto';
import sanitizeHtml from 'sanitize-html';
import { marked } from 'marked';

@Controller('admin/blog-posts')
export class AdminBlogController {
  constructor(
    private readonly adminService: AdminService,
    private readonly blogService: BlogService,
    @InjectRepository(BlogPost)
    private readonly blogRepo: Repository<BlogPost>,
  ) {}

  private resolveAdminToken(headers?: AdminHeaderMap): string {
    const { adminToken } = resolveAdminHeaders(headers);
    if (!adminToken) {
      throw new UnauthorizedException('Admin token required');
    }
    return adminToken;
  }

  private checkAdminAuth(headers?: AdminHeaderMap) {
    const adminToken = this.resolveAdminToken(headers);
    if (!this.adminService.isValidAdminToken(adminToken)) {
      throw new UnauthorizedException('Invalid or expired admin token');
    }
  }

  private sanitizeOrThrow(html: string): string {
    const cleaned = sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        'img',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
      ]),
      allowedAttributes: {
        a: ['href', 'name', 'target', 'rel'],
        img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
        '*': ['class'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      transformTags: {
        a: sanitizeHtml.simpleTransform('a', {
          rel: 'nofollow noopener noreferrer',
          target: '_blank',
        }),
      },
    });

    if (!cleaned || !cleaned.trim()) {
      throw new BadRequestException('contentHtml is required');
    }
    return cleaned;
  }

  private renderHtml(dto: { contentHtml?: string; contentMarkdown?: string }): { html: string; markdown?: string | null } {
    const markdown = dto.contentMarkdown;
    const hasHtml = typeof dto.contentHtml === 'string' && dto.contentHtml.trim().length > 0;
    const hasMd = typeof markdown === 'string' && markdown.trim().length > 0;

    if (!hasHtml && !hasMd) {
      throw new BadRequestException('Either contentHtml or contentMarkdown is required');
    }

    if (hasHtml) {
      return { html: this.sanitizeOrThrow(dto.contentHtml as string), markdown: hasMd ? markdown! : null };
    }

    const htmlFromMd = marked.parse(markdown as string);
    return { html: this.sanitizeOrThrow(String(htmlFromMd)), markdown: markdown! };
  }

  private normalizeLangKey(raw: unknown): string {
    return String(raw ?? '').trim().toLowerCase();
  }

  private normalizeTranslationsPatch(input: unknown): Record<string, any> | null {
    if (input === null) return {};
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

    const entries = Object.entries(input as Record<string, unknown>);
    if (entries.length === 0) return {};

    const patch: Record<string, any> = {};

    for (const [langRaw, value] of entries) {
      const lang = this.normalizeLangKey(langRaw);
      if (!lang) continue;

      if (value === null) {
        patch[lang] = null;
        continue;
      }

      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const v = value as Record<string, any>;

      const entry: Record<string, any> = {};

      if (typeof v.title === 'string' && v.title.trim()) entry.title = v.title;
      if (v.excerpt === null) entry.excerpt = null;
      else if (typeof v.excerpt === 'string') entry.excerpt = v.excerpt;

      const hasHtml = typeof v.contentHtml === 'string' && v.contentHtml.trim().length > 0;
      const hasMd = typeof v.contentMarkdown === 'string' && v.contentMarkdown.trim().length > 0;
      if (hasHtml || hasMd) {
        const { html, markdown } = this.renderHtml({
          contentHtml: hasHtml ? v.contentHtml : undefined,
          contentMarkdown: hasMd ? v.contentMarkdown : undefined,
        });
        entry.contentHtml = html;
        entry.contentMarkdown = markdown ?? null;
      }

      if (v.metaTitle === null) entry.metaTitle = null;
      else if (typeof v.metaTitle === 'string') entry.metaTitle = v.metaTitle;

      if (v.metaDescription === null) entry.metaDescription = null;
      else if (typeof v.metaDescription === 'string') entry.metaDescription = v.metaDescription;

      if (v.canonicalUrl === null) entry.canonicalUrl = null;
      else if (typeof v.canonicalUrl === 'string') entry.canonicalUrl = v.canonicalUrl;

      if (v.ogImageUrl === null) entry.ogImageUrl = null;
      else if (typeof v.ogImageUrl === 'string') entry.ogImageUrl = v.ogImageUrl;

      if (v.keywords === null) entry.keywords = null;
      else if (typeof v.keywords === 'string') entry.keywords = v.keywords;

      if (typeof v.noIndex === 'boolean') entry.noIndex = v.noIndex;

      if (v.jsonLd === null) entry.jsonLd = null;
      else if (typeof v.jsonLd === 'string') entry.jsonLd = v.jsonLd;

      if (Object.keys(entry).length > 0) {
        patch[lang] = entry;
      }
    }

    return patch;
  }

  private mergeTranslations(existing: Record<string, any> | null | undefined, patch: Record<string, any> | null): Record<string, any> | null {
    if (patch === null) return existing ?? null;
    // explicit clear all
    if (Object.keys(patch).length === 0) return null;

    const next: Record<string, any> = { ...(existing || {}) };
    for (const [lang, val] of Object.entries(patch)) {
      if (val === null) {
        delete next[lang];
        continue;
      }
      next[lang] = { ...(next[lang] || {}), ...(val as any) };
    }
    return Object.keys(next).length ? next : null;
  }

  @Get()
  async list(@Headers() headers?: AdminHeaderMap) {
    this.checkAdminAuth(headers);
    const items = await this.blogRepo.find({ order: { createdAt: 'DESC' } });
    return items;
  }

  @Get(':id')
  async get(@Param('id') id: string, @Headers() headers?: AdminHeaderMap) {
    this.checkAdminAuth(headers);
    const found = await this.blogRepo.findOne({ where: { id } });
    if (!found) throw new BadRequestException('Not found');
    return found;
  }

  @Post()
  async create(
    @Body() dto: CreateBlogPostDto,
    @Headers() headers?: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    const slug = this.blogService.normalizeSlug(dto.slug);
    const { html, markdown } = this.renderHtml(dto);
    const translationsPatch = this.normalizeTranslationsPatch((dto as any).translations);
    const translations = this.mergeTranslations(null, translationsPatch);

    const post = this.blogRepo.create({
      slug,
      title: dto.title,
      excerpt: dto.excerpt ?? null,
      contentHtml: html,
      contentMarkdown: markdown ?? null,
      translations,
      metaTitle: dto.metaTitle ?? null,
      metaDescription: dto.metaDescription ?? null,
      canonicalUrl: dto.canonicalUrl ?? null,
      ogImageUrl: dto.ogImageUrl ?? null,
      keywords: dto.keywords ?? null,
      noIndex: dto.noIndex ?? false,
      jsonLd: dto.jsonLd ?? null,
      status: dto.status ?? BlogPostStatus.DRAFT,
      publishedAt: (dto.status ?? BlogPostStatus.DRAFT) === BlogPostStatus.PUBLISHED ? new Date() : null,
    });
    try {
      return await this.blogRepo.save(post);
    } catch (e) {
      throw new BadRequestException('Could not create blog post (slug must be unique)');
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBlogPostDto,
    @Headers() headers?: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    const post = await this.blogRepo.findOne({ where: { id } });
    if (!post) throw new BadRequestException('Not found');

    if (dto.slug) post.slug = this.blogService.normalizeSlug(dto.slug);
    if (dto.title !== undefined) post.title = dto.title;
    if (dto.excerpt !== undefined) post.excerpt = dto.excerpt;
    if (dto.metaTitle !== undefined) post.metaTitle = dto.metaTitle;
    if (dto.metaDescription !== undefined) post.metaDescription = dto.metaDescription;
    if (dto.canonicalUrl !== undefined) post.canonicalUrl = dto.canonicalUrl;
    if (dto.ogImageUrl !== undefined) post.ogImageUrl = dto.ogImageUrl;
    if (dto.keywords !== undefined) post.keywords = dto.keywords;
    if (dto.noIndex !== undefined) post.noIndex = dto.noIndex;
    if (dto.jsonLd !== undefined) post.jsonLd = dto.jsonLd;

    if ((dto as any).translations !== undefined) {
      const patch = this.normalizeTranslationsPatch((dto as any).translations);
      if (patch === null) {
        throw new BadRequestException('translations must be an object');
      }
      post.translations = this.mergeTranslations(post.translations, patch);
    }

    const contentTouched = dto.contentHtml !== undefined || dto.contentMarkdown !== undefined;
    if (contentTouched) {
      const { html, markdown } = this.renderHtml({
        contentHtml: dto.contentHtml ?? undefined,
        contentMarkdown: dto.contentMarkdown ?? undefined,
      });
      post.contentHtml = html;
      post.contentMarkdown = markdown ?? null;
    }

    const prevStatus = post.status;
    if (dto.status) {
      post.status = dto.status;
      if (prevStatus !== BlogPostStatus.PUBLISHED && dto.status === BlogPostStatus.PUBLISHED) {
        post.publishedAt = new Date();
      }
      if (dto.status !== BlogPostStatus.PUBLISHED) {
        post.publishedAt = null;
      }
    }

    try {
      return await this.blogRepo.save(post);
    } catch (e) {
      throw new BadRequestException('Could not update blog post (slug must be unique)');
    }
  }

  @Put('by-slug/:slug')
  async upsertBySlug(
    @Param('slug') slugParam: string,
    @Body() dto: CreateBlogPostDto,
    @Headers() headers?: AdminHeaderMap,
  ) {
    this.checkAdminAuth(headers);
    const slug = this.blogService.normalizeSlug(slugParam);
    const existing = await this.blogRepo.findOne({ where: { slug } });

    if (!existing) {
      return this.create({ ...dto, slug }, headers);
    }

    // Convert create DTO into patch payload
    const patch: UpdateBlogPostDto = {
      slug,
      title: dto.title,
      excerpt: dto.excerpt,
      contentHtml: dto.contentHtml,
      contentMarkdown: dto.contentMarkdown,
      metaTitle: dto.metaTitle,
      metaDescription: dto.metaDescription,
      canonicalUrl: dto.canonicalUrl,
      ogImageUrl: dto.ogImageUrl,
      keywords: dto.keywords,
      noIndex: dto.noIndex,
      jsonLd: dto.jsonLd,
      status: dto.status,
      translations: (dto as any).translations,
    };
    return this.update(existing.id, patch, headers);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Headers() headers?: AdminHeaderMap) {
    this.checkAdminAuth(headers);
    await this.blogRepo.delete({ id });
    return { ok: true };
  }
}
