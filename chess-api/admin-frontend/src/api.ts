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
  ip: string | null;
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

export interface BanList {
  players: string[];
  ips: string[];
}

export interface SystemMetricsSample {
  cpu: number;
  memory: { used: number; total: number; percent: number };
  net: { rx: number; tx: number };
  disk: { read: number; write: number };
  timestamp: number;
}

export interface SystemStats {
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  cpu: {
    cores: number;
    model: string;
    loadAverage1: number;
    loadAverage5: number;
    loadAverage15: number;
  };
  process: {
    uptime: number;
    nodeVersion: string;
    pid: number;
    memoryRss: number;
    heapUsed: number;
    heapTotal: number;
  };
  system: {
    uptime: number;
    platform: string;
    hostname: string;
    arch: string;
  };
  disk: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
}
