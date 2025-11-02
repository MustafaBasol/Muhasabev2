/* eslint-disable no-console */
// Basit tarayıcı logger'ı: prod'da debug/info susturulur, warn/error her zaman görünür.

type LogFn = (...args: unknown[]) => void;

const isProd = typeof import.meta !== 'undefined'
  && (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE === 'production';

const noop: LogFn = () => {};

export const logger = {
  debug: isProd ? noop : ((...args: unknown[]) => console.log(...args)),
  info: isProd ? noop : ((...args: unknown[]) => console.log(...args)),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
} as const;

export type Logger = typeof logger;
