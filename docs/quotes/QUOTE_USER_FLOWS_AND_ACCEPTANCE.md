# Quote User Flows & Acceptance Criteria

This document describes the workflows and testable criteria for staff and customer experiences in EN/FR/DE/TR markets.

## Flow A: Staff creates and sends a quote
1) Create new quote for an existing Customer (and optional Project/Job)
2) Add items: select from Products and/or add custom lines; set qty, unit, unit price, per-line discount, tax
3) Mark some items as Optional; create Bundles; mark recurring items
4) Add Notes, Terms & Conditions, Payment and Delivery terms, Validity date, Warranty/Service info
5) Attach files/images
6) Set currency and tax mode (inclusive/exclusive); choose country tax profile; add global discount, shipping/handling, deposit
7) Review totals (subtotal, discounts, taxes, shipping, grand total, amount‑in‑words)
8) Choose template (minimal/detailed/sector-specific) and language
9) Click Send: compose email (localized), pick recipients from customer contacts; include PDF and public link; send

Acceptance:
- Can’t send if required fields missing (customer, at least one line, validity date, language)
- Totals computed server-side; client can’t override
- PDF localized and includes company/bank details
- Email delivered to selected recipients and logged in audit trail
- Status transitions: Draft → Sent with sentAt timestamp

## Flow B: Customer reviews and accepts/declines
1) Customer opens secure public link (read-only view)
2) Sees quote details, items (optional toggles if enabled), totals and amount‑in‑words
3) Can Accept: enters typed name, title (optional), checks acceptance checkbox, submits
4) System captures IP, timestamp, signer name/title; locks totals; status becomes Accepted
5) Alternatively, Decline with reason; status becomes Declined
6) Optional: Ask a question to notify staff (stores message in timeline)

Acceptance:
- Public link loads without auth via unguessable token and rate-limit
- Optional item selections are persisted at acceptance and reflected in final totals
- After acceptance, quote is read-only; any further change requires “Revise” creating a new version
- Audit log records view, acceptance/decline with IP and timestamp

## Flow C: Reminders and Expiry
- System can schedule reminders: X days before validity date and Y days after sent
- On validity lapse, status becomes Expired; reminders stop

Acceptance:
- Reminder events appear in timeline and email log
- Expired quotes show clearly as expired and cannot be accepted unless revised to a new version with a new validity date

## Flow D: Revise a sent quote
1) From a Sent/Viewed/Declined/Expired quote, click Revise
2) System creates new version (v+1) copying content
3) Edit lines/terms/dates; send again

Acceptance:
- Previous version remains viewable (read-only) with version tag
- Diffs show changes (lines added/removed/edited, totals delta)
- Numbering can include version suffix or maintain same number with version index

## Flow E: Convert to Invoice/Order (shell)
1) From an Accepted quote, click Convert → Invoice or Order
2) System creates a shell record with mapping: customer, currency, lines, taxes, totals, quote reference

Acceptance:
- Conversion recorded in audit log
- Resulting shell record links back to the source quote

## Saved Views & Dashboard
- Widgets: total quotes this month, acceptance rate, expiring soon
- Filters: status, validity window, customer, amount range, currency, language, date

Acceptance:
- Filters persist per user as saved views
- Widgets reflect filtered organization-scoped metrics

## Roles & Permissions
- Only permitted roles can send, apply high discounts, or approve revisions
- Attempts by unauthorized users are blocked with clear messaging

## Error Handling
- Email/PDF generation failures show clear toasts and allow retry
- Public page handles expired/invalid link gracefully
