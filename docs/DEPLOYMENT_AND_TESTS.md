# Deployment, Testing, and Environment Guide

## 1. Overview
- **Backend:** `backend/` is a NestJS 11 application backed by TypeORM 0.3 (see `backend/src/app.module.ts`). It intentionally supports PostgreSQL only across development, CI/E2E, and production. The legacy SQLite fallback is disabled for this workflow by always providing `DATABASE_*` or `DATABASE_URL` variables.
- **Frontend:** the repository root hosts a Vite + React + TypeScript + Tailwind single-page app (see `package.json`, `vite.config.ts`, and `src/`). The dev server listens on port 5174 and proxies `/api` calls to the backend dev port (3001) so that both apps can run locally without a separate reverse proxy.
- **Database:** PostgreSQL 16+ is the single source of truth. Local development and automated tests typically use the Docker recipe in `docker-compose.yml` (service `postgres`). Production also uses PostgreSQL and runs on the same host as the backend container.
- **Production target:** a single Ubuntu 24.04 Hostinger VPS that already runs n8n. We deploy the backend (and optional frontend) through Docker Compose, ensuring we reuse or extend the existing Docker network so n8n keeps running unaffected.

**Local development checklist**
1. Copy `backend/.env.example` → `backend/.env` and set the PostgreSQL, JWT, email, captcha, and Stripe secrets.
2. Copy `.env.example` → `.env` for the frontend and align `VITE_API_URL` with the backend URL (typically `http://localhost:3001`).
3. Start PostgreSQL with `docker compose up -d postgres` from the repo root (this exposes the DB on host port `5543`).
4. `cd backend && npm install`, run `npm run migration:run`, then start the API with `npm run start:dev` (port 3001 by default).
5. In another terminal, `npm install` at the repo root and run `npm run dev` to serve the SPA on port 5174.

**Test & e2e summary**
- Jest unit tests live in `backend/src/**/*.spec.ts` and `backend/src/__tests__`. They point to PostgreSQL when `DATABASE_*` is defined, so keep a Postgres instance running locally.
- End-to-end tests run through `backend/test/run-e2e.sh`, which loads `.env.test`, sets `NODE_ENV=test`, recreates the target PostgreSQL database via `scripts/prepare-e2e.ts`, applies migrations, and runs seeding logic from `SeedService`.
- No SQLite fixtures are used; everything goes against PostgreSQL to avoid production-only bugs.

**Production summary**
- Build the backend Docker image defined in `backend/Dockerfile` and orchestrate it together with PostgreSQL via `docker-compose` on the VPS. Environment variables live in `backend/.env.production` (never commit secrets).
- Expose the backend through either a reverse proxy (preferred for TLS) or direct port mapping. The `/health` endpoint is safe for readiness checks.
- Migrations run from inside the backend container (`docker compose run backend npm run migration:run`).

## 2. Environment variables
Populate backend env files under `backend/` and frontend env files at the repo root. The tables below group every required variable, their purpose, safe sample values, and where they are used.

### 2.1 Backend core runtime & database
| Variable | Description | Example | Environments |
| --- | --- | --- | --- |
| `DATABASE_URL` | Single PostgreSQL connection string used when set; overrides discrete fields. | `postgres://moneyflow:moneyflow123@127.0.0.1:5432/moneyflow_dev` | dev / test / prod |
| `DATABASE_HOST` | Hostname when `DATABASE_URL` is not provided. | `127.0.0.1` | dev / test / prod |
| `DATABASE_PORT` | PostgreSQL port. | `5432` | dev / test / prod |
| `DATABASE_USER` | PostgreSQL role with DDL/DML rights. | `moneyflow` | dev / test / prod |
| `DATABASE_PASSWORD` | Password for `DATABASE_USER`. | `moneyflow123` | dev / test / prod |
| `DATABASE_NAME` | Default database schema. | `moneyflow_dev` | dev / test / prod |
| `DATABASE_SSL` | `'true'` to enable TLS (uses `rejectUnauthorized: false`). | `false` locally, `true` on Hostinger if Pg enforces TLS | prod |
| `DB_SQLITE` | Keep unset or `false` to force PostgreSQL (see `app.module.ts`). | `false` | all |
| `PORT` | Backend HTTP port (`main.ts` defaults to 3001 dev / 3000 prod). | `3001` dev, `3000` prod | all |
| `NODE_ENV` | `development`, `test`, or `production`. Controls logging + CORS hardness. | `development` | all |
| `FRONTEND_URL` | Base URL used in email links (verification/reset/invite). | `http://localhost:5174` dev, `https://app.example.com` prod | all |
| `APP_PUBLIC_URL` | Optional override for public URLs (used by multi-tenant links). | `https://app.example.com` | prod |
| `CORS_ORIGINS` | Comma-separated list of allowed origins. | `https://app.example.com,https://admin.example.com` | prod |
| `CORS_CREDENTIALS` | Whether CORS responses allow credentials. | `true` | prod |
| `ADMIN_USERNAME` | Default admin user injected on boot/seed. | `owner` | all |
| `ADMIN_PASSWORD_HASH` | Bcrypt hash for the admin password (preferred over plain). | `$2b$12$example...` | all |
| `ADMIN_PASSWORD` | Plain dev password (omit in prod). | `changeme123` | dev |
| `ADMIN_TOKEN` | Token used by maintenance and admin endpoints. | `admin123` | all |
| `ADMIN_ALLOWED_IPS` | CSV of IPs allowed to hit sensitive endpoints. | `127.0.0.1,::1` | all |
| `REDIS_HOST` | Optional Redis endpoint for login-attempt tracking. | `redis.internal` | prod |
| `REDIS_PORT` | Redis port (defaults to 6379). | `6379` | all |
| `SECURITY_WEBHOOK_URL` | Optional webhook for security alerts. | `https://hooks.slack.com/services/...` | prod |
| `CSRF_SECRET` | Static secret for CSRF cookie signing. | `base64:3b8c...` | prod |

### 2.2 Test-only overrides (backend/.env.test)
| Variable | Description | Example | Environments |
| --- | --- | --- | --- |
| `TEST_DATABASE_URL` | Postgres URL dedicated to tests/E2E. Overrides other `TEST_*`. | `postgres://moneyflow:moneyflow123@127.0.0.1:5543/mf_app_test` | test |
| `TEST_DATABASE_HOST` | Host fallback for tests. | `127.0.0.1` | test |
| `TEST_DATABASE_PORT` | Port fallback for tests. | `5543` (matches docker compose publish) | test |
| `TEST_DATABASE_USER` | Role used when preparing the test DB. | `moneyflow` | test |
| `TEST_DATABASE_PASSWORD` | Password for the test role. | `moneyflow123` | test |
| `TEST_DATABASE_NAME` | Target database name truncated/recreated before E2E runs. | `app_test` | test |
| `TEST_DATABASE_SSL` | `'true'` if the test DB enforces TLS. | `false` | test |
| `TEST_DB_LOGGING` | `'true'` to enable TypeORM SQL logs inside tests. | `false` | test |
| `TEST_DATABASE_ADMIN_HOST` | Admin connection host when the runner cannot drop DBs with the app user. | `127.0.0.1` | CI only |
| `TEST_DATABASE_ADMIN_PORT` | Admin port override. | `5432` | CI only |
| `TEST_DATABASE_ADMIN_USER` | Admin role for dropping/creating DBs. | `postgres` | CI only |
| `TEST_DATABASE_ADMIN_PASSWORD` | Admin password. | `postgres` | CI only |
| `TEST_DATABASE_ADMIN_DB` | Database to connect to while issuing admin commands. | `postgres` | CI only |
| `TEST_DATABASE_ADMIN_SSL` | TLS flag for admin connection. | `false` | CI only |
| `TYPEORM_DISABLE_METADATA_PATCH` | Set to `true` to skip metadata patching hacks when debugging TypeORM. | `false` | dev |
| `TYPEORM_FORCE_METADATA_PATCH` | Force the metadata patch (helpful in CI). | `false` | CI |

### 2.3 Auth, captcha, and rate limits
| Variable | Description | Example | Environments |
| --- | --- | --- | --- |
| `JWT_SECRET` | Access-token signing key (min 256-bit). | `base64encodedlongsecret...` | all |
| `JWT_EXPIRES_IN` | Access-token TTL (Nest format). | `15m` | all |
| `JWT_REFRESH_SECRET` | Refresh-token signing key. Must differ from `JWT_SECRET`. | `base64longrefresh...` | all |
| `JWT_REFRESH_EXPIRES_IN` | Refresh-token TTL. | `7d` | all |
| `EMAIL_VERIFICATION_REQUIRED` | Must stay `true`; backend rejects logins for unverified users (tests force this flag on). | `true` | all |
| `VERIFICATION_TOKEN_TTL_HOURS` | Hours before verification token expires. | `24` | all |
| `RESET_TOKEN_TTL_MINUTES` | Password-reset token TTL. | `60` | all |
| `RESEND_COOLDOWN_SECONDS` | Cooldown for resending verification/reset emails. | `60` | all |
| `PASSWORD_MIN_LENGTH` | Minimum password length enforced by backend. | `12` | all |
| `PASSWORD_MIN_SCORE` | zxcvbn score threshold (0–4). | `3` | all |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile server-side secret. | `0x0000000000000000000000000000000AA` | all |
| `TURNSTILE_DEV_BYPASS` | Allow captcha bypass for localhost. Never enable in prod. | `false` | dev |
| `TURNSTILE_LOG_VERBOSE` | Emit verbose verification logs. | `false` | dev |
| `LOGIN_FAILED_CAPTCHA_THRESHOLD` | Attempts before forcing captcha. | `5` | all |
| `SIGNUP_RATE_LIMIT` | Allowed signups per minute per IP. | `5` | all |
| `FORGOT_RATE_LIMIT` | Forgot-password rate limit. | `5` | all |
| `RESET_RATE_LIMIT` | Password-reset rate limit. | `5` | all |
| `VERIFY_RATE_LIMIT` | Verification endpoint rate limit. | `10` | all |
| `RESEND_RATE_LIMIT` | Resend verification rate limit. | `5` | all |
| `WEBHOOK_SNS_RATE_LIMIT` | SES webhook throttle. | `120` | prod |
| `SECURITY_ENABLE_CSP_NONCE` | `'true'` to add CSP script nonces. | `false` | prod |

### 2.4 Email/SES and SNS
| Variable | Description | Example | Environments |
| --- | --- | --- | --- |
| `MAIL_PROVIDER` | `ses`, `smtp`, or `log` (log = console only). | `ses` prod, `log` dev/test | all |
| `MAIL_FROM` | From header displayed to recipients. | `Comptario <noreply@comptario.com>` | all |
| `MAIL_REPLY_TO` | Optional reply-to header. | `support@comptario.com` | all |
| `AWS_REGION` / `SES_REGION` | Region for SES API calls. | `eu-central-1` | prod |
| `AWS_ACCESS_KEY_ID` | IAM user key for SES. | `AKIA...` | prod |
| `AWS_SECRET_ACCESS_KEY` | Corresponding secret. | `wJalrXUtnFEMI/K7MDENG/bPxRfiCY` | prod |
| `SES_CONFIGURATION_SET` | Optional SES configuration set name. | `prod-email` | prod |
| `DEFAULT_EMAIL_LOCALE` | Fallback locale for transactional emails. | `en` | all |
| `SNS_TOPIC_ARN_BOUNCE` | SNS topic for SES bounces. | `arn:aws:sns:...:bounce` | prod |
| `SNS_TOPIC_ARN_COMPLAINT` | SNS topic for complaints. | `arn:aws:sns:...:complaint` | prod |
| `SNS_WEBHOOK_SHARED_SECRET` | Shared secret to verify SNS webhooks (`ses-sns.controller`). | `super-shared-secret` | prod |

### 2.5 Billing (Stripe)
| Variable | Description | Example | Environments |
| --- | --- | --- | --- |
| `STRIPE_SECRET_KEY` | Server-side Stripe API key. | `sk_test_1234567890` | dev/test, hidden secret in prod |
| `STRIPE_PUBLISHABLE_KEY` | Public key used by frontend when applicable. | `pk_test_1234567890` | dev/prod |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `/webhooks/stripe`. | `whsec_1234567890` | dev/prod |
| `STRIPE_MODE` | `test` or `live`. | `test` | all |
| `PAYMENT_SUCCESS_PATH` | Relative frontend path to redirect after success. | `/payments/success` | all |
| `PAYMENT_CANCEL_PATH` | Relative frontend path for cancellation. | `/payments/cancel` | all |
| `WEBHOOK_STRIPE_RATE_LIMIT` | Stripe webhook throttle per minute. | `300` | prod |
| `STRIPE_PRICE_STARTER_MONTHLY` | Price ID for Starter monthly plan. | `price_...` | prod |
| `STRIPE_PRICE_STARTER_YEARLY` | Starter yearly price ID. | `price_...` | prod |
| `STRIPE_PRICE_PRO_MONTHLY` | Pro monthly (see `billing.service.ts`). | `price_1SRGBEK8pwobn5mA40QBZIBq` | prod |
| `STRIPE_PRICE_PRO_YEARLY` | Pro yearly. | `price_1SRGBbK8pwobn5mAYBkauzD5` | prod |
| `STRIPE_PRICE_BUSINESS_MONTHLY` | Business monthly. | `price_1SThpzK8pwobn5mAIBKlMtQa` | prod |
| `STRIPE_PRICE_BUSINESS_YEARLY` | Business yearly. | `price_1SThqeK8pwobn5mAMU0gO2sT` | prod |
| `STRIPE_PRICE_ADDON_USER_MONTHLY` | Add-on seat monthly. | `price_1SRGF0K8pwobn5mALeu8wsgD` | prod |
| `STRIPE_PRICE_ADDON_USER_YEARLY` | Add-on seat yearly. | `price_1SRGFpK8pwobn5mAlnF18S2a` | prod |

### 2.6 Frontend (Vite) environment
| Variable | Description | Example | Environments |
| --- | --- | --- | --- |
| `VITE_API_URL` | Base URL the SPA uses for API calls. | `http://localhost:3001` dev, `https://api.example.com` prod |
| `VITE_TURNSTILE_SITE_KEY` | Public Turnstile site key. | `0x4AAAAAAA...` | all |
| `VITE_CAPTCHA_DEV_BYPASS` | `'true'` to skip captcha locally (never prod). | `false` | dev |
| `VITE_DEMO_EMAIL` / `VITE_DEMO_PASSWORD` | Demo credentials shown in the UI. | `demo@moneyflow.com` / `demo123` | dev |
| `VITE_LOGIN_URL` | Login path relative to SPA. | `/login` | all |
| `VITE_APP_NAME` / `VITE_APP_VERSION` | Displayed branding. | `Comptario` / `2.0.0` | all |
| `VITE_ENABLE_ENCRYPTION` / `VITE_USE_SECURE_CRYPTO` | Feature flags for client crypto helpers. | `true` | all |
| `VITE_ENABLE_CSP_REPORTING` | Toggle CSP reporting UI. | `true` | prod |
| `VITE_ENABLE_RATE_LIMITING` | Toggles rate-limit banners. | `true` | all |
| `VITE_EMAIL_VERIFICATION_REQUIRED` | Mirrors backend requirement to drive UX. | `true` | prod |
| `VITE_DEBUG_MODE` / `VITE_LOG_LEVEL` | Client logging configuration. | `false` / `error` | dev |

### Example env files
These snippets show how to wire everything for PostgreSQL everywhere. Adjust secrets before committing.

#### backend/.env (development)
```dotenv
NODE_ENV=development
PORT=3001
DATABASE_URL=postgres://moneyflow:moneyflow123@127.0.0.1:5543/moneyflow_dev
DATABASE_SSL=false
FRONTEND_URL=http://localhost:5174
APP_PUBLIC_URL=http://localhost:5174
CORS_ORIGINS=http://localhost:5174
CORS_CREDENTIALS=true

JWT_SECRET=dev_access_secret_min_256_bits________________________________
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=dev_refresh_secret_even_longer________________________
JWT_REFRESH_EXPIRES_IN=7d
EMAIL_VERIFICATION_REQUIRED=true
VERIFICATION_TOKEN_TTL_HOURS=24
RESET_TOKEN_TTL_MINUTES=60
RESEND_COOLDOWN_SECONDS=60
PASSWORD_MIN_LENGTH=12
PASSWORD_MIN_SCORE=3

TURNSTILE_SECRET_KEY=0x0000000000000000000000000000000AA
TURNSTILE_DEV_BYPASS=true
LOGIN_FAILED_CAPTCHA_THRESHOLD=5

MAIL_PROVIDER=log
MAIL_FROM=Comptario <noreply@comptario.com>
MAIL_REPLY_TO=support@comptario.com
AWS_REGION=eu-central-1

ADMIN_USERNAME=owner
ADMIN_PASSWORD=owner123
ADMIN_PASSWORD_HASH=$2b$10$exampleHashedValueHere...............
ADMIN_ALLOWED_IPS=127.0.0.1,::1
ADMIN_TOKEN=admin123

STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_PUBLISHABLE_KEY=pk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder
STRIPE_MODE=test
STRIPE_PRICE_PRO_MONTHLY=price_1SRGBEK8pwobn5mA40QBZIBq
STRIPE_PRICE_PRO_YEARLY=price_1SRGBbK8pwobn5mAYBkauzD5

CSRF_SECRET=dev_csrf_secret_please_replace
SECURITY_ENABLE_CSP_NONCE=false

REDIS_HOST=
REDIS_PORT=6379
SECURITY_WEBHOOK_URL=
```

#### backend/.env.test
```dotenv
NODE_ENV=test
TEST_DATABASE_URL=postgres://moneyflow:moneyflow123@127.0.0.1:5543/app_test
TEST_DATABASE_SSL=false
TEST_DB_LOGGING=false
TEST_DATABASE_ADMIN_USER=postgres
TEST_DATABASE_ADMIN_PASSWORD=postgres
TEST_DATABASE_ADMIN_DB=postgres
MAIL_PROVIDER=log
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
TURNSTILE_SECRET_KEY=test
JWT_SECRET=test_access_secret________________________________________________
JWT_REFRESH_SECRET=test_refresh_secret_______________________________________
STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_test_placeholder
```

#### backend/.env.production
```dotenv
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://moneyflow_prod:CHANGE_ME_STRONG@postgres:5432/moneyflow_prod
DATABASE_SSL=true
FRONTEND_URL=https://app.example.com
APP_PUBLIC_URL=https://app.example.com
CORS_ORIGINS=https://app.example.com
CORS_CREDENTIALS=true

JWT_SECRET=base64url_super_secure_value_here_________________________________
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=another_even_longer_random_secret_________________________
JWT_REFRESH_EXPIRES_IN=7d
EMAIL_VERIFICATION_REQUIRED=true

TURNSTILE_SECRET_KEY=0xPRODSECRET
TURNSTILE_DEV_BYPASS=false

MAIL_PROVIDER=mailersend
MAIL_FROM=Comptario <noreply@comptario.com>
MAIL_REPLY_TO=success@comptario.com
MAILERSEND_API_KEY=prod_mailersend_token
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=prodSecretValue
SES_CONFIGURATION_SET=production

ADMIN_USERNAME=owner
ADMIN_PASSWORD_HASH=$2b$12$your_real_hash_here
ADMIN_ALLOWED_IPS=192.0.2.10,198.51.100.4
ADMIN_TOKEN=only-share-with-root-team

STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_live_xxx
STRIPE_MODE=live
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_YEARLY=price_xxx
STRIPE_PRICE_STARTER_MONTHLY=price_xxx
STRIPE_PRICE_STARTER_YEARLY=price_xxx
STRIPE_PRICE_BUSINESS_MONTHLY=price_xxx
STRIPE_PRICE_BUSINESS_YEARLY=price_xxx
STRIPE_PRICE_ADDON_USER_MONTHLY=price_xxx
STRIPE_PRICE_ADDON_USER_YEARLY=price_xxx

CSRF_SECRET=prod_csrf_secret_base64
SECURITY_ENABLE_CSP_NONCE=true
SECURITY_WEBHOOK_URL=https://hooks.slack.com/services/...
```

## 3. Database & migrations (TypeORM)

1. **Configuration files:**
   - CLI commands use `backend/src/config/typeorm.config.ts`. This file reads `DATABASE_*` variables, so export them (or `DATABASE_URL`) before running migrations.
   - The Nest runtime bootstraps TypeORM in `backend/src/app.module.ts`. By exporting Postgres env vars you disable the SQLite fallback and keep dev/test/prod aligned.
2. **Local PostgreSQL:** run `docker compose up -d postgres` from the repo root to start the prepared Postgres 16 container (host port `5543`). Update your `.env`/`.env.test` to point at `127.0.0.1:5543`.
3. **Running migrations locally:**
   ```bash
   cd backend
   npm install
   npm run migration:generate --name AddNewTable        # creates src/migrations/<timestamp>-AddNewTable.ts
   npm run migration:run                                # applies pending migrations
   npm run migration:revert                             # rolls back the last migration
   ```
   Each command uses the shared TypeORM CLI wrapper (`npm run typeorm -- ...`). Ensure `NODE_ENV` is `development` and PostgreSQL env vars point to your local instance first.
4. **Test/E2E database wiring:** `backend/test/run-e2e.sh` loads `.env.test`, sets all `TEST_DATABASE_*` variables, exports them as the regular `DATABASE_*` env vars for compatibility, and invokes `scripts/prepare-e2e.ts`. That script:
   - Connects to the admin database (using `TEST_DATABASE_ADMIN_*` when provided) to drop & recreate `TEST_DATABASE_NAME`.
   - Ensures the `uuid-ossp` extension exists.
   - Calls `dataSource.synchronize()` followed by `MigrationExecutor` to apply every file in `src/migrations`.
   - Seeds initial data through `SeedService` (`backend/src/database/seed.service.ts`). The seeder skips inserts when it detects existing rows, so it is safe to run repeatedly.
5. **Seeding scripts:** For richer demo data run `npm run seed:demo` after migrations. This executes `src/seeds/demo-data.seed.ts` via `ts-node` and expects the same PostgreSQL env vars.
6. **Production migrations:** After pushing images to the VPS, run `docker compose run --rm backend npm run migration:run` to apply schema changes before flipping traffic. This uses the env file attached to the backend service.

## 4. Test commands
| Command | Location | Purpose | When to run |
| --- | --- | --- | --- |
| `npm run lint` | repo root | Runs ESLint against the Vite/React frontend (`eslint.config.js`). | Local pre-commit and CI (add to future frontend workflow). |
| `npm run build` | repo root | Executes `vite build`, which also triggers TypeScript checks through `tsconfig.app.json`. | Before publishing frontend assets or bundling inside Docker. |
| `npm run lint` | `backend/` | Runs ESLint on `src`, `test`, and supporting files using `eslint.config.mjs`. | Local dev and CI to enforce NestJS style and catch obvious issues. |
| `npm run build` | `backend/` | Invokes `nest build` (tsc) to emit `dist/`. Serves as the backend type-checking step. | Required during CI, before building Docker images, or verifying production configs. |
| `npm run test` | `backend/` | Plain Jest run for unit/targeted integration specs (ignores feature folders that lack coverage). Requires a PostgreSQL instance when entities touch the DB. | Local TDD and CI smoke tests. |
| `npm run test:watch` | `backend/` | Jest watch mode for quicker local feedback. | Local only. |
| `npm run test:cov` | `backend/` | Jest with coverage reporting. | Local before release / optional CI gate. |
| `npm run test:e2e` | `backend/` | Executes `test/run-e2e.sh`, preparing a dedicated PostgreSQL database, running migrations + seeding, then executing Jest E2E specs (`test/jest-e2e.json`). | Local validation before merges and in `.github/workflows/backend-e2e.yml`. |

> **Note:** The frontend currently has no `test` script in `package.json`. Add `vitest` or similar when UI test coverage becomes a requirement; until then only lint + build gates exist.

## 5. Production deployment on Hostinger VPS (Ubuntu + Docker)

1. **Prepare the VPS (Ubuntu 24.04):**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y ca-certificates curl gnupg
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
   sudo apt update
   sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   sudo usermod -aG docker $USER
   # log out/in once so the docker group takes effect
   ```
2. **Clone and structure the project:**
   ```bash
   sudo mkdir -p /opt/muhasabev2 && sudo chown $USER:$USER /opt/muhasabev2
   cd /opt/muhasabev2
   git clone https://github.com/MustafaBasol/Muhasabev2.git .
   cp backend/.env.production.example backend/.env.production   # fill with real secrets
   ```
3. **Compose file for the VPS:** either extend the existing Hostinger `docker-compose.yml` that already runs n8n or create a dedicated file such as `infra/hostinger-compose.yml`. Ensure you reuse the same Docker network as n8n (or expose non-conflicting ports). Example:
   ```yaml
   version: "3.9"
   services:
     postgres:
       image: postgres:16-alpine
       restart: unless-stopped
       environment:
         POSTGRES_DB: moneyflow_prod
         POSTGRES_USER: moneyflow_prod
         POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-please_change}
       volumes:
         - ./data/postgres:/var/lib/postgresql/data
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U moneyflow_prod -d moneyflow_prod"]
         interval: 10s
         timeout: 5s
         retries: 10
       networks:
         - shared

     backend:
       build:
         context: ./backend
         dockerfile: Dockerfile
       env_file:
         - ./backend/.env.production
       environment:
         DATABASE_HOST: postgres
         DATABASE_PORT: 5432
         DATABASE_USER: moneyflow_prod
         DATABASE_PASSWORD: ${POSTGRES_PASSWORD:-please_change}
         DATABASE_NAME: moneyflow_prod
       depends_on:
         postgres:
           condition: service_healthy
       ports:
         - "3000:3000"   # keep free if n8n already uses 3000
       restart: unless-stopped
       networks:
         - shared

   networks:
     shared:
       external: false   # set to true and specify the existing n8n network name if needed
   ```
   - If n8n already uses an external network (e.g., `n8n_net`), replace the `networks` block with `external: true` and `name: n8n_net` to co-host services safely.
   - Frontend static files can be served by a different host (e.g., Vite build uploaded to object storage) or by an additional Nginx container that serves `dist/`. Reference `ecosystem.frontend.config.cjs` if you already deploy via PM2.
4. **Environment variables in Compose:** prefer referencing `backend/.env.production` via `env_file` (as shown). For PostgreSQL secrets you can either duplicate them inside `.env.production` or use an `.env` file adjacent to the compose file so that `${POSTGRES_PASSWORD}` resolves at runtime (`docker compose --env-file infra/.env.hostinger up -d`).
5. **Build and start services:**
   ```bash
   docker compose -f infra/hostinger-compose.yml pull         # if using prebuilt images
   docker compose -f infra/hostinger-compose.yml build backend
   docker compose -f infra/hostinger-compose.yml up -d postgres
   docker compose -f infra/hostinger-compose.yml up -d backend
   ```
6. **Run database migrations inside the container:**
   ```bash
   docker compose -f infra/hostinger-compose.yml run --rm backend npm run migration:run
   docker compose -f infra/hostinger-compose.yml run --rm backend npm run seed:demo   # optional demo data
   ```
7. **Expose the backend:**
   - Preferred: terminate TLS with Nginx/Traefik already running for n8n and proxy traffic to `backend:3000`. Configure A/AAAA records for `api.example.com` pointing to the VPS and set `CORS_ORIGINS=https://app.example.com`.
   - Minimal: keep `ports: - "3000:3000"` and open the port via `ufw allow 3000/tcp`, then map your Hostinger DNS directly. Only do this temporarily; add TLS via reverse proxy soon after.
8. **First deploy checklist**
   - ✅ Build/pull Docker images for backend (and optional frontend).
   - ✅ `docker compose up -d postgres backend` with persistent volumes.
   - ✅ `docker compose run --rm backend npm run migration:run`.
   - ✅ Hit `https://api.example.com/health` (or `http://SERVER_IP:3000/health`) and confirm the reported dependencies (database/mail/frontend URL) are green.
   - ✅ Complete a full signup + email verification + login flow using the production domain and Turnstile keys.

## 6. CI / GitHub Actions notes
- `.github/workflows/backend-e2e.yml` runs on every push/PR affecting `backend/**`. It provisions `postgres:16-alpine` as a service, installs backend dependencies with Node 20, and executes `npm run test:e2e` with all `DATABASE_*` and `TEST_DATABASE_*` env vars pointing at the service (`localhost:5432`). Secrets (`JWT_SECRET`, `STRIPE_SECRET_KEY`) are pulled from the repository’s GitHub secrets.
- When adding more CI jobs (lint/build/frontend tests), replicate the Postgres service stanza so that Jest can prepare databases exactly like local runs. The same approach works for Codespaces/Dev Containers—export `DATABASE_HOST=localhost` and `DATABASE_PORT` to point at whichever Postgres instance you start.
- Ensure GitHub-hosted runners never fall back to SQLite by keeping `DATABASE_HOST` and `DATABASE_NAME` defined inside workflow `env:` blocks. This mirrors production and prevents column mismatch regressions.

With these steps, local development, PostgreSQL-backed automated testing, and Hostinger production deployment all follow the same contract—one set of migrations, one database engine, and a single source of environment truth.
