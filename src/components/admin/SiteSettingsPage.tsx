import { useState, useEffect } from 'react';
import { siteSettingsApi, SiteSettings } from '../../api/site-settings';
import { Save, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SiteSettingsPage() {
  const [settings, setSettings] = useState<Partial<SiteSettings>>({
    enableIndexing: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await siteSettingsApi.getSettings();
      setSettings(data);
      setMessage(null); // Clear any previous errors
    } catch (error: any) {
      console.error('Failed to load site settings:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Failed to load settings. Backend may not be ready.';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      await siteSettingsApi.updateSettings(settings);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      // Reload to get updated timestamps
      await loadSettings();
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to save settings' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof SiteSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Site Settings</h2>
        <p className="text-sm text-gray-600 mt-1">
          Manage global SEO metadata and analytics tracking codes
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg border flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* SEO Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">🔍 SEO Settings</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Site Title
              </label>
              <input
                type="text"
                value={settings.defaultMetaTitle || ''}
                onChange={(e) => handleChange('defaultMetaTitle', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. Comptario - Accounting Dashboard"
              />
              <p className="mt-1 text-xs text-gray-500">
                This will be used as the default page title when individual pages don't specify one
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Meta Description
              </label>
              <textarea
                value={settings.defaultMetaDescription || ''}
                onChange={(e) => handleChange('defaultMetaDescription', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder="A brief description of your site..."
              />
              <p className="mt-1 text-xs text-gray-500">
                160 characters or less recommended for optimal display in search results
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Open Graph Image URL
              </label>
              <input
                type="url"
                value={settings.defaultOgImageUrl || ''}
                onChange={(e) => handleChange('defaultOgImageUrl', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://example.com/og-image.jpg"
              />
              <p className="mt-1 text-xs text-gray-500">
                Image shown when your site is shared on social media (1200x630px recommended)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Canonical Base URL
              </label>
              <input
                type="url"
                value={settings.canonicalBaseUrl || ''}
                onChange={(e) => handleChange('canonicalBaseUrl', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://yoursite.com"
              />
              <p className="mt-1 text-xs text-gray-500">
                Your site's primary domain (used for canonical URLs)
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="enableIndexing"
                checked={settings.enableIndexing ?? true}
                onChange={(e) => handleChange('enableIndexing', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="enableIndexing" className="text-sm font-medium text-gray-700">
                Allow search engines to index this site
              </label>
            </div>
            <p className="text-xs text-gray-500 ml-7">
              If unchecked, a noindex meta tag will be added to all pages
            </p>
          </div>
        </div>

        {/* Analytics Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Analytics & Tracking</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Google Analytics (GA4) Measurement ID
              </label>
              <input
                type="text"
                value={settings.googleAnalyticsId || ''}
                onChange={(e) => handleChange('googleAnalyticsId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="G-XXXXXXXXXX"
              />
              <p className="mt-1 text-xs text-gray-500">
                Find this in your Google Analytics 4 property settings
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Google Tag Manager ID
              </label>
              <input
                type="text"
                value={settings.googleTagManagerId || ''}
                onChange={(e) => handleChange('googleTagManagerId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="GTM-XXXXXXX"
              />
              <p className="mt-1 text-xs text-gray-500">
                Google Tag Manager container ID from your GTM account
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pinterest Tag ID
              </label>
              <input
                type="text"
                value={settings.pinterestTagId || ''}
                onChange={(e) => handleChange('pinterestTagId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="1234567890123"
              />
              <p className="mt-1 text-xs text-gray-500">
                Pinterest Tag ID for conversion tracking
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meta/Facebook Pixel ID
              </label>
              <input
                type="text"
                value={settings.metaPixelId || ''}
                onChange={(e) => handleChange('metaPixelId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="123456789012345"
              />
              <p className="mt-1 text-xs text-gray-500">
                Facebook Pixel ID for ads tracking and conversion optimization
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LinkedIn Insight Tag ID
              </label>
              <input
                type="text"
                value={settings.linkedinInsightTagId || ''}
                onChange={(e) => handleChange('linkedinInsightTagId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="123456"
              />
              <p className="mt-1 text-xs text-gray-500">
                LinkedIn Insight Tag Partner ID for B2B analytics
              </p>
            </div>
          </div>
        </div>

        {/* Advanced Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">⚙️ Advanced HTML Injection</h3>
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
            <strong>⚠️ Warning:</strong> Only add code from trusted sources. Invalid HTML can break your site.
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custom &lt;head&gt; HTML
              </label>
              <textarea
                value={settings.customHeadHtml || ''}
                onChange={(e) => handleChange('customHeadHtml', e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs"
                placeholder="<script>...</script> or <link>...</link>"
              />
              <p className="mt-1 text-xs text-gray-500">
                Raw HTML injected into &lt;head&gt; section (e.g., verification tags, custom scripts)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custom &lt;body&gt; Start HTML
              </label>
              <textarea
                value={settings.customBodyStartHtml || ''}
                onChange={(e) => handleChange('customBodyStartHtml', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs"
                placeholder="<noscript>...</noscript> or <div>...</div>"
              />
              <p className="mt-1 text-xs text-gray-500">
                Injected right after opening &lt;body&gt; tag (e.g., GTM noscript, body-level scripts)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custom &lt;body&gt; End HTML
              </label>
              <textarea
                value={settings.customBodyEndHtml || ''}
                onChange={(e) => handleChange('customBodyEndHtml', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs"
                placeholder="<script>...</script>"
              />
              <p className="mt-1 text-xs text-gray-500">
                Injected right before closing &lt;/body&gt; tag (e.g., analytics, chat widgets)
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
