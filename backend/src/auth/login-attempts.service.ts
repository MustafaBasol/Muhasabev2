import { Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

interface AttemptRecord { count: number; captchaRequired: boolean; lastFailed: number }

@Injectable()
export class LoginAttemptsService {
  private memory = new Map<string, AttemptRecord>();
  private redis: Redis | null = null;
  private threshold: number;
  constructor() {
    this.threshold = parseInt(process.env.LOGIN_FAILED_CAPTCHA_THRESHOLD || '5', 10);
    const host = process.env.REDIS_HOST;
    if (host) {
      try {
        // Dynamic import to avoid crash if not installed early
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const RedisCtor = require('ioredis');
        const tmp: Redis = new RedisCtor({
          host: host,
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          lazyConnect: true,
        });
        tmp.on('error', () => { this.redis = null; });
        tmp.connect().catch(() => { this.redis = null; });
        this.redis = tmp;
      } catch {
        this.redis = null;
      }
    }
  }
  private key(email: string, ip: string) { return `login_attempts:${email.toLowerCase()}:${ip}`; }
  async increment(email: string, ip: string) {
    const k = this.key(email, ip);
    if (this.redis) {
      const c = await this.redis.incr(k);
      if (c === 1) await this.redis.expire(k, 3600);
      return c;
    }
    const rec = this.memory.get(k) || { count: 0, captchaRequired: false, lastFailed: 0 };
    rec.count += 1; rec.lastFailed = Date.now();
    if (rec.count >= this.threshold) rec.captchaRequired = true;
    this.memory.set(k, rec);
    return rec.count;
  }
  async requireCaptcha(email: string, ip: string): Promise<boolean> {
    const k = this.key(email, ip);
    if (this.redis) {
      const raw = await this.redis.get(k);
      const c = raw ? parseInt(raw, 10) : 0;
      return c >= this.threshold;
    }
    return this.memory.get(k)?.captchaRequired === true;
  }
  async reset(email: string, ip: string) {
    const k = this.key(email, ip);
    if (this.redis) {
      await this.redis.del(k);
    } else {
      this.memory.delete(k);
    }
  }
}