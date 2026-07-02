import { CSRFMiddleware } from './csrf.middleware';

/**
 * Regression: CSRF must be fail-closed. When protection is enforced
 * (production/staging, or CSRF_ENFORCE=true) the app must refuse to start
 * without a strong shared CSRF_SECRET, instead of silently falling back to a
 * per-process random secret that breaks validation across instances/restarts.
 */
describe('CSRFMiddleware — fail-closed secret', () => {
  const OLD_ENV = process.env;

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('throws when NODE_ENV=production and CSRF_SECRET is missing', () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'production' };
    delete process.env.CSRF_SECRET;
    expect(() => new CSRFMiddleware()).toThrow(/CSRF_SECRET/);
  });

  it('throws when NODE_ENV=production and CSRF_SECRET is too short', () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'production', CSRF_SECRET: 'short' };
    expect(() => new CSRFMiddleware()).toThrow(/CSRF_SECRET/);
  });

  it('starts when a strong CSRF_SECRET is provided in production', () => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'production',
      CSRF_SECRET: 'a'.repeat(32),
    };
    expect(() => new CSRFMiddleware()).not.toThrow();
  });

  it('does not enforce (no throw) in development without a secret', () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'development' };
    delete process.env.CSRF_SECRET;
    delete process.env.CSRF_ENFORCE;
    expect(() => new CSRFMiddleware()).not.toThrow();
  });
});
