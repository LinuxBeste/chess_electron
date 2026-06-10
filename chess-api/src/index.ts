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
import { cleanupIpRateBuckets } from './routes';

export const app: Express = express();

/* ─── Environment defaults ─── */

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const WS_HEARTBEAT_INTERVAL = parseInt(process.env.WS_HEARTBEAT_INTERVAL ?? '30000', 10);
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/* Validate critical env vars */
if (!process.env.ADMIN_PASSWORD && !process.env.JEST_WORKER_ID) {
  console.warn('[WARN] ADMIN_PASSWORD not set — a random password will be generated and logged on first request');
}

function log(level: string, ...args: unknown[]): void {
  const levels = { error: 0, warn: 1, info: 2, debug: 3 };
  if ((levels[level as keyof typeof levels] ?? 0) <= (levels[LOG_LEVEL as keyof typeof levels] ?? 2)) {
    console.log(`[${level.toUpperCase()}]`, ...args);
  }
}

/* Security headers via helmet */
app.use(helmet());
/* Request logging (skip in test) */
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('short'));
}
/* CORS: allow specific origin or wildcard (Electron loads from file://) */
if (CORS_ORIGIN === '*') {
  log('warn', 'CORS origin is set to * — restrict this in production');
}
app.use(cors({ origin: CORS_ORIGIN, credentials: CORS_ORIGIN !== '*' }));
/* Parse incoming JSON request bodies for all routes */
app.use(express.json());
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

/**
 * Create an HTTP server with WebSocket upgrade support.
 *
 * WebSocket connections are authenticated via the Sec-WebSocket-Protocol
 * header (subprotocol). The client sends the bearer token as the sole
 * subprotocol, and the server extracts it on upgrade.
 */
export function createServer(): http.Server {
  const server = http.createServer(app);

  const wss = new WebSocketServer({
    server,
    handleProtocols: (protocols) => {
      return protocols.values().next().value || false;
    },
  });

  /* Periodic heartbeat to detect stale connections */
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, WS_HEARTBEAT_INTERVAL);

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    /* Extract the bearer token from the Sec-WebSocket-Protocol header.
     * The client sends the token as a subprotocol, which `handleProtocols`
     * above accepted and stored in ws.protocol. */
    const token = ws.protocol || (req.headers['sec-websocket-protocol'] as string | undefined);

    /* Reject connections without a token */
    if (!token) {
      ws.close(4001, 'Token required');
      return;
    }

    /* Reject connections with an invalid/unknown token */
    const player = game.authenticatePlayer(token);
    if (!player) {
      ws.close(4001, 'Invalid token');
      return;
    }

    /* Register the connection so the player receives game events */
    game.registerWSConnection(player.id, ws);

    let spectatingGameId: string | null = null;

    /* Handle incoming WS messages (spectate, unspectate, chat, etc.) */
    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'spectate' && typeof msg.gameId === 'string') {
          if (game.registerSpectator(msg.gameId, ws)) {
            spectatingGameId = msg.gameId;
            ws.send(JSON.stringify({ type: 'spectate_ok', gameId: msg.gameId }));
          } else {
            ws.send(JSON.stringify({ type: 'spectate_error', error: 'Game not found or not active' }));
          }
        } else if (msg.type === 'unspectate' && spectatingGameId) {
          game.removeSpectator(spectatingGameId, ws);
          spectatingGameId = null;
        } else if (msg.type === 'chat_message' && typeof msg.gameId === 'string' && typeof msg.text === 'string') {
          game.handleChatMessage(msg.gameId, player.id, (msg.text as string).trim(), ws);
        } else if (msg.type === 'offer_draw' && typeof msg.gameId === 'string') {
          game.offerDraw(msg.gameId as string, player.id);
        } else if (msg.type === 'accept_draw' && typeof msg.gameId === 'string') {
          game.acceptDraw(msg.gameId as string, player.id);
        } else if (msg.type === 'decline_draw' && typeof msg.gameId === 'string') {
          game.declineDraw(msg.gameId as string, player.id);
        } else if (msg.type === 'challenge' && typeof msg.toPlayerId === 'string' && typeof msg.gameId === 'string') {
          game.sendToPlayer(msg.toPlayerId as string, {
            type: 'challenge',
            gameId: msg.gameId,
            fromPlayerId: player.id,
            fromUsername: player.username,
            fromDisplayName: player.displayName,
          });
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
        }
      } catch {
        /* Ignore malformed messages */
      }
    });

    /* Prevent crash on WS errors — cleanup happens in 'close' */
    ws.on('error', () => {
      ws.close();
    });

    /* Clean up when the connection drops */
    ws.on('close', () => {
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

/* Conditional server start: skip when imported by Jest (test environment).
 * This lets supertest bind to the app without port conflicts. */
const isTestEnv = typeof process.env.JEST_WORKER_ID !== 'undefined' || process.env.NODE_ENV === 'test';
if (!isTestEnv) {
  const server = createServer();
  /* Periodic cleanup of IP rate-limit buckets */
  setInterval(cleanupIpRateBuckets, 60000);

  server.listen(PORT, () => {
    log('info', `Chess API server listening on port ${PORT}`);
    log('info', `CORS origin: ${CORS_ORIGIN}`);
    log('info', `WS heartbeat interval: ${WS_HEARTBEAT_INTERVAL}ms`);
  });
}
