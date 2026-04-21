import { toVatRateCode, FR_VAT_RATE_MAP } from '../integrations/pennylane/constants/vat-rate-map';

describe('toVatRateCode', () => {
  // ─── Standart Fransa Oranları ──────────────────────────────────────────────

  it.each([
    ['0.2', 'FR_200'],
    ['0.200', 'FR_200'],
    ['20', 'FR_200'],
    [20, 'FR_200'],
  ])('TVA %s → FR_200 (standart oran)', (input, expected) => {
    expect(toVatRateCode(input)).toBe(expected);
  });

  it.each([
    ['0.1', 'FR_100'],
    ['0.100', 'FR_100'],
    ['10', 'FR_100'],
    [10, 'FR_100'],
  ])('TVA %s → FR_100 (indirimli oran)', (input, expected) => {
    expect(toVatRateCode(input)).toBe(expected);
  });

  it.each([
    ['0.055', 'FR_55'],
    ['5.5', 'FR_55'],
    [5.5, 'FR_55'],
  ])('TVA %s → FR_55 (yiyecek/kitap oranı)', (input, expected) => {
    expect(toVatRateCode(input)).toBe(expected);
  });

  it.each([
    ['0.021', 'FR_21'],
    ['2.1', 'FR_21'],
    [2.1, 'FR_21'],
  ])('TVA %s → FR_21 (ilaç oranı)', (input, expected) => {
    expect(toVatRateCode(input)).toBe(expected);
  });

  it.each([
    ['0.085', 'FR_85'],
    ['8.5', 'FR_85'],
    [8.5, 'FR_85'],
  ])('TVA %s → FR_85 (DOM-TOM)', (input, expected) => {
    expect(toVatRateCode(input)).toBe(expected);
  });

  // ─── Sıfır / Muaf ──────────────────────────────────────────────────────────

  it.each([
    ['0', 'exempt'],
    ['0.0', 'exempt'],
    ['0.00', 'exempt'],
    [0, 'exempt'],
  ])('TVA %s → exempt', (input, expected) => {
    expect(toVatRateCode(input)).toBe(expected);
  });

  // ─── Fallback ──────────────────────────────────────────────────────────────

  it('bilinmeyen oran için FR_200 fallback uygulanır', () => {
    expect(toVatRateCode(99)).toBe('FR_200');
    expect(toVatRateCode('unknown')).toBe('FR_200');
    expect(toVatRateCode('')).toBe('FR_200');
  });

  // ─── Map Bütünlüğü ─────────────────────────────────────────────────────────

  it('FR_VAT_RATE_MAP sadece geçerli Pennylane kodu içerir', () => {
    const validCodes = ['FR_200', 'FR_100', 'FR_55', 'FR_21', 'FR_85', 'FR_09', 'FR_130', 'exempt'];
    Object.values(FR_VAT_RATE_MAP).forEach((code) => {
      expect(validCodes).toContain(code);
    });
  });
});
