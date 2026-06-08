const BASE = '/admin/api';

let token: string | null = localStorage.getItem('admin_token');

export function getToken() { return token; }

export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem('admin_token', t);
  else localStorage.removeItem('admin_token');
}

export async function api<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + path, { ...opts, headers });
  if (res.status === 401 && path !== '/login') {
    setToken(null);
    window.location.reload();
    throw new Error('Unauthorized');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export interface Stats {
  gamesActive: number;
  playersOnline: number;
  registeredUsers: number;
  totalUsers: number;
}

export interface GameRow {
  id: string;
  status: string;
  white: string;
  black: string;
  turn: string;
  moves: number;
  createdAt: number;
  winner: string | null;
  visibility: string;
}

export interface PlayerRow {
  id: string;
  username: string;
  displayName: string;
  isRegistered: boolean;
  online: boolean;
  tokens: number;
}

export interface AccountRow {
  id: string;
  username: string;
  displayName: string;
  createdAt: number;
  wins: number;
  losses: number;
  draws: number;
}
