const PREFIX = '[Chess]';
const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

function formatArgs(args: unknown[]): unknown[] {
  return [PREFIX, ...args];
}

export default {
  info: (...args: unknown[]) => {
    if (isDev) console.info(...formatArgs(args));
  },
  warn: (...args: unknown[]) => console.warn(...formatArgs(args)),
  error: (...args: unknown[]) => console.error(...formatArgs(args)),
  debug: (...args: unknown[]) => {
    if (isDev) console.debug(...formatArgs(args));
  },
};
