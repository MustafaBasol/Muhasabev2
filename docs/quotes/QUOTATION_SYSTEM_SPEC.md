# Universal Quotation (Offer) System — Product Spec

This document defines the end-to-end quoting experience for EN/FR/DE/TR markets across sectors (services, construction, retail, SaaS). Focus is on workflows, outputs, and acceptance.

## Objectives
- Staff can create, send, and track professional quotes in multiple languages/currencies.
- Customers can view via secure link, select optional items, accept/decline with e‑signature.
- Accepted quotes become read-only and convertible to Invoice/Order later.

## Core Concepts
- Quote: Commercial offer to a Customer, optional Project/Job.
- Line Items:
  - Product lines (from catalog) or custom free‑text lines
  - Quantity, unit, unit price, per-line discount, tax
  - Optional items (include/exclude), Bundles/Kits, Recurring items (monthly/yearly)
- Notes & Terms: Notes, T&C, Payment terms, Delivery terms, Validity date, Warranty/Service info
- Attachments: Files/images (drawings, photos, specs)
- Pricing & Taxes: Multi-currency; tax models per country (VAT/GST/withholding), tax-inclusive/exclusive lines; global discount, shipping/handling, deposits/advances; auto totals including amount‑in‑words
- Localization: UI, PDF, and email labels fully localized EN/FR/DE/TR; region formats; local tax IDs on PDF (EIN, VATIN, SIRET, Vergi No)
- Templates: Template library per sector/country (minimal, detailed, line-by-line, lump-sum)
- Approvals & Customer Journey: Public link; Accept, Decline, Ask a question; e‑signature (typed name + checkbox + timestamp) with IP/device; partial acceptance for optional items
- Communication: Branded PDF, email with personalized message + PDF + public link; reminders; Resend/Share
- Lifecycle: Statuses with timestamps; versioning with diffs; convert to Invoice/Order shell; audit log
- Usability: Saved views/filters, search, roles/permissions, keyboard/mobile friendly
- Compliance: Country footers, legal blocks, privacy note, data export/retention

## Statuses & Lifecycle
- Draft → Sent → Viewed → Accepted/Declined → Expired
- Timestamps captured on each transition (e.g., sentAt, viewedAt, decidedAt, expiredAt)
- After Accepted: Read‑only (except internal notes); totals locked.
- Expiry: Quote auto-moves to Expired after validity date; reminders configurable.

## Numbering
- Pattern configurable per company/country, e.g., `Q-{YYYY}-{####}` with per‑year sequence reset.
- Uniqueness per organization and per numbering context (supports multi‑tenant).

## Pricing & Taxes Rules
- Server-calculated totals; client cannot override.
- Line-level: qty × unit price − line discount; tax inclusive/exclusive per line.
- Global: overall discount (amount or %), shipping/handling, deposit/advance (shown as due later), withholding when relevant.
- Tax models per country:
  - US: sales tax by jurisdiction; optionally tax on shipping
  - FR/DE: VAT; SIRET/Handelsregisternummer presentation
  - TR: KDV, Tevkifat (withholding) when applicable
- Multi-currency: store transaction currency, base currency amounts, and exchange rate used; display both when relevant.
- Optional items: selections affect accepted totals; recorded along with acceptance.

## Line Types
- Standard line
- Optional line (customer-toggleable on public page)
- Bundle/Kit (display as group with subtotal)
- Recurring line (monthly, quarterly, yearly; flag for conversion to subscription/invoice later)

## Customer Public Page (Read‑only except actions)
- Header: company logo, quote number/date/validity, customer details.
- Items table: optional toggles (if enabled), bundle display, recurring badges.
- Totals: localized currency + amount‑in‑words; info blocks (terms, payment/delivery, warranty).
- Actions: Accept (typed name + checkbox consent), Decline, Ask a question; capture IP, timestamp, name/title.
- After acceptance: show confirmation, lock toggles and totals.

## PDF Output
- Clean, branded; localized labels; table (Item | Qty | Unit | Unit Price | Discount | Tax | Line Total)
- Totals section: subtotal, discounts, taxes, shipping/handling, deposit, grand total; amount‑in‑words in selected language
- Company identity (EIN/VATIN/SIRET/Vergi No) and bank info (IBAN/ABA, SWIFT), page numbers, signatures area
- Footer legal blocks configurable per country/sector (withdrawal rights, dispute venue, mediation)

## Email Send Flow
- Compose: subject/body per language with placeholders; choose recipients from Customer contacts; attach PDF; include public link
- Scheduling: send now; automatic reminders pre/post validity; quick Resend/Share

## Versioning
- “Revise quote” creates new version (v2, v3…), preserves history and diffs (lines, totals, terms). Public link shows latest, with link to previous versions (read-only).

## Convert to Invoice/Order
- From Accepted: create shell Invoice/Order with mapped lines, taxes, currency, customer, and reference to quote; do not implement full billing here.

## Audit Log
- Events: created, edited, sent (to who), viewed (when/IP), accepted/declined (who/IP), expired, revised, converted.

## Permissions
- Roles: Creator (draft), Approver (can send/approve/discount), Viewer (read-only), Admin (manage templates/numbering/legal blocks)
- Enforce who can send, apply discounts > X%, and approve revisions.

## Saved Views & Search
- Views: “Expiring in 7 days”, “Awaiting response”, “Viewed but not accepted”, “Declined last 30 days”
- Search: quote number, customer, status, amount, date, project, email recipient

## Non-Functional
- Pagination on list; accessible components (labels, contrast, focus); reliable email; secure public links (unguessable), rate-limited public endpoints; robust error handling with clear toasts and retry for email/PDF.

## Acceptance (Summary)
- See separate flows and criteria in QUOTE_USER_FLOWS_AND_ACCEPTANCE.md
