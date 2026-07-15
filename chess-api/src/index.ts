import { fileURLToPath } from 'url';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { execSync } from 'child_process';
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
import * as monitoring from './monitoring.js';
import { players } from './player.js';
import logger, { closeAllStreams as closeLogStreams } from './logger.js';
import { cleanupIpRateBuckets, cleanupRegBuckets, cleanupHealthBuckets } from './routes.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app: Express = express();

app.set('trust proxy', 1); // Respect X-Forwarded-For behind nginx

const PORT = parseInt(process.env.PORT ?? '25565', 10);
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT ?? '25566', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const CORS_CREDENTIALS = process.env.CORS_CREDENTIALS !== 'false';
const WS_HEARTBEAT_INTERVAL = parseInt(process.env.WS_HEARTBEAT_INTERVAL ?? '30000', 10);
const WS_PONG_TIMEOUT = parseInt(process.env.WS_PONG_TIMEOUT ?? '10000', 10);
const WS_MAX_CONNECTIONS_PER_IP = parseInt(process.env.WS_MAX_CONNECTIONS_PER_IP ?? '5', 10);
const MAX_BODY_SIZE = process.env.MAX_BODY_SIZE || '10kb';
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS ?? '30000', 10);
const SHUTDOWN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS ?? '10000', 10);
const CLEANUP_INTERVAL_MS = parseInt(process.env.CLEANUP_INTERVAL_MS ?? '60000', 10);
const LOG_CLEANUP_INTERVAL_MS = parseInt(process.env.LOG_CLEANUP_INTERVAL_MS ?? '86400000', 10);
const TOKEN_CLEANUP_INTERVAL_MS = parseInt(process.env.TOKEN_CLEANUP_INTERVAL_MS ?? '3600000', 10);
const ENABLE_HELMET = process.env.ENABLE_HELMET !== 'false';
const ENABLE_HSTS = process.env.ENABLE_HSTS === 'true';
const ENABLE_HTTPS = process.env.ENABLE_HTTPS === 'true';
const ENABLE_MORGAN = process.env.ENABLE_MORGAN !== 'false';
const CHAT_MAX_LENGTH = parseInt(process.env.CHAT_MAX_LENGTH ?? '500', 10);

if (!process.env.ADMIN_PASSWORD && !process.env.JEST_WORKER_ID) {
  logger.warn('ADMIN_PASSWORD not set — a random password will be generated and logged on first request'); // Dev convenience, insecure for production
}

if (ENABLE_HELMET) {
  const cspScriptSrc = process.env.CSP_SCRIPT_SRC
    ? process.env.CSP_SCRIPT_SRC.split(',')
    : ["'self'", "'unsafe-inline'"];
  const cspStyleSrc = process.env.CSP_STYLE_SRC ? process.env.CSP_STYLE_SRC.split(',') : ["'self'", "'unsafe-inline'"];
  app.use(
    helmet({
      crossOriginOpenerPolicy: false,
      originAgentCluster: false,
      strictTransportSecurity: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: cspScriptSrc,
          styleSrc: cspStyleSrc,
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'https:', 'data:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'none'"],
          frameSrc: ["'none'"],
          'upgrade-insecure-requests': null,
        },
      },
      ...(ENABLE_HSTS && {
        strictTransportSecurity: {
          maxAge: parseInt(process.env.HSTS_MAX_AGE ?? String(365 * 24 * 3600), 10),
          includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS !== 'false',
          preload: process.env.HSTS_PRELOAD === 'true',
        },
      }),
    }),
  );
}

if (ENABLE_MORGAN && process.env.NODE_ENV !== 'test') {
  const MORGAN_FORMAT = process.env.MORGAN_FORMAT || 'combined';
  app.use(morgan(MORGAN_FORMAT, { stream: logger.morganStream() }));
}

if (CORS_ORIGIN === '*') {
  if (process.env.NODE_ENV === 'production') {
    logger.error('CORS_ORIGIN is set to * in production — refusing to start. Set CORS_ORIGIN to a specific origin.');
    process.exit(1); // Hard fail — wildcard CORS is a security risk
  }
  logger.warn('CORS origin is set to * — restrict this in production');
}
import crypto from 'crypto';

app.use(cors({ origin: CORS_ORIGIN, credentials: CORS_CREDENTIALS }));
app.use(express.json({ limit: MAX_BODY_SIZE }));

app.use((req, res, next) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

app.use((req, res, next) => {
  res.setTimeout(REQUEST_TIMEOUT_MS, () => {
    logger.warn('Request timeout: ' + req.method + ' ' + req.path);
    if (!res.headersSent) {
      res.status(503).json({ error: 'Request timeout' });
    }
    req.destroy();
  });
  next();
});

const ENABLE_METRICS = process.env.DISABLE_METRICS !== 'true';
const metricsInstrumentation = monitoring.registerMetrics(ENABLE_METRICS);

if (metricsInstrumentation) {
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const route = req.route?.path || req.path;
      metricsInstrumentation.httpRequestDuration.observe(
        { method: req.method, route, status: res.statusCode },
        duration,
      );
      metricsInstrumentation.httpRequestTotal.inc({ method: req.method, route, status: res.statusCode });
    });
    next();
  });
}

app.get('/metrics', async (_req: express.Request, res: express.Response) => {
  const result = await monitoring.getMetricsResponse();
  res.setHeader('Content-Type', 'text/plain');
  res.send(result);
});

const API_PREFIX = process.env.API_PREFIX || '/v1';
app.use(API_PREFIX, routes);
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

// Catch-all 404: HTML page for browsers, JSON for API clients
const NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>404 — Page not found</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#0e0e10;color:#e0e0e0;font-family:'Inter','Segoe UI',system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}
.board{display:grid;grid-template-columns:repeat(8,32px);grid-template-rows:repeat(8,32px);border:2px solid #b58863;border-radius:4px;overflow:hidden;margin-bottom:24px;box-shadow:0 8px 48px rgba(0,0,0,.5);animation:fadeUp .5s ease}
.square{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:22px}
.light{background:#f0d9b5}
.dark{background:#b58863}
h1{font-size:72px;font-weight:800;letter-spacing:-3px;color:#4f8ef7;margin:0;line-height:1;animation:fadeUp .4s ease .3s both}
p{font-size:16px;color:#888;margin:0;animation:fadeUp .4s ease .5s both}
a{display:inline-block;margin-top:20px;padding:10px 24px;border:none;border-radius:8px;background:#4f8ef7;color:#fff;font-size:14px;font-weight:500;font-family:inherit;cursor:pointer;text-decoration:none;animation:fadeUp .4s ease .7s both;transition:transform .15s ease}
a:hover{background:#5d9af8;transform:scale(1.03)}
a:active{transform:scale(.97)}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
</style>
</head>
<body>
<div class="board" id="board"></div>
<h1>404</h1>
<p>This page is out of bounds</p>
<a href="/">← Back to the board</a>
<script>var b=document.getElementById('board'),p=['♜','♞','♝','♛','♚','♝','♞','♜','♟','♟','♟','♟','♟','♟','♟','♟','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','♙','♙','♙','♙','♙','♙','♙','♙','♖','♘','♗','♕','♔','♗','♘','♖'];for(var i=0;i<64;i++){var s=document.createElement('div');s.className='square '+(Math.floor(i/8)+i%8&1?'light':'dark');var pc=p[i];if(pc){s.textContent=pc;s.style.color=i<16?'#1a1a1a':'#fff'}b.appendChild(s)}</script>
</body>
</html>`;
app.use((req, res) => {
  if (req.accepts('html')) {
    res.status(404).type('html').send(NOT_FOUND_HTML);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

const sentryRequestHandler = monitoring.getSentryRequestHandler();
if (sentryRequestHandler) app.use(sentryRequestHandler);

const sentryErrorHandler = monitoring.getSentryErrorHandler();
const originalErrorHandler: express.ErrorRequestHandler = (
  err: unknown,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) => {
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error('Unhandled error:', msg, stack ? '\n' + stack : '');
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
app.use(originalErrorHandler);
if (sentryErrorHandler) app.use(sentryErrorHandler);

const wsIpCount = new Map<string, number>();
const wsAuthAttempts = new Map<string, { count: number; blockedUntil: number }>();
const WS_AUTH_MAX_ATTEMPTS = parseInt(process.env.WS_AUTH_MAX_ATTEMPTS ?? '10', 10);
const WS_AUTH_BLOCK_DURATION_MS = parseInt(process.env.WS_AUTH_BLOCK_DURATION_MS ?? '30000', 10);

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

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const clientIp = req.socket.remoteAddress || 'unknown';

    const authEntry = wsAuthAttempts.get(clientIp);
    if (authEntry && authEntry.blockedUntil > Date.now()) {
      logger.warn('WS auth rate limited for IP: ' + clientIp);
      ws.close(4003, 'Too many auth attempts — try later');
      return;
    }

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
      recordWsAuthFailure(clientIp);
      ws.close(4001, 'Token required');
      return;
    }

    const player = await game.authenticatePlayerAsync(token);
    if (!player) {
      decrementWsIp(clientIp);
      recordWsAuthFailure(clientIp);
      ws.close(4001, 'Invalid token');
      return;
    }

    wsAuthAttempts.delete(clientIp);

    game.registerWSConnection(player.id, ws);
    logger.info('WS connection established: playerId=' + player.id);

    /* Replay buffered events for reconnection */
    const playerGameIds = state.playerGameIndex.get(player.id);
    if (playerGameIds) {
      for (const gid of playerGameIds) {
        const events = state.getBufferedEvents(gid);
        if (events.length > 0) {
          for (const evt of events) {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(evt));
          }
          logger.debug('Replayed ' + events.length + ' events for game ' + gid + ' to player ' + player.id);
        }
      }
    }

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
      if (raw.length > 65536) {
        ws.close(4009, 'Message too large');
        return;
      }
      if (isWsRateLimited()) {
        logger.warn('WS rate limited: playerId=' + player.id);
        ws.send(JSON.stringify({ type: 'error', error: 'Rate limited — slow down' }));
        return;
      }
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'spectate' && typeof msg.gameId === 'string') {
          const code: string | undefined = typeof msg.code === 'string' ? msg.code : undefined;
          if (game.registerSpectator(msg.gameId, ws, code, player.id)) {
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
          const trimmed = (msg.text as string).trim().slice(0, CHAT_MAX_LENGTH);
          if (trimmed) game.handleChatMessage(msg.gameId, player.id, trimmed, ws);
        } else if (msg.type === 'get_chat_history' && typeof msg.gameId === 'string') {
          game.sendChatHistory(msg.gameId as string, ws);
        } else if (msg.type === 'lobby_chat' && typeof msg.text === 'string') {
          const trimmed = (msg.text as string).trim().slice(0, CHAT_MAX_LENGTH);
          if (trimmed) chat.handleLobbyChat(player.id, trimmed);
        } else if (msg.type === 'get_lobby_chat_history') {
          chat.sendLobbyChatHistory(ws);
        } else if (msg.type === 'private_chat' && typeof msg.toPlayerId === 'string' && typeof msg.text === 'string') {
          const trimmed = (msg.text as string).trim().slice(0, CHAT_MAX_LENGTH);
          if (trimmed) chat.handlePrivateChat(player.id, msg.toPlayerId as string, trimmed);
        } else if (msg.type === 'get_private_chat_history' && typeof msg.conversationId === 'string') {
          chat.sendPrivateChatHistory(msg.conversationId as string, ws);
        } else if (msg.type === 'mark_conversation_read' && typeof msg.conversationId === 'string') {
          chat.markConversationRead(msg.conversationId as string, player.id).catch((err: Error) => {
            logger.error('markConversationRead failed: ' + err);
          });
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
          game
            .offerDrawSafe(msg.gameId as string, player.id)
            .catch((err: unknown) => logger.error('offerDraw failed: ' + err));
        } else if (msg.type === 'accept_draw' && typeof msg.gameId === 'string') {
          game
            .acceptDraw(msg.gameId as string, player.id)
            .catch((err: unknown) => logger.error('acceptDraw failed: ' + err));
        } else if (msg.type === 'decline_draw' && typeof msg.gameId === 'string') {
          game
            .declineDraw(msg.gameId as string, player.id)
            .catch((err: unknown) => logger.error('declineDraw failed: ' + err));
        } else if (msg.type === 'rematch_offer' && typeof msg.gameId === 'string') {
          game
            .offerRematch(msg.gameId as string, player.id)
            .catch((err: unknown) => logger.error('offerRematch failed: ' + err));
        } else if (msg.type === 'rematch_accept' && typeof msg.gameId === 'string') {
          game
            .acceptRematch(msg.gameId as string, player.id)
            .catch((err: unknown) => logger.error('acceptRematch failed: ' + err));
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
          const trimmed = (msg.text as string).trim().slice(0, CHAT_MAX_LENGTH);
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

function recordWsAuthFailure(ip: string): void {
  const entry = wsAuthAttempts.get(ip) ?? { count: 0, blockedUntil: 0 };
  entry.count++;
  if (entry.count >= WS_AUTH_MAX_ATTEMPTS) {
    entry.blockedUntil = Date.now() + WS_AUTH_BLOCK_DURATION_MS;
    logger.warn('WS auth blocked for IP: ' + ip + ' for ' + WS_AUTH_BLOCK_DURATION_MS + 'ms');
  }
  wsAuthAttempts.set(ip, entry);
}

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection:', reason instanceof Error ? reason.message : String(reason));
  process.exitCode = 1;
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception:', err.message, err.stack);
  process.exit(1);
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
        cleanupHealthBuckets();
      } catch (e) {
        logger.error('Bucket cleanup failed: ' + e);
      }
    }, CLEANUP_INTERVAL_MS),
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
      const now = Date.now();
      for (const [ip, entry] of wsAuthAttempts) {
        if (entry.blockedUntil <= now) {
          if (entry.count >= WS_AUTH_MAX_ATTEMPTS) {
            wsAuthAttempts.delete(ip);
          } else {
            entry.count = 0;
          }
        }
      }
    }, CLEANUP_INTERVAL_MS),
  );
  logger.cleanupOldLogs();
  timers.push(
    setInterval(() => {
      try {
        logger.cleanupOldLogs();
      } catch (e) {
        logger.error('cleanupOldLogs failed: ' + e);
      }
    }, LOG_CLEANUP_INTERVAL_MS),
  );
  timers.push(
    setInterval(() => {
      db.cleanupExpiredTokens().catch((e) => {
        logger.error('cleanupExpiredTokens failed: ' + e);
      });
    }, TOKEN_CLEANUP_INTERVAL_MS),
  );
  timers.push(
    setInterval(() => {
      db.cleanupExpiredPasswordResetTokens().catch((e) => {
        logger.error('cleanupExpiredPasswordResetTokens failed: ' + e);
      });
    }, TOKEN_CLEANUP_INTERVAL_MS),
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

  let httpsServer: https.Server | null = null;

  function getOrCreateCert(): { key: string; cert: string } | null {
    const dataDir = path.join(path.resolve(__dirname, '..'), 'data');
    const keyPath = path.join(dataDir, 'server.key');
    const certPath = path.join(dataDir, 'server.cert');
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      return { key: fs.readFileSync(keyPath, 'utf8'), cert: fs.readFileSync(certPath, 'utf8') };
    }
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      execSync(
        `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 3650 -nodes -subj "/CN=chess-api" 2>/dev/null`,
        { stdio: 'pipe' },
      );
      const cert = { key: fs.readFileSync(keyPath, 'utf8'), cert: fs.readFileSync(certPath, 'utf8') };
      logger.info('Self-signed HTTPS certificate generated at ' + dataDir);
      return cert;
    } catch (e) {
      logger.error('Failed to generate HTTPS certificate: ' + e);
      return null;
    }
  }

  async function startApp(): Promise<void> {
    if (ENABLE_HTTPS) {
      const cert = getOrCreateCert();
      if (cert) {
        httpsServer = https.createServer({ key: cert.key, cert: cert.cert }, app);
        httpsServer.on('upgrade', (req, socket, head) => {
          server.emit('upgrade', req, socket, head);
        });
        httpsServer.listen(HTTPS_PORT, HOST, () => {
          logger.info('HTTPS server listening on ' + HOST + ':' + HTTPS_PORT);
        });
      } else {
        logger.warn('ENABLE_HTTPS is true but could not load/generate certificate. HTTPS not available.');
      }
    }

    try {
      await redis.initRedis();
    } catch (e) {
      logger.error('Redis init failed — continuing with in-memory state: ' + e);
    }
    const EVENT_BUFFER_CLEANUP_INTERVAL = parseInt(process.env.EVENT_BUFFER_CLEANUP_INTERVAL ?? '30000', 10);
    timers.push(setInterval(() => state.cleanupEventBuffer(), EVENT_BUFFER_CLEANUP_INTERVAL));
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
    } else {
      await state.loadActiveGamesFromFile();
      const FILE_SAVE_INTERVAL_MS = parseInt(process.env.FILE_SAVE_INTERVAL_MS ?? '30000', 10);
      const fileSaveTimer = setInterval(() => {
        if (state.isFileDirty()) {
          state.saveActiveGamesToFile().catch((err) => logger.error('Periodic save failed: ' + err));
        }
      }, FILE_SAVE_INTERVAL_MS);
      timers.push(fileSaveTimer);
    }
    await chat.ensureLobbyConversation().catch((e) => logger.error('Failed to ensure lobby conversation: ' + e));
    server.listen(PORT, HOST, () => {
      if (httpsServer) {
        logger.info(
          'Chess API server listening on ' + HOST + ':' + PORT + ' (HTTP) and ' + HOST + ':' + HTTPS_PORT + ' (HTTPS)',
        );
      } else {
        logger.info('Chess API server listening on ' + HOST + ':' + PORT);
      }
      logger.info('CORS origin: ' + CORS_ORIGIN);
      logger.info('WS heartbeat interval: ' + WS_HEARTBEAT_INTERVAL + 'ms');
    });
  }

  db.initDb()
    .then(() => startApp())
    .catch(function initDbRetry(e: unknown): void {
      logger.error('DB init failed: ' + e);
      const DB_RETRY_DELAY_MS = parseInt(process.env.DB_RETRY_DELAY_MS ?? '5000', 10);
      const DB_RETRY_MAX_ATTEMPTS = parseInt(process.env.DB_RETRY_MAX_ATTEMPTS ?? '5', 10);
      if (DB_RETRY_MAX_ATTEMPTS > 0) {
        let attempts = 0;
        const retryInterval = setInterval(async () => {
          attempts++;
          logger.info('Retrying DB init (' + attempts + '/' + DB_RETRY_MAX_ATTEMPTS + ')...');
          try {
            await db.initDb();
            clearInterval(retryInterval);
            await startApp();
          } catch (e2) {
            logger.error('DB init retry ' + attempts + ' failed: ' + e2);
            if (attempts >= DB_RETRY_MAX_ATTEMPTS) {
              clearInterval(retryInterval);
              logger.error('DB init exhausted retries — exiting');
              process.exit(1);
            }
          }
        }, DB_RETRY_DELAY_MS);
      } else {
        process.exit(1);
      }
    });

  function shutdown(signal: string): void {
    logger.info('Received ' + signal + ' — shutting down gracefully...');
    for (const timer of timers) clearInterval(timer);
    game.killAllEngines();
    closeLogStreams();
    state.saveActiveGamesToFile().catch((err) => logger.error('Final save failed: ' + err));
    server.close(() => {
      logger.info('HTTP server closed');
      if (httpsServer) {
        httpsServer.close();
        logger.info('HTTPS server closed');
      }
      const wss = (server as http.Server & { __wss: WebSocketServer | undefined }).__wss;
      if (wss) {
        wss.clients.forEach((client) => client.close(1001, 'Server shutting down'));
      }
      if (typeof db.closeDb === 'function')
        db.closeDb().catch((err: unknown) => logger.error('DB close failed: ' + err));
      redis.closeRedis().catch((err: unknown) => logger.error('Redis close failed: ' + err));
      logger.info('Shutdown complete');
      process.exit(0);
    });
    setTimeout(() => {
      logger.warn('Forced shutdown after timeout');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
