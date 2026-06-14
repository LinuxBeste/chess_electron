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
import * as db from './db';
import logger from './logger';
import { cleanupIpRateBuckets } from './routes';

export const app: Express = express();

app.set('trust proxy', 1);

const PORT = parseInt(process.env.PORT ?? '25565', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const WS_HEARTBEAT_INTERVAL = parseInt(process.env.WS_HEARTBEAT_INTERVAL ?? '30000', 10);
const WS_PONG_TIMEOUT = parseInt(process.env.WS_PONG_TIMEOUT ?? '10000', 10);
const WS_MAX_CONNECTIONS_PER_IP = parseInt(process.env.WS_MAX_CONNECTIONS_PER_IP ?? '5', 10);

if (!process.env.ADMIN_PASSWORD && !process.env.JEST_WORKER_ID) {
  logger.warn('ADMIN_PASSWORD not set — a random password will be generated and logged on first request');
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'https:', 'data:'],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
  }),
);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('short', { stream: logger.morganStream() }));
}

if (CORS_ORIGIN === '*') {
  logger.warn('CORS origin is set to * — restrict this in production');
}
app.use(cors({ origin: CORS_ORIGIN, credentials: CORS_ORIGIN !== '*' }));
app.use(express.json({ limit: '10kb' }));

app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    logger.warn('Request timeout: ' + req.method + ' ' + req.path);
    if (!res.headersSent) {
      res.status(503).json({ error: 'Request timeout' });
    }
    req.destroy();
  });
  next();
});

app.use(routes);

const avatarDir = path.join(path.resolve(__dirname, '..'), 'data', 'avatars');
fs.mkdirSync(avatarDir, { recursive: true });
app.use('/avatars', express.static(avatarDir));

const adminDir = path.join(path.resolve(__dirname, '..'), 'dist', 'admin');
app.use('/admin', express.static(adminDir));
app.use(adminRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error('Unhandled error:', msg, stack ? '\n' + stack : '');
  res.status(500).json({ error: 'Internal server error' });
});

const wsIpCount = new Map<string, number>();

export function createServer(): http.Server {
  const server = http.createServer(app);

  const wss = new WebSocketServer({
    server,
    handleProtocols: (protocols) => protocols.values().next().value || false,
  });

  (server as any).__wss = wss;

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        (ws as any).__pongReceived = false;
        ws.ping();
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
    const clientIp = req.socket.remoteAddress || 'unknown';
    const current = wsIpCount.get(clientIp) ?? 0;
    if (current >= WS_MAX_CONNECTIONS_PER_IP) {
      logger.warn('WS connection limit exceeded for IP: ' + clientIp);
      ws.close(4003, 'Too many connections from this IP');
      return;
    }
    wsIpCount.set(clientIp, current + 1);

    (ws as any).__pongReceived = true;
    ws.on('pong', () => { (ws as any).__pongReceived = true; });

    const token = ws.protocol || (req.headers['sec-websocket-protocol'] as string | undefined);

    if (!token) {
      decrementWsIp(clientIp);
      ws.close(4001, 'Token required');
      return;
    }

    const player = game.authenticatePlayer(token);
    if (!player) {
      decrementWsIp(clientIp);
      ws.close(4001, 'Invalid token');
      return;
    }

    game.registerWSConnection(player.id, ws);
    logger.info('WS connection established: playerId=' + player.id);

    let spectatingGameId: string | null = null;

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'spectate' && typeof msg.gameId === 'string') {
          const code: string | undefined = typeof msg.code === 'string' ? msg.code : undefined;
          if (game.registerSpectator(msg.gameId, ws, code)) {
            spectatingGameId = msg.gameId;
            ws.send(JSON.stringify({ type: 'spectate_ok', gameId: msg.gameId }));
            logger.info('WS spectate: playerId=' + player.id + ' gameId=' + msg.gameId);
          } else {
            ws.send(JSON.stringify({ type: 'spectate_error', error: 'Game not found, not active, or invalid spectate code' }));
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
        } else if (msg.type === 'challenge_accept' && typeof msg.toPlayerId === 'string' && typeof msg.gameId === 'string') {
          game.sendToPlayer(msg.toPlayerId as string, {
            type: 'challenge_accept',
            gameId: msg.gameId,
            fromPlayerId: player.id,
          });
          logger.info('WS challenge accept: from=' + player.id + ' to=' + msg.toPlayerId + ' gameId=' + msg.gameId);
        } else if (msg.type === 'challenge_decline' && typeof msg.toPlayerId === 'string' && typeof msg.gameId === 'string') {
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

    ws.on('error', (err) => {
      logger.warn('WS error for playerId=' + player.id + ': ' + err);
      ws.close();
    });

    ws.on('close', () => {
      decrementWsIp(clientIp);
      game.removeWSConnection(player.id, ws);
      game.cleanupPlayerWaitingGames(player.id);
      if (spectatingGameId) {
        game.removeSpectator(spectatingGameId, ws);
      }
    });
  });

  server.on('close', () => clearInterval(heartbeatInterval));

  return server;
}

function decrementWsIp(ip: string): void {
  const count = wsIpCount.get(ip) ?? 1;
  if (count <= 1) wsIpCount.delete(ip);
  else wsIpCount.set(ip, count - 1);
}

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection:', reason instanceof Error ? reason.message : String(reason));
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception:', err.message);
  process.exitCode = 1;
});

const isTestEnv = typeof process.env.JEST_WORKER_ID !== 'undefined' || process.env.NODE_ENV === 'test';
if (!isTestEnv) {
  const server = createServer();
  setInterval(cleanupIpRateBuckets, 60000);
  setInterval(() => {
    game.cleanupRateLimitBuckets();
    game.cleanupLoginAttempts();
  }, 60000);
  logger.cleanupOldLogs();
  setInterval(logger.cleanupOldLogs, 86400000);
  setInterval(() => db.cleanupExpiredTokens(), 3600000);

  const DB_BACKUP_INTERVAL_MS = parseInt(process.env.DB_BACKUP_INTERVAL_MS ?? String(6 * 3600000), 10);
  if (DB_BACKUP_INTERVAL_MS > 0) {
    db.createBackup();
    setInterval(() => db.createBackup(), DB_BACKUP_INTERVAL_MS);
  }

  server.listen(PORT, () => {
    logger.info('Chess API server listening on port ' + PORT);
    logger.info('CORS origin: ' + CORS_ORIGIN);
    logger.info('WS heartbeat interval: ' + WS_HEARTBEAT_INTERVAL + 'ms');
  });

  function shutdown(signal: string): void {
    logger.info('Received ' + signal + ' — shutting down gracefully...');
    game.killAllEngines();
    server.close(() => {
      logger.info('HTTP server closed');
      const wss: WebSocketServer | undefined = (server as any).__wss;
      if (wss) {
        wss.clients.forEach((client) => client.close(1001, 'Server shutting down'));
      }
      if (typeof db.closeDb === 'function') db.closeDb();
      logger.info('Shutdown complete');
      process.exit(0);
    });
    setTimeout(() => {
      logger.warn('Forced shutdown after timeout');
      process.exit(1);
    }, 10000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
