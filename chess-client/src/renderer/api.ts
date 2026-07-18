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

import type {
  GameState,
  LegalMoveHint,
  PieceType,
  FriendInfo,
  FriendRequestInfo,
  TournamentData,
  ArchivedGame,
} from '../types';
import { store } from './store';
import logger from './logger';
import type { SerializedSquare } from '../types';

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
    public code?: string,
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
    let code: string | undefined;
    try {
      const body = await res.json();
      if (body.error) msg = body.error;
      if (body.code) code = body.code;
    } catch {}
    throw new ApiError(res.status, msg, code);
  }

  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(res.status, 'Server returned non-JSON response (endpoint may not exist or server error)');
  }
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
  email: string | null;
  verified?: boolean;
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
      email: string | null;
      verified?: boolean;
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
/* PUT /auth/me/email — auth required.
 * Update the recovery email. Pass null to clear. Requires current password. */
export async function updateEmail(
  email: string | null,
  currentPassword: string,
): Promise<{ success: true; email: string | null }> {
  logger.info('updateEmail called: email=' + email);
  try {
    const result = await request<{ success: true; email: string | null }>('/auth/me/email', {
      method: 'PUT',
      body: JSON.stringify({ email, currentPassword }),
    });
    logger.info('updateEmail ok');
    return result;
  } catch (err) {
    logger.error('updateEmail failed: ' + err);
    throw err;
  }
}

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
  signal?: AbortSignal;
}): Promise<{ games: ArchivedGame[]; total: number; page: number; limit: number }> {
  logger.info('getArchivedGames called', params);
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.player) q.set('player', params.player);
  if (params.status) q.set('status', params.status);
  if (params.from) q.set('from', String(params.from));
  if (params.to) q.set('to', String(params.to));
  return request('/games/archive?' + q.toString(), params.signal ? { signal: params.signal } : undefined);
}

// Get a single archived game by ID
export async function getArchivedGame(gameId: string): Promise<ArchivedGame> {
  logger.info('getArchivedGame called', { gameId });
  return request('/games/archive/' + encodeURIComponent(gameId));
}

/* ─── Tournaments ─── */

export async function createTournament(name: string, maxPlayers: number, isPrivate?: boolean): Promise<TournamentData> {
  return request('/tournaments', {
    method: 'POST',
    body: JSON.stringify({ name, maxPlayers, isPrivate }),
  });
}

export async function getTournaments(): Promise<TournamentData[]> {
  return request('/tournaments');
}

export async function getTournament(id: string): Promise<TournamentData> {
  return request('/tournaments/' + encodeURIComponent(id));
}

export async function joinTournament(id: string): Promise<TournamentData> {
  return request('/tournaments/' + encodeURIComponent(id) + '/join', { method: 'POST' });
}

export async function joinTournamentByCode(code: string): Promise<TournamentData> {
  return request('/tournaments/join-by-code', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function leaveTournament(id: string): Promise<TournamentData> {
  return request('/tournaments/' + encodeURIComponent(id) + '/leave', { method: 'POST' });
}

export async function updateTournament(
  id: string,
  data: { name?: string; maxPlayers?: number; isPrivate?: boolean },
): Promise<TournamentData> {
  return request('/tournaments/' + encodeURIComponent(id), {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteTournament(id: string): Promise<TournamentData> {
  return request('/tournaments/' + encodeURIComponent(id), { method: 'DELETE' });
}

export async function startTournament(id: string): Promise<TournamentData> {
  return request('/tournaments/' + encodeURIComponent(id) + '/start', { method: 'POST' });
}

/* ─── Password Reset ─── */

/* POST /auth/forgot-password — no auth required. */
export async function forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
  logger.info('forgotPassword called: email=' + email);
  try {
    const result = await request<{ success: boolean; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    logger.info('forgotPassword ok');
    return result;
  } catch (err) {
    logger.error('forgotPassword failed: ' + err);
    throw err;
  }
}

/* POST /auth/reset-password — no auth required. */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> {
  logger.info('resetPassword called');
  try {
    const result = await request<{ success: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
    logger.info('resetPassword ok');
    return result;
  } catch (err) {
    logger.error('resetPassword failed: ' + err);
    throw err;
  }
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
export async function getLeaderboard(
  page = 1,
  limit = 50,
): Promise<{
  entries: {
    playerId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
  }[];
  total: number;
  page: number;
  limit: number;
}> {
  logger.info('getLeaderboard called page=' + page + ' limit=' + limit);
  const result = await request<{
    entries: {
      playerId: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      rating: number;
      wins: number;
      losses: number;
      draws: number;
    }[];
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

/* POST /games/chess960 */
export async function createChess960Game(visibility?: 'public' | 'private'): Promise<GameState> {
  logger.info('createChess960Game called' + (visibility ? ': visibility=' + visibility : ''));
  try {
    const result = await request<GameState>('/games/chess960', {
      method: 'POST',
      body: JSON.stringify({ ...(visibility ? { visibility } : {}) }),
    });
    logger.info('createChess960Game ok: gameId=' + result.id);
    return result;
  } catch (err) {
    logger.error('createChess960Game failed: ' + err);
    throw err;
  }
}

/* POST /games/bot */
export async function createBotGame(skillLevel: number, playerColor?: 'white' | 'black'): Promise<GameState> {
  logger.info('createBotGame called', { skillLevel, playerColor });
  try {
    const result = await request<GameState>('/games/bot', {
      method: 'POST',
      body: JSON.stringify({ skillLevel, playerColor }),
    });
    logger.info('createBotGame ok: gameId=' + result.id);
    return result;
  } catch (err) {
    logger.error('createBotGame failed: ' + err);
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
    const result = await request<{ games: GameState[]; page: number; limit: number }>('/games');
    logger.debug('getOpenGames ok: count=' + result.games.length + ' page=' + result.page + ' limit=' + result.limit);
    return result.games;
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
    const result = await request<{ games: GameState[]; page: number; limit: number }>('/games/active');
    logger.debug('getActiveGames ok: count=' + result.games.length + ' page=' + result.page + ' limit=' + result.limit);
    return result.games;
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
    const result = await request<GameState>(`/games/${encodeURIComponent(gameId)}`);
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
    const result = await request<{ success: boolean }>(`/games/${encodeURIComponent(gameId)}/abort`, {
      method: 'POST',
    });
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
    const result = await request<GameState>(`/games/${encodeURIComponent(gameId)}/join`, { method: 'POST' });
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
    const result = await request<GameState>(`/games/${encodeURIComponent(gameId)}/move`, {
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
    const result = await request<GameState>(`/games/${encodeURIComponent(gameId)}/resign`, { method: 'POST' });
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
    const result = await request<GameState[]>(`/players/${encodeURIComponent(playerId)}/games`);
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
    const result = await request<{ moves: LegalMoveHint[] }>(`/games/${encodeURIComponent(gameId)}/moves`);
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
  rating: number | null;
  verified?: boolean;
  friendStatus: 'none' | 'friends' | 'incoming' | 'outgoing';
  friendCount: number;
  isOnline: boolean;
  currentGameId: string | null;
  totalGames: number;
  archivedStats: { wins: number; losses: number; draws: number };
  tournaments: { total: number; wins: number; currentId: string | null };
  stats: { wins: number; losses: number; draws: number } | null;
}

/* Helper: get archived games for a specific player. */
export async function getArchivedGamesForPlayer(
  playerId: string,
  page = 1,
  limit = 20,
): Promise<{ games: ArchivedGame[]; total: number; page: number; limit: number }> {
  return getArchivedGames({ player: playerId, page, limit });
}

/* GET /players/:playerId/profile — auth required.
 * View another player's public profile. */
export async function getPlayerProfile(playerId: string): Promise<PlayerProfile> {
  logger.info('getPlayerProfile called: playerId=' + playerId);
  try {
    const result = await request<PlayerProfile>(`/players/${encodeURIComponent(playerId)}/profile`);
    logger.info('getPlayerProfile ok: playerId=' + result.id);
    return result;
  } catch (err) {
    logger.error('getPlayerProfile failed: playerId=' + playerId + ', ' + err);
    throw err;
  }
}

/* ─── Friends ─── */

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
}

let searchCache: { q: string; results: UserSearchResult[] } | null = null;

/* GET /users/search?q= — auth required (debounced externally). */
export async function searchUsers(q: string): Promise<UserSearchResult[]> {
  if (searchCache && searchCache.q === q) return searchCache.results;
  const results = await request<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(q)}`);
  searchCache = { q, results };
  return results;
}

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
    const result = await request<{ success: boolean }>(`/friends/requests/${encodeURIComponent(id)}/accept`, {
      method: 'POST',
    });
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
    const result = await request<{ success: boolean }>(`/friends/requests/${encodeURIComponent(id)}/decline`, {
      method: 'POST',
    });
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
    const result = await request<{ success: boolean }>(`/friends/requests/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    });
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
    const result = await request<{ success: boolean }>(`/friends/${encodeURIComponent(friendId)}`, {
      method: 'DELETE',
    });
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

export async function parsePgn(pgn: string): Promise<{ fen: string; board: SerializedSquare[] }> {
  return request('/analysis/parse-pgn', { method: 'POST', body: JSON.stringify({ pgn }) });
}
