import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogPost, BlogPostStatus } from './entities/blog-post.entity';

export type BlogListOptions = {
  status?: BlogPostStatus;
  limit?: number;
  offset?: number;
};

@Injectable()
export class BlogService {
  constructor(
    @InjectRepository(BlogPost)
    private readonly blogRepo: Repository<BlogPost>,
  ) {}

  async list(options: BlogListOptions = {}): Promise<{ items: BlogPost[]; total: number }> {
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));
    const offset = Math.max(0, options.offset ?? 0);

    const qb = this.blogRepo.createQueryBuilder('p');
    if (options.status) {
      qb.andWhere('p.status = :status', { status: options.status });
    }
    qb.orderBy('p.publishedAt', 'DESC').addOrderBy('p.createdAt', 'DESC');

    const [items, total] = await qb.take(limit).skip(offset).getManyAndCount();
    return { items, total };
  }

  async getBySlug(slug: string): Promise<BlogPost> {
    const normalized = this.normalizeSlug(slug);
    const found = await this.blogRepo.findOne({ where: { slug: normalized } });
    if (!found) throw new NotFoundException('Blog post not found');
    return found;
  }

  async getPublishedBySlug(slug: string): Promise<BlogPost> {
    const normalized = this.normalizeSlug(slug);
    const found = await this.blogRepo.findOne({ where: { slug: normalized, status: BlogPostStatus.PUBLISHED } });
    if (!found) throw new NotFoundException('Blog post not found');
    return found;
  }

  normalizeSlug(value: string): string {
    const v = String(value || '').trim().toLowerCase();
    const cleaned = v
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-\u00C0-\u024F\u1E00-\u1EFF]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!cleaned) throw new BadRequestException('Invalid slug');
    if (cleaned.length > 200) throw new BadRequestException('Slug too long');
    return cleaned;
  }
}
