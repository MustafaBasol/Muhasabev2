import apiClient from './client';

export type PublicBlogPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  updatedAt: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  ogImageUrl?: string | null;
  keywords?: string | null;
  noIndex: boolean;
  jsonLd?: string | null;
};

export type PublicBlogPost = PublicBlogPostSummary & {
  contentHtml: string;
  contentMarkdown?: string | null;
};

export const publicBlogApi = {
  async listPosts(limit = 50, offset = 0): Promise<{ total: number; items: PublicBlogPostSummary[] }> {
    const res = await apiClient.get('/public/blog/posts', { params: { limit, offset } });
    return res.data as { total: number; items: PublicBlogPostSummary[] };
  },

  async getPostBySlug(slug: string): Promise<PublicBlogPost> {
    const res = await apiClient.get(`/public/blog/posts/${encodeURIComponent(slug)}`);
    return res.data as PublicBlogPost;
  },
};
