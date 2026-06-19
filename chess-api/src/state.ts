import { GameState } from './types.js';
import { WebSocket } from 'ws';

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

let _sweepTimer: ReturnType<typeof setInterval> | null = null;
export function getSweepTimer(): ReturnType<typeof setInterval> | null {
  return _sweepTimer;
}
export function setSweepTimer(timer: ReturnType<typeof setInterval> | null): void {
  _sweepTimer = timer;
}

export function removeGameById(id: string): void {
  games.delete(id);
  chatHistory.delete(id);
}

export function addPlayerGameIndex(playerId: string, gameId: string): void {
  let set = playerGameIndex.get(playerId);
  if (!set) {
    set = new Set();
    playerGameIndex.set(playerId, set);
  }
  set.add(gameId);
}

export function sendToPlayerRaw(playerId: string, data: string): void {
  const conns = wsConnections.get(playerId);
  if (!conns) return;
  for (const ws of conns) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

export function sendToPlayer(playerId: string, message: Record<string, unknown>): void {
  sendToPlayerRaw(playerId, JSON.stringify(message));
}

export function sendToSpectators(gameId: string, dataOrMessage: Record<string, unknown> | string): void {
  const conns = spectatorConnections.get(gameId);
  if (!conns) return;
  const data = typeof dataOrMessage === 'string' ? dataOrMessage : JSON.stringify(dataOrMessage);
  for (const ws of conns) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}
