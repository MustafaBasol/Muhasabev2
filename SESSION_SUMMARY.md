# Current Lint Cleanup Status (Nov 21, 2025)

## Completed Work
- ESLint now relies solely on the flat-config `ignores`; the legacy `.eslintignore` file was removed to silence the v9 warning spam.
- `npx eslint --max-warnings=0 .` was re-run: it now surfaces ~2.2k warnings (no errors). Hotspots are `JoinOrganizationPage.tsx`, `ProductList.tsx`, `ReportsPage.tsx`, `SettingsPage.tsx`, and other large modals with pervasive `any`, `no-empty`, console logging, and missing hook deps.
- `src/components/InvoiceViewModal.tsx` was fully typed (items, audit metadata, locale helpers) and all `any`/`no-empty` warnings eliminated; `src/components/JoinOrganizationPage.tsx` now reuses typed error helpers + safe side-effect wrappers and also lint-clean.
- Backend fixes: `backend/src/auth/login-attempts.service.ts` uses a straight `ioredis` import (resolving the RedisConstructor type error) and `backend/src/webhooks/ses-sns.controller.ts` gained Bounce/Complaint type guards (so `.bounce`/`.complaint` access is safe). With Postgres/Redis started via `backend/docker-compose up -d`, `npm run start:dev` now passes the health check.

## Remaining Follow-Ups
1. Burn down the remaining ESLint warnings (next targets: `ProductList.tsx`, `ReportsPage.tsx`, `SettingsPage.tsx`, `InvoiceViewModal`-adjacent modals, etc.).
2. After each cleanup batch, rerun `npx eslint --max-warnings=0 .` to ensure the warning count keeps dropping.
3. Keep `backend/docker-compose` services running (or extend `start-dev.sh` to auto-launch them) so `npm run start:dev` health checks keep succeeding without manual prep.

## Security Hardening (Nov 21, 2025)
- Admin auth now flows through `src/utils/adminAuthStorage.ts`, which stores tokens in `sessionStorage`, mirrors them in-memory when storage is blocked (SSR/private-mode), and purges stale `localStorage` copies to tighten exposure.
- `src/api/client.ts` adopts typed header helpers, safer payload parsing, and better logging so CSRF propagation, maintenance notices, and admin-token expiry are handled without `any` casting or silent catch blocks.
- `src/components/QuoteViewModal.tsx` and `PublicQuotePage.tsx` render scope-of-work HTML through `sanitizeRteHtml`; run `rio:grep dangerouslySetInnerHTML` to keep future additions honest.
- Cloudflare Turnstile bypass now requires `VITE_CAPTCHA_DEV_BYPASS=1` (or legacy Codespaces fallback when API keys are genuinely absent), preventing accidental production skip paths.

_Reopen this file in the new chat to regain context immediately._
