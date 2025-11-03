# Customer Public Quote Page — UX & Security

Read‑only presentation of the quote with actions Accept, Decline, Ask a question. Accessible via secure, unguessable link.

## Page Structure
- Header: company logo/name, quote number/date, validity, customer block
- Items: table with optional toggles (if allowed), bundles, recurring labels
- Totals: subtotal, discounts, taxes, shipping, deposit, grand total; amount‑in‑words
- Actions: Accept, Decline, Ask a question

## Accept Flow (E‑Signature)
- Fields: typed full name (required), title (optional), checkbox: “I accept the quote and agree to the terms” (required)
- Submit captures: signer name/title, timestamp, IP, user agent fingerprint, selected optional items
- Result: show confirmation; lock totals; provide download PDF link

## Decline Flow
- Required reason (short text); notify staff; status becomes Declined

## Ask a Question
- Text field to send a message; adds to quote timeline; email notification to staff

## Security
- Public link: tokenized, unguessable; rate-limited endpoints; no indexing
- Read-only except actions; validation for expired/invalid token
- CORS same-origin for dynamic assets; no sensitive internal identifiers in HTML

## Accessibility & Mobile
- Focus states, keyboard navigation for toggles/actions; mobile responsive tables
