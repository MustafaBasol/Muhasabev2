/**
 * Factur-X / ZUGFeRD profilleri (EN 16931 uyum seviyeleri).
 *
 * MINIMUM     — yalnızca zorunlu alanlar (fatura no, tarih, tutar)
 * BASIC_WL    — satır bilgisi olmadan temel veriler
 * EN_16931    — tam EN 16931 uyumlu (Türkiye: Fransa için önerilen)
 * EXTENDED    — genişletilmiş ticari veri
 */
export enum FacturXProfile {
  MINIMUM = 'MINIMUM',
  BASIC_WL = 'BASIC WL',
  EN_16931 = 'EN 16931',
  EXTENDED = 'EXTENDED',
}

/** Profil → Factur-X XMP conformanceLevel değeri */
export const FACTURX_CONFORMANCE_LEVEL: Record<FacturXProfile, string> = {
  [FacturXProfile.MINIMUM]: 'MINIMUM',
  [FacturXProfile.BASIC_WL]: 'BASIC WL',
  [FacturXProfile.EN_16931]: 'EN 16931',
  [FacturXProfile.EXTENDED]: 'EXTENDED',
};
