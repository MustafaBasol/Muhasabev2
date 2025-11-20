# Site Settings / SEO & Analytics Management

## Overview

This feature adds a **Site Settings** management interface to the admin panel, allowing non-technical administrators to manage global SEO metadata and analytics tracking codes without modifying code.

## Architecture

### Backend (NestJS + TypeORM)

**Files Created:**
- `backend/src/site-settings/entities/site-settings.entity.ts` - TypeORM entity for site_settings table
- `backend/src/site-settings/site-settings.service.ts` - Service layer with caching
- `backend/src/site-settings/site-settings.controller.ts` - REST API endpoints
- `backend/src/site-settings/site-settings.module.ts` - NestJS module

**Files Modified:**
- `backend/src/app.module.ts` - Added SiteSettingsModule import

**Database:**
- **Table**: `site_settings`
- **Pattern**: Singleton (single row with id=1)
- **Auto-creation**: Default settings created on first access
- **Caching**: 1-minute in-memory cache for performance

### Frontend (React + Vite)

**Files Created:**
- `src/api/site-settings.ts` - API client for backend communication
- `src/components/admin/SiteSettingsPage.tsx` - Admin UI for settings management
- `src/components/SeoInjector.tsx` - Dynamic SEO/analytics injection component

**Files Modified:**
- `src/components/AdminPage.tsx` - Added "Site Settings" tab to admin navigation
- `src/App.tsx` - Integrated SeoInjector component at root level

## Database Schema

```sql
CREATE TABLE site_settings (
  id INTEGER PRIMARY KEY,
  
  -- SEO Fields
  defaultMetaTitle VARCHAR(255),
  defaultMetaDescription TEXT,
  defaultOgImageUrl VARCHAR(500),
  canonicalBaseUrl VARCHAR(255),
  enableIndexing BOOLEAN DEFAULT TRUE,
  
  -- Analytics & Tracking IDs (public IDs only)
  googleAnalyticsId VARCHAR(100),      -- GA4: G-XXXXXXXXXX
  googleTagManagerId VARCHAR(100),     -- GTM-XXXXXXX
  pinterestTagId VARCHAR(100),
  metaPixelId VARCHAR(100),            -- Facebook Pixel
  linkedinInsightTagId VARCHAR(100),
  
  -- Custom HTML Injections
  customHeadHtml TEXT,
  customBodyStartHtml TEXT,
  customBodyEndHtml TEXT,
  
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

## API Endpoints

### GET /site-settings
**Access**: Public (needed for injecting meta tags)  
**Purpose**: Retrieve current site settings  
**Response**: SiteSettings object

### PUT /site-settings
**Access**: Admin only (requires `admin-token` header)  
**Purpose**: Update site settings  
**Body**: Partial SiteSettings object  
**Response**: Updated SiteSettings object

## Admin Access

### How to Access Site Settings

1. Log into admin panel at `/#admin` (use admin credentials)
2. Navigate to **"⚙️ Site Ayarları"** (Site Settings) tab
3. Configure settings and click **"Save Settings"**

### Settings Sections

#### 1. SEO Settings (🔍)
- **Default Site Title**: Page title when no specific title is set
- **Default Meta Description**: Description for search results (160 chars recommended)
- **Default Open Graph Image URL**: Image for social media shares (1200x630px)
- **Canonical Base URL**: Your site's primary domain
- **Allow Indexing**: Toggle to control search engine indexing (noindex meta tag)

#### 2. Analytics & Tracking (📊)
- **Google Analytics (GA4)**: Enter measurement ID (G-XXXXXXXXXX)
- **Google Tag Manager**: Enter container ID (GTM-XXXXXXX)
- **Pinterest Tag**: Enter tag ID
- **Meta/Facebook Pixel**: Enter pixel ID
- **LinkedIn Insight Tag**: Enter partner ID

#### 3. Advanced HTML Injection (⚙️)
- **Custom <head> HTML**: Raw HTML injected into document head
- **Custom <body> Start HTML**: Injected after opening <body> tag
- **Custom <body> End HTML**: Injected before closing </body> tag

**⚠️ Warning**: Only add code from trusted sources. Invalid HTML can break the site.

## How It Works

### SEO Injection Flow

1. **App Startup**: `SeoInjector` component loads in `App.tsx`
2. **Settings Fetch**: GET /site-settings API call
3. **Dynamic Injection**:
   - Updates document title if not set
   - Adds/updates meta description
   - Adds robots noindex if indexing disabled
   - Adds Open Graph tags for social sharing
   - Sets canonical URL based on current path
4. **Analytics Scripts**: Injects tracking codes (production only by default)
5. **Custom HTML**: Safely parses and injects custom HTML snippets

### Tracking Script Behavior

**Development Mode** (default):
- Tracking scripts are **disabled** to avoid polluting analytics
- Set `VITE_ENABLE_TRACKING_IN_DEV=true` in `.env` to enable in dev

**Production Mode**:
- All configured tracking scripts are injected automatically
- Scripts load asynchronously to avoid blocking page render

## Security Considerations

### What's Safe
✅ Public tracking IDs (GA, GTM, Facebook Pixel, etc.)  
✅ Meta tags and Open Graph data  
✅ Canonical URLs  
✅ Custom HTML from trusted sources (admin-controlled)

### What's NOT Stored Here
❌ **API Secret Keys** (e.g., Stripe secret, Turnstile secret)  
❌ **Private credentials**  
❌ **Backend-only configuration**

### Admin Authorization
- Update endpoint requires `admin-token` header
- Token validated against `ADMIN_TOKEN` environment variable
- Only authenticated admins can access the admin panel

### HTML Injection Safety
- Custom HTML fields allow raw HTML input
- **Admin responsibility**: Only add code from trusted sources
- Scripts are parsed and injected using standard DOM methods
- No automatic escaping (to allow legitimate scripts)

## Performance Optimizations

1. **Backend Caching**: Settings cached in memory for 1 minute
2. **Single DB Row**: Singleton pattern (id=1) for fast queries
3. **Async Script Loading**: All tracking scripts load asynchronously
4. **Early Injection**: SEO meta tags injected during app initialization

## Extending the Feature

### Adding New Tracking Services

1. **Backend**: Add new field to `SiteSettings` entity
   ```typescript
   @Column({ type: 'varchar', length: 100, nullable: true })
   customTrackingId: string;
   ```

2. **Frontend API**: Update `SiteSettings` interface in `src/api/site-settings.ts`

3. **Admin UI**: Add new input field in `src/components/admin/SiteSettingsPage.tsx`

4. **Injection Logic**: Add injection function in `src/components/SeoInjector.tsx`
   ```typescript
   function injectCustomTracking(trackingId: string) {
     // Your injection logic
   }
   ```

5. **Call in Effect**: Add call in `loadAndInjectSettings()` function

### Adding New SEO Fields

Follow same pattern as tracking services. Common additions:
- Twitter Card meta tags
- Structured data (JSON-LD)
- Alternate language links (hreflang)
- Custom favicon URLs
- Theme color meta tags

## Troubleshooting

### Settings Not Applying
1. **Check browser console** for errors
2. **Verify admin token** is correct in localStorage
3. **Clear cache**: Settings have 1-minute cache on backend
4. **Restart backend** if entity changes were made

### Tracking Scripts Not Loading
1. **Check environment**: Scripts disabled in dev by default
2. **Verify IDs**: Ensure correct format (G-XXXXXXXX for GA4, GTM-XXXXXXX for GTM)
3. **Check browser console**: Look for script loading errors
4. **Test in production mode**: `npm run build && npm run preview`

### Custom HTML Breaking Site
1. **Remove problematic code** from custom HTML fields
2. **Validate HTML** before injecting
3. **Test incrementally**: Add code in small chunks
4. **Use browser DevTools** to identify syntax errors

## Migration Notes

### Initial Deployment
- Postgres kullanılan ortamlarda tablo migration ile oluşturulmalıdır (SQLite fallback kullanılmaz).
- Default settings ilk API çağrısında oluşturulur (id=1 singleton).
- Yeni kurulumlarda ek veri taşımaya gerek yoktur.

### Updating Existing Installations
1. Postgres için migration’ı çalıştırın:
   ```bash
   cd backend
   npm run build
   # Lokal Postgres örneği ile örnek
   DATABASE_HOST=localhost \
   DATABASE_PORT=5433 \
   DATABASE_USER=moneyflow \
   DATABASE_PASSWORD=moneyflow123 \
   DATABASE_NAME=moneyflow_dev \
   npm run migration:run
   ```
2. `relation "site_settings" does not exist` hatası görürseniz migration uygulanmamıştır; yukarıdaki komutu doğrulayın.

## Examples

### Example 1: Setting Up Google Analytics
1. Go to Admin Panel → Site Settings
2. Enter GA4 Measurement ID: `G-ABC123XYZ`
3. Save settings
4. Refresh any page in production to see gtag.js injected

### Example 2: Disabling Search Indexing (Staging Site)
1. Go to Admin Panel → Site Settings
2. Uncheck "Allow search engines to index this site"
3. Save settings
4. Verify `<meta name="robots" content="noindex, nofollow">` appears in page source

### Example 3: Adding Custom Verification Tag
1. Go to Admin Panel → Site Settings → Advanced
2. In "Custom <head> HTML", add:
   ```html
   <meta name="google-site-verification" content="YOUR_VERIFICATION_CODE" />
   ```
3. Save settings
4. Verify tag appears in page <head>

## Best Practices

1. **Test tracking in production**: Use Tag Assistant or similar tools
2. **Monitor console errors**: Watch for script loading issues
3. **Keep IDs documented**: Store tracking IDs in password manager
4. **Regular audits**: Review active tracking codes quarterly
5. **Staging environment**: Test settings changes on staging before production
6. **Backup settings**: Export settings JSON before major changes
7. **Access control**: Limit admin panel access to authorized personnel

## Support

For issues or questions:
- Check browser console for errors
- Review this documentation
- Verify API endpoint responses in Network tab
- Contact development team with error details and steps to reproduce

---

**Last Updated**: November 20, 2025  
**Version**: 1.0  
**Status**: Production Ready ✅
