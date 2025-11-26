# Database Migrations and Email Features

This repo includes TypeORM migrations for new email-based features:

- Email verification and password reset fields on users
- Organization invitations (with email delivery) and membership tables

## What changed (Nov 2025)

- A new migration was added: `1762000000000-AddEmailVerificationAndReset.ts`
- Organization invite emails now link to a hash-based route so they work on static hosting: `/#join?token=...`
- Resending an invite extends expiry and sends the email again.

### Frontend legacy cache migration (Nov 2025)

The React app no longer executes the legacy `sales`/`sales_cache` localStorage migration on every bootstrap. After deploying this change, run the browser-only helper once per tenant/user that still has pre-tenantized caches:

1. Authenticate as the tenant owner (or at least open the app once) so the browser contains the relevant legacy `sales` keys.
2. Open `legacy-sales-migrator.html` on the **same origin** as the app (e.g. `https://app.example.com/legacy-sales-migrator.html`).
3. Verify the prefilled tenant ID, click **Durumu İncele** to view legacy vs tenant-scoped counts, then click **Migrasyonu Çalıştır**.
4. Keep the "global keys" checkbox enabled to delete the root `sales` keys afterward; re-run only if you intentionally need to copy the data for another tenant profile.

The page writes directly to `localStorage`, mimicking the previous runtime effect, and records a `sales_migration_manual_*` marker so ops teams can double-check completion via DevTools.

### Site Settings / SEO & Analytics (Nov 2025)

- A new migration was added: `1762826000000-CreateSiteSettingsTable.ts`
- This creates the `site_settings` table (singleton row with id=1) for global SEO and analytics settings.
- If you see 500s on `/api/site-settings` with `relation "site_settings" does not exist`, make sure this migration has been applied.

### Quotes module (Nov 2025)

- A new migration was added: `1762200000000-CreateQuotesTable.ts`
- This creates the `quotes` table with indexes on `tenantId`, unique `publicId`, and unique `quoteNumber`.
- If you see 404s for `/api/quotes` after deploying a new backend build, ensure the backend image is rebuilt and this migration is applied to your database.

## How to run migrations

Backend uses TypeORM CLI via npm scripts. Ensure DATABASE_URL or equivalent DB envs are set. Then run:

```bash
# From backend directory
cd backend
npm ci
npm run build

# Apply migrations to the configured database
npm run migration:run

# (Optional) Revert the last migration
npm run migration:revert
```

For production, set proper env variables before running:

```bash
# Example
export NODE_ENV=production
export DATABASE_URL="postgres://user:pass@host:5432/db"
export FRONTEND_URL="https://app.example.com"

cd backend
npm run build
npm run migration:run
```

For local development using a standalone Postgres (not Docker), example:

```bash
cd backend
npm ci
npm run build
DATABASE_HOST=localhost \
DATABASE_PORT=5433 \
DATABASE_USER=moneyflow \
DATABASE_PASSWORD=moneyflow123 \
DATABASE_NAME=moneyflow_dev \
npm run migration:run
```

### Running migrations in local Docker Compose dev

When using the provided `docker-compose.yml` at repo root, the backend runtime container does not include devDependencies (ts-node), so run the CLI from the host instead and point it to the Postgres port exposed by Docker (default 5543 in this repo):

```bash
cd backend
npm ci # installs CLI/dev deps locally

# Use the same DB envs as backend/.env.docker but with host/port for the exposed Postgres service
DATABASE_HOST=localhost \
DATABASE_PORT=5543 \
DATABASE_USER=moneyflow \
DATABASE_PASSWORD=moneyflow123 \
DATABASE_NAME=moneyflow_dev \
npm run migration:run
```

## Required environment variables

- FRONTEND_URL: Used to generate verification and invitation links in outgoing emails.
- EMAIL_VERIFICATION_REQUIRED (backend): Gate login until email is verified (if implemented in your auth flow).
- VITE_EMAIL_VERIFICATION_REQUIRED (frontend): If `true`, the app won’t auto-login after register and will instruct users to verify their email, then log in.

## Verifying the flow

- Register with a new email. You should receive a verification email. If `VITE_EMAIL_VERIFICATION_REQUIRED=true`, the app will not auto-login.
- In Settings → Organization → Members, invite a teammate. The app sends an invite email containing a link like `https://app.example.com/#join?token=...`.
- Use the “Resend” action on a pending invite to send the email again.

## Troubleshooting

- If emails are not being delivered, check the backend `EmailService` configuration (SMTP or provider). In development, it may log emails to console or a local file.
- If the invite link shows a blank page, ensure the URL includes the `#join?token=...` hash segment and that your app is served from `FRONTEND_URL`.
