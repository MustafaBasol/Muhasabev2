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
 * Yalnızca Fransa oranları listeleniyor; başka ülke faturaları
 * gerektiğinde bu map'e eklenir.
 */
export const FR_VAT_RATE_MAP: Record<string, string> = {
  // Standart Fransa oranları
  '0.2': 'FR_200',
  '0.200': 'FR_200',
  '20': 'FR_200',
  '0.1': 'FR_100',
  '0.100': 'FR_100',
  '10': 'FR_100',
  '0.055': 'FR_55',
  '5.5': 'FR_55',
  '0.021': 'FR_21',
  '2.1': 'FR_21',
  '0.085': 'FR_85',
  '8.5': 'FR_85',
  // Sıfır / muaf
  '0': 'exempt',
  '0.0': 'exempt',
  '0.00': 'exempt',
  // DOM-TOM (ileride gerekirse)
  '0.008': 'FR_09',
  '0.013': 'FR_130',
};

/**
 * Decimal vergi oranından Pennylane VAT code'u döner.
 * Bilinmeyen oran için 'FR_200' (20%) fallback uygulanır.
 */
export function toVatRateCode(taxRate: number | string): string {
  const key = String(taxRate);
  return FR_VAT_RATE_MAP[key] ?? 'FR_200';
}
