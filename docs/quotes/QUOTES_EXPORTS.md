# Quotes — Export & Retention

## Exports
- CSV columns:
  - quoteNumber, version, date, validUntil, status, customerName, currency, grandTotal, baseCurrency, baseGrandTotal, exchangeRate, language, project, sentAt, viewedAt, decidedAt, acceptanceName, acceptanceIP
- PDF bundle export: selected quotes as merged zip with filenames `Q-<number>-v<version>.pdf`

## Amount & Localization in CSV
- Numbers exported as plain values (dot decimal). Separate localized exports may use locale formatting.
- Dates exported in ISO 8601.

## Data Retention
- Quotes and PDFs retained per organization policy (e.g., 10 years) unless deleted per legal requirements.
- Audit logs retained alongside quotes.
