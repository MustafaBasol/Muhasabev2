import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  PISTE_TOKEN_URL_PROD,
  PISTE_TOKEN_URL_SANDBOX,
  CHORUS_PRO_API_BASE_PROD,
  CHORUS_PRO_API_BASE_SANDBOX,
  CHORUS_PRO_ENDPOINTS,
} from '../constants/chorus-pro.constants';
import {
  PisteTokenResponse,
  ChorusProDeposerRequest,
  ChorusProDeposerResponse,
  ChorusProHistoriqueRequest,
  ChorusProHistoriqueResponse,
  ChorusProIdentifiantRequest,
  ChorusProIdentifiantResponse,
} from '../types/chorus-pro.types';

/**
 * ChorusProApiClient
 *
 * PISTE OAuth 2.0 client_credentials akışı ile erişim tokenı alır ve
 * Chorus Pro REST API'si üzerinden fatura gönderimi / durum sorgulama yapar.
 *
 * Ortam değişkenleri:
 *   CHORUS_PRO_CLIENT_ID     — PISTE uygulama istemci kimliği
 *   CHORUS_PRO_CLIENT_SECRET — PISTE uygulama istemci sırrı
 *   CHORUS_PRO_SANDBOX=true  — Sandbox modu (varsayılan: prod)
 */
@Injectable()
export class ChorusProApiClient {
  private readonly logger = new Logger(ChorusProApiClient.name);
  private readonly isSandbox: boolean;
  private readonly tokenUrl: string;
  private readonly apiBase: string;
  private readonly http: AxiosInstance;

  /** Uygulama seviyesi access token cache (dakika bazlı yeterli) */
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.isSandbox = process.env.CHORUS_PRO_SANDBOX === 'true';
    this.tokenUrl = this.isSandbox ? PISTE_TOKEN_URL_SANDBOX : PISTE_TOKEN_URL_PROD;
    this.apiBase = this.isSandbox ? CHORUS_PRO_API_BASE_SANDBOX : CHORUS_PRO_API_BASE_PROD;

    this.http = axios.create({
      baseURL: this.apiBase,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        Accept: 'application/json',
      },
    });
  }

  // ── Uygulama düzeyi token (client_credentials) ─────────────────────────

  /**
   * PISTE'den uygulama access token alır.
   * Token geçerliyse cache'den döner; yoksa yeniler.
   */
  async getAppAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.cachedToken;
    }

    const clientId = process.env.CHORUS_PRO_CLIENT_ID;
    const clientSecret = process.env.CHORUS_PRO_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        'CHORUS_PRO_CLIENT_ID ve CHORUS_PRO_CLIENT_SECRET ortam değişkenleri tanımlı değil.',
      );
    }

    try {
      const res = await axios.post<PisteTokenResponse>(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'openid',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      this.cachedToken = res.data.access_token;
      this.tokenExpiresAt = Date.now() + res.data.expires_in * 1000;
      this.logger.debug('PISTE uygulama token yenilendi.');
      return this.cachedToken;
    } catch (err) {
      this.logger.error('PISTE token alınamadı', err);
      throw new UnauthorizedException('Chorus Pro PISTE token alınamadı.');
    }
  }

  // ── deposerFluxFacture ──────────────────────────────────────────────────

  /**
   * XML/PDF faturayı Chorus Pro'ya gönderir.
   * @returns numeroFluxDepot — sistem tarafından atanan takip numarası
   */
  async deposerFlux(
    login: string,
    motDePasse: string,
    payload: ChorusProDeposerRequest,
  ): Promise<ChorusProDeposerResponse> {
    const token = await this.getAppAccessToken();

    try {
      const res = await this.http.post<ChorusProDeposerResponse>(
        CHORUS_PRO_ENDPOINTS.DEPOSER_FLUX,
        payload,
        { headers: this.buildHeaders(token, login, motDePasse) },
      );
      this.logger.log(
        `deposerFlux OK: syntax=${payload.syntaxeFlux} flux=${res.data.numeroFluxDepot}`,
      );
      return res.data;
    } catch (err: any) {
      this.logger.error(
        `deposerFlux HATA: ${err?.response?.status} ${JSON.stringify(err?.response?.data)}`,
      );
      throw new Error(
        `Chorus Pro fatura gönderimi başarısız: ${err?.response?.data?.libellErreur ?? err.message}`,
      );
    }
  }

  // ── consulterHistoriqueEtatFacture ───────────────────────────────────────

  /**
   * Bir faturanın durum tarihçesini getirir.
   */
  async consulterHistorique(
    login: string,
    motDePasse: string,
    request: ChorusProHistoriqueRequest,
  ): Promise<ChorusProHistoriqueResponse> {
    const token = await this.getAppAccessToken();

    try {
      const res = await this.http.post<ChorusProHistoriqueResponse>(
        CHORUS_PRO_ENDPOINTS.CONSULTER_HISTORIQUE,
        request,
        { headers: this.buildHeaders(token, login, motDePasse) },
      );
      return res.data;
    } catch (err: any) {
      this.logger.error(
        `consulterHistorique HATA: ${err?.response?.status} ${JSON.stringify(err?.response?.data)}`,
      );
      throw new Error(
        `Chorus Pro durum sorgulaması başarısız: ${err?.response?.data?.libellErreur ?? err.message}`,
      );
    }
  }

  // ── recupererIdentifiant ─────────────────────────────────────────────────

  /**
   * SIRET numarasından Chorus Pro alıcı ID'si alır.
   */
  async recupererIdentifiant(
    login: string,
    motDePasse: string,
    request: ChorusProIdentifiantRequest,
  ): Promise<ChorusProIdentifiantResponse> {
    const token = await this.getAppAccessToken();

    try {
      const res = await this.http.post<ChorusProIdentifiantResponse>(
        CHORUS_PRO_ENDPOINTS.RECUPERER_IDENTIFIANT,
        request,
        { headers: this.buildHeaders(token, login, motDePasse) },
      );
      return res.data;
    } catch (err: any) {
      this.logger.warn(
        `recupererIdentifiant HATA: ${err?.response?.status}`,
      );
      throw new Error(
        `Chorus Pro alıcı ID alınamadı: ${err?.response?.data?.libellErreur ?? err.message}`,
      );
    }
  }

  // ── Ortak yardımcılar ────────────────────────────────────────────────────

  /**
   * Chorus Pro API, iki kimlik doğrulama katmanı gerektirir:
   *  1. Bearer token (PISTE uygulama tokeni) — Authorization başlığı
   *  2. Tenant teknik kullanıcı bilgileri     — login/motDePasse başlıkları
   */
  private buildHeaders(
    appToken: string,
    login: string,
    motDePasse: string,
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${appToken}`,
      'cpro-account': login,
      'cpro-account-password': motDePasse,
    };
  }
}
