/* Bootstrap file — creates the Express app, attaches WebSocket support,
 * and starts listening on the configured port.  Exported separately so
 * supertest can import the app without starting the server. */

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import routes from './routes';
import adminRouter from './admin';
import * as game from './game';
import logger from './logger';
import { cleanupIpRateBuckets } from './routes';

export const app: Express = express();

/* Trust the first proxy (cloudflared) for correct IP detection */
app.set('trust proxy', 1);

/* ─── Environment defaults ─── */

const PORT = parseInt(process.env.PORT ?? '25565', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const WS_HEARTBEAT_INTERVAL = parseInt(process.env.WS_HEARTBEAT_INTERVAL ?? '30000', 10);
const WS_PONG_TIMEOUT = parseInt(process.env.WS_PONG_TIMEOUT ?? '10000', 10);
const WS_MAX_CONNECTIONS_PER_IP = parseInt(process.env.WS_MAX_CONNECTIONS_PER_IP ?? '5', 10);

/* Validate critical env vars */
if (!process.env.ADMIN_PASSWORD && !process.env.JEST_WORKER_ID) {
  logger.warn('ADMIN_PASSWORD not set — a random password will be generated and logged on first request');
}

/* Security headers via helmet */
app.use(helmet());
/* Request logging to both console and file (skip in test) */
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('short', { stream: logger.morganStream() }));
}
/* CORS: allow specific origin or wildcard (Electron loads from file://) */
if (CORS_ORIGIN === '*') {
  logger.warn('CORS origin is set to * — restrict this in production');
}
app.use(cors({ origin: CORS_ORIGIN, credentials: CORS_ORIGIN !== '*' }));
/* Parse incoming JSON request bodies — 10kb is plenty for chess data */
app.use(express.json({ limit: '10kb' }));
/* Attach all API routes */
app.use(routes);

/* Ensure avatar upload directory exists, then serve it */
const avatarDir = path.join(path.resolve(__dirname, '..'), 'data', 'avatars');
fs.mkdirSync(avatarDir, { recursive: true });
app.use('/avatars', express.static(avatarDir));
/* Serve admin dashboard static files (React build output in dist/admin/) */
const adminDir = path.join(path.resolve(__dirname, '..'), 'dist', 'admin');
app.use('/admin', express.static(adminDir));
/* Attach admin API routes (login, stats, accounts CRUD) */
app.use(adminRouter);

/* ─── Global Express error handler ─── */
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const msg = err instanceof Error ? err.message : String(err);
  logger.error('Unhandled error:', msg);
  res.status(500).json({ error: 'Internal server error' });
});

/**
 * Create an HTTP server with WebSocket upgrade support.
 *
 * WebSocket connections are authenticated via the Sec-WebSocket-Protocol
 * header (subprotocol). The client sends the bearer token as the sole
 * subprotocol, and the server extracts it on upgrade.
 */
/* Track WS connections per IP to limit abuse */
const wsIpCount = new Map<string, number>();

export function createServer(): http.Server {
  const server = http.createServer(app);

  const wss = new WebSocketServer({
    server,
    handleProtocols: (protocols) => {
      return protocols.values().next().value || false;
    },
  });

  /* Expose for graceful shutdown */
  (server as any).__wss = wss;

  /* Periodic heartbeat to detect stale connections */
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        (ws as any).__pongReceived = false;
        ws.ping();
        /* If no pong within timeout, terminate */
        setTimeout(() => {
          if ((ws as any).__pongReceived === false && ws.readyState === WebSocket.OPEN) {
            logger.warn('WS pong timeout — terminating stale connection');
            ws.terminate();
          }
        }, WS_PONG_TIMEOUT);
      }
    });
  }, WS_HEARTBEAT_INTERVAL);

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    /* Track IP for connection limit */
    const clientIp = req.socket.remoteAddress || 'unknown';
    const current = wsIpCount.get(clientIp) ?? 0;
    if (current >= WS_MAX_CONNECTIONS_PER_IP) {
      logger.warn('WS connection limit exceeded for IP: ' + clientIp);
      ws.close(4003, 'Too many connections from this IP');
      return;
    }
    wsIpCount.set(clientIp, current + 1);

    /* Mark pong received on pong frames */
    (ws as any).__pongReceived = true;
    ws.on('pong', () => {
      (ws as any).__pongReceived = true;
    });

    /* Extract the bearer token from the Sec-WebSocket-Protocol header. */
    const token = ws.protocol || (req.headers['sec-websocket-protocol'] as string | undefined);

    /* Reject connections without a token */
    if (!token) {
      decrementWsIp(clientIp);
      ws.close(4001, 'Token required');
      return;
    }

    /* Reject connections with an invalid/unknown token */
    const player = game.authenticatePlayer(token);
    if (!player) {
      decrementWsIp(clientIp);
      ws.close(4001, 'Invalid token');
      return;
    }

    /* Register the connection so the player receives game events */
    game.registerWSConnection(player.id, ws);
    logger.info('WS connection established: playerId=' + player.id);

    let spectatingGameId: string | null = null;

    /* Handle incoming WS messages (spectate, unspectate, chat, etc.) */
    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'spectate' && typeof msg.gameId === 'string') {
          if (game.registerSpectator(msg.gameId, ws)) {
            spectatingGameId = msg.gameId;
            ws.send(JSON.stringify({ type: 'spectate_ok', gameId: msg.gameId }));
            logger.info('WS spectate: playerId=' + player.id + ' gameId=' + msg.gameId);
          } else {
            ws.send(JSON.stringify({ type: 'spectate_error', error: 'Game not found or not active' }));
          }
        } else if (msg.type === 'unspectate' && spectatingGameId) {
          game.removeSpectator(spectatingGameId, ws);
          logger.info('WS unspectate: playerId=' + player.id + ' gameId=' + spectatingGameId);
          spectatingGameId = null;
        } else if (msg.type === 'chat_message' && typeof msg.gameId === 'string' && typeof msg.text === 'string') {
          game.handleChatMessage(msg.gameId, player.id, (msg.text as string).trim(), ws);
        } else if (msg.type === 'get_chat_history' && typeof msg.gameId === 'string') {
          game.sendChatHistory(msg.gameId as string, ws);
        } else if (msg.type === 'offer_draw' && typeof msg.gameId === 'string') {
          game.offerDraw(msg.gameId as string, player.id);
        } else if (msg.type === 'accept_draw' && typeof msg.gameId === 'string') {
          game.acceptDraw(msg.gameId as string, player.id);
        } else if (msg.type === 'decline_draw' && typeof msg.gameId === 'string') {
          game.declineDraw(msg.gameId as string, player.id);
        } else if (msg.type === 'rematch_offer' && typeof msg.gameId === 'string') {
          game.offerRematch(msg.gameId as string, player.id);
        } else if (msg.type === 'rematch_accept' && typeof msg.gameId === 'string') {
          game.acceptRematch(msg.gameId as string, player.id);
        } else if (msg.type === 'challenge' && typeof msg.toPlayerId === 'string' && typeof msg.gameId === 'string') {
          game.sendToPlayer(msg.toPlayerId as string, {
            type: 'challenge',
            gameId: msg.gameId,
            fromPlayerId: player.id,
            fromUsername: player.username,
            fromDisplayName: player.displayName,
          });
          logger.info('WS challenge: from=' + player.id + ' to=' + msg.toPlayerId + ' gameId=' + msg.gameId);
        } else if (
          msg.type === 'challenge_accept' &&
          typeof msg.toPlayerId === 'string' &&
          typeof msg.gameId === 'string'
        ) {
          game.sendToPlayer(msg.toPlayerId as string, {
            type: 'challenge_accept',
            gameId: msg.gameId,
            fromPlayerId: player.id,
          });
          logger.info('WS challenge accept: from=' + player.id + ' to=' + msg.toPlayerId + ' gameId=' + msg.gameId);
        } else if (
          msg.type === 'challenge_decline' &&
          typeof msg.toPlayerId === 'string' &&
          typeof msg.gameId === 'string'
        ) {
          game.sendToPlayer(msg.toPlayerId as string, {
            type: 'challenge_decline',
            gameId: msg.gameId,
            fromPlayerId: player.id,
          });
          logger.info('WS challenge decline: from=' + player.id + ' to=' + msg.toPlayerId + ' gameId=' + msg.gameId);
        }
      } catch (e) {
        logger.warn('WS malformed message from playerId=' + player.id + ': ' + e);
      }
    });

    /* Prevent crash on WS errors — cleanup happens in 'close' */
    ws.on('error', (err) => {
      logger.warn('WS error for playerId=' + player.id + ': ' + err);
      ws.close();
    });

    /* Clean up when the connection drops */
    ws.on('close', () => {
      decrementWsIp(clientIp);
      game.removeWSConnection(player.id, ws);
      game.cleanupPlayerWaitingGames(player.id);
      if (spectatingGameId) {
        game.removeSpectator(spectatingGameId, ws);
      }
    });
  });

  /* Clean up heartbeat on server close */
  server.on('close', () => clearInterval(heartbeatInterval));

  return server;
}

function decrementWsIp(ip: string): void {
  const count = wsIpCount.get(ip) ?? 1;
  if (count <= 1) wsIpCount.delete(ip);
  else wsIpCount.set(ip, count - 1);
}

/* ─── Crash safety: prevent process exit on unhandled rejections/errors ─── */
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection:', reason instanceof Error ? reason.message : String(reason));
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception:', err.message);
  /* Still exit after logging — process may be in an unknown state */
  process.exitCode = 1;
});

/* Conditional server start: skip when imported by Jest (test environment).
 * This lets supertest bind to the app without port conflicts. */
const isTestEnv = typeof process.env.JEST_WORKER_ID !== 'undefined' || process.env.NODE_ENV === 'test';
if (!isTestEnv) {
  const server = createServer();
  /* Periodic cleanup of IP rate-limit buckets */
  setInterval(cleanupIpRateBuckets, 60000);
  /* Clean up old log files daily */
  logger.cleanupOldLogs();
  setInterval(logger.cleanupOldLogs, 86400000);

  server.listen(PORT, () => {
    logger.info('Chess API server listening on port ' + PORT);
    logger.info('CORS origin: ' + CORS_ORIGIN);
    logger.info('WS heartbeat interval: ' + WS_HEARTBEAT_INTERVAL + 'ms');
  });

  /* Graceful shutdown on SIGTERM/SIGINT */
  function shutdown(signal: string): void {
    logger.info('Received ' + signal + ' — shutting down gracefully...');
    server.close(() => {
      logger.info('HTTP server closed');
      const wss: WebSocketServer | undefined = (server as any).__wss;
      if (wss) {
        wss.clients.forEach((client) => {
          client.close(1001, 'Server shutting down');
        });
      }
      /* Close DB connection if applicable */
      const db = require('./db') as typeof import('./db');
      if (typeof db.closeDb === 'function') db.closeDb();
      logger.info('Shutdown complete');
      process.exit(0);
    });
    /* Force exit after 10 seconds regardless */
    setTimeout(() => {
      logger.warn('Forced shutdown after timeout');
      process.exit(1);
    }, 10000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
