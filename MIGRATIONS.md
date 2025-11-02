# Database Migrations and Email Features

This repo includes TypeORM migrations for new email-based features:

- Email verification and password reset fields on users
- Organization invitations (with email delivery) and membership tables

## What changed (Nov 2025)

- A new migration was added: `1762000000000-AddEmailVerificationAndReset.ts`
- Organization invite emails now link to a hash-based route so they work on static hosting: `/#join?token=...`
- Resending an invite extends expiry and sends the email again.

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
