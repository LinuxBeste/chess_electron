import * as client from 'prom-client';
import logger from './logger.js';
import * as db from './db.js';
import * as redis from './redis.js';
import { engineManager } from './engine.js';
import { games, wsConnections } from './state.js';

const ENABLE_SENTRY = process.env.SENTRY_DSN ? true : false;
const ENABLE_METRICS = process.env.DISABLE_METRICS !== 'true';

let sentryInitialized = false;

export async function initSentry(): Promise<void> {
  if (!ENABLE_SENTRY || sentryInitialized) return;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN!,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
      enabled: !process.env.JEST_WORKER_ID,
    });
    sentryInitialized = true;
    logger.info('Sentry initialized');
  } catch (err) {
    logger.warn('Sentry init failed (SENTRY_DSN set but @sentry/node not installed?): ' + err);
  }
}

export function getSentryRequestHandler() {
  if (!ENABLE_SENTRY) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node');
    return Sentry.Handlers.requestHandler();
  } catch {
    return null;
  }
}

export function getSentryErrorHandler() {
  if (!ENABLE_SENTRY) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node');
    return Sentry.Handlers.errorHandler();
  } catch {
    return null;
  }
}

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export function registerMetrics(enableFlag: boolean): {
  httpRequestDuration: client.Histogram<string>;
  httpRequestTotal: client.Counter<string>;
} | null {
  if (!enableFlag) return null;
  try {
    const httpRequestDuration = new client.Histogram({
      name: 'chess_http_request_duration_ms',
      help: 'HTTP request duration in ms',
      labelNames: ['method', 'route', 'status'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 3000],
      registers: [register],
    });

    const gamesActiveGauge = new client.Gauge({
      name: 'chess_games_active',
      help: 'Number of active games',
      registers: [register],
    });

    const playersOnlineGauge = new client.Gauge({
      name: 'chess_players_online',
      help: 'Number of connected players',
      registers: [register],
    });

    const wsConnectionsGauge = new client.Gauge({
      name: 'chess_ws_connections',
      help: 'Number of WebSocket connections',
      registers: [register],
    });

    const enginePoolGauge = new client.Gauge({
      name: 'chess_engine_pool',
      help: 'Engine pool usage',
      labelNames: ['state'],
      registers: [register],
    });

    const httpRequestTotal = new client.Counter({
      name: 'chess_http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [register],
    });

    setInterval(() => {
      gamesActiveGauge.set(games.size);
      playersOnlineGauge.set(wsConnections.size);
      const wsCount = Array.from(wsConnections.values()).reduce((s, set) => s + set.size, 0);
      wsConnectionsGauge.set(wsCount);
      enginePoolGauge.set({ state: 'active' }, engineManager.activeCount);
      enginePoolGauge.set({ state: 'max' }, engineManager.maxConcurrentEngines);
    }, 10000);

    return { httpRequestDuration, httpRequestTotal };
  } catch (err) {
    logger.warn('Prometheus metrics init failed: ' + err);
    return null;
  }
}

// Return Prometheus-format metrics
export async function getMetricsResponse(): Promise<string> {
  if (!ENABLE_METRICS) return '# Metrics disabled';
  try {
    return await register.metrics();
  } catch {
    return '# Metrics error';
  }
}

/* ─── CAPTCHA verification (Cloudflare Turnstile / Google reCAPTCHA) ─── */

// Verify turnstile token against Cloudflare API

export async function verifyCaptchaToken(token: string, ip: string): Promise<boolean> {
  const secret = process.env.CAPTCHA_SECRET_KEY;
  if (!secret) return true; // No CAPTCHA configured — skip
  try {
    const params = new URLSearchParams({ secret, response: token, remoteip: ip });
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: params,
    });
    const data = (await resp.json()) as { success: boolean; 'error-codes'?: string[] };
    if (!data.success) {
      logger.warn('CAPTCHA verification failed: ' + JSON.stringify(data['error-codes']));
    }
    return data.success;
  } catch (err) {
    logger.error('CAPTCHA verify request failed: ' + err);
    return false;
  }
}

export async function getHealthDetails(): Promise<{
  status: string;
  uptime: number;
  gamesActive: number;
  playersOnline: number;
  wsConnections: number;
  database: { connected: boolean; latencyMs: number; poolTotal: number; poolIdle: number; poolWaiting: number };
  redis: { enabled: boolean };
  engine: { active: number; max: number; available: number };
  memory: { rss: number; heapUsed: number; heapTotal: number; external: number };
  nodeVersion: string;
  timestamp: number;
}> {
  let dbConnected = false;
  let dbLatency = -1;
  let poolTotal = 0;
  let poolIdle = 0;
  let poolWaiting = 0;
  try {
    const pool = db.getDb();
    const start = process.hrtime.bigint();
    await pool.query('SELECT 1');
    dbLatency = Number(process.hrtime.bigint() - start) / 1e6;
    dbConnected = true;
    poolTotal = pool.totalCount;
    poolIdle = pool.idleCount;
    poolWaiting = pool.waitingCount;
  } catch {}

  const redisEnabled = redis.isRedisEnabled();

  const memUsage = process.memoryUsage();
  const wsCount = Array.from(wsConnections.values()).reduce((s, set) => s + set.size, 0);

  return {
    status: 'ok',
    uptime: process.uptime(),
    gamesActive: games.size,
    playersOnline: wsConnections.size,
    wsConnections: wsCount,
    database: { connected: dbConnected, latencyMs: dbLatency, poolTotal, poolIdle, poolWaiting },
    redis: { enabled: redisEnabled },
    engine: {
      active: engineManager.activeCount,
      max: engineManager.maxConcurrentEngines,
      available: engineManager.maxConcurrentEngines - engineManager.activeCount,
    },
    memory: {
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
    },
    nodeVersion: process.version,
    timestamp: Date.now(),
  };
}
