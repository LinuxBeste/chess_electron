/**
 * Typed REST API client.
 *
 * All fetch calls are wrapped in typed async functions whose return types
 * are derived from the chess-api source in ../chess-api/src/.
 * Every endpoint, request body shape, response shape, and auth requirement
 * was confirmed by reading:
 *   - ../chess-api/src/routes.ts  (route definitions)
 *   - ../chess-api/src/game.ts    (business logic + WS broadcast shapes)
 *   - ../chess-api/src/types.ts   (shared type definitions)
 *   - ../chess-api/docs/api.md    (API contract documentation)
 */

import type { GameState, LegalMoveHint, PieceType } from '../types';
import { store } from './store';

/** Base URL — can be overridden via setBaseUrl() for testing or env config. */
let BASE_URL = 'http://localhost:3000';

/** Set a custom base URL (e.g. from Electron preload config). */
export function setBaseUrl(url: string): void {
  BASE_URL = url;
}

/** Error thrown when the API returns a non-2xx response. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Shared request helper.
 *
 * Injects the bearer token from the store if available, handles non-2xx
 * responses by throwing a typed ApiError, and parses JSON.  No direct
 * fetch calls outside this helper — all API functions go through it.
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = store.get('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401 && store.get('token')) {
      store.set('token', null);
      store.set('playerId', null);
      store.set('username', null);
      store.clearSession();
    }
    let msg = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) msg = body.error;
    } catch {}
    throw new ApiError(res.status, msg);
  }

  return res.json() as Promise<T>;
}

/* POST /auth/register — no auth required.
 * Response shape confirmed in ../chess-api/src/routes.ts line 46-54
 * and ../chess-api/docs/api.md lines 13-28. */
export function register(username: string): Promise<{ playerId: string; token: string }> {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
}

/* GET /auth/me — auth required.
 * Response shape confirmed in ../chess-api/src/routes.ts line 57-59
 * and ../chess-api/docs/api.md lines 30-40. */
export function getMe(): Promise<{ id: string; username: string }> {
  return request('/auth/me');
}

/* GET /health — no auth required.
 * Response shape confirmed in ../chess-api/src/routes.ts line 35-43
 * and ../chess-api/docs/api.md lines 44-54. */
export function healthCheck(): Promise<{ status: string; uptime: number; gamesActive: number; playersOnline: number }> {
  return request('/health');
}

/* POST /games — auth required.
 * Optional body field: visibility ('public' | 'private', defaults to 'public').
 * Response shape confirmed in ../chess-api/src/routes.ts line 62-65
 * and ../chess-api/docs/api.md lines 58-80. */
export function createGame(visibility?: 'public' | 'private'): Promise<GameState> {
  return request('/games', {
    method: 'POST',
    body: JSON.stringify({ ...(visibility ? { visibility } : {}) }),
  });
}

/* GET /games — no auth required.
 * Returns an array of GameState objects.
 * Confirmed in ../chess-api/src/routes.ts line 68-70
 * and ../chess-api/docs/api.md lines 82-89. */
export function getOpenGames(): Promise<GameState[]> {
  return request('/games');
}

/* GET /games/active — no auth required.
 * Returns active games available for spectating. */
export function getActiveGames(): Promise<GameState[]> {
  return request('/games/active');
}

/* GET /games — no auth, returns all games (for combined view). */
export function getGameList(): Promise<GameState[]> {
  return request('/games');
}

/* GET /games/:gameId — no auth required.
 * Returns a single GameState.
 * Confirmed in ../chess-api/src/routes.ts line 73-80
 * and ../chess-api/docs/api.md lines 91-95. */
export function getGame(gameId: string): Promise<GameState> {
  return request(`/games/${gameId}`);
}

/* POST /games/:gameId/join — auth required.
 * Body: none.  Returns GameState.
 * Confirmed in ../chess-api/src/routes.ts line 83-90
 * and ../chess-api/docs/api.md lines 97-101. */
export function joinGame(gameId: string): Promise<GameState> {
  return request(`/games/${gameId}/join`, { method: 'POST' });
}

/* POST /games/:gameId/move — auth required.
 * Body: { from, to, promotion? }.
 * Returns updated GameState.
 * Confirmed in ../chess-api/src/routes.ts line 93-111
 * and ../chess-api/docs/api.md lines 103-118. */
export function makeMove(
  gameId: string,
  from: string,
  to: string,
  promotion?: PieceType,
): Promise<GameState> {
  return request(`/games/${gameId}/move`, {
    method: 'POST',
    body: JSON.stringify({ from, to, ...(promotion ? { promotion } : {}) }),
  });
}

/* POST /games/:gameId/resign — auth required.
 * Returns updated GameState with status 'resigned'.
 * Confirmed in ../chess-api/src/routes.ts line 114-121
 * and ../chess-api/docs/api.md lines 120-124. */
export function resignGame(gameId: string): Promise<GameState> {
  return request(`/games/${gameId}/resign`, { method: 'POST' });
}

/* GET /players/:playerId/games — auth required.
 * Returns completed games for the authenticated player. */
export function getPlayerGames(playerId: string): Promise<GameState[]> {
  return request(`/players/${playerId}/games`);
}

/* GET /games/:gameId/moves — auth required.
 * Returns { moves: [{ from, to }] }.
 * Confirmed in ../chess-api/src/routes.ts line 124-131
 * and ../chess-api/docs/api.md lines 126-138. */
export function getLegalMoves(gameId: string): Promise<{ moves: LegalMoveHint[] }> {
  return request(`/games/${gameId}/moves`);
}
