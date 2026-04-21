import { ChorusProSyntax, ChorusProStatus } from '../constants/chorus-pro.constants';

// ── PISTE OAuth ────────────────────────────────────────────────────────────

export interface PisteTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

// ── deposerFluxFacture ─────────────────────────────────────────────────────

export interface ChorusProDeposerRequest {
  /** CII, UBL21 veya FACTURX */
  syntaxeFlux: ChorusProSyntax;
  /** Base64'e encode edilmiş XML/PDF içeriği */
  fluxFacture: string;
  /** Kullanıcıya özel Chorus Pro teknik kullanıcı id'si */
  numeroFluxDepot?: string;
}

export interface ChorusProDeposerResponse {
  /** Sistem tarafından atanan unik akış numarası */
  numeroFluxDepot: string;
  /** İlk durum — genellikle DEPOSEE */
  codeStatut?: ChorusProStatus;
  /** Hata varsa açıklama */
  libellErreur?: string;
}

// ── consulterHistoriqueEtatFacture ─────────────────────────────────────────

export interface ChorusProHistoriqueRequest {
  numeroFluxDepot: string;
}

export interface ChorusProStatutHistorique {
  dateTtRealise: string;
  nouveauStatut: ChorusProStatus;
  libelleStatut?: string;
  commentaire?: string;
}

export interface ChorusProHistoriqueResponse {
  numeroFluxDepot: string;
  statutCourant?: ChorusProStatus;
  listeStatutCourant?: ChorusProStatutHistorique[];
  /** Chorus Pro tarafından atanan fatura numarası (eğer varsa) */
  numeroFactureCPP?: string;
}

// ── recupererIdentifiant ───────────────────────────────────────────────────

export interface ChorusProIdentifiantRequest {
  siret: string;
}

export interface ChorusProIdentifiantResponse {
  idDestinataire: string;
  raisonSociale?: string;
}

// ── Teknik kullanıcı (tenant bazlı) kimlik bilgileri ──────────────────────

/**
 * Her tenant kendi Chorus Pro teknik hesabını bağlar.
 * ProviderAccount.metadata içinde şifreli saklanır.
 */
export interface ChorusProTenantCredentials {
  /** PISTE OAuth client ID */
  pisteClientId: string;
  /** PISTE OAuth client secret (şifreli) */
  pisteClientSecret: string;
  /** Tenantin SIRET numarası (9 hane SIREN + 5 hane NIC) */
  siret: string;
}
