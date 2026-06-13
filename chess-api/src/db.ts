import crypto from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import logger from './logger';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'chess.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    fs.mkdirSync(dir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    migrate();
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      display_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bans (
      id TEXT PRIMARY KEY,
      player_id TEXT,
      ip TEXT,
      banned_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS friend_requests (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL REFERENCES users(id),
      to_user_id TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS friends (
      user_id TEXT NOT NULL REFERENCES users(id),
      friend_id TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, friend_id)
    );
  `);

  try {
    db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL`);
  } catch {
    /* column already exists */
  }

  try {
    db.exec(`ALTER TABLE users ADD COLUMN rating INTEGER NOT NULL DEFAULT 1200`);
  } catch {
    /* column already exists */
  }

  db.exec(`
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
      move_history TEXT NOT NULL DEFAULT '[]',
      board_history TEXT NOT NULL DEFAULT '[]',
      pgn TEXT,
      played_at INTEGER NOT NULL,
      time_control TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_completed_games_played_at ON completed_games(played_at);
    CREATE INDEX IF NOT EXISTS idx_completed_games_white ON completed_games(white_player_id);
    CREATE INDEX IF NOT EXISTS idx_completed_games_black ON completed_games(black_player_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      created_by TEXT NOT NULL REFERENCES users(id),
      max_players INTEGER NOT NULL DEFAULT 8,
      is_private INTEGER NOT NULL DEFAULT 0,
      join_code TEXT,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER,
      winner_id TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tournament_participants (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL REFERENCES tournaments(id),
      player_id TEXT NOT NULL REFERENCES users(id),
      display_name TEXT NOT NULL DEFAULT '',
      seed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

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

    CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON tournament_participants(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);
  `);

  try {
    db.exec(`ALTER TABLE tournaments ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0`);
  } catch {
    /* column already exists */
  }

  try {
    db.exec(`ALTER TABLE tournaments ADD COLUMN join_code TEXT`);
  } catch {
    /* column already exists */
  }
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

export function createUser(id: string, username: string, passwordHash: string | null, displayName: string): void {
  const d = getDb();
  d.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, username, passwordHash, displayName, Date.now());
  logger.info('DB: user created id=' + id + ' username=' + username);
}

export function getUserByUsername(username: string): DbUser | undefined {
  const d = getDb();
  const user = d.prepare('SELECT * FROM users WHERE username = ?').get(username) as DbUser | undefined;
  logger.info('DB: getUserByUsername username=' + username + (user ? ' found' : ' not found'));
  return user;
}

export function getUserById(id: string): DbUser | undefined {
  const d = getDb();
  const user = d.prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser | undefined;
  logger.info('DB: getUserById id=' + id + (user ? ' found' : ' not found'));
  return user;
}

export function saveToken(token: string, userId: string): void {
  const d = getDb();
  d.prepare('INSERT INTO user_tokens (token, user_id, created_at) VALUES (?, ?, ?)').run(token, userId, Date.now());
  logger.info('DB: token saved userId=' + userId);
}

export function getUserIdByToken(token: string): string | undefined {
  const d = getDb();
  const row = d.prepare('SELECT user_id FROM user_tokens WHERE token = ?').get(token) as
    | { user_id: string }
    | undefined;
  logger.info('DB: getUserIdByToken ' + (row ? 'found userId=' + row.user_id : 'not found'));
  return row?.user_id;
}

export function deleteToken(token: string): void {
  const d = getDb();
  d.prepare('DELETE FROM user_tokens WHERE token = ?').run(token);
  logger.info('DB: token deleted');
}

export function addWin(userId: string): void {
  const d = getDb();
  d.prepare('UPDATE users SET wins = wins + 1 WHERE id = ?').run(userId);
  logger.info('DB: addWin userId=' + userId);
}

export function addLoss(userId: string): void {
  const d = getDb();
  d.prepare('UPDATE users SET losses = losses + 1 WHERE id = ?').run(userId);
  logger.info('DB: addLoss userId=' + userId);
}

export function addDraw(userId: string): void {
  const d = getDb();
  d.prepare('UPDATE users SET draws = draws + 1 WHERE id = ?').run(userId);
  logger.info('DB: addDraw userId=' + userId);
}

export function loadAllUsers(): DbUser[] {
  const d = getDb();
  const users = d.prepare('SELECT * FROM users').all() as DbUser[];
  logger.info('DB: loadAllUsers count=' + users.length);
  return users;
}

export function loadAllTokens(): { token: string; user_id: string }[] {
  const d = getDb();
  const tokens = d.prepare('SELECT token, user_id FROM user_tokens').all() as {
    token: string;
    user_id: string;
  }[];
  logger.info('DB: loadAllTokens count=' + tokens.length);
  return tokens;
}

/* ─── Avatar ─── */

export function updateUserAvatar(id: string, url: string | null): void {
  const d = getDb();
  d.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(url, id);
  logger.info('DB: avatar updated id=' + id + ' url=' + url);
}

/* ─── Username (admin only) ─── */

export function updateUsername(id: string, username: string): void {
  const d = getDb();
  d.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, id);
  logger.info('DB: username updated id=' + id + ' username=' + username);
}

/* ─── Stats (admin only) ─── */

export function updateUserStats(id: string, wins: number, losses: number, draws: number): void {
  const d = getDb();
  d.prepare('UPDATE users SET wins = ?, losses = ?, draws = ? WHERE id = ?').run(wins, losses, draws, id);
  logger.info('DB: stats updated id=' + id + ' w=' + wins + ' l=' + losses + ' d=' + draws);
}

/* ─── Admin dashboard helpers ─── */

export function updateUserDisplayName(id: string, displayName: string): void {
  const d = getDb();
  d.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName, id);
  logger.info('DB: displayName updated id=' + id + ' name=' + displayName);
}

export function updateUserPasswordHash(id: string, passwordHash: string): void {
  const d = getDb();
  d.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
  logger.info('DB: password hash updated id=' + id);
}

export function deleteUserTokens(id: string): void {
  const d = getDb();
  d.prepare('DELETE FROM user_tokens WHERE user_id = ?').run(id);
  logger.info('DB: tokens deleted userId=' + id);
}

export function deleteUserRecord(id: string): void {
  const d = getDb();
  d.prepare('DELETE FROM users WHERE id = ?').run(id);
  logger.info('DB: user record deleted id=' + id);
}

/* ─── Bans ─── */

export function saveBan(id: string, playerId: string | null, ip: string | null): void {
  const d = getDb();
  d.prepare('INSERT OR REPLACE INTO bans (id, player_id, ip, banned_at) VALUES (?, ?, ?, ?)').run(
    id,
    playerId,
    ip,
    Date.now(),
  );
  logger.info('DB: ban saved id=' + id + ' playerId=' + playerId + ' ip=' + ip);
}

export function loadAllBans(): { id: string; player_id: string | null; ip: string | null }[] {
  const d = getDb();
  const bans = d.prepare('SELECT id, player_id, ip FROM bans').all() as {
    id: string;
    player_id: string | null;
    ip: string | null;
  }[];
  logger.info('DB: loadAllBans count=' + bans.length);
  return bans;
}

export function deleteBanById(id: string): void {
  const d = getDb();
  d.prepare('DELETE FROM bans WHERE id = ?').run(id);
  logger.info('DB: ban deleted id=' + id);
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

export function createFriendRequest(fromUserId: string, toUserId: string): string {
  const d = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  d.prepare(
    'INSERT INTO friend_requests (id, from_user_id, to_user_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, fromUserId, toUserId, 'pending', now, now);
  logger.info('DB: friend request created id=' + id + ' from=' + fromUserId + ' to=' + toUserId);
  return id;
}

export function getFriendRequest(id: string): FriendRequestRow | undefined {
  const d = getDb();
  const fr = d.prepare('SELECT * FROM friend_requests WHERE id = ?').get(id) as FriendRequestRow | undefined;
  logger.info('DB: getFriendRequest id=' + id + (fr ? ' found' : ' not found'));
  return fr;
}

export function getPendingIncomingRequests(userId: string): FriendRequestRow[] {
  const d = getDb();
  const rows = d
    .prepare('SELECT * FROM friend_requests WHERE to_user_id = ? AND status = ? ORDER BY created_at DESC')
    .all(userId, 'pending') as FriendRequestRow[];
  logger.info('DB: pending incoming requests userId=' + userId + ' count=' + rows.length);
  return rows;
}

export function getPendingOutgoingRequests(userId: string): FriendRequestRow[] {
  const d = getDb();
  const rows = d
    .prepare('SELECT * FROM friend_requests WHERE from_user_id = ? AND status = ? ORDER BY created_at DESC')
    .all(userId, 'pending') as FriendRequestRow[];
  logger.info('DB: pending outgoing requests userId=' + userId + ' count=' + rows.length);
  return rows;
}

export function hasPendingRequest(fromUserId: string, toUserId: string): boolean {
  const d = getDb();
  const row = d
    .prepare(
      'SELECT 1 FROM friend_requests WHERE ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)) AND status = ?',
    )
    .get(fromUserId, toUserId, toUserId, fromUserId, 'pending');
  const result = !!row;
  logger.info('DB: hasPendingRequest from=' + fromUserId + ' to=' + toUserId + ' =' + result);
  return result;
}

export function updateFriendRequestStatus(id: string, status: string): void {
  const d = getDb();
  d.prepare('UPDATE friend_requests SET status = ?, updated_at = ? WHERE id = ?').run(status, Date.now(), id);
  logger.info('DB: friend request status updated id=' + id + ' status=' + status);
}

export function addFriendRelationship(userId: string, friendId: string): void {
  const d = getDb();
  const now = Date.now();
  d.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?)').run(
    userId,
    friendId,
    now,
  );
  d.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?)').run(
    friendId,
    userId,
    now,
  );
  logger.info('DB: friend relationship added user1=' + userId + ' user2=' + friendId);
}

export function removeFriendRelationship(userId: string, friendId: string): void {
  const d = getDb();
  d.prepare('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(
    userId,
    friendId,
    friendId,
    userId,
  );
  logger.info('DB: friend relationship removed user1=' + userId + ' user2=' + friendId);
}

export function getFriendIds(userId: string): string[] {
  const d = getDb();
  const rows = d.prepare('SELECT friend_id FROM friends WHERE user_id = ?').all(userId) as { friend_id: string }[];
  const ids = rows.map((r) => r.friend_id);
  logger.info('DB: getFriendIds userId=' + userId + ' count=' + ids.length);
  return ids;
}

/* ─── Leaderboard ─── */

export function getLeaderboard(
  limit: number,
  offset: number,
): {
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
} {
  const d = getDb();
  const total = (d.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  const rows = d
    .prepare(
      'SELECT id, username, display_name, avatar_url, rating, wins, losses, draws FROM users ORDER BY rating DESC LIMIT ? OFFSET ?',
    )
    .all(limit, offset) as any[];
  return { rows, total };
}

export function getPlayerRating(userId: string): number {
  const d = getDb();
  const row = d.prepare('SELECT rating FROM users WHERE id = ?').get(userId) as { rating: number } | undefined;
  return row?.rating ?? 1200;
}

export function updatePlayerRating(userId: string, rating: number): void {
  const d = getDb();
  d.prepare('UPDATE users SET rating = ? WHERE id = ?').run(rating, userId);
}

/* ─── Game Archive ─── */

export function saveCompletedGame(
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
): void {
  const d = getDb();
  d.prepare(
    `INSERT INTO completed_games (id, white_player_id, black_player_id, white_display_name, black_display_name, winner, status, result, reason, move_history, board_history, pgn, played_at, time_control)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
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
  );
  logger.info('DB: completed game saved id=' + id);
}

export function getArchivedGames(
  page: number,
  limit: number,
  playerId?: string,
  status?: string,
  fromDate?: number,
  toDate?: number,
): { rows: any[]; total: number } {
  const d = getDb();
  const conditions: string[] = [];
  const params: any[] = [];
  if (playerId) {
    conditions.push('(white_player_id = ? OR black_player_id = ?)');
    params.push(playerId, playerId);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (fromDate) {
    conditions.push('played_at >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push('played_at <= ?');
    params.push(toDate);
  }
  const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
  const total = (d.prepare('SELECT COUNT(*) as c FROM completed_games' + where).get(...params) as { c: number }).c;
  const offset = (page - 1) * limit;
  const rows = d
    .prepare('SELECT * FROM completed_games' + where + ' ORDER BY played_at DESC LIMIT ? OFFSET ?')
    .all(...params, limit, offset);
  return { rows, total };
}

export function getArchivedGame(id: string): any | undefined {
  const d = getDb();
  return d.prepare('SELECT * FROM completed_games WHERE id = ?').get(id);
}

export function getPlayerWinLossDraw(playerId: string): { wins: number; losses: number; draws: number } {
  const d = getDb();
  const wins = (
    d
      .prepare(
        'SELECT COUNT(*) as c FROM completed_games WHERE (white_player_id = ? OR black_player_id = ?) AND winner = ?',
      )
      .get(playerId, playerId, playerId) as { c: number }
  ).c;
  const allCount = (
    d
      .prepare('SELECT COUNT(*) as c FROM completed_games WHERE white_player_id = ? OR black_player_id = ?')
      .get(playerId, playerId) as { c: number }
  ).c;
  const draws = (
    d
      .prepare(
        'SELECT COUNT(*) as c FROM completed_games WHERE (white_player_id = ? OR black_player_id = ?) AND winner IS NULL',
      )
      .get(playerId, playerId) as { c: number }
  ).c;
  return { wins, losses: allCount - wins - draws, draws };
}

/* ─── Tournaments ─── */

export function createTournament(
  name: string,
  createdBy: string,
  maxPlayers: number,
  isPrivate?: boolean,
): { id: string; joinCode?: string } {
  const d = getDb();
  const id = crypto.randomUUID();
  const joinCode = isPrivate ? crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase() : undefined;
  d.prepare(
    'INSERT INTO tournaments (id, name, status, created_by, max_players, is_private, join_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, name, 'waiting', createdBy, maxPlayers, isPrivate ? 1 : 0, joinCode, Date.now());
  return { id, joinCode };
}

export function getTournament(id: string): any | undefined {
  const d = getDb();
  return d.prepare('SELECT * FROM tournaments WHERE id = ?').get(id);
}

export function getTournamentByJoinCode(code: string): any | undefined {
  const d = getDb();
  return d.prepare('SELECT * FROM tournaments WHERE join_code = ?').get(code);
}

export function getPublicTournaments(status?: string): any[] {
  const d = getDb();
  if (status) {
    return d
      .prepare('SELECT * FROM tournaments WHERE status = ? AND is_private = 0 ORDER BY created_at DESC')
      .all(status);
  }
  return d.prepare('SELECT * FROM tournaments WHERE is_private = 0 ORDER BY created_at DESC').all();
}

export function getTournaments(status?: string): any[] {
  const d = getDb();
  if (status) {
    return d.prepare('SELECT * FROM tournaments WHERE status = ? ORDER BY created_at DESC').all(status);
  }
  return d.prepare('SELECT * FROM tournaments ORDER BY created_at DESC').all();
}

export function getTournamentParticipants(tournamentId: string): any[] {
  const d = getDb();
  return d.prepare('SELECT * FROM tournament_participants WHERE tournament_id = ? ORDER BY seed').all(tournamentId);
}

export function addTournamentParticipant(
  tournamentId: string,
  playerId: string,
  displayName: string,
  seed: number,
): void {
  const d = getDb();
  const id = crypto.randomUUID();
  d.prepare(
    'INSERT INTO tournament_participants (id, tournament_id, player_id, display_name, seed, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, tournamentId, playerId, displayName, seed, Date.now());
}

export function removeTournamentParticipant(tournamentId: string, playerId: string): void {
  const d = getDb();
  d.prepare('DELETE FROM tournament_participants WHERE tournament_id = ? AND player_id = ?').run(
    tournamentId,
    playerId,
  );
}

export function isTournamentParticipant(tournamentId: string, playerId: string): boolean {
  const d = getDb();
  const row = d
    .prepare('SELECT 1 FROM tournament_participants WHERE tournament_id = ? AND player_id = ?')
    .get(tournamentId, playerId);
  return !!row;
}

export function getParticipantCount(tournamentId: string): number {
  const d = getDb();
  const row = d
    .prepare('SELECT COUNT(*) as c FROM tournament_participants WHERE tournament_id = ?')
    .get(tournamentId) as { c: number };
  return row.c;
}

export function updateTournamentStatus(
  id: string,
  status: string,
  startedAt?: number,
  completedAt?: number,
  winnerId?: string,
): void {
  const d = getDb();
  const updates: string[] = ['status = ?'];
  const params: any[] = [status];
  if (startedAt) {
    updates.push('started_at = ?');
    params.push(startedAt);
  }
  if (completedAt) {
    updates.push('completed_at = ?');
    params.push(completedAt);
  }
  if (winnerId) {
    updates.push('winner_id = ?');
    params.push(winnerId);
  }
  params.push(id);
  d.prepare(`UPDATE tournaments SET ${updates.join(', ')} WHERE id = ?`).run(...params);
}

export function updateTournamentDetails(id: string, name: string, maxPlayers: number, isPrivate: number): void {
  const d = getDb();
  d.prepare('UPDATE tournaments SET name = ?, max_players = ?, is_private = ? WHERE id = ?').run(
    name,
    maxPlayers,
    isPrivate,
    id,
  );
}

export function deleteTournament(id: string): void {
  const d = getDb();
  d.prepare('DELETE FROM tournament_participants WHERE tournament_id = ?').run(id);
  d.prepare('DELETE FROM tournament_matches WHERE tournament_id = ?').run(id);
  d.prepare('DELETE FROM tournaments WHERE id = ?').run(id);
}

export function getTournamentMatches(tournamentId: string): any[] {
  const d = getDb();
  return d
    .prepare('SELECT * FROM tournament_matches WHERE tournament_id = ? ORDER BY round, position')
    .all(tournamentId);
}

export function createTournamentMatch(
  tournamentId: string,
  round: number,
  position: number,
  whitePlayerId: string | null,
  blackPlayerId: string | null,
): string {
  const d = getDb();
  const id = crypto.randomUUID();
  d.prepare(
    'INSERT INTO tournament_matches (id, tournament_id, round, position, white_player_id, black_player_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, tournamentId, round, position, whitePlayerId, blackPlayerId, 'pending');
  return id;
}

export function updateTournamentMatch(id: string, gameId: string, winnerId: string | null, status: string): void {
  const d = getDb();
  d.prepare('UPDATE tournament_matches SET game_id = ?, winner_id = ?, status = ? WHERE id = ?').run(
    gameId,
    winnerId,
    status,
    id,
  );
}

export function areFriends(userId: string, friendId: string): boolean {
  const d = getDb();
  const row = d.prepare('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?').get(userId, friendId);
  const result = !!row;
  logger.info('DB: areFriends user1=' + userId + ' user2=' + friendId + ' =' + result);
  return result;
}

export function closeDb(): void {
  if (db) {
    try {
      db.close();
      logger.info('DB connection closed');
    } catch (err) {
      logger.error('Error closing DB:', err);
    }
  }
}
