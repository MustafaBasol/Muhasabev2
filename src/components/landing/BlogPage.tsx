import React, { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { useTranslation } from 'react-i18next';
import { publicBlogApi, type PublicBlogPost, type PublicBlogPostSummary } from '../../api/blog-public';
import { formatAppDate } from '../../utils/dateFormat';
import LandingNavbar from './LandingNavbar';
import LandingFooter from './LandingFooter';

type Props = {
  slug?: string;
};

const PAGE_SIZE = 15;

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
  const { t } = useTranslation();
  const [list, setList] = useState<PublicBlogPostSummary[]>([]);
  const [post, setPost] = useState<PublicBlogPost | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [readingMode, setReadingMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('blogReadingMode') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('blogReadingMode', readingMode ? '1' : '0');
    } catch {
      // ignore
    }
  }, [readingMode]);

  const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));

  // slug -> list geçişinde sayfa state'i bozulmasın diye clamp
  useEffect(() => {
    if (page < 1) setPage(1);
    else if (page > totalPages) setPage(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

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
          setList([]);
          setTotal(0);

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
          const offset = (page - 1) * PAGE_SIZE;
          const res = await publicBlogApi.listPosts(PAGE_SIZE, offset);
          setList(res.items || []);
          setTotal(Number(res.total || 0));
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
  }, [slug, page]);

  const onTryForFree = () => {
    window.location.hash = 'register';
  };

  const onSignIn = () => {
    window.location.hash = 'login';
  };

  const showToast = (message: string, tone: 'success' | 'error') => {
    try {
      window.dispatchEvent(
        new CustomEvent('showToast', {
          detail: { message, tone }
        })
      );
    } catch {
      // ignore
    }
  };

  const scrollToTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  const copyCurrentLink = async () => {
    const url =
      post?.canonicalUrl ||
      (slug ? `${window.location.origin}/#blog/${encodeURIComponent(slug)}` : window.location.href);

    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard API not available');
      }
      await navigator.clipboard.writeText(url);
      showToast(t('common.copied'), 'success');
    } catch {
      showToast(t('common.copyFailed'), 'error');
    }
  };

  const shareCurrentLink = async () => {
    const url =
      post?.canonicalUrl ||
      (slug ? `${window.location.origin}/#blog/${encodeURIComponent(slug)}` : window.location.href);

    try {
      const navAny = navigator as any;
      if (typeof navAny?.share !== 'function') {
        await copyCurrentLink();
        return;
      }

      await navAny.share({
        title: post?.title || 'Blog',
        text: post?.excerpt || undefined,
        url
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      await copyCurrentLink();
    }
  };

  const goToPage = (nextPage: number) => {
    const clamped = Math.min(Math.max(1, nextPage), totalPages);
    setPage(clamped);
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  const pageButtons = useMemo(() => {
    const pages: Array<number | '...'> = [];
    if (totalPages <= 7) {
      for (let p = 1; p <= totalPages; p++) pages.push(p);
      return pages;
    }

    const windowSize = 1; // current page etrafında kaç sayfa gösterelim
    const start = Math.max(2, page - windowSize);
    const end = Math.min(totalPages - 1, page + windowSize);

    pages.push(1);
    if (start > 2) pages.push('...');
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  return (
    <div className={readingMode && slug ? 'min-h-screen bg-slate-50' : 'min-h-screen bg-white'}>
      {!(readingMode && slug) && (
        <LandingNavbar onTryForFree={onTryForFree} onSignIn={onSignIn} />
      )}

      <main className={readingMode && slug ? 'pt-6' : 'pt-24'}>
        {!(readingMode && slug) && (
          <div className="bg-slate-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <div className="flex items-center justify-between">
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900">
                  Blog
                </h1>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm mb-6">{error}</div>
          )}

          {loading && <div className="text-sm text-gray-500">Yükleniyor…</div>}

          {!loading && slug && post && (
            <div className={readingMode ? 'max-w-3xl mx-auto' : 'max-w-7xl mx-auto'}>
              <div
                className={
                  readingMode
                    ? 'sticky top-0 z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-6 bg-white/80 backdrop-blur border-b border-slate-200'
                    : 'mb-6 flex items-center justify-between gap-3'
                }
              >
                <div className={readingMode ? 'flex items-center justify-between gap-3' : 'flex items-center justify-between gap-3 w-full'}>
                  <a href="#blog" className="text-sm text-blue-700 hover:underline">← {t('blog.actions.allPosts')}</a>
                  <div className="flex items-center gap-2">
                    {readingMode && (
                      <>
                        <button
                          type="button"
                          onClick={scrollToTop}
                          className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 hover:bg-slate-50"
                        >
                          {t('blog.actions.scrollTop')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void shareCurrentLink()}
                          className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 hover:bg-slate-50"
                        >
                          {t('blog.actions.share')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void copyCurrentLink()}
                          className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 hover:bg-slate-50"
                        >
                          {t('blog.actions.copyLink')}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      aria-pressed={readingMode}
                      onClick={() => setReadingMode((v) => !v)}
                      className={
                        readingMode
                          ? 'px-3 py-2 rounded-lg bg-gray-900 text-white text-sm'
                          : 'px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-800 hover:bg-gray-50'
                      }
                    >
                      {readingMode ? t('blog.readingMode.off') : t('blog.readingMode.on')}
                    </button>
                  </div>
                </div>
              </div>

              <div
                className={
                  readingMode
                    ? 'bg-white rounded-2xl border border-slate-200 shadow-sm px-6 sm:px-10 py-8'
                    : ''
                }
              >
                <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-3">{post.title}</h2>
                <div className="text-sm text-gray-500 mb-6">
                  {post.publishedAt ? formatAppDate(post.publishedAt) : ''}
                </div>

                {post.ogImageUrl ? (
                  <div className="mb-8 rounded-xl overflow-hidden border border-gray-200 bg-white">
                    <img
                      src={post.ogImageUrl}
                      alt={post.title}
                      className="w-full h-[320px] object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : null}

                {post.excerpt ? (
                  <p className={readingMode ? 'text-gray-700 text-xl leading-8 mb-7' : 'text-gray-700 text-lg leading-7 mb-6'}>
                    {post.excerpt}
                  </p>
                ) : null}

                <div
                  className={
                    readingMode
                      ? 'prose prose-slate prose-lg lg:prose-xl mx-auto prose-p:leading-8 prose-li:leading-7 prose-img:rounded-xl prose-img:shadow-sm prose-a:text-blue-700 prose-a:no-underline hover:prose-a:underline'
                      : 'prose prose-slate lg:prose-lg max-w-none prose-img:rounded-xl prose-img:shadow-sm prose-a:text-blue-700 prose-a:no-underline hover:prose-a:underline'
                  }
                  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
              </div>
            </div>
          )}

          {!loading && !slug && (
            <div>
              {!list.length ? (
                <div className="text-sm text-gray-600">Henüz yayınlanmış yazı yok.</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {list.map((p) => (
                      <a
                        key={p.id}
                        href={`#blog/${encodeURIComponent(p.slug)}`}
                        className="group bg-white rounded-xl overflow-hidden border border-gray-200 hover:shadow-md transition-shadow"
                      >
                        <div className="bg-gray-100">
                          {p.ogImageUrl ? (
                            <img
                              src={p.ogImageUrl}
                              alt={p.title}
                              className="w-full h-56 object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-56 bg-gradient-to-br from-gray-100 to-gray-200" />
                          )}
                        </div>

                        <div className="p-6">
                          <div className="text-xs font-semibold tracking-widest text-pink-600">
                            BLOG
                          </div>
                          <div className="mt-3 text-xl font-extrabold leading-snug text-gray-900 group-hover:underline">
                            {p.title}
                          </div>
                          <div className="mt-6 text-xs text-gray-500">
                            {p.publishedAt ? formatAppDate(p.publishedAt) : ''}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>

                  {/* Pagination */}
                  <div className="mt-10 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => goToPage(page - 1)}
                      disabled={page <= 1}
                      className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {t('pagination.previous')}
                    </button>

                    <div className="flex items-center gap-1">
                      {pageButtons.map((p, idx) =>
                        p === '...' ? (
                          <span key={`dots-${idx}`} className="px-2 text-gray-500">…</span>
                        ) : (
                          <button
                            key={p}
                            type="button"
                            onClick={() => goToPage(p)}
                            className={
                              p === page
                                ? 'px-3 py-2 rounded-lg bg-gray-900 text-white text-sm'
                                : 'px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-800 hover:bg-gray-50'
                            }
                          >
                            {p}
                          </button>
                        )
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => goToPage(page + 1)}
                      disabled={page >= totalPages}
                      className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {t('pagination.next')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {!(readingMode && slug) && <LandingFooter />}
    </div>
  );
};

export default BlogPage;
