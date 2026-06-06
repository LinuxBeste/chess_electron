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
  `);
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
}

export function createUser(
  id: string,
  username: string,
  passwordHash: string | null,
  displayName: string,
): void {
  const d = getDb();
  d.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, username, passwordHash, displayName, Date.now());
}

export function getUserByUsername(username: string): DbUser | undefined {
  const d = getDb();
  return d.prepare('SELECT * FROM users WHERE username = ?').get(username) as
    | DbUser
    | undefined;
}

export function getUserById(id: string): DbUser | undefined {
  const d = getDb();
  return d.prepare('SELECT * FROM users WHERE id = ?').get(id) as
    | DbUser
    | undefined;
}

export function saveToken(token: string, userId: string): void {
  const d = getDb();
  d.prepare('INSERT INTO user_tokens (token, user_id, created_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    Date.now(),
  );
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
