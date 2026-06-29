import { GameState } from './types.js';
import { WebSocket } from 'ws';
import * as redis from './redis.js';
import logger from './logger.js';

export const games = new Map<string, GameState>();
export const uciHistory = new Map<string, string[]>();
export const wsConnections = new Map<string, Set<WebSocket>>();
export const spectatorConnections = new Map<string, Set<WebSocket>>();
export const playerGameIndex = new Map<string, Set<string>>();
export const bannedPlayers = new Set<string>();
export const bannedIps = new Set<string>();
export const drawOffers = new Map<string, string>();
export const rematchOffers = new Map<string, string>();
export const chatHistory = new Map<string, { playerId: string; username: string; text: string; timestamp: number }[]>();
export const rateLimitBuckets = new Map<string, number[]>();

export const MAX_GAMES_PER_PLAYER = parseInt(process.env.MAX_GAMES_PER_PLAYER ?? '20', 10);
export const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);
export const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10);
export const WAITING_TTL_MS = parseInt(process.env.WAITING_TTL_MS ?? String(10 * 60 * 1000), 10);

export const COMPLETED_GAME_TTL_MS = parseInt(process.env.COMPLETED_GAME_TTL_MS ?? String(5 * 60 * 1000), 10);
export const gameCompletedAt = new Map<string, number>();

let _sweepTimer: ReturnType<typeof setInterval> | null = null;
export function getSweepTimer(): ReturnType<typeof setInterval> | null {
  return _sweepTimer;
}
export function setSweepTimer(timer: ReturnType<typeof setInterval> | null): void {
  _sweepTimer = timer;
}

/* ─── Redis sync ─── */

export async function syncGamesFromRedis(): Promise<void> {
  if (!redis.isRedisEnabled()) return;
  try {
    const remote = await redis.getAllGames();
    for (const [id, g] of remote) games.set(id, g);
    logger.info('Synced ' + remote.size + ' games from Redis');
  } catch (err) {
    logger.error('Failed to sync games from Redis: ' + err);
  }
}

export async function syncPlayerIndexFromRedis(): Promise<void> {
  if (!redis.isRedisEnabled()) return;
  try {
    for (const [gameId, game] of games) {
      for (const pid of [game.players.white, game.players.black]) {
        if (pid) {
          let set = playerGameIndex.get(pid);
          if (!set) {
            set = new Set();
            playerGameIndex.set(pid, set);
          }
          set.add(gameId);
        }
      }
    }
  } catch (err) {
    logger.error('Failed to sync player index from Redis: ' + err);
  }
}

function redisLog(e: unknown): void {
  logger.debug('Redis write-through failed: ' + e);
}

/* ─── Write-through helpers (call after mutating game state) ─── */

export function persistGame(id: string): void {
  const g = games.get(id);
  if (g && redis.isRedisEnabled()) redis.saveGame(id, g).catch(redisLog);
}

export function persistGameAndPublish(id: string): void {
  const g = games.get(id);
  if (!g || !redis.isRedisEnabled()) return;
  redis.saveGame(id, g).catch(redisLog);
  redis.publishGameEvent(id, 'game_updated', {});
}

export function removeGameById(id: string): void {
  games.delete(id);
  chatHistory.delete(id);
  gameCompletedAt.delete(id);
  if (redis.isRedisEnabled()) {
    redis.deleteGame(id).catch(redisLog);
    redis.deleteChatHistory(id).catch(redisLog);
    redis.deleteGameCompletedAt(id).catch(redisLog);
    redis.deleteUciHistory(id).catch(redisLog);
  }
}

export function addPlayerGameIndex(playerId: string, gameId: string): void {
  let set = playerGameIndex.get(playerId);
  if (!set) {
    set = new Set();
    playerGameIndex.set(playerId, set);
  }
  set.add(gameId);
  if (redis.isRedisEnabled()) redis.addPlayerGame(playerId, gameId).catch(redisLog);
}

export function setDrawOfferEntry(gameId: string, playerId: string): void {
  drawOffers.set(gameId, playerId);
  if (redis.isRedisEnabled()) redis.setDrawOffer(gameId, playerId).catch(redisLog);
}

export function deleteDrawOfferEntry(gameId: string): void {
  drawOffers.delete(gameId);
  if (redis.isRedisEnabled()) redis.deleteDrawOffer(gameId).catch(redisLog);
}

export function setRematchOfferEntry(gameId: string, playerId: string): void {
  rematchOffers.set(gameId, playerId);
  if (redis.isRedisEnabled()) redis.setRematchOffer(gameId, playerId).catch(redisLog);
}

export function deleteRematchOfferEntry(gameId: string): void {
  rematchOffers.delete(gameId);
  if (redis.isRedisEnabled()) redis.deleteRematchOffer(gameId).catch(redisLog);
}

export function addChatMessageEntry(
  gameId: string,
  msg: { playerId: string; username: string; text: string; timestamp: number },
): void {
  let arr = chatHistory.get(gameId);
  if (!arr) {
    arr = [];
    chatHistory.set(gameId, arr);
  }
  arr.push(msg);
  if (redis.isRedisEnabled()) redis.addChatMessage(gameId, msg).catch(redisLog);
}

export function setGameCompletedAtEntry(gameId: string): void {
  gameCompletedAt.set(gameId, Date.now());
  if (redis.isRedisEnabled()) redis.setGameCompletedAt(gameId).catch(redisLog);
}

/* ─── WS messaging ─── */

export function sendToPlayerRaw(playerId: string, data: string): void {
  if (redis.isRedisEnabled()) {
    redis.publish('player:' + playerId, JSON.stringify({ type: 'ws_message', data, playerId }));
  }
  const conns = wsConnections.get(playerId);
  if (!conns) return;
  for (const ws of conns) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

export function sendToPlayer(playerId: string, message: Record<string, unknown>): void {
  sendToPlayerRaw(playerId, JSON.stringify(message));
}

export function sendToSpectators(gameId: string, dataOrMessage: Record<string, unknown> | string): void {
  if (redis.isRedisEnabled()) {
    redis.publish('spectate:' + gameId, JSON.stringify({ type: 'ws_message', data: dataOrMessage, gameId }));
  }
  const conns = spectatorConnections.get(gameId);
  if (!conns) return;
  const data = typeof dataOrMessage === 'string' ? dataOrMessage : JSON.stringify(dataOrMessage);
  for (const ws of conns) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}
