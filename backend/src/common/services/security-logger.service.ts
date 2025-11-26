// backend/src/common/services/security-logger.service.ts
// Güvenlik olaylarını loglama servisi

import { Injectable, Logger } from '@nestjs/common';

export interface SecurityEvent {
  type:
    | 'login_attempt'
    | 'login_success'
    | 'login_failure'
    | 'admin_access'
    | 'suspicious_activity'
    | 'rate_limit_exceeded';
  userId?: string;
  ip: string;
  userAgent?: string;
  details?: SecurityEventDetail;
  timestamp: Date;
}

export type SecurityEventDetail =
  | Record<string, unknown>
  | string
  | number
  | boolean
  | Array<unknown>;

@Injectable()
export class SecurityLoggerService {
  private readonly logger = new Logger(SecurityLoggerService.name);
  private securityEvents: SecurityEvent[] = [];

  /**
   * Güvenlik olayını logla
   */
  logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>) {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.securityEvents.push(securityEvent);

    // Console'a da logla
    this.logger.warn(
      `🔒 Security Event: ${event.type} - meta=${JSON.stringify({
        userId: event.userId,
        ip: event.ip,
        userAgent: event.userAgent,
        details: event.details,
      })}`,
    );

    // Kritik olaylar için özel işlem
    if (['suspicious_activity', 'rate_limit_exceeded'].includes(event.type)) {
      this.handleCriticalEvent(securityEvent);
    }

    // Memory'de çok fazla log biriktirme
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-500);
    }
  }

  /**
   * Kritik güvenlik olayları için özel işlem
   */
  private handleCriticalEvent(event: SecurityEvent) {
    this.logger.error(
      `🚨 CRITICAL Security Event: ${event.type} - meta=${JSON.stringify(event)}`,
    );

    // Production'da bu olayları harici sisteme gönder
    // - Email notification
    // - Slack/Discord webhook
    // - Security monitoring service

    if (process.env.NODE_ENV === 'production') {
      // Webhook example
      this.sendSecurityAlert(event).catch((err) =>
        this.logger.error(
          `Failed to send security alert: ${this.safeErrorMessage(err)}`,
          err instanceof Error ? err.stack : undefined,
        ),
      );
    }
  }

  /**
   * Güvenlik uyarısı gönder
   */
  private async sendSecurityAlert(event: SecurityEvent) {
    const webhookUrl = process.env.SECURITY_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Security Alert: ${event.type}`,
          attachments: [
            {
              color: 'danger',
              fields: [
                { title: 'Type', value: event.type, short: true },
                { title: 'IP', value: event.ip, short: true },
                { title: 'User ID', value: event.userId || 'N/A', short: true },
                {
                  title: 'Time',
                  value: event.timestamp.toISOString(),
                  short: true,
                },
                {
                  title: 'Details',
                  value: JSON.stringify(event.details, null, 2),
                  short: false,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }
    } catch (error) {
      this.logger.error(
        `Security webhook failed: ${this.safeErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Son güvenlik olaylarını getir
   */
  getRecentEvents(limit = 50): SecurityEvent[] {
    return this.securityEvents
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Belirli IP'den gelen olayları getir
   */
  getEventsByIp(ip: string, hours = 24): SecurityEvent[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.securityEvents.filter(
      (event) => event.ip === ip && event.timestamp > cutoff,
    );
  }

  /**
   * Şüpheli aktivite tespiti
   */
  detectSuspiciousActivity(ip: string): boolean {
    const recentEvents = this.getEventsByIp(ip, 1); // Son 1 saat

    // Çok fazla başarısız login denemesi
    const failedLogins = recentEvents.filter(
      (e) => e.type === 'login_failure',
    ).length;
    if (failedLogins > 5) {
      this.logSecurityEvent({
        type: 'suspicious_activity',
        ip,
        details: { reason: 'too_many_failed_logins', count: failedLogins },
      });
      return true;
    }

    // Çok hızlı ardışık istekler
    const recentRequests = recentEvents.length;
    if (recentRequests > 100) {
      this.logSecurityEvent({
        type: 'suspicious_activity',
        ip,
        details: { reason: 'too_many_requests', count: recentRequests },
      });
      return true;
    }

    return false;
  }

  /**
   * Güvenlik raporu oluştur
   */
  generateSecurityReport(hours = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentEvents = this.securityEvents.filter(
      (e) => e.timestamp > cutoff,
    );

    const report = {
      period: `Last ${hours} hours`,
      totalEvents: recentEvents.length,
      eventTypes: {} as Record<string, number>,
      topIPs: {} as Record<string, number>,
      suspiciousIPs: [] as string[],
      criticalEvents: recentEvents.filter((e) =>
        ['suspicious_activity', 'rate_limit_exceeded'].includes(e.type),
      ).length,
    };

    // Event türlerini say
    recentEvents.forEach((event) => {
      report.eventTypes[event.type] = (report.eventTypes[event.type] || 0) + 1;
      report.topIPs[event.ip] = (report.topIPs[event.ip] || 0) + 1;
    });

    // Şüpheli IP'leri tespit et
    Object.entries(report.topIPs).forEach(([ip, count]) => {
      if (count > 50) {
        // 24 saatte 50'den fazla event
        report.suspiciousIPs.push(ip);
      }
    });

    return report;
  }

  private safeErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error';
  }
}
