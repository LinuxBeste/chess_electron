import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

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
  `);

  try {
    db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL`);
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
}

export function createUser(id: string, username: string, passwordHash: string | null, displayName: string): void {
  const d = getDb();
  d.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, username, passwordHash, displayName, Date.now());
}

export function getUserByUsername(username: string): DbUser | undefined {
  const d = getDb();
  return d.prepare('SELECT * FROM users WHERE username = ?').get(username) as DbUser | undefined;
}

export function getUserById(id: string): DbUser | undefined {
  const d = getDb();
  return d.prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser | undefined;
}

export function saveToken(token: string, userId: string): void {
  const d = getDb();
  d.prepare('INSERT INTO user_tokens (token, user_id, created_at) VALUES (?, ?, ?)').run(token, userId, Date.now());
}

export function getUserIdByToken(token: string): string | undefined {
  const d = getDb();
  const row = d.prepare('SELECT user_id FROM user_tokens WHERE token = ?').get(token) as
    | { user_id: string }
    | undefined;
  return row?.user_id;
}

export function deleteToken(token: string): void {
  const d = getDb();
  d.prepare('DELETE FROM user_tokens WHERE token = ?').run(token);
}

export function addWin(userId: string): void {
  const d = getDb();
  d.prepare('UPDATE users SET wins = wins + 1 WHERE id = ?').run(userId);
}

export function addLoss(userId: string): void {
  const d = getDb();
  d.prepare('UPDATE users SET losses = losses + 1 WHERE id = ?').run(userId);
}

export function addDraw(userId: string): void {
  const d = getDb();
  d.prepare('UPDATE users SET draws = draws + 1 WHERE id = ?').run(userId);
}

export function loadAllUsers(): DbUser[] {
  const d = getDb();
  return d.prepare('SELECT * FROM users').all() as DbUser[];
}

export function loadAllTokens(): { token: string; user_id: string }[] {
  const d = getDb();
  return d.prepare('SELECT token, user_id FROM user_tokens').all() as {
    token: string;
    user_id: string;
  }[];
}

/* ─── Avatar ─── */

export function updateUserAvatar(id: string, url: string | null): void {
  const d = getDb();
  d.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(url, id);
}

/* ─── Username (admin only) ─── */

export function updateUsername(id: string, username: string): void {
  const d = getDb();
  d.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, id);
}

/* ─── Stats (admin only) ─── */

export function updateUserStats(id: string, wins: number, losses: number, draws: number): void {
  const d = getDb();
  d.prepare('UPDATE users SET wins = ?, losses = ?, draws = ? WHERE id = ?').run(wins, losses, draws, id);
}

/* ─── Admin dashboard helpers ─── */

export function updateUserDisplayName(id: string, displayName: string): void {
  const d = getDb();
  d.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName, id);
}

export function updateUserPasswordHash(id: string, passwordHash: string): void {
  const d = getDb();
  d.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
}

export function deleteUserTokens(id: string): void {
  const d = getDb();
  d.prepare('DELETE FROM user_tokens WHERE user_id = ?').run(id);
}

export function deleteUserRecord(id: string): void {
  const d = getDb();
  d.prepare('DELETE FROM users WHERE id = ?').run(id);
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
}

export function loadAllBans(): { id: string; player_id: string | null; ip: string | null }[] {
  const d = getDb();
  return d.prepare('SELECT id, player_id, ip FROM bans').all() as {
    id: string;
    player_id: string | null;
    ip: string | null;
  }[];
}

export function deleteBanById(id: string): void {
  const d = getDb();
  d.prepare('DELETE FROM bans WHERE id = ?').run(id);
}
