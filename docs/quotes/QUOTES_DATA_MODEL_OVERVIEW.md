# Quotes Data Model — Conceptual Overview (Non-technical)

Entities and relationships described in business terms. Not a schema.

## Entities
- Quote
  - number, date, validityUntil, status, language, currency, exchangeRate, baseCurrencyAmounts
  - customerRef, projectRef
  - notes, terms, paymentTerms, deliveryTerms, warrantyInfo
  - globalDiscount (amount/%), shippingHandling, deposit
  - templateId
  - attachments[] (filename, type, size)
  - totals: subtotal, discountTotal, taxBreakdown[], shipping, grandTotal, amountInWords
  - version: index, previousVersionRef, diffSummary
  - publicLink: token, createdAt, lastAccessedAt
  - auditLog[]
- QuoteLine
  - type: standard | optional | bundle | recurring
  - productRef (optional), description, unit, quantity, unitPrice, lineDiscount, tax (rate/category), taxMode (inclusive/exclusive)
  - groupId (for bundle grouping), recurrence (monthly/quarterly/yearly)
  - lineTotals: net, tax, gross
- Customer
  - existing record reuse (address, contacts, tax IDs)
- Company
  - profile, logo, bank accounts (IBAN/ABA, SWIFT)

## Relationships
- Quote 1—N QuoteLine
- Quote → Customer, Project/Job (optional)
- Quote → Company (org/tenant scope)
- Quote → Version history (self-referential chain)

## Lifecycle Attributes
- sentAt, viewedAt, acceptedAt/declinedAt, expiredAt
- acceptedBy: name, title, ip, userAgent; selectedOptionalItemIds
- convertedTo: invoiceId/orderId (shell)

## Constraints
- Number unique per organization per pattern
- Totals computed server-side; immutable after acceptance
