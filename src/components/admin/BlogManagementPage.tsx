import React, { useEffect, useMemo, useState } from 'react';
import { adminBlogApi, type AdminBlogPost, type AdminBlogUpsertPayload } from '../../api/admin-blog';
import { formatAppDateTime } from '../../utils/dateFormat';

const emptyDraft = (): AdminBlogUpsertPayload => ({
  slug: '',
  title: '',
  excerpt: '',
  contentMarkdown: '',
  metaTitle: '',
  metaDescription: '',
  canonicalUrl: '',
  ogImageUrl: '',
  keywords: '',
  noIndex: false,
  jsonLd: '',
  status: 'draft',
});

const BlogManagementPage: React.FC = () => {
  const [items, setItems] = useState<AdminBlogPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<AdminBlogUpsertPayload>(emptyDraft());
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => (selectedId ? items.find((p) => p.id === selectedId) || null : null),
    [items, selectedId]
  );

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const list = await adminBlogApi.listPosts();
      setItems(list);
    } catch (e: any) {
      setError(e?.message || 'Blog yazıları yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openNew = () => {
    setSelectedId(null);
    setForm(emptyDraft());
  };

  const openEdit = (post: AdminBlogPost) => {
    setSelectedId(post.id);
    setForm({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt || '',
      contentMarkdown: post.contentMarkdown || '',
      contentHtml: '',
      metaTitle: post.metaTitle || '',
      metaDescription: post.metaDescription || '',
      canonicalUrl: post.canonicalUrl || '',
      ogImageUrl: post.ogImageUrl || '',
      keywords: post.keywords || '',
      noIndex: Boolean(post.noIndex),
      jsonLd: post.jsonLd || '',
      status: post.status,
    });
  };

  const save = async () => {
    if (!form.slug.trim() || !form.title.trim()) {
      setError('Slug ve başlık zorunlu');
      return;
    }
    if (!(form.contentMarkdown && form.contentMarkdown.trim()) && !(form.contentHtml && form.contentHtml.trim())) {
      setError('İçerik zorunlu (Markdown veya HTML)');
      return;
    }

    try {
      setSaving(true);
      setError('');

      // Empty strings -> undefined (backend will store null)
      const payload: AdminBlogUpsertPayload = {
        ...form,
        excerpt: form.excerpt?.trim() ? form.excerpt : undefined,
        contentMarkdown: form.contentMarkdown?.trim() ? form.contentMarkdown : undefined,
        contentHtml: form.contentHtml?.trim() ? form.contentHtml : undefined,
        metaTitle: form.metaTitle?.trim() ? form.metaTitle : undefined,
        metaDescription: form.metaDescription?.trim() ? form.metaDescription : undefined,
        canonicalUrl: form.canonicalUrl?.trim() ? form.canonicalUrl : undefined,
        ogImageUrl: form.ogImageUrl?.trim() ? form.ogImageUrl : undefined,
        keywords: form.keywords?.trim() ? form.keywords : undefined,
        jsonLd: form.jsonLd?.trim() ? form.jsonLd : undefined,
      };

      if (selectedId) {
        await adminBlogApi.updatePost(selectedId, payload);
      } else {
        const created = await adminBlogApi.createPost(payload);
        setSelectedId(created.id);
      }

      await load();
    } catch (e: any) {
      setError(e?.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (post: AdminBlogPost) => {
    if (!window.confirm(`Silinsin mi? (${post.title})`)) return;
    try {
      setSaving(true);
      setError('');
      await adminBlogApi.deletePost(post.id);
      if (selectedId === post.id) {
        openNew();
      }
      await load();
    } catch (e: any) {
      setError(e?.message || 'Silinemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">📝 Blog Yazıları</h2>
          <div className="flex gap-2">
            <button
              onClick={openNew}
              className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm hover:bg-gray-800"
              disabled={saving}
            >
              Yeni Yazı
            </button>
            <button
              onClick={() => void load()}
              className="bg-white border border-gray-300 text-gray-800 px-3 py-2 rounded-lg text-sm hover:bg-gray-50"
              disabled={loading}
            >
              Yenile
            </button>
          </div>
        </div>

        {error && (
          <div className="px-6 pt-4">
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">{error}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
          {/* List */}
          <div className="min-w-0">
            <div className="text-sm text-gray-600 mb-2">Toplam: {items.length}</div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="max-h-[520px] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="text-left px-3 py-2">Başlık</th>
                      <th className="text-left px-3 py-2">Slug</th>
                      <th className="text-left px-3 py-2">Durum</th>
                      <th className="text-left px-3 py-2">Güncellendi</th>
                      <th className="text-right px-3 py-2">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((p) => (
                      <tr key={p.id} className={selectedId === p.id ? 'bg-blue-50' : ''}>
                        <td className="px-3 py-2 font-medium text-gray-900 truncate max-w-[220px]">{p.title}</td>
                        <td className="px-3 py-2 text-gray-700 truncate max-w-[200px]">{p.slug}</td>
                        <td className="px-3 py-2">
                          <span className={p.status === 'published' ? 'text-green-700' : 'text-gray-600'}>
                            {p.status === 'published' ? 'Yayında' : 'Taslak'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{formatAppDateTime(p.updatedAt)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button
                            className="text-blue-700 hover:underline mr-3"
                            onClick={() => openEdit(p)}
                          >
                            Düzenle
                          </button>
                          <button className="text-red-700 hover:underline" onClick={() => void remove(p)}>
                            Sil
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!items.length && (
                      <tr>
                        <td className="px-3 py-3 text-gray-600" colSpan={5}>
                          {loading ? 'Yükleniyor…' : 'Henüz blog yazısı yok.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-xs text-gray-500 mt-3">
              Public URL: <span className="font-mono">/blog</span> ve <span className="font-mono">/blog/&lt;slug&gt;</span>
            </div>
          </div>

          {/* Editor */}
          <div className="min-w-0">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="ornek-yazi"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Başlık</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Özet</label>
                <textarea
                  value={form.excerpt || ''}
                  onChange={(e) => setForm((s) => ({ ...s, excerpt: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[70px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">İçerik (Markdown)</label>
                <textarea
                  value={form.contentMarkdown || ''}
                  onChange={(e) => setForm((s) => ({ ...s, contentMarkdown: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[180px] font-mono"
                />
                <div className="text-xs text-gray-500 mt-1">Not: İsterseniz otomasyon tarafında HTML de gönderebilirsiniz.</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                  <select
                    value={form.status || 'draft'}
                    onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="draft">Taslak</option>
                    <option value="published">Yayında</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={Boolean(form.noIndex)}
                      onChange={(e) => setForm((s) => ({ ...s, noIndex: e.target.checked }))}
                    />
                    NoIndex (robots)
                  </label>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="text-sm font-semibold text-gray-800 mb-2">SEO</div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meta Title</label>
                    <input
                      value={form.metaTitle || ''}
                      onChange={(e) => setForm((s) => ({ ...s, metaTitle: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
                    <textarea
                      value={form.metaDescription || ''}
                      onChange={(e) => setForm((s) => ({ ...s, metaDescription: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[70px]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Canonical URL (opsiyonel)</label>
                    <input
                      value={form.canonicalUrl || ''}
                      onChange={(e) => setForm((s) => ({ ...s, canonicalUrl: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="https://example.com/blog/ornek-yazi"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">OG Image URL</label>
                    <input
                      value={form.ogImageUrl || ''}
                      onChange={(e) => setForm((s) => ({ ...s, ogImageUrl: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
                    <input
                      value={form.keywords || ''}
                      onChange={(e) => setForm((s) => ({ ...s, keywords: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="muhasebe, fatura, kobi"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">JSON-LD (opsiyonel)</label>
                    <textarea
                      value={form.jsonLd || ''}
                      onChange={(e) => setForm((s) => ({ ...s, jsonLd: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[110px] font-mono"
                      placeholder='{"@context":"https://schema.org","@type":"Article",...}'
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => void save()}
                  disabled={saving}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Kaydediliyor…' : selected ? 'Güncelle' : 'Oluştur'}
                </button>
                {selected ? (
                  <a
                    href={`/blog/${encodeURIComponent(form.slug)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Public Gör
                  </a>
                ) : null}
                {selected ? (
                  <button
                    onClick={() => void remove(selected)}
                    disabled={saving}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                  >
                    Sil
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogManagementPage;
