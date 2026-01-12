import apiClient from './client';
import { adminAuthStorage } from '../utils/adminAuthStorage';

export type AdminBlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  contentHtml: string;
  contentMarkdown?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  ogImageUrl?: string | null;
  keywords?: string | null;
  noIndex: boolean;
  jsonLd?: string | null;
  status: 'draft' | 'published';
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminBlogUpsertPayload = {
  slug: string;
  title: string;
  excerpt?: string;
  contentMarkdown?: string;
  contentHtml?: string;
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  ogImageUrl?: string;
  keywords?: string;
  noIndex?: boolean;
  jsonLd?: string;
  status?: 'draft' | 'published';
};

const getAdminHeaders = () => {
  const token = adminAuthStorage.getToken();
  return token ? { 'admin-token': token } : {};
};

export const adminBlogApi = {
  async listPosts(): Promise<AdminBlogPost[]> {
    const res = await apiClient.get('/admin/blog-posts', { headers: getAdminHeaders() });
    return (res.data || []) as AdminBlogPost[];
  },

  async createPost(payload: AdminBlogUpsertPayload): Promise<AdminBlogPost> {
    const res = await apiClient.post('/admin/blog-posts', payload, { headers: getAdminHeaders() });
    return res.data as AdminBlogPost;
  },

  async updatePost(id: string, payload: Partial<AdminBlogUpsertPayload>): Promise<AdminBlogPost> {
    const res = await apiClient.patch(`/admin/blog-posts/${id}`, payload, { headers: getAdminHeaders() });
    return res.data as AdminBlogPost;
  },

  async deletePost(id: string): Promise<{ ok: true } | { ok: boolean }>{
    const res = await apiClient.delete(`/admin/blog-posts/${id}`, { headers: getAdminHeaders() });
    return res.data as { ok: true };
  },

  async upsertBySlug(slug: string, payload: AdminBlogUpsertPayload): Promise<AdminBlogPost> {
    const res = await apiClient.put(`/admin/blog-posts/by-slug/${encodeURIComponent(slug)}`, payload, { headers: getAdminHeaders() });
    return res.data as AdminBlogPost;
  },
};
