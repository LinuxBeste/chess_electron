import { Redis } from 'ioredis';
import logger from './logger.js';
import type { GameState } from './types.js';

const REDIS_URL = process.env.REDIS_URL || '';
const ENABLED = REDIS_URL.length > 0;
const GAME_TTL = parseInt(process.env.REDIS_GAME_TTL ?? '3600', 10);
const CHAT_TTL = parseInt(process.env.REDIS_CHAT_TTL ?? '3600', 10);

let pubClient: InstanceType<typeof Redis> | null = null;
let subClient: InstanceType<typeof Redis> | null = null;

type PubSubHandler = (channel: string, message: string) => void;
let messageHandler: PubSubHandler | null = null;

export function isRedisEnabled(): boolean {
  return ENABLED;
}

export async function initRedis(): Promise<void> {
  if (!ENABLED) {
    logger.info('Redis not configured — using in-memory state');
    return;
  }
  pubClient = new Redis(REDIS_URL, { lazyConnect: true, retryStrategy: (t: number) => Math.min(t * 50, 2000) });
  subClient = new Redis(REDIS_URL, { lazyConnect: true, retryStrategy: (t: number) => Math.min(t * 50, 2000) });
  await pubClient.connect();
  await subClient.connect();
  subClient.on('message', (channel: string, message: string) => {
    if (messageHandler) messageHandler(channel, message);
  });
  subClient.on('pmessage', (_pattern: string, channel: string, message: string) => {
    if (messageHandler) messageHandler(channel, message);
  });
  logger.info('Redis connected: ' + REDIS_URL.replace(/\/\/.*@/, '//***@'));
}

export function setMessageHandler(handler: PubSubHandler): void {
  messageHandler = handler;
}

export function subscribe(channel: string): void {
  if (subClient) subClient.subscribe(channel);
}

export function psubscribe(pattern: string): void {
  if (subClient) subClient.psubscribe(pattern);
}

export function subscribeToGame(gameId: string): void {
  subscribe('game:' + gameId);
}

export function publish(channel: string, message: string): void {
  if (pubClient) pubClient.publish(channel, message);
}

export function publishGameEvent(gameId: string, event: string, data: Record<string, unknown>): void {
  publish('game:' + gameId, JSON.stringify({ event, data, ts: Date.now() }));
}

/* ─── Game State ─── */

export async function saveGame(gameId: string, game: GameState): Promise<void> {
  if (!ENABLED) return;
  try {
    await pubClient!.setex('game:' + gameId, GAME_TTL, JSON.stringify(game));
  } catch (err) {
    logger.error('Redis saveGame failed: ' + err);
  }
}

export async function getGame(gameId: string): Promise<GameState | null> {
  if (!ENABLED) return null;
  try {
    const raw = await pubClient!.get('game:' + gameId);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.error('Redis getGame failed: ' + err);
    return null;
  }
}

export async function deleteGame(gameId: string): Promise<void> {
  if (!ENABLED) return;
  try {
    await pubClient!.del('game:' + gameId);
  } catch (err) {
    logger.error('Redis deleteGame failed: ' + err);
  }
}

export async function getAllGameIds(): Promise<string[]> {
  if (!ENABLED) return [];
  try {
    const keys = await pubClient!.keys('game:*');
    return keys.map((k: string) => k.slice(5));
  } catch (err) {
    logger.error('Redis getAllGameIds failed: ' + err);
    return [];
  }
}

export async function getAllGames(): Promise<Map<string, GameState>> {
  const map = new Map<string, GameState>();
  if (!ENABLED) return map;
  try {
    const ids = await getAllGameIds();
    if (ids.length === 0) return map;
    const pipeline = pubClient!.pipeline();
    for (const id of ids) pipeline.get('game:' + id);
    const results = await pipeline.exec();
    if (!results) return map;
    for (let i = 0; i < ids.length; i++) {
      const raw = results[i]?.[1];
      if (typeof raw === 'string') {
        try {
          map.set(ids[i], JSON.parse(raw));
        } catch {}
      }
    }
  } catch (err) {
    logger.error('Redis getAllGames failed: ' + err);
  }
  return map;
}

/* ─── UCI History ─── */

export async function getUciHistory(gameId: string): Promise<string[]> {
  if (!ENABLED) return [];
  try {
    return await pubClient!.lrange('uci:' + gameId, 0, -1);
  } catch (err) {
    logger.error('Redis getUciHistory failed: ' + err);
    return [];
  }
}

export async function pushUciMove(gameId: string, move: string): Promise<void> {
  if (!ENABLED) return;
  try {
    await pubClient!.rpush('uci:' + gameId, move);
    await pubClient!.expire('uci:' + gameId, GAME_TTL);
  } catch (err) {
    logger.error('Redis pushUciMove failed: ' + err);
  }
}

export async function deleteUciHistory(gameId: string): Promise<void> {
  if (!ENABLED) return;
  try {
    await pubClient!.del('uci:' + gameId);
  } catch (err) {
    logger.error('Redis deleteUciHistory failed: ' + err);
  }
}

/* ─── Player Game Index ─── */

export async function addPlayerGame(playerId: string, gameId: string): Promise<void> {
  if (!ENABLED) return;
  try {
    await pubClient!.sadd('playerGames:' + playerId, gameId);
  } catch (err) {
    logger.error('Redis addPlayerGame failed: ' + err);
  }
}

export async function getPlayerGames(playerId: string): Promise<string[]> {
  if (!ENABLED) return [];
  try {
    return await pubClient!.smembers('playerGames:' + playerId);
  } catch (err) {
    logger.error('Redis getPlayerGames failed: ' + err);
    return [];
  }
}

export async function removePlayerGame(playerId: string, gameId: string): Promise<void> {
  if (!ENABLED) return;
  try {
    await pubClient!.srem('playerGames:' + playerId, gameId);
  } catch (err) {
    logger.error('Redis removePlayerGame failed: ' + err);
  }
}

/* ─── Draw Offers ─── */

export async function setDrawOffer(gameId: string, playerId: string): Promise<void> {
  if (!ENABLED) return;
  try {
    await pubClient!.setex('draw:' + gameId, 300, playerId);
  } catch (err) {
    logger.error('Redis setDrawOffer failed: ' + err);
  }
}

export async function getDrawOffer(gameId: string): Promise<string | null> {
  if (!ENABLED) return null;
  try {
    return await pubClient!.get('draw:' + gameId);
  } catch (err) {
    logger.error('Redis getDrawOffer failed: ' + err);
    return null;
  }
}

export async function deleteDrawOffer(gameId: string): Promise<void> {
  if (!ENABLED) return;
  try {
    await pubClient!.del('draw:' + gameId);
  } catch (err) {
    logger.error('Redis deleteDrawOffer failed: ' + err);
  }
}

/* ─── Rematch Offers ─── */

export async function setRematchOffer(gameId: string, playerId: string): Promise<void> {
  if (!ENABLED) return;
  try {
    await pubClient!.setex('rematch:' + gameId, 300, playerId);
  } catch (err) {
    logger.error('Redis setRematchOffer failed: ' + err);
  }
}

export async function getRematchOffer(gameId: string): Promise<string | null> {
  if (!ENABLED) return null;
  try {
    return await pubClient!.get('rematch:' + gameId);
  } catch (err) {
    logger.error('Redis getRematchOffer failed: ' + err);
    return null;
  }
}

export async function deleteRematchOffer(gameId: string): Promise<void> {
  if (!ENABLED) return;
  try {
    await pubClient!.del('rematch:' + gameId);
  } catch (err) {
    logger.error('Redis deleteRematchOffer failed: ' + err);
  }
}

/* ─── Chat History ─── */

export async function addChatMessage(
  gameId: string,
  msg: { playerId: string; username: string; text: string; timestamp: number },
): Promise<void> {
  if (!ENABLED) return;
  try {
    await pubClient!.rpush('chat:' + gameId, JSON.stringify(msg));
    await pubClient!.expire('chat:' + gameId, CHAT_TTL);
  } catch (err) {
    logger.error('Redis addChatMessage failed: ' + err);
  }
}

export async function getChatHistory(
  gameId: string,
): Promise<{ playerId: string; username: string; text: string; timestamp: number }[]> {
  if (!ENABLED) return [];
  try {
    const raw = await pubClient!.lrange('chat:' + gameId, 0, -1);
    return raw.map((r: string) => JSON.parse(r));
  } catch (err) {
    logger.error('Redis getChatHistory failed: ' + err);
    return [];
  }
}

export async function deleteChatHistory(gameId: string): Promise<void> {
  if (!ENABLED) return;
  try {
    await pubClient!.del('chat:' + gameId);
  } catch (err) {
    logger.error('Redis deleteChatHistory failed: ' + err);
  }
}

/* ─── Game Completed At ─── */

export async function setGameCompletedAt(gameId: string): Promise<void> {
  if (!ENABLED) return;
  try {
    await pubClient!.setex('completed:' + gameId, 300, String(Date.now()));
  } catch (err) {
    logger.error('Redis setGameCompletedAt failed: ' + err);
  }
}

export async function getGameCompletedAt(gameId: string): Promise<number | null> {
  if (!ENABLED) return null;
  try {
    const raw = await pubClient!.get('completed:' + gameId);
    return raw ? parseInt(raw, 10) : null;
  } catch (err) {
    logger.error('Redis getGameCompletedAt failed: ' + err);
    return null;
  }
}

export async function getAllCompletedGameIds(): Promise<string[]> {
  if (!ENABLED) return [];
  try {
    const keys = await pubClient!.keys('completed:*');
    return keys.map((k: string) => k.slice(10));
  } catch (err) {
    logger.error('Redis getAllCompletedGameIds failed: ' + err);
    return [];
  }
}

export async function deleteGameCompletedAt(gameId: string): Promise<void> {
  if (!ENABLED) return;
  try {
    await pubClient!.del('completed:' + gameId);
  } catch (err) {
    logger.error('Redis deleteGameCompletedAt failed: ' + err);
  }
}

/* ─── Cleanup ─── */

export async function closeRedis(): Promise<void> {
  if (!ENABLED) return;
  try {
    if (subClient) {
      subClient.unsubscribe();
      subClient.disconnect();
    }
    if (pubClient) pubClient.disconnect();
    logger.info('Redis disconnected');
  } catch (err) {
    logger.error('Redis close failed: ' + err);
  }
}
