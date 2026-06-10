import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_RETENTION_DAYS = 30;
const isTest = process.env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined';

function dateTag(): string {
  return new Date().toISOString().slice(0, 10);
}

function timestamp(): string {
  return new Date().toISOString();
}

function ensureDir(dir: string): void {
  if (!isTest) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function appendLine(file: string, line: string): void {
  if (isTest) return;
  try {
    ensureDir(LOG_DIR);
    fs.appendFileSync(path.join(LOG_DIR, file), line + '\n', 'utf-8');
  } catch {
    /* best-effort file logging */
  }
}

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LEVEL_NUM: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };

const CONSOLE_COLORS: Record<LogLevel, string> = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[90m',
};

const CONSOLE_RESET = '\x1b[0m';

const configuredLevel: number = LEVEL_NUM[(process.env.LOG_LEVEL as LogLevel) || 'info'] ?? 2;

function shouldLog(level: LogLevel): boolean {
  return LEVEL_NUM[level] <= configuredLevel;
}

function log(level: LogLevel, message: string, ...args: unknown[]): void {
  if (!shouldLog(level)) return;
  const ts = timestamp();
  const line =
    args.length > 0
      ? `${message} ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`
      : message;
  if (!isTest) {
    console.log(`${CONSOLE_COLORS[level]}[${level.toUpperCase()}]${CONSOLE_RESET} ${line}`);
  }
  appendLine(`app-${dateTag()}.log`, `[${ts}] [${level.toUpperCase()}] ${line}`);
}

export function audit(action: string, detail: string): void {
  const ts = timestamp();
  const line = `[AUDIT] ${action} — ${detail}`;
  if (!isTest) {
    console.log(`\x1b[35m${line}\x1b[0m`);
  }
  appendLine(`audit-${dateTag()}.log`, `[${ts}] ${line}`);
}

export function morganStream(): { write: (msg: string) => void } {
  return {
    write: (msg: string) => {
      const trimmed = msg.trim();
      if (!trimmed) return;
      appendLine(`http-${dateTag()}.log`, `[${timestamp()}] ${trimmed}`);
    },
  };
}

export function cleanupOldLogs(): void {
  if (isTest) return;
  try {
    ensureDir(LOG_DIR);
    const cutoff = Date.now() - LOG_RETENTION_DAYS * 86400000;
    const files = fs.readdirSync(LOG_DIR);
    for (const file of files) {
      if (!/\.log$/.test(file)) continue;
      const filePath = path.join(LOG_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile() && stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
      }
    }
  } catch {
    /* best-effort cleanup */
  }
}

function error(message: string, ...args: unknown[]): void {
  log('error', message, ...args);
}
function warn(message: string, ...args: unknown[]): void {
  log('warn', message, ...args);
}
function info(message: string, ...args: unknown[]): void {
  log('info', message, ...args);
}
function debug(message: string, ...args: unknown[]): void {
  log('debug', message, ...args);
}

export default { error, warn, info, debug, audit, morganStream, cleanupOldLogs };
