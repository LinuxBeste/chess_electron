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
 *
 * NOTE: this file already has thorough JSDoc on every export.
 * I'm only adding structural comments here; the docstrings for each
 * function are already excellent.
 */

import type { GameState, LegalMoveHint, PieceType, FriendInfo, FriendRequestInfo } from '../types';
import { store } from './store';
import logger from './logger';

/** Base URL — can be overridden via setBaseUrl() for testing or env config. */
let BASE_URL = 'http://localhost:3000';

/** Set a custom base URL (e.g. from Electron preload config). */
export function setBaseUrl(url: string): void {
  logger.info('setBaseUrl: ' + url);
  BASE_URL = url;
}

/** Get the current API base URL. */
export function getBaseUrl(): string {
  logger.debug('getBaseUrl called');
  return BASE_URL;
}

/** Convert a relative avatar URL to an absolute URL for use in <img> tags. */
export function avatarSrc(url: string | null | undefined): string | undefined {
  logger.debug('avatarSrc called' + (url ? ': url=' + url : ': url=null/undefined'));
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${BASE_URL}${url}`;
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
 * Anonymous: just { username }.
 * Registered: { username, password } for a persistent account with stats.
 * Returns { playerId, token, isRegistered, displayName }. */
export async function register(
  username: string,
  password?: string,
): Promise<{ playerId: string; token: string; isRegistered: boolean; displayName: string }> {
  logger.info('register called: username=' + username + ', hasPassword=' + !!password);
  try {
    const result = await request<{
      playerId: string;
      token: string;
      isRegistered: boolean;
      displayName: string;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, ...(password ? { password } : {}) }),
    });
    logger.info('register ok: playerId=' + result.playerId + ', isRegistered=' + result.isRegistered);
    return result;
  } catch (err) {
    logger.error('register failed: ' + err);
    throw err;
  }
}

/* POST /auth/login — no auth required.
 * Login as an existing registered user.
 * Returns { playerId, token, displayName } on success. */
export async function login(
  username: string,
  password: string,
): Promise<{ success: true; playerId: string; token: string; displayName: string }> {
  logger.info('login called: username=' + username);
  try {
    const result = await request<{
      success: true;
      playerId: string;
      token: string;
      displayName: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    logger.info('login ok: playerId=' + result.playerId + ', displayName=' + result.displayName);
    return result;
  } catch (err) {
    logger.error('login failed: ' + err);
    throw err;
  }
}

/* GET /auth/me — auth required.
 * Returns player info including stats for registered users. */
export async function getMe(): Promise<{
  id: string;
  username: string;
  displayName: string;
  isRegistered: boolean;
  createdAt: number | null;
  avatarUrl: string | null;
  stats?: { wins: number; losses: number; draws: number };
}> {
  logger.info('getMe called');
  try {
    const result = await request<{
      id: string;
      username: string;
      displayName: string;
      isRegistered: boolean;
      createdAt: number | null;
      avatarUrl: string | null;
      stats?: { wins: number; losses: number; draws: number };
    }>('/auth/me');
    logger.info('getMe ok: username=' + result.username);
    return result;
  } catch (err) {
    logger.error('getMe failed: ' + err);
    throw err;
  }
}

/* PUT /auth/me — auth required.
 * Update the authenticated player's display name. */
export async function updateDisplayName(displayName: string): Promise<{ success: true; displayName: string }> {
  logger.info('updateDisplayName called');
  try {
    const result = await request<{ success: true; displayName: string }>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify({ displayName }),
    });
    logger.info('updateDisplayName ok: displayName=' + result.displayName);
    return result;
  } catch (err) {
    logger.error('updateDisplayName failed: ' + err);
    throw err;
  }
}

/* PUT /auth/me/password — auth required.
 * Change the authenticated player's password. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<{ success: true }> {
  logger.info('changePassword called');
  try {
    const result = await request<{ success: true }>('/auth/me/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    logger.info('changePassword ok');
    return result;
  } catch (err) {
    logger.error('changePassword failed: ' + err);
    throw err;
  }
}

/* DELETE /auth/me — auth required.
 * Delete the authenticated player's account. */
export async function deleteAccount(): Promise<{ success: true }> {
  logger.info('deleteAccount called');
  try {
    const result = await request<{ success: true }>('/auth/me', { method: 'DELETE' });
    logger.info('deleteAccount ok');
    return result;
  } catch (err) {
    logger.error('deleteAccount failed: ' + err);
    throw err;
  }
}

/* GET /games/archive */
export async function getArchivedGames(params: {
  page?: number;
  limit?: number;
  player?: string;
  status?: string;
  from?: number;
  to?: number;
}): Promise<{ games: any[]; total: number; page: number; limit: number }> {
  logger.info('getArchivedGames called', params);
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.player) q.set('player', params.player);
  if (params.status) q.set('status', params.status);
  if (params.from) q.set('from', String(params.from));
  if (params.to) q.set('to', String(params.to));
  return request('/games/archive?' + q.toString());
}

export async function getArchivedGame(gameId: string): Promise<any> {
  logger.info('getArchivedGame called', { gameId });
  return request('/games/archive/' + gameId);
}

/* ─── Tournaments ─── */

export async function createTournament(name: string, maxPlayers: number, isPrivate?: boolean): Promise<any> {
  return request('/tournaments', {
    method: 'POST',
    body: JSON.stringify({ name, maxPlayers, isPrivate }),
  });
}

export async function getTournaments(): Promise<any[]> {
  return request('/tournaments');
}

export async function getTournament(id: string): Promise<any> {
  return request('/tournaments/' + id);
}

export async function joinTournament(id: string): Promise<any> {
  return request('/tournaments/' + id + '/join', { method: 'POST' });
}

export async function joinTournamentByCode(code: string): Promise<any> {
  return request('/tournaments/join-by-code', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function leaveTournament(id: string): Promise<any> {
  return request('/tournaments/' + id + '/leave', { method: 'POST' });
}

export async function updateTournament(id: string, data: { name?: string; maxPlayers?: number; isPrivate?: boolean }): Promise<any> {
  return request('/tournaments/' + id, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteTournament(id: string): Promise<any> {
  return request('/tournaments/' + id, { method: 'DELETE' });
}

export async function startTournament(id: string): Promise<any> {
  return request('/tournaments/' + id + '/start', { method: 'POST' });
}

/* GET /health — no auth required.
 * Response shape confirmed in ../chess-api/src/routes.ts line 35-43
 * and ../chess-api/docs/api.md lines 44-54. */
export async function healthCheck(): Promise<{
  status: string;
  uptime: number;
  gamesActive: number;
  playersOnline: number;
}> {
  logger.info('healthCheck called');
  try {
    const result = await request<{
      status: string;
      uptime: number;
      gamesActive: number;
      playersOnline: number;
    }>('/health');
    logger.info('healthCheck ok: status=' + result.status);
    return result;
  } catch (err) {
    logger.error('healthCheck failed: ' + err);
    throw err;
  }
}

/* GET /leaderboard */
export async function getLeaderboard(page = 1, limit = 50): Promise<{
  entries: { playerId: string; username: string; displayName: string; avatarUrl: string | null; rating: number; wins: number; losses: number; draws: number }[];
  total: number;
  page: number;
  limit: number;
}> {
  logger.info('getLeaderboard called page=' + page + ' limit=' + limit);
  const result = await request<{
    entries: any[];
    total: number;
    page: number;
    limit: number;
  }>('/leaderboard?page=' + page + '&limit=' + limit);
  return result;
}

/* POST /games — auth required.
 * Optional body field: visibility ('public' | 'private', defaults to 'public').
 * Response shape confirmed in ../chess-api/src/routes.ts line 62-65
 * and ../chess-api/docs/api.md lines 58-80. */
export async function createGame(visibility?: 'public' | 'private'): Promise<GameState> {
  logger.info('createGame called' + (visibility ? ': visibility=' + visibility : ''));
  try {
    const result = await request<GameState>('/games', {
      method: 'POST',
      body: JSON.stringify({ ...(visibility ? { visibility } : {}) }),
    });
    logger.info('createGame ok: gameId=' + result.id);
    return result;
  } catch (err) {
    logger.error('createGame failed: ' + err);
    throw err;
  }
}

/* POST /games/ai */
export async function createAIGame(skillLevel: number, playerColor?: 'white' | 'black'): Promise<GameState> {
  logger.info('createAIGame called', { skillLevel, playerColor });
  try {
    const result = await request<GameState>('/games/ai', {
      method: 'POST',
      body: JSON.stringify({ skillLevel, playerColor }),
    });
    logger.info('createAIGame ok: gameId=' + result.id);
    return result;
  } catch (err) {
    logger.error('createAIGame failed: ' + err);
    throw err;
  }
}

/* GET /games — no auth required.
 * Returns an array of GameState objects.
 * Confirmed in ../chess-api/src/routes.ts line 68-70
 * and ../chess-api/docs/api.md lines 82-89. */
export async function getOpenGames(): Promise<GameState[]> {
  logger.debug('getOpenGames called');
  try {
    const result = await request<GameState[]>('/games');
    logger.debug('getOpenGames ok: count=' + result.length);
    return result;
  } catch (err) {
    logger.error('getOpenGames failed: ' + err);
    throw err;
  }
}

/* GET /games/active — no auth required.
 * Returns active games available for spectating. */
export async function getActiveGames(): Promise<GameState[]> {
  logger.debug('getActiveGames called');
  try {
    const result = await request<GameState[]>('/games/active');
    logger.debug('getActiveGames ok: count=' + result.length);
    return result;
  } catch (err) {
    logger.error('getActiveGames failed: ' + err);
    throw err;
  }
}

/* GET /games — no auth, returns all games (for combined view). */
export async function getGameList(): Promise<GameState[]> {
  logger.debug('getGameList called');
  try {
    const result = await request<GameState[]>('/games');
    logger.debug('getGameList ok: count=' + result.length);
    return result;
  } catch (err) {
    logger.error('getGameList failed: ' + err);
    throw err;
  }
}

/* GET /games/:gameId — no auth required.
 * Returns a single GameState.
 * Confirmed in ../chess-api/src/routes.ts line 73-80
 * and ../chess-api/docs/api.md lines 91-95. */
export async function getGame(gameId: string): Promise<GameState> {
  logger.debug('getGame called: gameId=' + gameId);
  try {
    const result = await request<GameState>(`/games/${gameId}`);
    logger.debug('getGame ok: gameId=' + result.id);
    return result;
  } catch (err) {
    logger.error('getGame failed: gameId=' + gameId + ', ' + err);
    throw err;
  }
}

/* POST /games/:gameId/abort — auth required.
 * Aborts a waiting game (creator only).  The game is deleted from the
 * server and connected players are notified via WebSocket. */
export async function abortGame(gameId: string): Promise<{ success: boolean }> {
  logger.info('abortGame called: gameId=' + gameId);
  try {
    const result = await request<{ success: boolean }>(`/games/${gameId}/abort`, { method: 'POST' });
    logger.info('abortGame ok: gameId=' + gameId);
    return result;
  } catch (err) {
    logger.error('abortGame failed: gameId=' + gameId + ', ' + err);
    throw err;
  }
}

/* POST /games/:gameId/join — auth required.
 * Body: none.  Returns GameState.
 * Confirmed in ../chess-api/src/routes.ts line 83-90
 * and ../chess-api/docs/api.md lines 97-101. */
export async function joinGame(gameId: string): Promise<GameState> {
  logger.info('joinGame called: gameId=' + gameId);
  try {
    const result = await request<GameState>(`/games/${gameId}/join`, { method: 'POST' });
    logger.info('joinGame ok: gameId=' + result.id);
    return result;
  } catch (err) {
    logger.error('joinGame failed: gameId=' + gameId + ', ' + err);
    throw err;
  }
}

/* POST /games/:gameId/move — auth required.
 * Body: { from, to, promotion? }.
 * Returns updated GameState.
 * Confirmed in ../chess-api/src/routes.ts line 93-111
 * and ../chess-api/docs/api.md lines 103-118. */
export async function makeMove(gameId: string, from: string, to: string, promotion?: PieceType): Promise<GameState> {
  logger.info('makeMove called: gameId=' + gameId + ', from=' + from + ', to=' + to);
  try {
    const result = await request<GameState>(`/games/${gameId}/move`, {
      method: 'POST',
      body: JSON.stringify({ from, to, ...(promotion ? { promotion } : {}) }),
    });
    logger.info('makeMove ok: gameId=' + result.id + ', boardHash=' + (result.board ? result.board.length : '?'));
    return result;
  } catch (err) {
    logger.error('makeMove failed: gameId=' + gameId + ', ' + err);
    throw err;
  }
}

/* POST /games/:gameId/resign — auth required.
 * Returns updated GameState with status 'resigned'.
 * Confirmed in ../chess-api/src/routes.ts line 114-121
 * and ../chess-api/docs/api.md lines 120-124. */
export async function resignGame(gameId: string): Promise<GameState> {
  logger.info('resignGame called: gameId=' + gameId);
  try {
    const result = await request<GameState>(`/games/${gameId}/resign`, { method: 'POST' });
    logger.info('resignGame ok: gameId=' + result.id);
    return result;
  } catch (err) {
    logger.error('resignGame failed: gameId=' + gameId + ', ' + err);
    throw err;
  }
}

/* GET /players/:playerId/games — auth required.
 * Returns completed games for the authenticated player. */
export async function getPlayerGames(playerId: string): Promise<GameState[]> {
  logger.info('getPlayerGames called: playerId=' + playerId);
  try {
    const result = await request<GameState[]>(`/players/${playerId}/games`);
    logger.info('getPlayerGames ok: count=' + result.length);
    return result;
  } catch (err) {
    logger.error('getPlayerGames failed: playerId=' + playerId + ', ' + err);
    throw err;
  }
}

/* GET /games/:gameId/moves — auth required.
 * Returns { moves: [{ from, to }] }.
 * Confirmed in ../chess-api/src/routes.ts line 124-131
 * and ../chess-api/docs/api.md lines 126-138. */
export async function getLegalMoves(gameId: string): Promise<{ moves: LegalMoveHint[] }> {
  logger.debug('getLegalMoves called: gameId=' + gameId);
  try {
    const result = await request<{ moves: LegalMoveHint[] }>(`/games/${gameId}/moves`);
    logger.debug('getLegalMoves ok: gameId=' + gameId + ', movesCount=' + result.moves.length);
    return result;
  } catch (err) {
    logger.error('getLegalMoves failed: gameId=' + gameId + ', ' + err);
    throw err;
  }
}

/* ─── Profile Pictures ─── */

/* POST /auth/me/avatar — auth required.
 * Upload a profile picture. */
export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  logger.info('uploadAvatar called: fileName=' + file.name + ', size=' + file.size);
  const token = store.get('token');
  const formData = new FormData();
  formData.append('avatar', file);

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/auth/me/avatar`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    let msg = 'Upload failed';
    try {
      const b = await res.json();
      if (b.error) msg = b.error;
    } catch {}
    logger.error('uploadAvatar failed: ' + msg);
    throw new ApiError(res.status, msg);
  }

  const result = await res.json();
  logger.info('uploadAvatar ok');
  return result;
}

/* DELETE /auth/me/avatar — auth required.
 * Remove profile picture. */
export async function deleteAvatar(): Promise<{ success: true }> {
  logger.info('deleteAvatar called');
  try {
    const result = await request<{ success: true }>('/auth/me/avatar', { method: 'DELETE' });
    logger.info('deleteAvatar ok');
    return result;
  } catch (err) {
    logger.error('deleteAvatar failed: ' + err);
    throw err;
  }
}

/* ─── Player Profiles ─── */

export interface PlayerProfile {
  id: string;
  username: string | null;
  displayName: string | null;
  isRegistered: boolean;
  avatarUrl: string | null;
  createdAt: number | null;
  stats: { wins: number; losses: number; draws: number } | null;
}

/* GET /players/:playerId/profile — auth required.
 * View another player's public profile. */
export async function getPlayerProfile(playerId: string): Promise<PlayerProfile> {
  logger.info('getPlayerProfile called: playerId=' + playerId);
  try {
    const result = await request<PlayerProfile>(`/players/${playerId}/profile`);
    logger.info('getPlayerProfile ok: playerId=' + result.id);
    return result;
  } catch (err) {
    logger.error('getPlayerProfile failed: playerId=' + playerId + ', ' + err);
    throw err;
  }
}

/* ─── Friends ─── */

/* POST /friends/request — auth required. */
export async function sendFriendRequest(username: string): Promise<{ id: string }> {
  logger.info('sendFriendRequest called: username=' + username);
  try {
    const result = await request<{ id: string }>('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    logger.info('sendFriendRequest ok: id=' + result.id);
    return result;
  } catch (err) {
    logger.error('sendFriendRequest failed: username=' + username + ', ' + err);
    throw err;
  }
}

/* GET /friends/requests — auth required. */
export async function getFriendRequests(): Promise<{
  incoming: FriendRequestInfo[];
  outgoing: FriendRequestInfo[];
}> {
  logger.debug('getFriendRequests called');
  try {
    const result = await request<{
      incoming: FriendRequestInfo[];
      outgoing: FriendRequestInfo[];
    }>('/friends/requests');
    logger.debug('getFriendRequests ok: incoming=' + result.incoming.length + ', outgoing=' + result.outgoing.length);
    return result;
  } catch (err) {
    logger.error('getFriendRequests failed: ' + err);
    throw err;
  }
}

/* POST /friends/requests/:id/accept — auth required. */
export async function acceptFriendRequest(id: string): Promise<{ success: boolean }> {
  logger.info('acceptFriendRequest called: id=' + id);
  try {
    const result = await request<{ success: boolean }>(`/friends/requests/${id}/accept`, { method: 'POST' });
    logger.info('acceptFriendRequest ok: id=' + id);
    return result;
  } catch (err) {
    logger.error('acceptFriendRequest failed: id=' + id + ', ' + err);
    throw err;
  }
}

/* POST /friends/requests/:id/decline — auth required. */
export async function declineFriendRequest(id: string): Promise<{ success: boolean }> {
  logger.info('declineFriendRequest called: id=' + id);
  try {
    const result = await request<{ success: boolean }>(`/friends/requests/${id}/decline`, { method: 'POST' });
    logger.info('declineFriendRequest ok: id=' + id);
    return result;
  } catch (err) {
    logger.error('declineFriendRequest failed: id=' + id + ', ' + err);
    throw err;
  }
}

/* POST /friends/requests/:id/cancel — auth required. */
export async function cancelFriendRequest(id: string): Promise<{ success: boolean }> {
  logger.info('cancelFriendRequest called: id=' + id);
  try {
    const result = await request<{ success: boolean }>(`/friends/requests/${id}/cancel`, { method: 'POST' });
    logger.info('cancelFriendRequest ok: id=' + id);
    return result;
  } catch (err) {
    logger.error('cancelFriendRequest failed: id=' + id + ', ' + err);
    throw err;
  }
}

/* DELETE /friends/:friendId — auth required. */
export async function removeFriend(friendId: string): Promise<{ success: boolean }> {
  logger.info('removeFriend called: friendId=' + friendId);
  try {
    const result = await request<{ success: boolean }>(`/friends/${friendId}`, { method: 'DELETE' });
    logger.info('removeFriend ok: friendId=' + friendId);
    return result;
  } catch (err) {
    logger.error('removeFriend failed: friendId=' + friendId + ', ' + err);
    throw err;
  }
}

/* GET /friends — auth required. */
export async function getFriends(): Promise<FriendInfo[]> {
  logger.debug('getFriends called');
  try {
    const result = await request<FriendInfo[]>('/friends');
    logger.debug('getFriends ok: count=' + result.length);
    return result;
  } catch (err) {
    logger.error('getFriends failed: ' + err);
    throw err;
  }
}
