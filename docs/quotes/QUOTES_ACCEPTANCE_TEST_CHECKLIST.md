# Quotes — Acceptance Test Checklist

Use this as a QA guide. Cover EN/FR/DE/TR and key countries (US/FR/DE/TR) with different tax modes and currencies.

## A. Creation and Sending
- [ ] Can create a quote for existing customer (+ optional project/job)
- [ ] Add product and custom lines; set qty, unit, unit price, per‑line discount
- [ ] Set tax per line; toggle tax inclusive vs exclusive
- [ ] Mark lines as optional/bundle/recurring
- [ ] Add notes, T&C, payment/delivery terms, warranty; attach files
- [ ] Set currency and (if needed) exchange rate; verify base currency storage
- [ ] Apply global discount (amount and %), shipping/handling, deposit/advance
- [ ] Totals computed server‑side; client cannot override
- [ ] Choose template + language; preview PDF
- [ ] Send email: choose recipients from customer; email + public link logged in audit
- [ ] Status moves Draft → Sent; sentAt recorded

## B. Public Page (View / Optional / Accept / Decline)
- [ ] Secure public link opens without auth; unguessable; rate‑limited (simulate multiple hits)
- [ ] Page localized (labels, dates, currency format)
- [ ] Optional items toggles visible (if allowed) and affect displayed totals
- [ ] Accept flow requires typed name + consent checkbox; captures name, title, timestamp, IP, user agent
- [ ] Decline flow captures reason; notifies staff; status Declined
- [ ] After acceptance: view is read‑only; toggles locked; Accepted status with acceptedAt

## C. Reminders & Expiry
- [ ] Pre‑validity reminder sent X days before; visible in timeline
- [ ] Post‑sent nudge sent Y days after, if not viewed/accepted
- [ ] After validity date, status becomes Expired; cannot accept without revision

## D. Revision & Versioning
- [ ] “Revise” creates v+1; history preserves previous version
- [ ] Diffs show added/removed/changed lines and totals delta
- [ ] New version has new validity date; public link points to latest; previous remains viewable (read‑only)

## E. Conversion (Shell)
- [ ] From Accepted, create Invoice/Order shell; mapping of customer, currency, lines, taxes, totals, reference
- [ ] Conversion recorded in audit log

## F. Localization (EN/FR/DE/TR)
- [ ] UI labels, PDFs, emails localized correctly
- [ ] Date/number/currency formats per locale
- [ ] Amount‑in‑words correct for each language

## G. Taxes and Countries
- [ ] US: sales tax on lines; (optional) shipping taxability rule
- [ ] FR/DE: VAT rate and presentation; SIRET/HRB and VATIN displayed on PDF
- [ ] TR: KDV and (if applicable) tevkifat; Vergi No on PDF

## H. Roles & Permissions
- [ ] Only permitted roles can send/approve/apply high discounts
- [ ] Unauthorized actions are blocked with clear messaging

## I. Exports & Search
- [ ] CSV export contains fields (number, version, dates, status, customer, amounts, exchange rate, acceptance info)
- [ ] PDF bundle export names as `Q-<number>-v<version>.pdf`
- [ ] Search and filters work (expiring soon, awaiting response, viewed, declined 30d)

## J. Error Handling & Accessibility
- [ ] Email/PDF failures show toasts and allow retry
- [ ] Public link invalid/expired states handled gracefully
- [ ] Keyboard navigation and focus states accessible on public page and internal UI
