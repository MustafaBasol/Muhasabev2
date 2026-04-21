/**
 * Chorus Pro (PISTE) API sabitleri
 *
 * PISTE: Plateforme Interministérielle de Sécurisation des Échanges
 * Chorus Pro: Fransa kamu faturalaşma platformu (B2G zorunlu)
 *
 * Referans: https://developer.aife.economie.gouv.fr/
 */

// ── PISTE OAuth 2.0 ────────────────────────────────────────────────────────
export const PISTE_TOKEN_URL_SANDBOX =
  'https://sandbox-oauth.piste.gouv.fr/api/oauth/token';
export const PISTE_TOKEN_URL_PROD =
  'https://oauth.piste.gouv.fr/api/oauth/token';

// ── Chorus Pro API Base URL ────────────────────────────────────────────────
export const CHORUS_PRO_API_BASE_SANDBOX =
  'https://sandbox-qualif-souhait.chorus-pro.gouv.fr/api/cpro';
export const CHORUS_PRO_API_BASE_PROD =
  'https://chorus-pro.gouv.fr/api/cpro';

// ── API Endpoint Yolları ───────────────────────────────────────────────────
export const CHORUS_PRO_ENDPOINTS = {
  /** Fatura akışı gönder (deposer) */
  DEPOSER_FLUX: '/factures/v1/deposerFluxFacture',
  /** Fatura durumu tarihçesi sorgula */
  CONSULTER_HISTORIQUE: '/factures/v1/consulterHistoriqueEtatFacture',
  /** Fatura detayı sorgula */
  CONSULTER_FACTURE: '/factures/v1/consulterFacture',
  /** SIRET → Chorus Pro ID dönüşümü */
  RECUPERER_IDENTIFIANT: '/transverses/v1/recupererIdentifiant',
} as const;

// ── Desteklenen XML Formatları ─────────────────────────────────────────────
export const CHORUS_PRO_SYNTAX = {
  /** UBL 2.1 (ISO/IEC 19845) */
  UBL21: 'UBL21',
  /** UN/CEFACT Cross Industry Invoice — Factur-X uyumlu */
  CII: 'CII',
  /** PDF/A-3 + Factur-X CII gömülü */
  FACTURX: 'FACTURX',
} as const;

export type ChorusProSyntax =
  (typeof CHORUS_PRO_SYNTAX)[keyof typeof CHORUS_PRO_SYNTAX];

// ── Chorus Pro Fatura Durum Kodları ───────────────────────────────────────
export const CHORUS_PRO_STATUS = {
  /** Akış alındı, işleniyor */
  DEPOSEE: 'DEPOSEE',
  /** Syntaktik kontrol tamamlandı */
  A_VALIDER: 'A_VALIDER',
  /** Aracı onayı bekleniyor */
  A_VALIDER_INTERMEDIAIRE: 'A_VALIDER_INTERMEDIAIRE',
  /** Alıcı tarafından onaylandı */
  VALIDEE: 'VALIDEE',
  /** Ödeme başlatıldı */
  MISE_EN_PAIEMENT: 'MISE_EN_PAIEMENT',
  /** Ödeme tamamlandı */
  COMPTABILISEE: 'COMPTABILISEE',
  /** Redde edildi */
  REJETEE: 'REJETEE',
  /** İptal edildi */
  ANNULEE: 'ANNULEE',
  /** Hata / işlenemedi */
  REJETEE_MANDATAIRE: 'REJETEE_MANDATAIRE',
} as const;

export type ChorusProStatus =
  (typeof CHORUS_PRO_STATUS)[keyof typeof CHORUS_PRO_STATUS];

// ── Provider anahtarı ──────────────────────────────────────────────────────
export const CHORUS_PRO_PROVIDER_KEY = 'chorus_pro';
