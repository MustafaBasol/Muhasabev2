import React, { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { publicBlogApi, type PublicBlogPost, type PublicBlogPostSummary } from '../../api/blog-public';
import { formatAppDate } from '../../utils/dateFormat';

type Props = {
  slug?: string;
};

const ensureMeta = (name: string, content: string) => {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const ensureOg = (property: string, content: string) => {
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const ensureCanonical = (href: string) => {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
};

const ensureJsonLd = (json: string | null) => {
  const existing = document.getElementById('blog-jsonld');
  if (existing) existing.remove();
  if (!json) return;
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'blog-jsonld';
  script.textContent = json;
  document.head.appendChild(script);
};

const BlogPage: React.FC<Props> = ({ slug }) => {
  const [list, setList] = useState<PublicBlogPostSummary[]>([]);
  const [post, setPost] = useState<PublicBlogPost | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const sanitizedHtml = useMemo(() => {
    if (!post?.contentHtml) return '';
    return DOMPurify.sanitize(post.contentHtml, { USE_PROFILES: { html: true } });
  }, [post?.contentHtml]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        if (slug) {
          const p = await publicBlogApi.getPostBySlug(slug);
          setPost(p);

          const title = p.metaTitle || p.title || 'Blog';
          document.title = title;
          if (p.metaDescription) ensureMeta('description', p.metaDescription);
          if (p.keywords) ensureMeta('keywords', p.keywords);
          ensureMeta('robots', p.noIndex ? 'noindex, nofollow' : 'index, follow');

          ensureOg('og:title', title);
          if (p.metaDescription) ensureOg('og:description', p.metaDescription);
          ensureOg('og:type', 'article');
          if (p.ogImageUrl) ensureOg('og:image', p.ogImageUrl);

          if (p.canonicalUrl) ensureCanonical(p.canonicalUrl);
          ensureJsonLd(p.jsonLd || null);
        } else {
          const res = await publicBlogApi.listPosts();
          setList(res.items || []);
          setPost(null);
          document.title = 'Blog';
          ensureJsonLd(null);
        }
      } catch (e: any) {
        setError(e?.message || 'Yüklenemedi');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [slug]);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Blog</h1>
          <a
            href="#landing"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Ana Sayfa
          </a>
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm mb-6">{error}</div>
        )}

        {loading && <div className="text-sm text-gray-500">Yükleniyor…</div>}

        {!loading && slug && post && (
          <div>
            <div className="mb-6">
              <a href="#blog" className="text-sm text-blue-700 hover:underline">← Tüm yazılar</a>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">{post.title}</h2>
            <div className="text-sm text-gray-500 mb-6">
              {post.publishedAt ? formatAppDate(post.publishedAt) : ''}
            </div>
            {post.excerpt ? <p className="text-gray-700 mb-6">{post.excerpt}</p> : null}
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
          </div>
        )}

        {!loading && !slug && (
          <div className="space-y-6">
            {!list.length ? (
              <div className="text-sm text-gray-600">Henüz yayınlanmış yazı yok.</div>
            ) : (
              list.map((p) => (
                <div key={p.id} className="border border-gray-200 rounded-lg p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <a
                        href={`#blog/${encodeURIComponent(p.slug)}`}
                        className="text-lg font-semibold text-gray-900 hover:underline"
                      >
                        {p.title}
                      </a>
                      {p.excerpt ? <p className="text-sm text-gray-700 mt-2">{p.excerpt}</p> : null}
                      <div className="text-xs text-gray-500 mt-3">
                        {p.publishedAt ? formatAppDate(p.publishedAt) : ''}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogPage;
