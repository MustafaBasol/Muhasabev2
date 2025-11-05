/*
  Minimal logger utility to control console noise.
  - By default (DEV without debug flag), debug/info logs are muted.
  - Enable verbose logs by running in browser console:
      localStorage.setItem('debug', '1'); location.reload();
    Disable with:
      localStorage.removeItem('debug'); location.reload();
*/

export const isDebug = import.meta.env.DEV && localStorage.getItem('debug') === '1';

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDebug) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (isDebug) console.info(...args);
  },
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
  installConsoleMute: () => {
    // Mute console.log/debug globally unless debug flag is set
    if (!isDebug) {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      console.log = () => {};
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      console.debug = () => {};
      // Keep warn/error visible
    }
  },
};
export type Logger = typeof logger;
