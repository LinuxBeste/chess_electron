const BASE = '/admin/api';

// persist admin token across page reloads
let token: string | null = localStorage.getItem('admin_token');

export function getToken() {
  return token;
}

export function setToken(t: string | null) {
  // keep in-memory token and localStorage in sync
  token = t;
  if (t) localStorage.setItem('admin_token', t);
  else localStorage.removeItem('admin_token');
}

export async function api<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`; // attach JWT for authenticated requests
  const res = await fetch(BASE + path, { ...opts, headers });
  // auto-redirect to login on 401, but not during login itself
  if (res.status === 401 && path !== '/login') {
    setToken(null);
    window.location.reload();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    let msg = 'Request failed';
    try {
      const body = await res.json();
      msg = body.error || msg;
    } catch {
      /* body is not JSON, keep default */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export interface Stats {
  gamesActive: number;
  playersOnline: number;
  totalPlayers: number;
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
  registeredAt: number | null;
  currentGameId: string | undefined;
}

export interface AccountRow {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: number;
  wins: number;
  losses: number;
  draws: number;
  rating: number;
  isAdmin?: boolean;
}

export interface PlayerProfileView {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: number;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  isAdmin: boolean;
  isOnline: boolean;
  currentGameId: string | null;
}

export interface BanEntry {
  id?: string;
  ip?: string;
  bannedAt: number;
}

export interface BanList {
  players: BanEntry[];
  ips: BanEntry[];
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
    speed: number;
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
    release: string;
    hostname: string;
    arch: string;
  };
  disk: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  networks: { name: string; address: string; family: string }[];
}

export interface ProcessRow {
  user: string;
  pid: number;
  cpu: number;
  mem: number;
  rss: number;
  vsz: number;
  command: string;
}

export interface UserGamesResponse {
  active: {
    id: string;
    status: string;
    white: string;
    black: string;
    turn: string;
    moves: number;
    createdAt: number;
  }[];
  completed: {
    id: string;
    white: string;
    black: string;
    winner: string | null;
    status: string;
    playedAt: number;
    pgn: string | null;
  }[];
  totalCompleted: number;
}

export interface ImpersonateResponse {
  token: string;
  userId: string;
  username: string;
}

export interface AccountCreate {
  username: string;
  password: string;
  displayName?: string;
}

export interface WsConnectionInfo {
  totalPlayerConnections: number;
  totalSpectatorConnections: number;
  connectedPlayers: number;
  spectatedGames: number;
  players: { playerId: string; username: string; connectionCount: number }[];
  spectators: { gameId: string; connectionCount: number }[];
  disconnectEvents: number;
}

export interface HealthStatus {
  status: string;
  database: { connected: boolean; latencyMs?: number };
  server: {
    uptime: number;
    nodeVersion: string;
    pid: number;
    memory: { rss: number; heapUsed: number; heapTotal: number };
  };
  game: { activeGames: number; onlinePlayers: number };
  timestamp: number;
}

export interface DbTableInfo {
  tables: { name: string; estimatedRows: number }[];
}

export interface DbQueryResult {
  columns: string[];
  rows: string[][];
  totalRows: number;
  elapsedMs: number;
}

export interface AuditResponse {
  entries: string[];
  total: number;
}

export interface GameReplayResponse {
  id: string;
  status: string;
  white: string;
  black: string;
  moves: string[];
  boardHistory: string[];
  winner: string | null;
  result: string;
  createdAt: number;
}

export interface LogFileInfo {
  name: string;
  size: number;
}

export interface ServerConfig {
  maxGamesPerPlayer: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  waitingTtl: number;
  adminUsername: string;
  dbPath: string;
  nodeVersion: string;
  platform: string;
  _sources?: Record<string, 'env' | 'default'>;
}
