# Quotes — Statuses, Transitions & Quick Actions

Türkçe özet: Bu doküman teklif (quote) durumlarını, geçiş kurallarını ve UI’deki hızlı aksiyonları özetler.

## Statuses

Supported statuses (UI + i18n):
- draft
- sent
- viewed
- accepted
- declined
- expired

Terminal statuses: accepted, declined, expired.

## Transitions

User-initiated:
- draft → sent (Send)
- sent/viewed → accepted (Accept)
- sent/viewed → declined (Decline)

Automatic:
- sent → viewed when the customer opens the public link (future integration; placeholder in UI)
- draft/sent/viewed → expired when validUntil < today (midnight) and status is not accepted/declined

Revision flow:
- expired/declined/accepted → draft (Revise) creates a new version (v+1) with a fresh validity window; prior version state is superseded in UI
- Effects:
  - status set to draft
  - issueDate reset to today, validUntil = today + 30 days
  - version counter increments (displayed as v{{n}})
  - UI: Revise button shown only for terminal statuses in the view modal; version label shown in view header and list next to quote number when > v1

## Validity window

- Field: validUntil (YYYY-MM-DD)
- Default: issueDate + 30 days on create
- UI: 
  - Shows “expires in X days” if future; 
  - Shows “expired on <date>” if past;
  - Adds an Expired badge in view if past and status not terminal.
- Automation: On load, quotes with validUntil < today are marked expired unless already accepted/declined/expired.

## Quick actions in internal view

Shown in `QuoteViewModal` (stub implementations wired):
- Send (only when draft)
- Accept / Decline (when sent or viewed)
- Download PDF (stub)
- Copy public link (copies `/public/quote/{id}` to clipboard)
- Resend email (stub; when sent or viewed)

Disable/visibility rules:
- accepted/declined/expired: status-changing buttons hidden. Future: show Revise.
- expired: cannot Accept/Decline without Revision (business rule; UI currently hides the buttons when terminal).

## i18n keys added

Under `quotes.*` across EN/TR/FR/DE:
- validUntil
- expiresIn
- expiredOn
- actions.downloadPdf
- actions.copyLink
- actions.resendEmail
- actions.revise
- version

## Acceptance criteria

- Creating a quote auto-sets validUntil = issueDate + 30 days (editable in create/edit forms).
- Viewing a quote shows issue date and validUntil; shows relative expiry text.
- Past-due quotes auto-mark as expired unless accepted/declined.
- Quick actions update status and reflect immediately in the list and the view modal header.
- Translations available for EN/TR/FR/DE for all labels used in the view/edit/create flows.
- Revision:
  - Revise is available for accepted/declined/expired quotes in the view modal.
  - Clicking Revise resets status to draft, re-dates issue/validity, and increments version.
  - Version is visible as v{{n}} in the view header and in the list next to the quote number when n > 1.

## Notes and next steps

- “Viewed” should be set via public page tracking; currently planned.
- “Revise” flow should create a new version with a fresh validity window and link to prior versions.
- PDF generation and email delivery to be integrated; stubs exist in UI.
