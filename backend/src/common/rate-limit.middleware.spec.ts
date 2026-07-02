import { HttpException } from '@nestjs/common';
import { Request, Response } from 'express';
import { RateLimitMiddleware } from './rate-limit.middleware';

/**
 * Regression: spoofed forwarding headers (X-Real-IP / X-Forwarded-For /
 * CF-Connecting-IP) must NOT be trusted unless TRUST_PROXY=true. An attacker
 * setting `X-Real-IP: 127.0.0.1` must not be able to pass the admin IP
 * allow-list from a non-loopback socket.
 */
describe('RateLimitMiddleware — IP spoofing defense', () => {
  const OLD_ENV = process.env;

  const makeReq = (over: Partial<Request>): Request =>
    ({
      method: 'GET',
      path: '/admin/dashboard',
      headers: {},
      socket: { remoteAddress: '203.0.113.7' },
      ...over,
    }) as unknown as Request;

  const makeRes = (): Response =>
    ({ setHeader: () => undefined }) as unknown as Response;

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('rejects admin access from a non-allowlisted socket even with spoofed X-Real-IP: 127.0.0.1 (TRUST_PROXY unset)', () => {
    process.env = { ...OLD_ENV };
    delete process.env.TRUST_PROXY;
    const mw = new RateLimitMiddleware();
    const req = makeReq({
      socket: { remoteAddress: '203.0.113.7' } as Request['socket'],
      headers: { 'x-real-ip': '127.0.0.1', 'x-forwarded-for': '127.0.0.1' },
    });
    const next = jest.fn();

    expect(() => mw.use(req, makeRes(), next)).toThrow(HttpException);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows admin access when the real TCP peer (socket) is loopback', () => {
    process.env = { ...OLD_ENV };
    delete process.env.TRUST_PROXY;
    const mw = new RateLimitMiddleware();
    const req = makeReq({
      socket: { remoteAddress: '127.0.0.1' } as Request['socket'],
      headers: {},
    });
    const next = jest.fn();

    expect(() => mw.use(req, makeRes(), next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('trusts X-Real-IP only when TRUST_PROXY=true (behind a real reverse proxy)', () => {
    process.env = { ...OLD_ENV, TRUST_PROXY: 'true' };
    const mw = new RateLimitMiddleware();
    const req = makeReq({
      socket: { remoteAddress: '203.0.113.7' } as Request['socket'],
      headers: { 'x-real-ip': '127.0.0.1' },
    });
    const next = jest.fn();

    // With trust enabled the proxy-provided loopback IP is honored → allowed.
    expect(() => mw.use(req, makeRes(), next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
