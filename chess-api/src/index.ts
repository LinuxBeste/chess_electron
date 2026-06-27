import { fileURLToPath } from 'url';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import routes from './routes.js';
import adminRouter from './admin.js';
import friendsRouter from './friends.js';
import * as game from './game.js';
import * as db from './db.js';
import * as chat from './chat.js';
import * as redis from './redis.js';
import * as state from './state.js';
import { players } from './player.js';
import logger from './logger.js';
import { cleanupIpRateBuckets, cleanupRegBuckets } from './routes.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app: Express = express();

app.set('trust proxy', 1); // Respect X-Forwarded-For behind nginx

const PORT = parseInt(process.env.PORT ?? '25565', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const WS_HEARTBEAT_INTERVAL = parseInt(process.env.WS_HEARTBEAT_INTERVAL ?? '30000', 10);
const WS_PONG_TIMEOUT = parseInt(process.env.WS_PONG_TIMEOUT ?? '10000', 10);
const WS_MAX_CONNECTIONS_PER_IP = parseInt(process.env.WS_MAX_CONNECTIONS_PER_IP ?? '5', 10);

if (!process.env.ADMIN_PASSWORD && !process.env.JEST_WORKER_ID) {
  logger.warn('ADMIN_PASSWORD not set — a random password will be generated and logged on first request'); // Dev convenience, insecure for production
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
  if (process.env.NODE_ENV === 'production') {
    logger.error('CORS_ORIGIN is set to * in production — refusing to start. Set CORS_ORIGIN to a specific origin.');
    process.exit(1); // Hard fail — wildcard CORS is a security risk
  }
  logger.warn('CORS origin is set to * — restrict this in production');
}
app.use(cors({ origin: CORS_ORIGIN, credentials: CORS_ORIGIN !== '*' }));
app.use(express.json({ limit: '10kb' })); // Prevent large payload attacks

app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    // Global 30s timeout for all routes
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
app.use(adminRouter); // Admin API routes under /admin/api/
app.get('/admin/*', (_req, res) => {
  // SPA fallback — all non-API paths serve index.html
  res.sendFile(path.join(adminDir, 'index.html'));
});
app.use(friendsRouter);

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
    handleProtocols: (protocols) => protocols.values().next().value || false, // Pick first protocol client offers (the auth token)
  });

  (server as http.Server & { __wss: WebSocketServer }).__wss = wss;

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        (ws as WebSocket & { __pongReceived: boolean }).__pongReceived = false;
        ws.ping();
        setTimeout(() => {
          if (
            (ws as WebSocket & { __pongReceived: boolean }).__pongReceived === false &&
            ws.readyState === WebSocket.OPEN
          ) {
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

    (ws as WebSocket & { __pongReceived: boolean }).__pongReceived = true;
    ws.on('pong', () => {
      (ws as WebSocket & { __pongReceived: boolean }).__pongReceived = true;
    });

    /* sec-websocket-protocol is a comma-separated list; pick the first real value.
       ws.protocol is the server-chosen protocol, not the client token. */
    const protocolHeader = req.headers['sec-websocket-protocol'] as string | undefined;
    const token = protocolHeader ? protocolHeader.split(',')[0].trim() : undefined;

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

    /* ---- WS rate limiting ---- */
    const WS_RATE_LIMIT = parseInt(process.env.WS_RATE_LIMIT_PER_SEC ?? '10', 10);
    const wsMessageTimes: number[] = [];
    function isWsRateLimited(): boolean {
      const now = Date.now();
      while (wsMessageTimes.length > 0 && wsMessageTimes[0] < now - 1000) wsMessageTimes.shift();
      if (wsMessageTimes.length >= WS_RATE_LIMIT) return true;
      wsMessageTimes.push(now);
      return false;
    }

    ws.on('message', (raw: Buffer) => {
      if (isWsRateLimited()) {
        logger.warn('WS rate limited: playerId=' + player.id);
        ws.send(JSON.stringify({ type: 'error', error: 'Rate limited — slow down' }));
        return;
      }
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'spectate' && typeof msg.gameId === 'string') {
          const code: string | undefined = typeof msg.code === 'string' ? msg.code : undefined;
          if (game.registerSpectator(msg.gameId, ws, code)) {
            spectatingGameId = msg.gameId;
            ws.send(JSON.stringify({ type: 'spectate_ok', gameId: msg.gameId }));
            logger.info('WS spectate: playerId=' + player.id + ' gameId=' + msg.gameId);
          } else {
            ws.send(
              JSON.stringify({ type: 'spectate_error', error: 'Game not found, not active, or invalid spectate code' }),
            );
          }
        } else if (msg.type === 'unspectate' && spectatingGameId) {
          game.removeSpectator(spectatingGameId, ws);
          logger.info('WS unspectate: playerId=' + player.id + ' gameId=' + spectatingGameId);
          spectatingGameId = null;
        } else if (msg.type === 'chat_message' && typeof msg.gameId === 'string' && typeof msg.text === 'string') {
          const trimmed = (msg.text as string).trim().slice(0, 500);
          if (trimmed) game.handleChatMessage(msg.gameId, player.id, trimmed, ws);
        } else if (msg.type === 'get_chat_history' && typeof msg.gameId === 'string') {
          game.sendChatHistory(msg.gameId as string, ws);
        } else if (msg.type === 'lobby_chat' && typeof msg.text === 'string') {
          const trimmed = (msg.text as string).trim().slice(0, 500);
          if (trimmed) chat.handleLobbyChat(player.id, trimmed);
        } else if (msg.type === 'get_lobby_chat_history') {
          chat.sendLobbyChatHistory(ws);
        } else if (msg.type === 'private_chat' && typeof msg.toPlayerId === 'string' && typeof msg.text === 'string') {
          const trimmed = (msg.text as string).trim().slice(0, 500);
          if (trimmed) chat.handlePrivateChat(player.id, msg.toPlayerId as string, trimmed);
        } else if (msg.type === 'get_private_chat_history' && typeof msg.conversationId === 'string') {
          chat.sendPrivateChatHistory(msg.conversationId as string, ws);
        } else if (msg.type === 'get_conversations') {
          chat.getConversationsForUser(player.id).then(
            (
              convs: {
                id: string;
                type: string;
                name: string | null;
                lastMessageAt: number;
                unread: number;
                ownerId?: string;
              }[],
            ) => {
              ws.send(JSON.stringify({ type: 'conversations_list', conversations: convs }));
            },
          );
        } else if (msg.type === 'start_private_conversation' && typeof msg.toPlayerId === 'string') {
          const targetId = msg.toPlayerId as string;
          chat.getOrCreatePrivateConversation(player.id, targetId).then((convId: string) => {
            const targetPlayer = players.get(targetId);
            ws.send(
              JSON.stringify({
                type: 'conversation_created',
                conversationId: convId,
                withName: targetPlayer?.displayName || targetId.slice(0, 8),
              }),
            );
          });
        } else if (msg.type === 'offer_draw' && typeof msg.gameId === 'string') {
          game.offerDraw(msg.gameId as string, player.id);
        } else if (msg.type === 'accept_draw' && typeof msg.gameId === 'string') {
          game.acceptDraw(msg.gameId as string, player.id).catch(() => {});
        } else if (msg.type === 'decline_draw' && typeof msg.gameId === 'string') {
          game.declineDraw(msg.gameId as string, player.id);
        } else if (msg.type === 'rematch_offer' && typeof msg.gameId === 'string') {
          game.offerRematch(msg.gameId as string, player.id);
        } else if (msg.type === 'rematch_accept' && typeof msg.gameId === 'string') {
          game.acceptRematch(msg.gameId as string, player.id).catch(() => {});
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
        } else if (msg.type === 'create_group' && typeof msg.name === 'string') {
          chat
            .handleCreateGroupConversation(player.id, msg.name as string)
            .then((convId: string) => {
              ws.send(JSON.stringify({ type: 'group_created', conversationId: convId, name: msg.name }));
              logger.info('WS create_group: playerId=' + player.id + ' convId=' + convId);
            })
            .catch((err: Error) => {
              ws.send(JSON.stringify({ type: 'error', error: err.message }));
            });
        } else if (
          msg.type === 'group_chat' &&
          typeof msg.conversationId === 'string' &&
          typeof msg.text === 'string'
        ) {
          const trimmed = (msg.text as string).trim().slice(0, 500);
          if (trimmed) chat.handleGroupChat(msg.conversationId as string, player.id, trimmed);
        } else if (msg.type === 'get_group_chat_history' && typeof msg.conversationId === 'string') {
          chat.sendGroupChatHistory(msg.conversationId as string, ws);
        } else if (
          msg.type === 'group_add_member' &&
          typeof msg.conversationId === 'string' &&
          typeof msg.playerId === 'string'
        ) {
          chat
            .handleAddGroupMember(msg.conversationId as string, player.id, msg.playerId as string)
            .catch((err: Error) => {
              ws.send(JSON.stringify({ type: 'error', error: err.message }));
            });
        } else if (
          msg.type === 'group_add_member_by_name' &&
          typeof msg.conversationId === 'string' &&
          typeof msg.username === 'string'
        ) {
          chat
            .handleAddGroupMemberByName(msg.conversationId as string, player.id, msg.username as string)
            .catch((err: Error) => {
              ws.send(JSON.stringify({ type: 'error', error: err.message }));
            });
        } else if (
          msg.type === 'group_remove_member' &&
          typeof msg.conversationId === 'string' &&
          typeof msg.playerId === 'string'
        ) {
          chat
            .handleRemoveGroupMember(msg.conversationId as string, player.id, msg.playerId as string)
            .catch((err: Error) => {
              ws.send(JSON.stringify({ type: 'error', error: err.message }));
            });
        } else if (
          msg.type === 'group_promote_member' &&
          typeof msg.conversationId === 'string' &&
          typeof msg.playerId === 'string'
        ) {
          chat
            .handlePromoteGroupMember(msg.conversationId as string, player.id, msg.playerId as string)
            .catch((err: Error) => {
              ws.send(JSON.stringify({ type: 'error', error: err.message }));
            });
        } else if (
          msg.type === 'group_demote_member' &&
          typeof msg.conversationId === 'string' &&
          typeof msg.playerId === 'string'
        ) {
          chat
            .handleDemoteGroupMember(msg.conversationId as string, player.id, msg.playerId as string)
            .catch((err: Error) => {
              ws.send(JSON.stringify({ type: 'error', error: err.message }));
            });
        } else if (
          msg.type === 'group_transfer_ownership' &&
          typeof msg.conversationId === 'string' &&
          typeof msg.playerId === 'string'
        ) {
          chat
            .handleTransferGroupOwnership(msg.conversationId as string, player.id, msg.playerId as string)
            .catch((err: Error) => {
              ws.send(JSON.stringify({ type: 'error', error: err.message }));
            });
        } else if (msg.type === 'group_leave' && typeof msg.conversationId === 'string') {
          chat.handleLeaveGroup(msg.conversationId as string, player.id).catch((err: Error) => {
            ws.send(JSON.stringify({ type: 'error', error: err.message }));
          });
        } else if (msg.type === 'group_disband' && typeof msg.conversationId === 'string') {
          chat.handleDisbandGroup(msg.conversationId as string, player.id).catch((err: Error) => {
            ws.send(JSON.stringify({ type: 'error', error: err.message }));
          });
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
  const timers: ReturnType<typeof setInterval>[] = [];

  timers.push(
    setInterval(() => {
      try {
        cleanupIpRateBuckets();
        cleanupRegBuckets();
      } catch (e) {
        logger.error('cleanupIpRateBuckets failed: ' + e);
      }
    }, 60000),
  );
  timers.push(
    setInterval(() => {
      try {
        game.cleanupRateLimitBuckets();
      } catch (e) {
        logger.error('cleanupRateLimitBuckets failed: ' + e);
      }
      try {
        game.cleanupLoginAttempts();
      } catch (e) {
        logger.error('cleanupLoginAttempts failed: ' + e);
      }
    }, 60000),
  );
  logger.cleanupOldLogs();
  timers.push(
    setInterval(() => {
      try {
        logger.cleanupOldLogs();
      } catch (e) {
        logger.error('cleanupOldLogs failed: ' + e);
      }
    }, 86400000),
  );
  timers.push(
    setInterval(() => {
      db.cleanupExpiredTokens().catch((e) => {
        logger.error('cleanupExpiredTokens failed: ' + e);
      });
    }, 3600000),
  );

  const DB_BACKUP_INTERVAL_MS = parseInt(process.env.DB_BACKUP_INTERVAL_MS ?? String(6 * 3600000), 10);
  if (DB_BACKUP_INTERVAL_MS > 0) {
    db.createBackup().catch((e) => {
      logger.error('Initial DB backup failed: ' + e);
    });
    timers.push(
      setInterval(() => {
        db.createBackup().catch((e) => {
          logger.error('DB backup failed: ' + e);
        });
      }, DB_BACKUP_INTERVAL_MS),
    );
  }

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error('Port ' + PORT + ' is already in use');
    } else {
      logger.error('Server error: ' + err.message);
    }
    process.exit(1);
  });

  db.initDb()
    .then(async () => {
      await redis.initRedis();
      if (redis.isRedisEnabled()) {
        redis.setMessageHandler((channel, message) => {
          try {
            const parsed = JSON.parse(message);
            if (parsed.type === 'ws_message') {
              if (channel.startsWith('player:')) {
                const playerId = channel.slice(7);
                const conns = state.wsConnections.get(playerId);
                if (conns) {
                  for (const ws of conns) {
                    if (ws.readyState === WebSocket.OPEN) ws.send(parsed.data);
                  }
                }
              } else if (channel.startsWith('spectate:')) {
                const gameId = channel.slice(9);
                const conns = state.spectatorConnections.get(gameId);
                if (conns) {
                  const data = typeof parsed.data === 'string' ? parsed.data : JSON.stringify(parsed.data);
                  for (const ws of conns) {
                    if (ws.readyState === WebSocket.OPEN) ws.send(data);
                  }
                }
              }
            }
          } catch {}
        });
        redis.psubscribe('player:*');
        redis.psubscribe('spectate:*');
        await state.syncGamesFromRedis();
        await state.syncPlayerIndexFromRedis();
      }
      await chat.ensureLobbyConversation().catch((e) => logger.error('Failed to ensure lobby conversation: ' + e));
      server.listen(PORT, () => {
        logger.info('Chess API server listening on port ' + PORT);
        logger.info('CORS origin: ' + CORS_ORIGIN);
        logger.info('WS heartbeat interval: ' + WS_HEARTBEAT_INTERVAL + 'ms');
      });
    })
    .catch((e) => {
      logger.error('DB init failed: ' + e);
      process.exit(1);
    });

  function shutdown(signal: string): void {
    logger.info('Received ' + signal + ' — shutting down gracefully...');
    for (const timer of timers) clearInterval(timer);
    game.killAllEngines();
    server.close(() => {
      logger.info('HTTP server closed');
      const wss = (server as http.Server & { __wss: WebSocketServer | undefined }).__wss;
      if (wss) {
        wss.clients.forEach((client) => client.close(1001, 'Server shutting down'));
      }
      if (typeof db.closeDb === 'function') db.closeDb().catch(() => {});
      redis.closeRedis().catch(() => {});
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
