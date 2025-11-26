/*
  Session Manager: handles inactivity logout and sliding token refresh.
  - Tracks user activity events and updates lastActive timestamp.
  - If idle exceeds threshold, calls onLogout.
  - Periodically checks token expiry and refreshes if close to expiry while user is active.
*/

import { authService } from '../api/auth';
import { logger } from './logger';

export type SessionManagerOptions = {
  idleTimeoutMinutes?: number; // logout after this many minutes of no activity
  refreshBeforeSeconds?: number; // refresh token when less than this many seconds remain
  checkIntervalSeconds?: number; // periodic check interval
};

export class SessionManager {
  private lastActiveAt = Date.now();
  private intervalId: number | null = null;
  private options: Required<SessionManagerOptions>;
  private getToken: () => string | null;
  private setToken: (t: string) => void;
  private onLogout: () => void;
  private boundActivityHandler: () => void;
  private stopped = true;

  constructor(
    getToken: () => string | null,
    setToken: (t: string) => void,
    onLogout: () => void,
    options?: SessionManagerOptions,
  ) {
    this.getToken = getToken;
    this.setToken = setToken;
    this.onLogout = onLogout;
    const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
    const idleTimeoutMinutes = (() => {
      const raw = env?.VITE_IDLE_TIMEOUT_MINUTES;
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
    })();
    this.options = {
      idleTimeoutMinutes,
      refreshBeforeSeconds: 5 * 60, // 5 minutes
      checkIntervalSeconds: 60, // every minute
      ...(options || {}),
    };
    this.boundActivityHandler = this.recordActivity.bind(this);
  }

  start() {
    if (!this.stopped) return;
    if (typeof window === 'undefined') {
      logger.warn('SessionManager start çağrısı tarayıcı dışında yapıldı');
      return;
    }
    this.stopped = false;
    this.lastActiveAt = Date.now();
    // Listen a broad set of events as activity
    const events = ['click','keydown','mousemove','scroll','touchstart','visibilitychange','hashchange'];
    const listenerOptions: AddEventListenerOptions = { passive: true };
    events.forEach(ev => window.addEventListener(ev, this.boundActivityHandler, listenerOptions));
    // Periodic check
    this.intervalId = window.setInterval(() => this.tick(), this.options.checkIntervalSeconds * 1000);
    logger.info('🕒 SessionManager started', this.options);
  }

  stop() {
    if (this.stopped) return;
    if (typeof window === 'undefined') return;
    this.stopped = true;
    const events = ['click','keydown','mousemove','scroll','touchstart','visibilitychange','hashchange'];
    events.forEach(ev => window.removeEventListener(ev, this.boundActivityHandler));
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('🛑 SessionManager stopped');
  }

  recordActivity() {
    this.lastActiveAt = Date.now();
  }

  private decodeJwtExp(token: string | null): number | null {
    if (!token) return null;
    const decoder =
      (typeof window !== 'undefined' && window.atob)
        ? window.atob
        : typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function'
          ? globalThis.atob.bind(globalThis)
          : null;
    if (!decoder) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(decoder(parts[1]));
      if (!payload || typeof payload.exp !== 'number') return null;
      return payload.exp * 1000; // ms
    } catch {
      return null;
    }
  }

  private async tick() {
    try {
      const now = Date.now();
      // 1) Inactivity logout
      const idleMs = this.options.idleTimeoutMinutes * 60 * 1000;
      if (now - this.lastActiveAt > idleMs) {
        logger.info('⏳ Idle timeout reached. Logging out.');
        this.stop();
        this.onLogout();
        return;
      }

      // 2) Sliding refresh if close to expiry and user is active (visible)
      const token = this.getToken();
      if (!token) return;
      // Only refresh if tab is visible (avoid background thrash) and there was some recent activity in last 5 min
      const activeRecently = now - this.lastActiveAt < 5 * 60 * 1000;
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'hidden' || !activeRecently) return;

      const expMs = this.decodeJwtExp(token);
      if (!expMs) return;
      const secondsLeft = Math.floor((expMs - now) / 1000);
      if (secondsLeft <= this.options.refreshBeforeSeconds) {
        // Throttle refresh to at most once per check interval
        logger.debug(`🔄 Refreshing token. Seconds left: ${secondsLeft}`);
        try {
          const res = await authService.refresh();
          if (res?.token) {
            this.setToken(res.token);
            logger.info('✅ Token refreshed');
          }
        } catch (e) {
          logger.error('❌ Token refresh failed', e);
          // If refresh fails due to 401, apiClient will redirect; we also consider logout here
        }
      }
    } catch (e) {
      logger.error('SessionManager tick sırasında hata oluştu', e);
    }
  }
}

export const createSessionManager = (
  getToken: () => string | null,
  setToken: (t: string) => void,
  onLogout: () => void,
  options?: SessionManagerOptions,
) => new SessionManager(getToken, setToken, onLogout, options);
