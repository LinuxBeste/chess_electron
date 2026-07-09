import http, { RefinedResponse, ResponseType } from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:25565';
export const WS_URL = BASE_URL.replace(/^http/, 'ws') + '/chess-ws';

export const regErrorRate = new Rate('reg_errors');
export const loginErrorRate = new Rate('login_errors');
export const gameErrorRate = new Rate('game_errors');
export const moveErrorRate = new Rate('move_errors');
export const wsErrorRate = new Rate('ws_errors');
export const engineErrorRate = new Rate('engine_errors');

export const registerTrend = new Trend('register_duration');
export const loginTrend = new Trend('login_duration');
export const gameCreateTrend = new Trend('game_create_duration');
export const gameJoinTrend = new Trend('game_join_duration');
export const moveTrend = new Trend('move_duration');
export const engineTrend = new Trend('engine_duration');
export const wsConnectTrend = new Trend('ws_connect_duration');

export const OPENING_MOVES: { from: string; to: string }[] = [
  { from: 'e2', to: 'e4' },
  { from: 'e7', to: 'e5' },
  { from: 'g1', to: 'f3' },
  { from: 'b8', to: 'c6' },
  { from: 'f1', to: 'c4' },
  { from: 'f8', to: 'c5' },
  { from: 'e1', to: 'g1' },
  { from: 'g8', to: 'f6' },
  { from: 'd2', to: 'd3' },
  { from: 'd7', to: 'd6' },
];

export const CHAT_MESSAGES: string[] = ['hello everyone', 'gg', 'nice move', 'good game', 'hi', 'gl hf', 'well played'];

export interface Credentials {
  username: string;
  password: string;
  playerId: string;
  token: string;
}

export function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function makeUsername(prefix: string): string {
  return `${prefix}${Math.random().toString(36).substring(2, 9)}`;
}

export function register(vuId: string): Credentials | null {
  const username = makeUsername(`u${vuId}_`);
  const password = 'testpass123';
  const res = http.post(`${BASE_URL}/auth/register`, JSON.stringify({ username, password }), {
    headers: { 'Content-Type': 'application/json' },
  });
  registerTrend.add(res.timings.duration);
  const ok = check(res, { 'register status 201': (r: RefinedResponse<ResponseType | undefined>) => r.status === 201 });
  regErrorRate.add(!ok);
  if (ok) {
    const body = res.json() as { playerId: string; token: string };
    return { username, password, playerId: body.playerId, token: body.token };
  }
  return null;
}

export function login(username: string, password: string): { token: string } | null {
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ username, password }), {
    headers: { 'Content-Type': 'application/json' },
  });
  loginTrend.add(res.timings.duration);
  const ok = check(res, { 'login status 200': (r: RefinedResponse<ResponseType | undefined>) => r.status === 200 });
  loginErrorRate.add(!ok);
  if (ok) return res.json() as { token: string };
  return null;
}

export function getMe(token: string): RefinedResponse<ResponseType | undefined> {
  return http.get(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getHealth(): RefinedResponse<ResponseType | undefined> {
  return http.get(`${BASE_URL}/health`);
}

export function getGamesList(token: string): RefinedResponse<ResponseType | undefined> {
  return http.get(`${BASE_URL}/games?page=1&limit=10`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createGame(token: string): { id: string } | null {
  const res = http.post(`${BASE_URL}/games`, JSON.stringify({ visibility: 'public' }), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  gameCreateTrend.add(res.timings.duration);
  const ok = check(res, {
    'create game status 201': (r: RefinedResponse<ResponseType | undefined>) => r.status === 201,
  });
  gameErrorRate.add(!ok);
  if (ok) return res.json() as { id: string };
  return null;
}

export function joinGame(token: string, gameId: string): { id: string } | null {
  if (!gameId) return null;
  const res = http.post(`${BASE_URL}/games/${gameId}/join`, null, {
    headers: { Authorization: `Bearer ${token}` },
  });
  gameJoinTrend.add(res.timings.duration);
  const ok = check(res, { 'join game status 200': (r: RefinedResponse<ResponseType | undefined>) => r.status === 200 });
  gameErrorRate.add(!ok);
  if (ok) return res.json() as { id: string };
  return null;
}

export function makeMove(token: string, gameId: string, from: string, to: string): boolean {
  const res = http.post(`${BASE_URL}/games/${gameId}/move`, JSON.stringify({ from, to }), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  moveTrend.add(res.timings.duration);
  const ok = check(res, { 'move status 200': (r: RefinedResponse<ResponseType | undefined>) => r.status === 200 });
  moveErrorRate.add(!ok);
  return ok;
}

export function resignGame(token: string, gameId: string): RefinedResponse<ResponseType | undefined> {
  return http.post(`${BASE_URL}/games/${gameId}/resign`, null, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createBotGame(token: string, skillLevel?: number): { id: string } | null {
  const res = http.post(
    `${BASE_URL}/games/bot`,
    JSON.stringify({ skillLevel: skillLevel || 1, playerColor: 'white' }),
    {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    },
  );
  engineTrend.add(res.timings.duration);
  const ok = check(res, { 'bot game status 201': (r: RefinedResponse<ResponseType | undefined>) => r.status === 201 });
  engineErrorRate.add(!ok);
  if (ok) return res.json() as { id: string };
  return null;
}
