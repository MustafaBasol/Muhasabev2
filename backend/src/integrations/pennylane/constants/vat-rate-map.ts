/**
 * Pennylane VAT Rate Code Mapping
 *
 * Kaynak: Pennylane API v2 OAS spec — vat_rate enum
 *
 * Decimal vergi oranını (invoice_lines.taxRate) Pennylane'in
 * string kod formatına dönüştürür.
 *
 * Format: FR_200 = France 20.0%, FR_55 = 5.5%, vb.
 *
 * Fransa'da geçerli KDV oranları: 0%, 2.1%, 5.5%, 8.5%, 10%, 20%
 * Farklı ülkeden (Türkiye: %1, %8, %18 vb.) gelen oranlar için
 * en yakın geçerli Fransız oranına yuvarlama yapılır.
 */
export const FR_VAT_RATE_MAP: Record<string, string> = {
  // ── Standart Fransa oranları (kesin eşleşme) ──────────────────────────────
  '20': 'FR_200',
  '20.0': 'FR_200',
  '20.00': 'FR_200',
  '0.2': 'FR_200',
  '0.20': 'FR_200',
  '0.200': 'FR_200',

  '10': 'FR_100',
  '10.0': 'FR_100',
  '10.00': 'FR_100',
  '0.1': 'FR_100',
  '0.10': 'FR_100',
  '0.100': 'FR_100',

  '5.5': 'FR_55',
  '5.50': 'FR_55',
  '0.055': 'FR_55',

  '8.5': 'FR_85',
  '8.50': 'FR_85',
  '0.085': 'FR_85',

  '2.1': 'FR_21',
  '2.10': 'FR_21',
  '0.021': 'FR_21',

  // Sıfır / muaf
  '0': 'exempt',
  '0.0': 'exempt',
  '0.00': 'exempt',

  // DOM-TOM
  '0.8': 'FR_09',
  '0.9': 'FR_09',
  '1.3': 'FR_130',
  '0.013': 'FR_130',

  // ── Türk KDV oranları → en yakın FR oranına yuvarlama ────────────────────
  // TR %1 → FR exempt yerine FR_21 (en düşük standart oran)
  '1': 'FR_21',
  '1.0': 'FR_21',
  '1.00': 'FR_21',
  // TR %8 → FR %8.5 (en yakın)
  '8': 'FR_85',
  '8.0': 'FR_85',
  '8.00': 'FR_85',
  // TR %18 → FR %20 (standart oran / en yakın)
  '18': 'FR_200',
  '18.0': 'FR_200',
  '18.00': 'FR_200',
};

/**
 * Geçerli FR KDV oranları ve kodları (yuvarlama için)
 */
const FR_VALID_RATES: Array<{ rate: number; code: string }> = [
  { rate: 0,    code: 'exempt'  },
  { rate: 2.1,  code: 'FR_21'  },
  { rate: 5.5,  code: 'FR_55'  },
  { rate: 8.5,  code: 'FR_85'  },
  { rate: 10,   code: 'FR_100' },
  { rate: 20,   code: 'FR_200' },
];

/**
 * Decimal vergi oranından Pennylane VAT code'u döner.
 *
 * Önce kesin eşleşme aranır; bulunamazsa en yakın geçerli
 * Fransız KDV oranına yuvarlanır (nearest-match).
 */
export function toVatRateCode(taxRate: number | string): string {
  const key = String(taxRate);

  // 1. Kesin eşleşme
  if (FR_VAT_RATE_MAP[key]) {
    return FR_VAT_RATE_MAP[key];
  }

  // 2. Sayısal değer üzerinden en yakın geçerli FR oranını bul
  const numeric = Number(taxRate);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 'FR_200'; // güvenli fallback
  }

  let nearest = FR_VALID_RATES[FR_VALID_RATES.length - 1];
  let minDiff = Math.abs(numeric - nearest.rate);
  for (const entry of FR_VALID_RATES) {
    const diff = Math.abs(numeric - entry.rate);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = entry;
    }
  }
  return nearest.code;
}
