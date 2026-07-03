import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Player } from './types.js';
import * as db from './db.js';
import logger from './logger.js';

export const players = new Map<string, Player>();
export const tokenIndex = new Map<string, string>();
export const tokenExpiry = new Map<string, number>();
export const playerIps = new Map<string, string>();

const PLAYER_TOKEN_TTL = parseInt(process.env.PLAYER_TOKEN_TTL ?? String(24 * 60 * 60 * 1000), 10); // Per-player token 24h default

const LOGIN_MAX_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS ?? '5', 10);
const LOGIN_LOCKOUT_MINUTES = parseInt(process.env.LOGIN_LOCKOUT_MINUTES ?? '15', 10); // Brute-force lockout config
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

export function checkLoginLockout(username: string): { locked: boolean; remainingMs?: number } {
  const entry = loginAttempts.get(username);
  if (!entry) return { locked: false };
  if (entry.lockedUntil > 0 && Date.now() >= entry.lockedUntil) {
    loginAttempts.delete(username);
    return { locked: false };
  }
  if (entry.lockedUntil > 0) {
    return { locked: true, remainingMs: entry.lockedUntil - Date.now() };
  }
  return { locked: false };
}

export function recordFailedAttempt(username: string): void {
  const entry = loginAttempts.get(username) ?? { count: 0, lockedUntil: 0 };
  entry.count++;
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOGIN_LOCKOUT_MINUTES * 60 * 1000;
    logger.warn('Account locked out: username="' + username + '" for ' + LOGIN_LOCKOUT_MINUTES + ' minutes');
  }
  loginAttempts.set(username, entry);
}

export function clearLoginAttempts(username: string): void {
  loginAttempts.delete(username);
}

export function cleanupLoginAttempts(): void {
  const now = Date.now();
  for (const [username, entry] of loginAttempts) {
    if (now >= entry.lockedUntil) {
      loginAttempts.delete(username);
    }
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex'); // PBKDF2 with 100k iterations
  return `${salt}:${key}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length < 2) return false;
  const [salt, key] = parts;
  if (!salt || !key) return false;
  const check = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  if (key.length !== check.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(key), Buffer.from(check)); // Constant-time prevents timing attack
  } catch {
    return false; // Return false on error, never throw
  }
}

export function hashPasswordAsync(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, key) => {
      if (err) reject(err);
      else resolve(`${salt}:${key.toString('hex')}`);
    });
  });
}

export function verifyPasswordAsync(password: string, stored: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const parts = stored.split(':');
    if (parts.length < 2) return resolve(false);
    const [salt, key] = parts;
    if (!salt || !key) return resolve(false);
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, check) => {
      if (err) return reject(err);
      const checkHex = check.toString('hex');
      if (key.length !== checkHex.length) return resolve(false);
      try {
        resolve(crypto.timingSafeEqual(Buffer.from(key), Buffer.from(checkHex)));
      } catch {
        resolve(false);
      }
    });
  });
}

export const BOT_PLAYER_ID = '_bot_';

export async function registerPlayer(
  username: string,
  password?: string,
): Promise<{ playerId: string; token: string; isRegistered: boolean; displayName: string }> {
  const playerId = uuidv4();
  const token = uuidv4();
  const isRegistered = !!password;
  const hash = password ? await hashPasswordAsync(password) : null;
  await db.createUser(playerId, username, hash, username);
  await db.saveToken(token, playerId);
  const player: Player = { id: playerId, username, displayName: username, tokens: [token], isRegistered };
  players.set(playerId, player);
  setToken(token, playerId);
  logger.info('Player registered: playerId=' + playerId + ' username="' + username + '" registered=' + isRegistered);
  return { playerId, token, isRegistered, displayName: username };
}

export async function loginPlayer(
  username: string,
  password: string,
): Promise<
  { success: false; error: string } | { success: true; playerId: string; token: string; displayName: string }
> {
  const user = await db.getUserByUsername(username);
  if (!user || !user.password_hash) {
    return { success: false, error: 'Invalid username or password' };
  }
  if (!(await verifyPasswordAsync(password, user.password_hash))) {
    return { success: false, error: 'Invalid username or password' };
  }
  const token = uuidv4();
  await db.saveToken(token, user.id);
  const existing = players.get(user.id);
  if (existing) {
    existing.tokens.push(token); // Append token to existing in-memory player
    setToken(token, user.id);
  } else {
    const player: Player = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      tokens: [token],
      isRegistered: true,
    };
    players.set(user.id, player);
    setToken(token, user.id);
  }
  logger.info('Player login: playerId=' + user.id + ' username="' + user.username + '"');
  return { success: true, playerId: user.id, token, displayName: user.display_name };
}

function setToken(token: string, playerId: string): void {
  tokenIndex.set(token, playerId);
  tokenExpiry.set(token, Date.now() + PLAYER_TOKEN_TTL);
}

export function deleteToken(token: string): void {
  tokenIndex.delete(token);
  tokenExpiry.delete(token);
}

export function authenticatePlayer(token: string): Player | null {
  const expiry = tokenExpiry.get(token);
  if (expiry && expiry <= Date.now()) {
    deleteToken(token);
    logger.info('Auth failed: token expired');
    return null;
  }
  const playerId = tokenIndex.get(token);
  if (!playerId) {
    logger.info('Auth failed: token not found');
    return null;
  }
  const player = players.get(playerId) ?? null;
  if (player) {
    logger.debug('Auth ok: playerId=' + playerId + ' username=' + player.username);
  } else {
    logger.debug('Auth failed: playerId=' + playerId + ' not in memory');
  }
  return player;
}

export async function authenticatePlayerAsync(token: string): Promise<Player | null> {
  const cached = authenticatePlayer(token);
  if (cached) return cached;

  // Lazy-load from DB on cache miss (avoids preloading all users at startup)
  try {
    const userId = await db.getUserIdByToken(token);
    if (!userId) return null;

    const user = await db.getUserById(userId);
    if (!user) return null;

    const player: Player = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      tokens: [token],
      isRegistered: true,
    };
    players.set(user.id, player);
    setToken(token, user.id);
    logger.info('Lazy-loaded player: playerId=' + user.id + ' username="' + user.username + '"');
    return player;
  } catch (err) {
    logger.error('authenticatePlayerAsync failed: ' + err);
    return null;
  }
}

export function addToken(playerId: string): string | null {
  const player = players.get(playerId);
  if (!player) {
    logger.info('addToken: player not found playerId=' + playerId);
    return null;
  }
  const token = uuidv4();
  player.tokens.push(token); // Push — don't replace existing tokens
  setToken(token, playerId);
  logger.info('Token added: playerId=' + playerId);
  return token;
}

export async function logoutPlayer(token: string): Promise<boolean> {
  const playerId = tokenIndex.get(token);
  if (!playerId) return false;
  deleteToken(token);
  const player = players.get(playerId);
  if (player) {
    player.tokens = player.tokens.filter((t) => t !== token);
  }
  await db.deleteToken(token);
  logger.info('Player logged out: playerId=' + playerId);
  return true;
}

export async function updateDisplayName(
  playerId: string,
  displayName: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const player = players.get(playerId);
  if (!player) return { success: false, error: 'Player not found' };
  if (!displayName || displayName.trim().length === 0) return { success: false, error: 'Display name is required' };

  player.displayName = displayName.trim();
  if (player.isRegistered) {
    await db.updateUserDisplayName(playerId, displayName.trim());
  }
  logger.info('Display name updated: playerId=' + playerId + ' displayName=' + displayName.trim());
  return { success: true };
}

export async function changePassword(
  playerId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const player = players.get(playerId);
  if (!player || !player.isRegistered) return { success: false, error: 'Only registered users can change password' };
  if (!currentPassword || !newPassword) return { success: false, error: 'Current and new password are required' };
  if (newPassword.length < 8) return { success: false, error: 'New password must be at least 8 characters' };

  const user = await db.getUserById(playerId);
  if (!user || !user.password_hash) return { success: false, error: 'Account not found' };
  if (!(await verifyPasswordAsync(currentPassword, user.password_hash)))
    return { success: false, error: 'Current password is incorrect' };

  const hash = await hashPasswordAsync(newPassword);
  await db.updateUserPasswordHash(playerId, hash);
  logger.info('Password changed: playerId=' + playerId);
  return { success: true };
}

export async function deleteAccount(playerId: string): Promise<{ success: true } | { success: false; error: string }> {
  const player = players.get(playerId);
  if (!player || !player.isRegistered)
    return { success: false, error: 'Only registered users can delete their account' };

  for (const t of player.tokens) {
    deleteToken(t);
  }
  await db.transaction(async (client) => {
    // Transaction: cascade delete user data atomically
    await client.query('DELETE FROM user_tokens WHERE user_id = $1', [playerId]);
    await client.query('DELETE FROM completed_games WHERE white_player_id = $1 OR black_player_id = $1', [playerId]);
    await client.query('DELETE FROM users WHERE id = $1', [playerId]);
  });
  players.delete(playerId);

  logger.info('Account deleted: playerId=' + playerId);
  return { success: true };
}

export function setPlayerIp(playerId: string, ip: string): void {
  playerIps.set(playerId, ip);
  logger.info('Player IP set: playerId=' + playerId + ' ip=' + ip);
}

export function getPlayerIp(playerId: string): string | undefined {
  const ip = playerIps.get(playerId);
  logger.debug('getPlayerIp: playerId=' + playerId + (ip ? ' ip=' + ip : ' no IP'));
  return ip;
}

export function getPlayerById(playerId: string): Player | undefined {
  const player = players.get(playerId);
  logger.debug('getPlayerById: playerId=' + playerId + (player ? ' found' : ' not found'));
  return player;
}

export function getAllPlayers(): Player[] {
  const result = Array.from(players.values());
  logger.debug('getAllPlayers: count=' + result.length);
  return result;
}

export async function loadPersistedUsers(): Promise<void> {
  const allUsers = await db.loadAllUsers();
  for (const u of allUsers) {
    const player: Player = {
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      tokens: [],
      isRegistered: true,
    };
    players.set(u.id, player);
  }
  const allTokens = await db.loadAllTokens();
  for (const t of allTokens) {
    const player = players.get(t.user_id);
    if (player) {
      player.tokens.push(t.token);
      setToken(t.token, t.user_id);
    }
  }
  logger.info('Persisted users loaded: users=' + allUsers.length + ' tokens=' + allTokens.length);
}

export function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [token, expiry] of tokenExpiry) {
    if (expiry <= now) deleteToken(token);
  }
  const activePlayerIds = new Set(tokenIndex.values());
  for (const [playerId, _player] of players) {
    if (!activePlayerIds.has(playerId)) {
      players.delete(playerId);
      playerIps.delete(playerId);
    }
  }
}

const isTestEnv = typeof process.env.JEST_WORKER_ID !== 'undefined' || process.env.NODE_ENV === 'test';
if (!isTestEnv) {
  setInterval(cleanupExpiredTokens, Math.min(PLAYER_TOKEN_TTL, 300000));
}
