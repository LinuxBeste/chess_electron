import { GameState } from './types.js';
import { WebSocket } from 'ws';
import * as redis from './redis.js';
import logger from './logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

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

/* ─── File-based persistence (fallback when Redis is not enabled) ─── */

const ACTIVE_GAMES_FILE_ENV = process.env.ACTIVE_GAMES_FILE ?? '';
const _filePersistenceEnabled = ACTIVE_GAMES_FILE_ENV.length > 0 || process.env.DISABLE_FILE_PERSISTENCE !== 'true';
const ACTIVE_GAMES_FILE = ACTIVE_GAMES_FILE_ENV || path.join(process.cwd(), 'data', 'active_games.json');

let _fileDirty = false;

function activeGameFilter(g: GameState): boolean {
  return g.status === 'waiting' || g.status === 'active';
}

function fileEnabled(): boolean {
  return !redis.isRedisEnabled() && _filePersistenceEnabled;
}

export async function saveActiveGamesToFile(): Promise<void> {
  if (!fileEnabled()) return;
  try {
    const data: Record<string, GameState> = {};
    for (const [id, g] of games) {
      if (activeGameFilter(g)) {
        data[id] = g;
      }
    }
    await fs.mkdir(path.dirname(ACTIVE_GAMES_FILE), { recursive: true });
    await fs.writeFile(ACTIVE_GAMES_FILE + '.tmp', JSON.stringify(data), 'utf-8');
    await fs.rename(ACTIVE_GAMES_FILE + '.tmp', ACTIVE_GAMES_FILE);
    _fileDirty = false;
    logger.debug('Saved ' + Object.keys(data).length + ' active games to ' + ACTIVE_GAMES_FILE);
  } catch (err) {
    logger.error('Failed to save active games: ' + err);
  }
}

export async function loadActiveGamesFromFile(): Promise<void> {
  if (!fileEnabled()) return;
  try {
    const raw = await fs.readFile(ACTIVE_GAMES_FILE, 'utf-8');
    const data = JSON.parse(raw) as Record<string, GameState>;
    let loaded = 0;
    for (const [id, g] of Object.entries(data)) {
      if (activeGameFilter(g)) {
        games.set(id, g);
        uciHistory.set(id, []);
        if (g.players.white) addPlayerGameIndex(g.players.white, id);
        if (g.players.black) addPlayerGameIndex(g.players.black, id);
        loaded++;
      }
    }
    logger.info('Loaded ' + loaded + ' active games from ' + ACTIVE_GAMES_FILE);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error('Failed to load active games: ' + err);
    }
  }
}

export function markGamesDirty(): void {
  if (fileEnabled()) {
    _fileDirty = true;
  }
}

export function isFileDirty(): boolean {
  return _fileDirty;
}

/* ─── Write-through helpers (call after mutating game state) ─── */

export function persistGame(id: string): void {
  const g = games.get(id);
  if (!g) return;
  if (redis.isRedisEnabled()) {
    redis.saveGame(id, g).catch(redisLog);
  } else {
    markGamesDirty();
  }
}

export function persistGameAndPublish(id: string): void {
  const g = games.get(id);
  if (!g) return;
  if (redis.isRedisEnabled()) {
    redis.saveGame(id, g).catch(redisLog);
    redis.publishGameEvent(id, 'game_updated', {});
  } else {
    markGamesDirty();
  }
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

/* ─── Event Buffer for WS reconnection replay ─── */

const GAME_EVENT_BUFFER_TTL_MS = parseInt(process.env.GAME_EVENT_BUFFER_TTL_MS ?? '60000', 10);
const GAME_EVENT_BUFFER_MAX = parseInt(process.env.GAME_EVENT_BUFFER_MAX ?? '50', 10);
const eventBuffer = new Map<string, Array<{ timestamp: number; event: Record<string, unknown> }>>();

export function addGameEvent(gameId: string, event: Record<string, unknown>): void {
  const now = Date.now();
  let arr = eventBuffer.get(gameId);
  if (!arr) {
    arr = [];
    eventBuffer.set(gameId, arr);
  }
  arr.push({ timestamp: now, event });
  if (arr.length > GAME_EVENT_BUFFER_MAX) {
    arr.splice(0, arr.length - GAME_EVENT_BUFFER_MAX);
  }
  const cutoff = now - GAME_EVENT_BUFFER_TTL_MS;
  while (arr.length > 0 && arr[0].timestamp < cutoff) {
    arr.shift();
  }
}

export function getBufferedEvents(gameId: string, sinceTimestamp?: number): Record<string, unknown>[] {
  const arr = eventBuffer.get(gameId);
  if (!arr) return [];
  if (sinceTimestamp) {
    return arr.filter((e) => e.timestamp > sinceTimestamp).map((e) => e.event);
  }
  return arr.map((e) => e.event);
}

export function cleanupEventBuffer(): void {
  const cutoff = Date.now() - GAME_EVENT_BUFFER_TTL_MS;
  for (const [gameId, arr] of eventBuffer) {
    while (arr.length > 0 && arr[0].timestamp < cutoff) {
      arr.shift();
    }
    if (arr.length === 0) eventBuffer.delete(gameId);
  }
}

export function deleteEventBuffer(gameId: string): void {
  eventBuffer.delete(gameId);
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
