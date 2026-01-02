import type { TFunction } from 'i18next';

const matchers = {
  createdFromInvoice: [
    // tr
    /^(.+?)\s+numaralı\s+faturadan\s+otomatik\s+oluşturuldu\.?$/iu,
    // en
    /^Automatically\s+created\s+from\s+invoice\s+(.+?)\.?$/iu,
    // de
    /^Automatisch\s+aus\s+Rechnung\s+(.+?)\s+erstellt\.?$/iu,
    // fr
    /^Créé\s+automatiquement\s+à\s+partir\s+de\s+la\s+facture\s+(.+?)\.?$/iu,
  ],
  quoteAcceptedAutoCreated: [
    /^Teklif\s+kabul\s+edildi\s*\(otomatik\s+oluşturuldu\)\.?$/iu,
    /^Quote\s+accepted\s*\(auto-?created\)\.?$/iu,
    /^Angebot\s+akzeptiert\s*\(automatisch\s+erstellt\)\.?$/iu,
    /^Devis\s+accepté\s*\(créé\s+automatiquement\)\.?$/iu,
  ],
} as const;

export const localizeAutoNote = (note: string, t: TFunction): string => {
  const input = String(note || '').trim();
  if (!input) return input;

  for (const re of matchers.createdFromInvoice) {
    const m = input.match(re);
    if (m) {
      const invoiceNumber = String(m[1] || '').trim();
      return t('sales.autoNotes.createdFromInvoice', { invoiceNumber });
    }
  }

  for (const re of matchers.quoteAcceptedAutoCreated) {
    if (re.test(input)) {
      return t('sales.autoNotes.quoteAcceptedAutoCreated');
    }
  }

  return input;
};
