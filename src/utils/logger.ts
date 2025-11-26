import { safeLocalStorage } from './localStorageSafe';

/*
  Minimal logger utility to control console noise.
  - By default (DEV without debug flag), debug/info logs are muted.
  - Enable verbose logs by running in browser console:
      window.__enableEnvDebug?.();
    Disable with:
      window.__disableEnvDebug?.();
    (Both helpers rely on safeLocalStorage under the hood.)
*/

type ConsoleLike = Pick<Console, 'log' | 'info' | 'warn' | 'error' | 'debug'>;

const noop = () => {};

const resolveConsole = (): ConsoleLike => {
  if (typeof globalThis !== 'undefined' && globalThis.console) {
    return globalThis.console;
  }
  return {
    log: noop,
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
  };
};

const consoleLike = resolveConsole();

const getDebugFlag = (): boolean => {
  if (!import.meta.env.DEV) return false;
  return safeLocalStorage.getItem('debug') === '1';
};

const shouldLogVerbose = () => getDebugFlag();

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLogVerbose()) {
      consoleLike.log?.(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (shouldLogVerbose()) {
      consoleLike.info?.(...args);
    }
  },
  warn: (...args: unknown[]) => {
    consoleLike.warn?.(...args);
  },
  error: (...args: unknown[]) => {
    consoleLike.error?.(...args);
  },
  installConsoleMute: () => {
    if (shouldLogVerbose()) return;
    if (typeof globalThis === 'undefined' || !globalThis.console) return;
    const globalConsole = globalThis.console;
    globalConsole.log = noop;
    globalConsole.debug = noop;
  },
};

export type Logger = typeof logger;
