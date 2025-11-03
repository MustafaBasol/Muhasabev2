# Quote PDF Template Guide

A branded, localized PDF is generated for each quote. This guide defines mandatory sections, layouts, and localization behavior.

## Layout (one- or multi-page)
1) Header
- Company logo, name, address, country IDs (EIN/VATIN/SIRET/Vergi No)
- Quote title per language (Quote / Devis / Angebot / Teklif)
- Quote number, issue date, validity until, project/job (optional)
2) Customer Block
- Customer name, address, contact person; customer tax IDs if provided
3) Items Table
- Columns: Item | Description | Qty | Unit | Unit Price | Discount | Tax | Line Total
- Optional items marked; Bundles visually grouped with subtotal rows; Recurring items labeled
4) Totals Section
- Subtotal, Global discount, Shipping/Handling, Deposits/Advances, Taxes (breakdown), Grand total
- Amount‑in‑words in the document language
5) Notes & Terms
- Notes, Terms & Conditions, Payment terms, Delivery terms, Warranty/Service info
6) Company & Bank Info
- Bank name, IBAN/ABA, SWIFT/BIC
7) Signatures (optional block)
- Seller signature area; Customer signature area (for on-paper workflows)
8) Footer
- Page numbers (Page X of Y)
- Legal/compliance footer blocks per country (withdrawal rights, dispute venue, mediation text)

## Localization
- All labels and boilerplates localized in EN/FR/DE/TR
- Date and numbers follow locale formats
- Currency display: transaction currency prominently; base currency and exchange rate as secondary where applicable

## Amount-in-words
- Displayed under totals in language: EN, FR, DE, TR
- Example formats:
  - EN: “Amount in words: One thousand two hundred euros and fifty cents”
  - FR: “Montant en lettres : Mille deux cents euros et cinquante centimes”
  - DE: “Betrag in Worten: Eintausendzweihundert Euro und fünfzig Cent”
  - TR: “Yazıyla tutar: Bin iki yüz euro ve elli sent”

## Template Variants
- Minimal (lump-sum): condensed items, strong totals
- Detailed line-by-line (default)
- Construction/services variant: highlights labor, materials, schedule notes
- SaaS variant: recurring items, plan tiers, term length

## Required Pulls from Existing Data
- Company profile (logo, address, tax IDs)
- Bank accounts (IBAN/ABA, SWIFT)
- Customer record (address, contacts)
- Products (name, SKU, tax category) where referenced
