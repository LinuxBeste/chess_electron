import { fileURLToPath } from 'url';
import crypto from 'crypto';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import logger from './logger.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let _pool: pg.Pool | null = null;

const LEADERBOARD_CACHE_TTL_MS = parseInt(process.env.LEADERBOARD_CACHE_TTL ?? '10000', 10);
const leaderboardCache = new Map<string, { data: unknown; expiresAt: number }>(); // TTL-based cache reduces DB load
function getLeaderboardCacheKey(
  limit: number,
  offset: number,
  minGames: number,
  sortKey: string,
  sortAsc: boolean,
): string {
  return `${limit}:${offset}:${minGames}:${sortKey}:${sortAsc}`;
}
function getCachedLeaderboard<T>(key: string): T | null {
  const entry = leaderboardCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data as T;
  leaderboardCache.delete(key);
  return null;
}
function setCachedLeaderboard(key: string, data: unknown): void {
  leaderboardCache.set(key, { data, expiresAt: Date.now() + LEADERBOARD_CACHE_TTL_MS });
}
export function invalidateLeaderboardCache(): void {
  leaderboardCache.clear();
}

function getPool(): pg.Pool {
  if (!_pool) {
    // Lazy singleton: pool created on first query
    _pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://chess:chess@localhost:5432/chess',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pg.types.setTypeParser(pg.types.builtins.INT8, (val: string) => parseInt(val, 10)); // Auto-parse INT8/NUMERIC to JS numbers
    pg.types.setTypeParser(pg.types.builtins.NUMERIC, (val: string) => parseFloat(val));
    _pool.on('error', (err) => {
      logger.error('Unexpected PostgreSQL pool error:', err);
    });
  }
  return _pool;
}

export function getDb(): pg.Pool {
  return getPool();
}

export function setConnectionString(url: string): void {
  if (_pool) {
    _pool.end(); // Gracefully close old pool before replacing
    _pool = null;
  }
  process.env.DATABASE_URL = url;
}

export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {}); // Rollback failure must not throw
    throw err;
  } finally {
    client.release();
  }
}

const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        display_name TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        draws INTEGER NOT NULL DEFAULT 0,
        avatar_url TEXT DEFAULT NULL,
        rating INTEGER NOT NULL DEFAULT 1200
      );

      CREATE TABLE IF NOT EXISTS user_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        created_at BIGINT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens(user_id);

      CREATE TABLE IF NOT EXISTS bans (
        id TEXT PRIMARY KEY,
        player_id TEXT,
        ip TEXT,
        banned_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS friend_requests (
        id TEXT PRIMARY KEY,
        from_user_id TEXT NOT NULL REFERENCES users(id),
        to_user_id TEXT NOT NULL REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'pending',
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_friend_requests_to_status ON friend_requests(to_user_id, status);
      CREATE INDEX IF NOT EXISTS idx_friend_requests_from_status ON friend_requests(from_user_id, status);
      CREATE INDEX IF NOT EXISTS idx_friend_requests_both_status ON friend_requests(from_user_id, to_user_id, status);

      CREATE TABLE IF NOT EXISTS friends (
        user_id TEXT NOT NULL REFERENCES users(id),
        friend_id TEXT NOT NULL REFERENCES users(id),
        created_at BIGINT NOT NULL,
        PRIMARY KEY (user_id, friend_id)
      );

      CREATE TABLE IF NOT EXISTS completed_games (
        id TEXT PRIMARY KEY,
        white_player_id TEXT,
        black_player_id TEXT,
        white_display_name TEXT NOT NULL DEFAULT '',
        black_display_name TEXT NOT NULL DEFAULT '',
        winner TEXT,
        status TEXT NOT NULL,
        result TEXT NOT NULL,
        reason TEXT,
        move_history JSONB NOT NULL DEFAULT '[]'::jsonb,
        board_history JSONB NOT NULL DEFAULT '[]'::jsonb,
        pgn TEXT,
        played_at BIGINT NOT NULL,
        time_control TEXT NOT NULL DEFAULT ''
      );

      CREATE INDEX IF NOT EXISTS idx_completed_games_played_at ON completed_games(played_at);
      CREATE INDEX IF NOT EXISTS idx_completed_games_white ON completed_games(white_player_id);
      CREATE INDEX IF NOT EXISTS idx_completed_games_black ON completed_games(black_player_id);

      CREATE TABLE IF NOT EXISTS tournaments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'waiting',
        created_by TEXT NOT NULL REFERENCES users(id),
        max_players INTEGER NOT NULL DEFAULT 8,
        is_private BOOLEAN NOT NULL DEFAULT false,
        join_code TEXT,
        created_at BIGINT NOT NULL,
        started_at BIGINT,
        completed_at BIGINT,
        winner_id TEXT REFERENCES users(id),
        type TEXT NOT NULL DEFAULT 'single_elimination',
        participant_data JSONB NOT NULL DEFAULT '[]'::jsonb,
        match_data JSONB NOT NULL DEFAULT '[]'::jsonb
      );

      CREATE TABLE IF NOT EXISTS tournament_participants (
        id TEXT PRIMARY KEY,
        tournament_id TEXT NOT NULL REFERENCES tournaments(id),
        player_id TEXT NOT NULL REFERENCES users(id),
        display_name TEXT NOT NULL DEFAULT '',
        seed INTEGER NOT NULL DEFAULT 0,
        created_at BIGINT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON tournament_participants(tournament_id);

      CREATE TABLE IF NOT EXISTS tournament_matches (
        id TEXT PRIMARY KEY,
        tournament_id TEXT NOT NULL REFERENCES tournaments(id),
        round INTEGER NOT NULL,
        position INTEGER NOT NULL,
        white_player_id TEXT,
        black_player_id TEXT,
        game_id TEXT,
        winner_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending'
      );

      CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);
    `,
  },
  {
    version: 2,
    sql: `
      ALTER TABLE completed_games ALTER COLUMN move_history TYPE TEXT;
      ALTER TABLE completed_games ALTER COLUMN board_history TYPE TEXT;
    `,
  },
  {
    version: 3,
    sql: `
      CREATE INDEX IF NOT EXISTS idx_bans_player_id ON bans(player_id);
      CREATE INDEX IF NOT EXISTS idx_bans_ip ON bans(ip);
      CREATE INDEX IF NOT EXISTS idx_users_rating ON users(rating);
      CREATE INDEX IF NOT EXISTS idx_tournaments_join_code ON tournaments(join_code);
      CREATE INDEX IF NOT EXISTS idx_tournament_participants_player ON tournament_participants(player_id);
      CREATE INDEX IF NOT EXISTS idx_user_tokens_created_at ON user_tokens(created_at);
    `,
  },
];

let migrated = false;

async function migrate(): Promise<void> {
  if (migrated) return;
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  for (const m of MIGRATIONS) {
    const { rows } = await getPool().query('SELECT 1 FROM _migrations WHERE version = $1', [m.version]);
    if (rows.length === 0) {
      await getPool().query(m.sql);
      await getPool().query('INSERT INTO _migrations (version) VALUES ($1)', [m.version]);
      logger.info('DB migration applied: version=' + m.version);
    }
  }
  migrated = true;
  logger.info('DB migrations complete');
}

export function resetMigrations(): void {
  migrated = false;
}

export async function initDb(): Promise<void> {
  await migrate();
}

export interface DbUser {
  id: string;
  username: string;
  password_hash: string | null;
  display_name: string;
  created_at: number;
  wins: number;
  losses: number;
  draws: number;
  avatar_url: string | null;
  rating: number;
}

interface CompletedGameRow {
  id: string;
  white_player_id: string | null;
  black_player_id: string | null;
  white_display_name: string;
  black_display_name: string;
  winner: string | null;
  status: string;
  result: string;
  reason: string | null;
  move_history: string;
  board_history: string;
  pgn: string | null;
  played_at: number;
  time_control: string;
}

interface TournamentRow {
  id: string;
  name: string;
  status: string;
  created_by: string;
  max_players: number;
  is_private: boolean | number;
  join_code: string | null;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  winner_id: string | null;
}

interface TournamentParticipantRow {
  id: string;
  tournament_id: string;
  player_id: string;
  display_name: string;
  seed: number;
  created_at: number;
}

interface TournamentMatchRow {
  id: string;
  tournament_id: string;
  round: number;
  position: number;
  white_player_id: string | null;
  black_player_id: string | null;
  game_id: string | null;
  winner_id: string | null;
  status: string;
}

export async function createUser(
  id: string,
  username: string,
  passwordHash: string | null,
  displayName: string,
): Promise<void> {
  await getPool().query(
    'INSERT INTO users (id, username, password_hash, display_name, created_at) VALUES ($1, $2, $3, $4, $5)',
    [id, username, passwordHash, displayName, Date.now()],
  );
  logger.debug('DB: user created id=' + id + ' username=' + username);
}

export async function getUserByUsername(username: string): Promise<DbUser | undefined> {
  const { rows } = await getPool().query('SELECT * FROM users WHERE username = $1', [username]);
  const user = rows[0] as DbUser | undefined;
  logger.debug('DB: getUserByUsername username=' + username + (user ? ' found' : ' not found'));
  return user;
}

export async function getUserById(id: string): Promise<DbUser | undefined> {
  const { rows } = await getPool().query('SELECT * FROM users WHERE id = $1', [id]);
  const user = rows[0] as DbUser | undefined;
  logger.debug('DB: getUserById id=' + id + (user ? ' found' : ' not found'));
  return user;
}

export async function getUsersByIds(ids: string[]): Promise<Map<string, DbUser>> {
  if (ids.length === 0) return new Map(); // Early return for empty batch query
  const placeholders = ids.map((_, i) => '$' + (i + 1)).join(',');
  const { rows } = await getPool().query('SELECT * FROM users WHERE id IN (' + placeholders + ')', ids);
  const map = new Map<string, DbUser>();
  for (const row of rows as DbUser[]) {
    map.set(row.id, row);
  }
  logger.debug('DB: getUsersByIds requested=' + ids.length + ' found=' + rows.length);
  return map;
}

export async function saveToken(token: string, userId: string): Promise<void> {
  await getPool().query('INSERT INTO user_tokens (token, user_id, created_at) VALUES ($1, $2, $3)', [
    token,
    userId,
    Date.now(),
  ]);
  logger.debug('DB: token saved userId=' + userId);
}

export async function getUserIdByToken(token: string): Promise<string | undefined> {
  const { rows } = await getPool().query('SELECT user_id FROM user_tokens WHERE token = $1', [token]);
  const row = rows[0] as { user_id: string } | undefined;
  logger.debug('DB: getUserIdByToken ' + (row ? 'found userId=' + row.user_id : 'not found'));
  return row?.user_id;
}

export async function deleteToken(token: string): Promise<void> {
  await getPool().query('DELETE FROM user_tokens WHERE token = $1', [token]);
  logger.debug('DB: token deleted');
}

export async function cleanupExpiredTokens(maxAgeMs = 30 * 86400000): Promise<number> {
  const cutoff = Date.now() - maxAgeMs;
  const { rowCount } = await getPool().query('DELETE FROM user_tokens WHERE created_at < $1', [cutoff]);
  if (rowCount && rowCount > 0) logger.info('DB: cleaned up ' + rowCount + ' expired tokens');
  return rowCount ?? 0;
}

export async function createBackup(): Promise<string | null> {
  try {
    const dir = path.join(__dirname, '..', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(dir, `chess-${timestamp}.dump`);
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    await execFileAsync('pg_dump', ['--dbname=' + process.env.DATABASE_URL!, '-Fc', '-f', backupPath], {
      timeout: 60000, // 60s backup timeout
    });
    logger.info('DB backup created: ' + backupPath);

    const cutoff = Date.now() - 7 * 86400000; // Auto-prune backups older than 7 days
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (!file.startsWith('chess-') || !file.endsWith('.dump')) continue;
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile() && stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        logger.info('DB backup pruned: ' + file);
      }
    }
    return backupPath;
  } catch (err) {
    logger.error('DB backup failed:', err);
    return null;
  }
}

export async function addWin(userId: string): Promise<void> {
  await getPool().query('UPDATE users SET wins = wins + 1, rating = rating + 16 WHERE id = $1', [userId]); // +16 Elo as simple default delta
  invalidateLeaderboardCache();
}

export async function addLoss(userId: string): Promise<void> {
  await getPool().query('UPDATE users SET losses = losses + 1, rating = rating - 16 WHERE id = $1', [userId]);
  invalidateLeaderboardCache();
}

export async function addDraw(userId: string): Promise<void> {
  await getPool().query('UPDATE users SET draws = draws + 1 WHERE id = $1', [userId]);
  invalidateLeaderboardCache();
}

export async function loadAllUsers(): Promise<DbUser[]> {
  const { rows } = await getPool().query('SELECT * FROM users');
  logger.debug('DB: loadAllUsers count=' + rows.length);
  return rows as DbUser[];
}

export async function loadAllTokens(): Promise<{ token: string; user_id: string }[]> {
  const { rows } = await getPool().query('SELECT token, user_id FROM user_tokens');
  logger.debug('DB: loadAllTokens count=' + rows.length);
  return rows as { token: string; user_id: string }[];
}

export async function updateUserAvatar(id: string, url: string | null): Promise<void> {
  await getPool().query('UPDATE users SET avatar_url = $1 WHERE id = $2', [url, id]);
  logger.debug('DB: avatar updated id=' + id + ' url=' + url);
}

export async function updateUsername(id: string, username: string): Promise<void> {
  await getPool().query('UPDATE users SET username = $1 WHERE id = $2', [username, id]);
  logger.debug('DB: username updated id=' + id + ' username=' + username);
}

export async function updateUserStats(id: string, wins: number, losses: number, draws: number): Promise<void> {
  await getPool().query('UPDATE users SET wins = $1, losses = $2, draws = $3 WHERE id = $4', [wins, losses, draws, id]);
  logger.debug('DB: stats updated id=' + id + ' w=' + wins + ' l=' + losses + ' d=' + draws);
}

export async function updateUserDisplayName(id: string, displayName: string): Promise<void> {
  await getPool().query('UPDATE users SET display_name = $1 WHERE id = $2', [displayName, id]);
  logger.debug('DB: displayName updated id=' + id + ' name=' + displayName);
}

export async function updateUserPasswordHash(id: string, passwordHash: string): Promise<void> {
  await getPool().query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
  logger.debug('DB: password hash updated id=' + id);
}

export async function deleteUserTokens(id: string): Promise<void> {
  await getPool().query('DELETE FROM user_tokens WHERE user_id = $1', [id]);
  logger.debug('DB: tokens deleted userId=' + id);
}

export async function deleteUserRecord(id: string): Promise<void> {
  await getPool().query('DELETE FROM users WHERE id = $1', [id]);
  logger.debug('DB: user record deleted id=' + id);
}

/* ─── Bans ─── */

export async function saveBan(id: string, playerId: string | null, ip: string | null): Promise<void> {
  await getPool().query(
    'INSERT INTO bans (id, player_id, ip, banned_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET player_id = $2, ip = $3, banned_at = $4',
    [id, playerId, ip, Date.now()],
  );
  logger.debug('DB: ban saved id=' + id + ' playerId=' + playerId + ' ip=' + ip);
}

export async function loadAllBans(): Promise<
  { id: string; player_id: string | null; ip: string | null; banned_at: number }[]
> {
  const { rows } = await getPool().query('SELECT id, player_id, ip, banned_at FROM bans');
  logger.debug('DB: loadAllBans count=' + rows.length);
  return rows as { id: string; player_id: string | null; ip: string | null; banned_at: number }[];
}

export async function deleteBanById(id: string): Promise<void> {
  await getPool().query('DELETE FROM bans WHERE id = $1', [id]);
  logger.debug('DB: ban deleted id=' + id);
}

/* ─── Friends ─── */

export interface FriendRequestRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  created_at: number;
  updated_at: number;
}

export async function createFriendRequest(fromUserId: string, toUserId: string): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await getPool().query(
    'INSERT INTO friend_requests (id, from_user_id, to_user_id, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, fromUserId, toUserId, 'pending', now, now],
  );
  logger.debug('DB: friend request created id=' + id + ' from=' + fromUserId + ' to=' + toUserId);
  return id;
}

export async function getFriendRequest(id: string): Promise<FriendRequestRow | undefined> {
  const { rows } = await getPool().query('SELECT * FROM friend_requests WHERE id = $1', [id]);
  const fr = rows[0] as FriendRequestRow | undefined;
  logger.debug('DB: getFriendRequest id=' + id + (fr ? ' found' : ' not found'));
  return fr;
}

export async function getPendingIncomingRequests(userId: string): Promise<FriendRequestRow[]> {
  const { rows } = await getPool().query(
    'SELECT * FROM friend_requests WHERE to_user_id = $1 AND status = $2 ORDER BY created_at DESC',
    [userId, 'pending'],
  );
  logger.debug('DB: pending incoming requests userId=' + userId + ' count=' + rows.length);
  return rows as FriendRequestRow[];
}

export async function getPendingOutgoingRequests(userId: string): Promise<FriendRequestRow[]> {
  const { rows } = await getPool().query(
    'SELECT * FROM friend_requests WHERE from_user_id = $1 AND status = $2 ORDER BY created_at DESC',
    [userId, 'pending'],
  );
  logger.debug('DB: pending outgoing requests userId=' + userId + ' count=' + rows.length);
  return rows as FriendRequestRow[];
}

export async function getFriendStatus(
  authUserId: string,
  otherUserId: string,
): Promise<'none' | 'friends' | 'incoming' | 'outgoing'> {
  if (await areFriends(authUserId, otherUserId)) return 'friends';
  const incoming = await getPool().query(
    'SELECT 1 FROM friend_requests WHERE from_user_id = $1 AND to_user_id = $2 AND status = $3',
    [otherUserId, authUserId, 'pending'],
  );
  if (incoming.rows.length > 0) return 'incoming';
  const outgoing = await getPool().query(
    'SELECT 1 FROM friend_requests WHERE from_user_id = $1 AND to_user_id = $2 AND status = $3',
    [authUserId, otherUserId, 'pending'],
  );
  if (outgoing.rows.length > 0) return 'outgoing';
  return 'none';
}

export async function hasPendingRequest(fromUserId: string, toUserId: string): Promise<boolean> {
  const { rows } = await getPool().query(
    'SELECT 1 FROM friend_requests WHERE ((from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $3 AND to_user_id = $4)) AND status = $5',
    [fromUserId, toUserId, toUserId, fromUserId, 'pending'],
  );
  const result = rows.length > 0;
  logger.debug('DB: hasPendingRequest from=' + fromUserId + ' to=' + toUserId + ' =' + result);
  return result;
}

export async function updateFriendRequestStatus(id: string, status: string): Promise<void> {
  await getPool().query('UPDATE friend_requests SET status = $1, updated_at = $2 WHERE id = $3', [
    status,
    Date.now(),
    id,
  ]);
  logger.debug('DB: friend request status updated id=' + id + ' status=' + status);
}

export async function addFriendRelationship(userId: string, friendId: string): Promise<void> {
  return transaction(async (client) => {
    const now = Date.now();
    await client.query(
      'INSERT INTO friends (user_id, friend_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [userId, friendId, now],
    );
    await client.query(
      'INSERT INTO friends (user_id, friend_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [friendId, userId, now],
    );
    logger.debug('DB: friend relationship added user1=' + userId + ' user2=' + friendId);
  });
}

export async function removeFriendRelationship(userId: string, friendId: string): Promise<void> {
  await getPool().query(
    'DELETE FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $3 AND friend_id = $4)',
    [userId, friendId, friendId, userId],
  );
  logger.debug('DB: friend relationship removed user1=' + userId + ' user2=' + friendId);
}

export async function getFriendIds(userId: string): Promise<string[]> {
  const { rows } = await getPool().query('SELECT friend_id FROM friends WHERE user_id = $1', [userId]);
  const ids = (rows as { friend_id: string }[]).map((r) => r.friend_id);
  logger.debug('DB: getFriendIds userId=' + userId + ' count=' + ids.length);
  return ids;
}

/* ─── Leaderboard ─── */

export async function getLeaderboard(
  limit: number,
  offset: number,
  minGames = 0,
  sortKey = 'rating',
  sortAsc = false,
): Promise<{
  rows: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
  }[];
  total: number;
}> {
  const cacheKey = getLeaderboardCacheKey(limit, offset, minGames, sortKey, sortAsc);
  const cached = getCachedLeaderboard<{
    rows: {
      id: string;
      username: string;
      display_name: string;
      avatar_url: string | null;
      rating: number;
      wins: number;
      losses: number;
      draws: number;
    }[];
    total: number;
  }>(cacheKey);
  if (cached) return cached;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 0;
  if (minGames > 0) {
    paramIdx++;
    conditions.push('(wins + losses + draws) >= $' + paramIdx);
    params.push(minGames);
  }
  const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
  const { rows: countRows } = await getPool().query('SELECT COUNT(*) as c FROM users' + where, params);
  const total = (countRows[0] as { c: number }).c;
  const allowedSort = ['rating', 'wins', 'username', 'display_name'];
  const orderCol = allowedSort.includes(sortKey) ? sortKey : 'rating';
  const orderDir = sortAsc ? 'ASC' : 'DESC';
  const { rows } = await getPool().query(
    'SELECT id, username, display_name, avatar_url, rating, wins, losses, draws FROM users' +
      where +
      ' ORDER BY ' +
      orderCol +
      ' ' +
      orderDir +
      ' LIMIT $' +
      (paramIdx + 1) +
      ' OFFSET $' +
      (paramIdx + 2),
    [...params, limit, offset],
  );
  const result = {
    rows: rows as {
      id: string;
      username: string;
      display_name: string;
      avatar_url: string | null;
      rating: number;
      wins: number;
      losses: number;
      draws: number;
    }[],
    total,
  };
  setCachedLeaderboard(cacheKey, result);
  return result;
}

export async function getPlayerRating(userId: string): Promise<number> {
  const { rows } = await getPool().query('SELECT rating FROM users WHERE id = $1', [userId]);
  const row = rows[0] as { rating: number } | undefined;
  return row?.rating ?? 1200;
}

export async function updatePlayerRating(userId: string, rating: number): Promise<void> {
  await getPool().query('UPDATE users SET rating = $1 WHERE id = $2', [rating, userId]);
  invalidateLeaderboardCache();
}

export async function updateWinLossDraw(userId: string, result: 'win' | 'loss' | 'draw'): Promise<void> {
  if (result === 'win') await getPool().query('UPDATE users SET wins = wins + 1 WHERE id = $1', [userId]);
  else if (result === 'loss') await getPool().query('UPDATE users SET losses = losses + 1 WHERE id = $1', [userId]);
  else await getPool().query('UPDATE users SET draws = draws + 1 WHERE id = $1', [userId]);
}

/* ─── Game Archive ─── */

export async function saveCompletedGame(
  id: string,
  whitePlayerId: string | null,
  blackPlayerId: string | null,
  whiteDisplayName: string,
  blackDisplayName: string,
  winner: string | null,
  status: string,
  result: string,
  reason: string | null,
  moveHistory: string,
  boardHistory: string,
  pgn: string | null,
  timeControl: string,
): Promise<void> {
  await getPool().query(
    'INSERT INTO completed_games (id, white_player_id, black_player_id, white_display_name, black_display_name, winner, status, result, reason, move_history, board_history, pgn, played_at, time_control) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)',
    [
      id,
      whitePlayerId,
      blackPlayerId,
      whiteDisplayName,
      blackDisplayName,
      winner,
      status,
      result,
      reason,
      moveHistory,
      boardHistory,
      pgn,
      Date.now(),
      timeControl,
    ],
  );
  logger.debug('DB: completed game saved id=' + id);
}

export async function getArchivedGames(
  page: number,
  limit: number,
  playerId?: string,
  status?: string,
  fromDate?: number,
  toDate?: number,
  sortKey = 'played_at',
  sortAsc = false,
): Promise<{ rows: CompletedGameRow[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 0;
  if (playerId) {
    paramIdx++;
    conditions.push('(white_player_id = $' + paramIdx + ' OR black_player_id = $' + (paramIdx + 1) + ')');
    params.push(playerId, playerId);
    paramIdx++;
  }
  if (status) {
    paramIdx++;
    conditions.push('status = $' + paramIdx);
    params.push(status);
  }
  if (fromDate) {
    paramIdx++;
    conditions.push('played_at >= $' + paramIdx);
    params.push(fromDate);
  }
  if (toDate) {
    paramIdx++;
    conditions.push('played_at <= $' + paramIdx);
    params.push(toDate);
  }
  const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
  const { rows: countRows } = await getPool().query('SELECT COUNT(*) as c FROM completed_games' + where, params);
  const total = (countRows[0] as { c: number }).c;
  const offset = (page - 1) * limit;
  const allowedSort = ['played_at', 'white_display_name', 'black_display_name'];
  const orderCol = allowedSort.includes(sortKey) ? sortKey : 'played_at';
  const orderDir = sortAsc ? 'ASC' : 'DESC';
  const { rows } = await getPool().query(
    'SELECT * FROM completed_games' +
      where +
      ' ORDER BY ' +
      orderCol +
      ' ' +
      orderDir +
      ' LIMIT $' +
      (paramIdx + 1) +
      ' OFFSET $' +
      (paramIdx + 2),
    [...params, limit, offset],
  );
  return { rows: rows as CompletedGameRow[], total };
}

export async function getArchivedGame(id: string): Promise<CompletedGameRow | undefined> {
  const { rows } = await getPool().query('SELECT * FROM completed_games WHERE id = $1', [id]);
  return rows[0] as CompletedGameRow | undefined;
}

export async function deleteArchivedGame(id: string): Promise<void> {
  await getPool().query('DELETE FROM completed_games WHERE id = $1', [id]);
}

export async function getPlayerWinLossDraw(playerId: string): Promise<{ wins: number; losses: number; draws: number }> {
  const { rows } = await getPool().query(
    `SELECT
      COUNT(*) FILTER (WHERE (white_player_id = $1 AND winner = 'white') OR (black_player_id = $2 AND winner = 'black')) AS wins,
      COUNT(*) FILTER (WHERE winner IS NULL) AS draws,
      COUNT(*) AS total
     FROM completed_games
     WHERE white_player_id = $3 OR black_player_id = $4`,
    [playerId, playerId, playerId, playerId],
  );
  const row = rows[0] as { wins: number; draws: number; total: number };
  return { wins: row.wins, losses: row.total - row.wins - row.draws, draws: row.draws };
}

/* ─── Cancel friend request ─── */

export async function deleteFriendRequest(id: string): Promise<void> {
  await getPool().query('DELETE FROM friend_requests WHERE id = $1 AND status = $2', [id, 'pending']);
}

/* ─── Tournaments ─── */

export async function createTournament(
  name: string,
  createdBy: string,
  maxPlayers: number,
  isPrivate?: boolean,
): Promise<{ id: string; joinCode?: string }> {
  const id = crypto.randomUUID();
  const joinCode = isPrivate ? crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase() : undefined;
  await getPool().query(
    'INSERT INTO tournaments (id, name, status, created_by, max_players, is_private, join_code, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [id, name, 'waiting', createdBy, maxPlayers, isPrivate ?? false, joinCode, Date.now()],
  );
  return { id, joinCode };
}

export async function getTournament(id: string): Promise<TournamentRow | undefined> {
  const { rows } = await getPool().query('SELECT * FROM tournaments WHERE id = $1', [id]);
  return rows[0] as TournamentRow | undefined;
}

export async function getTournamentByJoinCode(code: string): Promise<TournamentRow | undefined> {
  const { rows } = await getPool().query('SELECT * FROM tournaments WHERE join_code = $1', [code]);
  return rows[0] as TournamentRow | undefined;
}

export async function getPublicTournaments(status?: string): Promise<TournamentRow[]> {
  if (status) {
    const { rows } = await getPool().query(
      'SELECT * FROM tournaments WHERE status = $1 AND is_private = false ORDER BY created_at DESC',
      [status],
    );
    return rows as TournamentRow[];
  }
  const { rows } = await getPool().query('SELECT * FROM tournaments WHERE is_private = false ORDER BY created_at DESC');
  return rows as TournamentRow[];
}

export async function getTournaments(status?: string): Promise<TournamentRow[]> {
  if (status) {
    const { rows } = await getPool().query('SELECT * FROM tournaments WHERE status = $1 ORDER BY created_at DESC', [
      status,
    ]);
    return rows as TournamentRow[];
  }
  const { rows } = await getPool().query('SELECT * FROM tournaments ORDER BY created_at DESC');
  return rows as TournamentRow[];
}

export async function getTournamentParticipants(tournamentId: string): Promise<TournamentParticipantRow[]> {
  const { rows } = await getPool().query(
    'SELECT * FROM tournament_participants WHERE tournament_id = $1 ORDER BY seed',
    [tournamentId],
  );
  return rows as TournamentParticipantRow[];
}

export async function addTournamentParticipant(
  tournamentId: string,
  playerId: string,
  displayName: string,
  seed: number,
): Promise<void> {
  await getPool().query(
    'INSERT INTO tournament_participants (id, tournament_id, player_id, display_name, seed, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [crypto.randomUUID(), tournamentId, playerId, displayName, seed, Date.now()],
  );
}

export async function removeTournamentParticipant(tournamentId: string, playerId: string): Promise<void> {
  await getPool().query('DELETE FROM tournament_participants WHERE tournament_id = $1 AND player_id = $2', [
    tournamentId,
    playerId,
  ]);
}

export async function isTournamentParticipant(tournamentId: string, playerId: string): Promise<boolean> {
  const { rows } = await getPool().query(
    'SELECT 1 FROM tournament_participants WHERE tournament_id = $1 AND player_id = $2',
    [tournamentId, playerId],
  );
  return rows.length > 0;
}

export async function getParticipantCount(tournamentId: string): Promise<number> {
  const { rows } = await getPool().query('SELECT COUNT(*) as c FROM tournament_participants WHERE tournament_id = $1', [
    tournamentId,
  ]);
  return (rows[0] as { c: number }).c;
}

export async function getPublicTournamentsWithCounts(): Promise<Record<string, unknown>[]> {
  const { rows } = await getPool().query(
    `SELECT t.*, COUNT(tp.id) AS "participantCount"
     FROM tournaments t
     LEFT JOIN tournament_participants tp ON tp.tournament_id = t.id
     WHERE t.is_private = false
     GROUP BY t.id
     ORDER BY t.created_at DESC`,
  );
  return rows as Record<string, unknown>[];
}

export async function updateTournamentStatus(
  id: string,
  status: string,
  startedAt?: number,
  completedAt?: number,
  winnerId?: string,
): Promise<void> {
  const updates: string[] = [];
  const params: unknown[] = [];
  let idx = 0;
  idx++;
  updates.push('status = $' + idx);
  params.push(status);
  if (startedAt !== undefined) {
    idx++;
    updates.push('started_at = $' + idx);
    params.push(startedAt);
  }
  if (completedAt !== undefined) {
    idx++;
    updates.push('completed_at = $' + idx);
    params.push(completedAt);
  }
  if (winnerId !== undefined) {
    idx++;
    updates.push('winner_id = $' + idx);
    params.push(winnerId);
  }
  idx++;
  params.push(id);
  await getPool().query('UPDATE tournaments SET ' + updates.join(', ') + ' WHERE id = $' + idx, params);
}

export async function updateTournamentDetails(
  id: string,
  name: string,
  maxPlayers: number,
  isPrivate: number,
): Promise<void> {
  await getPool().query('UPDATE tournaments SET name = $1, max_players = $2, is_private = $3 WHERE id = $4', [
    name,
    maxPlayers,
    isPrivate === 1 ? true : false,
    id,
  ]);
}

export async function deleteTournament(id: string): Promise<void> {
  return transaction(async (client) => {
    await client.query('DELETE FROM tournament_participants WHERE tournament_id = $1', [id]);
    await client.query('DELETE FROM tournament_matches WHERE tournament_id = $1', [id]);
    await client.query('DELETE FROM tournaments WHERE id = $1', [id]);
  });
}

export async function getTournamentMatches(tournamentId: string): Promise<TournamentMatchRow[]> {
  const { rows } = await getPool().query(
    'SELECT * FROM tournament_matches WHERE tournament_id = $1 ORDER BY round, position',
    [tournamentId],
  );
  return rows as TournamentMatchRow[];
}

export async function getPlayerTournamentStats(
  playerId: string,
): Promise<{ total: number; wins: number; currentId: string | null }> {
  const { rows: totalRows } = await getPool().query(
    'SELECT COUNT(*) as c FROM tournament_participants WHERE player_id = $1',
    [playerId],
  );
  const total = (totalRows[0] as { c: number }).c;
  const { rows: winsRows } = await getPool().query('SELECT COUNT(*) as c FROM tournaments WHERE winner_id = $1', [
    playerId,
  ]);
  const wins = (winsRows[0] as { c: number }).c;
  const { rows: currentRows } = await getPool().query(
    `SELECT t.id FROM tournament_participants tp
     JOIN tournaments t ON t.id = tp.tournament_id
     WHERE tp.player_id = $1 AND t.status = 'active'
     LIMIT 1`,
    [playerId],
  );
  const current = currentRows[0] as { id: string } | undefined;
  return { total, wins, currentId: current?.id ?? null };
}

export async function createTournamentMatch(
  tournamentId: string,
  round: number,
  position: number,
  whitePlayerId: string | null,
  blackPlayerId: string | null,
): Promise<string> {
  const id = crypto.randomUUID();
  await getPool().query(
    'INSERT INTO tournament_matches (id, tournament_id, round, position, white_player_id, black_player_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, tournamentId, round, position, whitePlayerId, blackPlayerId, 'pending'],
  );
  return id;
}

export async function updateTournamentMatch(
  id: string,
  gameId: string,
  winnerId: string | null,
  status: string,
): Promise<void> {
  await getPool().query('UPDATE tournament_matches SET game_id = $1, winner_id = $2, status = $3 WHERE id = $4', [
    gameId,
    winnerId,
    status,
    id,
  ]);
}

export async function areFriends(userId: string, friendId: string): Promise<boolean> {
  const { rows } = await getPool().query('SELECT 1 FROM friends WHERE user_id = $1 AND friend_id = $2', [
    userId,
    friendId,
  ]);
  const result = rows.length > 0;
  logger.debug('DB: areFriends user1=' + userId + ' user2=' + friendId + ' =' + result);
  return result;
}

export async function closeDb(): Promise<void> {
  try {
    await getPool().end();
    logger.info('DB connection pool closed');
  } catch (err) {
    logger.error('Error closing DB pool:', err);
  }
}
