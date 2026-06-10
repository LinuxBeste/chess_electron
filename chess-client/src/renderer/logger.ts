const PREFIX = '[Chess]';

function formatArgs(args: unknown[]): unknown[] {
  return [PREFIX, ...args];
}

export default {
  info: (...args: unknown[]) => {
    console.info(...formatArgs(args));
  },
  warn: (...args: unknown[]) => console.warn(...formatArgs(args)),
  error: (...args: unknown[]) => console.error(...formatArgs(args)),
  debug: (...args: unknown[]) => {
    console.debug(...formatArgs(args));
  },
};
