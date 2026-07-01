import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS ?? '30', 10);
const isTest = process.env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined'; // Suppress file I/O during tests

const streams = new Map<string, fs.WriteStream>();
let currentDateTag = '';

function dateTag(): string {
  return new Date().toISOString().slice(0, 10);
}

function timestamp(): string {
  return new Date().toISOString();
}

function getStream(file: string): fs.WriteStream {
  const tag = dateTag();
  if (currentDateTag !== tag) {
    // Rotate log files daily
    closeAllStreams();
    currentDateTag = tag;
  }
  const key = file + '|' + tag;
  let s = streams.get(key);
  if (!s) {
    if (!isTest) {
      try {
        fs.mkdirSync(LOG_DIR, { recursive: true });
      } catch {
        /* noop */
      }
    }
    const filePath = path.join(LOG_DIR, file.replace('{date}', tag));
    s = fs.createWriteStream(filePath, { flags: 'a' }); // Append mode preserves existing logs
    streams.set(key, s);
  }
  return s;
}

export function closeAllStreams(): void {
  for (const s of streams.values()) {
    try {
      s.end();
    } catch {
      /* noop */
    }
  }
  streams.clear();
}

function appendLine(file: string, line: string): void {
  if (isTest) return;
  const s = getStream(file);
  s.write(line + '\n');
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
const LOG_FORMAT_JSON = process.env.LOG_FORMAT === 'json';

function shouldLog(level: LogLevel): boolean {
  return LEVEL_NUM[level] <= configuredLevel;
}

function log(level: LogLevel, message: string, ...args: unknown[]): void {
  if (!shouldLog(level)) return;
  const ts = timestamp();
  const formattedArgs =
    args.length > 0 ? args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ') : '';
  const line = formattedArgs ? `${message} ${formattedArgs}` : message;
  if (LOG_FORMAT_JSON) {
    const entry = JSON.stringify({ timestamp: ts, level, message, args: args.length > 0 ? args : undefined });
    if (!isTest) console.log(entry);
    appendLine(`app-{date}.log`, entry);
  } else {
    if (!isTest) {
      console.log(`${CONSOLE_COLORS[level]}[${level.toUpperCase()}]${CONSOLE_RESET} ${line}`);
    }
    appendLine(`app-{date}.log`, `[${ts}] [${level.toUpperCase()}] ${line}`);
  }
}

export function audit(action: string, detail: string): void {
  const ts = timestamp();
  if (LOG_FORMAT_JSON) {
    const entry = JSON.stringify({ timestamp: ts, level: 'audit', action, detail });
    if (!isTest) console.log(entry);
    appendLine(`audit-{date}.log`, entry);
  } else {
    const line = `[AUDIT] ${action} — ${detail}`;
    if (!isTest) console.log(`\x1b[35m${line}\x1b[0m`);
    appendLine(`audit-{date}.log`, `[${ts}] ${line}`);
  }
}

export function morganStream(): { write: (msg: string) => void } {
  return {
    write: (msg: string) => {
      const trimmed = msg.trim();
      if (!trimmed) return; // Skip empty HTTP log lines
      appendLine(`http-{date}.log`, `[${timestamp()}] ${trimmed}`);
    },
  };
}

export function cleanupOldLogs(): void {
  if (isTest) return;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const cutoff = Date.now() - LOG_RETENTION_DAYS * 86400000;
    let files: string[];
    try {
      files = fs.readdirSync(LOG_DIR);
    } catch {
      return;
    }
    for (const file of files) {
      if (!/\.log$/.test(file)) continue;
      const filePath = path.join(LOG_DIR, file);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(filePath);
      } catch {
        continue;
      }
      if (stat.isFile() && stat.mtimeMs < cutoff) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          /* noop */
        }
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
