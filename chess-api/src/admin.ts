import { fileURLToPath } from 'url';
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import * as game from './game.js';
import * as db from './db.js';
import logger from './logger.js';
import { ipRateLimitMiddleware } from './routes.js';
import { hashPassword, verifyPassword } from './game.js';
import { passwordSchema, displayNameSchema, ipSchema, statsValueSchema, broadcastMessageSchema } from './validation.js';
import { isWeakPassword as checkWeakPassword } from './password-strength.js';
import { wsConnections, spectatorConnections, playerGameIndex } from './state.js';

const dbLatencyHistory: number[] = [];
const MAX_LATENCY_SAMPLES = 60;

let prevWsTotalConnections = 0;
let wsDisconnectEvents = 0;
setInterval(() => {
  const now = Array.from(wsConnections.values()).reduce((s, set) => s + set.size, 0);
  if (now < prevWsTotalConnections) wsDisconnectEvents += prevWsTotalConnections - now;
  prevWsTotalConnections = now;
}, 5000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router: ReturnType<typeof Router> = Router();

let ADMIN_USERNAME: string;
let ADMIN_PASSWORD_HASH: string;

const ADMIN_TOKEN_TTL = parseInt(process.env.ADMIN_TOKEN_TTL ?? String(24 * 60 * 60 * 1000), 10);

const ADMIN_LOGIN_MAX_ATTEMPTS = parseInt(process.env.ADMIN_LOGIN_MAX_ATTEMPTS ?? '5', 10);
const ADMIN_LOGIN_LOCKOUT_MINUTES = parseInt(process.env.ADMIN_LOGIN_LOCKOUT_MINUTES ?? '15', 10);
const adminLoginAttempts = new Map<string, { count: number; lockedUntil: number }>();

function checkAdminLoginLockout(username: string): { locked: boolean; remainingMs?: number } {
  const entry = adminLoginAttempts.get(username);
  if (!entry) return { locked: false };
  if (entry.lockedUntil > 0 && Date.now() >= entry.lockedUntil) {
    adminLoginAttempts.delete(username);
    return { locked: false };
  }
  if (entry.lockedUntil > 0) {
    return { locked: true, remainingMs: entry.lockedUntil - Date.now() };
  }
  return { locked: false };
}

function recordAdminFailedAttempt(username: string): void {
  const entry = adminLoginAttempts.get(username) ?? { count: 0, lockedUntil: 0 };
  entry.count++;
  if (entry.count >= ADMIN_LOGIN_MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + ADMIN_LOGIN_LOCKOUT_MINUTES * 60 * 1000;
    logger.warn('Admin login locked out: username="' + username + '" for ' + ADMIN_LOGIN_LOCKOUT_MINUTES + ' minutes');
  }
  adminLoginAttempts.set(username, entry);
}

function clearAdminLoginAttempts(username: string): void {
  adminLoginAttempts.delete(username);
}

function initAdminCreds(): void {
  ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
  if (process.env.ADMIN_PASSWORD) {
    if (checkWeakPassword(process.env.ADMIN_PASSWORD, 2)) {
      logger.warn('ADMIN_PASSWORD is weak — use at least 8 characters and avoid common passwords');
    }
    ADMIN_PASSWORD_HASH = hashPassword(process.env.ADMIN_PASSWORD);
    logger.info('ADMIN_PASSWORD has been set from ENV.');
  } else {
    ADMIN_PASSWORD_HASH = hashPassword(crypto.randomBytes(24).toString('hex'));
    logger.warn('No ADMIN_PASSWORD set. A random password was generated for this session.');
    logger.warn('Set ADMIN_PASSWORD env var to use a custom password.');
  }
}

initAdminCreds();

const adminTokens = new Map<string, number>();

if (process.env.NODE_ENV !== 'test') {
  setInterval(
    () => {
      const now = Date.now();
      for (const [token, expiry] of adminTokens) {
        if (expiry <= now) adminTokens.delete(token);
      }
    },
    Math.min(ADMIN_TOKEN_TTL, 300000),
  );
}

function adminAuthMiddleware(req: Request, res: Response, next: () => void): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Admin authentication required' });
    return;
  }
  const token = header.slice(7);
  const expiry = adminTokens.get(token);
  if (!expiry || expiry <= Date.now()) {
    adminTokens.delete(token);
    res.status(401).json({ error: 'Invalid or expired admin token' });
    return;
  }
  next();
}

router.post('/admin/api/login', ipRateLimitMiddleware, (req: Request, res: Response) => {
  const parsed = z
    .object({
      username: z.string().min(1, 'Username is required'),
      password: z.string().min(1, 'Password is required'),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { username, password } = parsed.data;
  const lockout = checkAdminLoginLockout(username);
  if (lockout.locked) {
    logger.audit('admin_login_locked', `username="${username}" ip="${req.ip || ''}"`);
    res
      .status(429)
      .json({ error: 'Too many failed login attempts. Try again later.', remainingMs: lockout.remainingMs });
    return;
  }
  if (username !== ADMIN_USERNAME || !verifyPassword(password, ADMIN_PASSWORD_HASH)) {
    recordAdminFailedAttempt(username);
    logger.audit('admin_login_failed', `username="${username}" ip="${req.ip || ''}"`);
    res.status(401).json({ error: 'Invalid admin credentials' });
    return;
  }
  clearAdminLoginAttempts(username);
  const token = uuidv4();
  adminTokens.set(token, Date.now() + ADMIN_TOKEN_TTL);
  logger.audit('admin_login_ok', `username="${username}" ip="${req.ip || ''}"`);
  res.json({ token });
});

router.post('/admin/api/logout', adminAuthMiddleware, (req: Request, res: Response) => {
  const token = req.headers.authorization!.slice(7);
  adminTokens.delete(token);
  logger.audit('admin_logout', `token revoked by admin`);
  res.json({ success: true });
});

router.get('/admin/api/stats', adminAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const { gamesActive, playersOnline } = game.getStats();
    const allPlayers = game.getAllPlayers();
    const registeredUsers = allPlayers.filter((p) => p.isRegistered).length;
    const totalUsers = (await db.loadAllUsers()).length;
    logger.info(
      'Admin stats: gamesActive=' +
        gamesActive +
        ' playersOnline=' +
        playersOnline +
        ' registered=' +
        registeredUsers +
        ' totalUsers=' +
        totalUsers,
    );
    res.json({ gamesActive, playersOnline, registeredUsers, totalUsers });
  } catch (err) {
    logger.error('Stats error:', err);
    res.status(500).json({ error: String(err) });
  }
});

/* ─── Live metrics (delta-tracked CPU/net/disk) ─── */

let prevCpu: { idle: number; total: number } | null = null;
let prevNet: { rx: number; tx: number } | null = null;
let prevDisk: { read: number; write: number } | null = null;

function readProc(path: string): string | null {
  try {
    return fs.readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

function sampleCpu(): { idle: number; total: number } | null {
  const content = readProc('/proc/stat');
  if (!content) return null;
  const line = content.split('\n').find((l) => l.startsWith('cpu '));
  if (!line) return null;
  const parts = line.trim().split(/\s+/).slice(1).map(Number);
  return { idle: parts[3] + (parts[4] || 0), total: parts.reduce((a, b) => a + b, 0) };
}

function sampleNet(): { rx: number; tx: number } | null {
  const content = readProc('/proc/net/dev');
  if (!content) return null;
  let rx = 0,
    tx = 0;
  for (const line of content.split('\n').slice(2)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 10) continue;
    rx += parseInt(parts[1]) || 0;
    tx += parseInt(parts[9]) || 0;
  }
  return { rx, tx };
}

function sampleDisk(): { read: number; write: number } | null {
  const content = readProc('/proc/diskstats');
  if (!content) return null;
  let read = 0,
    write = 0;
  for (const line of content.split('\n').filter((l) => l.trim())) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 14) continue;
    const name = parts[2];
    if (name.startsWith('loop') || name.startsWith('ram') || /\d$/.test(name)) continue;
    read += parseInt(parts[5]) || 0;
    write += parseInt(parts[9]) || 0;
  }
  return { read: read * 512, write: write * 512 };
}

router.get('/admin/api/system/metrics', adminAuthMiddleware, (_req: Request, res: Response) => {
  const totalMem = os.totalmem();
  const usedMem = totalMem - os.freemem();

  let cpuPercent = 0;
  const cpu = sampleCpu();
  if (cpu && prevCpu) {
    const totalDiff = cpu.total - prevCpu.total;
    const idleDiff = cpu.idle - prevCpu.idle;
    if (totalDiff > 0) cpuPercent = Math.round(((totalDiff - idleDiff) / totalDiff) * 10000) / 100;
  }
  if (cpu) prevCpu = cpu;

  let rxRate = 0,
    txRate = 0;
  const net = sampleNet();
  if (net && prevNet) {
    rxRate = Math.max(0, net.rx - prevNet.rx);
    txRate = Math.max(0, net.tx - prevNet.tx);
  }
  if (net) prevNet = net;

  let readRate = 0,
    writeRate = 0;
  const disk = sampleDisk();
  if (disk && prevDisk) {
    readRate = Math.max(0, disk.read - prevDisk.read);
    writeRate = Math.max(0, disk.write - prevDisk.write);
  }
  if (disk) prevDisk = disk;

  logger.info('Admin system metrics: cpu=' + cpuPercent + '% mem=' + Math.round((usedMem / totalMem) * 100) + '%');
  res.json({
    cpu: cpuPercent,
    memory: { used: usedMem, total: totalMem, percent: Math.round((usedMem / totalMem) * 10000) / 100 },
    net: { rx: rxRate, tx: txRate },
    disk: { read: readRate, write: writeRate },
    timestamp: Date.now(),
  });
});

router.get('/admin/api/system', adminAuthMiddleware, (_req: Request, res: Response) => {
  logger.info('Admin system info requested');
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const cpus = os.cpus();
  const loadAvg = os.loadavg();
  const rss = process.memoryUsage().rss;
  const heapUsed = process.memoryUsage().heapUsed;
  const heapTotal = process.memoryUsage().heapTotal;

  let diskTotal = 0,
    diskFree = 0;
  try {
    const out = execFileSync('df', ['-k', '/'], { maxBuffer: 65536 }).toString().split('\n')[1]?.split(/\s+/);
    if (out && out.length >= 4) {
      diskTotal = parseInt(out[1], 10) * 1024 || 0;
      diskFree = parseInt(out[3], 10) * 1024 || 0;
    }
  } catch (e) {
    logger.warn('Failed to read disk info via df: ' + e);
  }

  const nets = os.networkInterfaces();
  const addrs: { name: string; address: string; family: string }[] = [];
  for (const [name, infs] of Object.entries(nets)) {
    if (!infs) continue;
    for (const inf of infs) {
      if (inf.family === 'IPv4' || inf.family === 'IPv6') {
        addrs.push({ name, address: inf.address, family: inf.family === 'IPv6' ? 'IPv6' : 'IPv4' });
      }
    }
  }

  res.json({
    memory: {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      usagePercent: Math.round((usedMem / totalMem) * 100 * 100) / 100,
    },
    cpu: {
      cores: cpus.length,
      model: cpus[0]?.model || 'unknown',
      speed: cpus[0]?.speed || 0,
      loadAverage1: loadAvg[0],
      loadAverage5: loadAvg[1],
      loadAverage15: loadAvg[2],
    },
    process: {
      uptime: process.uptime(),
      nodeVersion: process.version,
      pid: process.pid,
      memoryRss: rss,
      heapUsed,
      heapTotal,
    },
    system: {
      uptime: os.uptime(),
      platform: os.platform(),
      release: os.release(),
      hostname: os.hostname(),
      arch: os.arch(),
    },
    disk: {
      total: diskTotal,
      free: diskFree,
      used: diskTotal - diskFree,
      usagePercent: diskTotal > 0 ? Math.round(((diskTotal - diskFree) / diskTotal) * 100 * 100) / 100 : 0,
    },
    networks: addrs,
  });
});

router.get('/admin/api/system/processes', adminAuthMiddleware, (_req: Request, res: Response) => {
  try {
    const out = execFileSync('ps', ['aux', '--sort=-%cpu', '--no-headers'], { maxBuffer: 65536 }).toString();
    const lines = out.split('\n');
    const processes = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.trim().split(/\s+/);
      if (parts.length < 11) continue;
      processes.push({
        user: parts[0],
        pid: parseInt(parts[1], 10),
        cpu: parseFloat(parts[2]),
        mem: parseFloat(parts[3]),
        rss: parseInt(parts[5], 10) * 1024,
        command: parts.slice(10).join(' ').slice(0, 80),
      });
    }
    logger.info('Admin processes listed: count=' + processes.length);
    res.json(processes);
  } catch (e) {
    logger.error('Failed to list processes: ' + e);
    res.json([]);
  }
});

router.get('/admin/api/games', adminAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const allGames = await game.getAllGames();
    const list = allGames.map((g) => ({
      id: g.id,
      status: g.status,
      white: g.whiteName || g.players.white || '—',
      black: g.blackName || g.players.black || '—',
      turn: g.turn,
      moves: g.moveHistory.length,
      createdAt: g.createdAt,
      winner: g.winner,
      visibility: g.visibility,
    }));
    logger.info('Admin games listed: count=' + list.length);
    res.json(list);
  } catch (err) {
    logger.error('Admin games query failed: ' + err);
    res.status(500).json({ error: 'Failed to list games' });
  }
});

router.get('/admin/api/players', adminAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const allPlayers = game.getAllPlayers();
    const onlineIds = game.getOnlinePlayerIds();
    const registeredUsers = await db.loadAllUsers().catch(() => []);
    const regMap = new Map(registeredUsers.map((u) => [u.id, u.created_at]));
    const list = allPlayers.map((p) => {
      const gameIdSet = playerGameIndex.get(p.id);
      const currentGameId = gameIdSet && gameIdSet.size > 0 ? Array.from(gameIdSet)[0] : undefined;
      return {
        id: p.id,
        username: p.username,
        displayName: p.displayName,
        isRegistered: p.isRegistered,
        online: onlineIds.has(p.id),
        tokens: p.tokens.length,
        ip: game.getPlayerIp(p.id) || null,
        registeredAt: p.isRegistered ? (regMap.get(p.id) ?? null) : null,
        currentGameId,
      };
    });
    logger.info('Admin players listed: count=' + list.length + ' online=' + onlineIds.size);
    res.json(list);
  } catch (err) {
    logger.error('Admin players query failed: ' + err);
    res.status(500).json({ error: 'Failed to list players' });
  }
});

router.get('/admin/api/accounts', adminAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const users = await db.loadAllUsers();
    const list = users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      avatarUrl: u.avatar_url,
      createdAt: u.created_at,
      wins: u.wins,
      losses: u.losses,
      draws: u.draws,
      rating: u.rating,
    }));
    logger.info('Admin accounts listed: count=' + list.length);
    res.json(list);
  } catch (err) {
    logger.error('Admin accounts query failed: ' + err);
    res.status(500).json({ error: 'Failed to list accounts' });
  }
});

router.put('/admin/api/accounts/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { username, displayName, wins, losses, draws, rating } = req.body;
    const user = await db.getUserById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    if (rating !== undefined) {
      const r = parseInt(rating, 10);
      if (!isNaN(r) && r >= 0 && r <= 4000) {
        await db.updatePlayerRating(req.params.id, r);
      }
    }

    if (username !== undefined) {
      if (typeof username !== 'string' || username.trim().length === 0) {
        res.status(400).json({ error: 'Username cannot be empty' });
        return;
      }
      const trimmed = username.trim();
      if (trimmed.length < 2) {
        res.status(400).json({ error: 'Username must be at least 2 characters' });
        return;
      }
      if (trimmed.length > 30) {
        res.status(400).json({ error: 'Username must be at most 30 characters' });
        return;
      }
      const existing = await db.getUserByUsername(trimmed);
      if (existing && existing.id !== req.params.id) {
        res.status(409).json({ error: 'Username is already taken' });
        return;
      }
      await db.updateUsername(req.params.id, trimmed);
      const player = game.getAllPlayers().find((p) => p.id === req.params.id);
      if (player) player.username = trimmed;
    }

    if (displayName !== undefined) {
      const parsed = displayNameSchema.safeParse(displayName);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
      }
      await db.updateUserDisplayName(req.params.id, parsed.data);
      const player = game.getAllPlayers().find((p) => p.id === req.params.id);
      if (player) player.displayName = parsed.data;
    }

    if (wins !== undefined || losses !== undefined || draws !== undefined) {
      const newWins = wins !== undefined ? wins : user.wins;
      const newLosses = losses !== undefined ? losses : user.losses;
      const newDraws = draws !== undefined ? draws : user.draws;
      const statsParsed = z
        .object({
          wins: statsValueSchema,
          losses: statsValueSchema,
          draws: statsValueSchema,
        })
        .safeParse({ wins: newWins, losses: newLosses, draws: newDraws });
      if (!statsParsed.success) {
        res.status(400).json({ error: statsParsed.error.issues[0].message });
        return;
      }
      await db.updateUserStats(req.params.id, newWins, newLosses, newDraws);
    }

    logger.audit('admin_account_updated', `account="${req.params.id}" by admin`);
    res.json({ success: true });
  } catch (err) {
    logger.error('Admin account update failed: ' + err);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

router.delete('/admin/api/accounts/:id/avatar', adminAuthMiddleware, async (req: Request, res: Response) => {
  const user = await db.getUserById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  if (user.avatar_url) {
    const filePath = path.join(__dirname, '..', 'data', 'avatars', path.basename(user.avatar_url));
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ok */
    }
  }
  await db.updateUserAvatar(req.params.id, null);
  logger.audit('admin_avatar_cleared', `account="${req.params.id}" by admin`);
  res.json({ success: true });
});

router.post('/admin/api/accounts/:id/reset-password', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const parsed = passwordSchema.safeParse(req.body.newPassword);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const newPassword = parsed.data;
    const user = await db.getUserById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const key = crypto.pbkdf2Sync(newPassword, salt, 100000, 64, 'sha512').toString('hex');
    await db.updateUserPasswordHash(req.params.id, `${salt}:${key}`);
    logger.audit('admin_password_reset', `account="${req.params.id}" by admin`);
    res.json({ success: true });
  } catch (err) {
    logger.error('Admin password reset failed: ' + err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.delete('/admin/api/accounts/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await db.getUserById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    await db.deleteUserTokens(req.params.id);
    await db.deleteUserRecord(req.params.id);
    logger.audit('admin_account_deleted', `account="${req.params.id}" by admin`);
    res.json({ success: true });
  } catch (err) {
    logger.error('Admin account deletion failed: ' + err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

/* ─── Admin bans, kicks, end-game ─── */

router.post('/admin/api/players/:id/ban', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await game.banPlayer(req.params.id);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    logger.audit('admin_player_banned', `player="${req.params.id}" by admin`);
    res.json({ success: true });
  } catch (err) {
    logger.error('Ban player failed: ' + err);
    res.status(500).json({ error: 'Failed to ban player' });
  }
});

router.post('/admin/api/players/:id/kick', adminAuthMiddleware, (req: Request, res: Response) => {
  try {
    const result = game.kickPlayer(req.params.id);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    logger.audit('admin_player_kicked', `player="${req.params.id}" by admin`);
    res.json({ success: true });
  } catch (err) {
    logger.error('Kick player failed: ' + err);
    res.status(500).json({ error: 'Failed to kick player' });
  }
});

router.post('/admin/api/games/:id/end', adminAuthMiddleware, (req: Request, res: Response) => {
  try {
    const result = game.endGame(req.params.id);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    logger.audit('admin_game_ended', `game="${req.params.id}" by admin`);
    res.json({ success: true });
  } catch (err) {
    logger.error('End game failed: ' + err);
    res.status(500).json({ error: 'Failed to end game' });
  }
});

router.post('/admin/api/bans/ip', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const parsed = ipSchema.safeParse(req.body.ip);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const result = await game.banIp(parsed.data);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    logger.audit('admin_ip_banned', `ip="${parsed.data}" by admin`);
    res.json({ success: true });
  } catch (err) {
    logger.error('Ban IP failed: ' + err);
    res.status(500).json({ error: 'Failed to ban IP' });
  }
});

router.get('/admin/api/bans', adminAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const allBans = await db.loadAllBans();
    const players = allBans.filter((b) => b.player_id).map((b) => ({ id: b.player_id!, bannedAt: b.banned_at }));
    const ips = allBans.filter((b) => b.ip).map((b) => ({ ip: b.ip!, bannedAt: b.banned_at }));
    logger.info('Admin bans listed: players=' + players.length + ' ips=' + ips.length);
    res.json({ players, ips });
  } catch (err) {
    logger.error('Bans query failed: ' + err);
    res.status(500).json({ error: 'Failed to list bans' });
  }
});

router.delete('/admin/api/bans/player/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    await game.unbanPlayer(req.params.id);
    logger.audit('admin_player_unbanned', `player="${req.params.id}" by admin`);
    res.json({ success: true });
  } catch (err) {
    logger.error('Unban player failed: ' + err);
    res.status(500).json({ error: 'Failed to unban player' });
  }
});

router.delete('/admin/api/bans/ip/:ip', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const parsed = ipSchema.safeParse(req.params.ip);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid IP address format' });
      return;
    }
    await game.unbanIp(parsed.data);
    logger.audit('admin_ip_unbanned', `ip="${req.params.ip}" by admin`);
    res.json({ success: true });
  } catch (err) {
    logger.error('Unban IP failed: ' + err);
    res.status(500).json({ error: 'Failed to unban IP' });
  }
});

/* ─── Log viewer ─── */

const LOG_DIR = path.join(__dirname, '..', 'logs');

function tailFile(filePath: string, lines: number): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').filter(Boolean).slice(-lines);
  } catch {
    return [];
  }
}

router.get('/admin/api/logs', adminAuthMiddleware, (req: Request, res: Response) => {
  const maxLines = Math.min(parseInt(req.query.lines as string, 10) || 200, 5000);
  const type = (req.query.type as string) || 'all';
  const today = new Date().toISOString().slice(0, 10);
  const result: Record<string, string[]> = {};

  if (type === 'all' || type === 'app') result.app = tailFile(path.join(LOG_DIR, `app-${today}.log`), maxLines);
  if (type === 'all' || type === 'audit') result.audit = tailFile(path.join(LOG_DIR, `audit-${today}.log`), maxLines);
  if (type === 'all' || type === 'http') result.http = tailFile(path.join(LOG_DIR, `http-${today}.log`), maxLines);

  let logFiles: { name: string; size: number }[] = [];
  try {
    logFiles = fs
      .readdirSync(LOG_DIR)
      .filter((f) => f.endsWith('.log'))
      .sort()
      .reverse()
      .map((f) => {
        let size = 0;
        try { size = fs.statSync(path.join(LOG_DIR, f)).size; } catch { /* ok */ }
        return { name: f, size };
      });
  } catch {
    /* ok */
  }

  logger.info('Admin logs viewed: type=' + type + ' lines=' + maxLines);
  res.json({ logs: result, files: logFiles });
});

/* ─── Admin: Leaderboard ─── */

router.get('/admin/api/leaderboard', adminAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(_req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(_req.query.limit as string, 10) || 50));
    const minGames = Math.max(0, parseInt(_req.query.minGames as string, 10) || 0);
    const offset = (page - 1) * limit;
    const result = await db.getLeaderboard(limit, offset, minGames);
    res.json({ entries: result.rows, total: result.total, page, limit });
  } catch (err) {
    logger.error('Admin leaderboard query failed: ' + err);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

/* ─── Admin: Game Archive ─── */

router.get('/admin/api/archive', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const player = req.query.player as string | undefined;
    const status = req.query.status as string | undefined;
    const fromDate = req.query.fromDate ? parseInt(req.query.fromDate as string, 10) : undefined;
    const toDate = req.query.toDate ? parseInt(req.query.toDate as string, 10) : undefined;
    const result = await db.getArchivedGames(page, limit, player, status, fromDate, toDate);
    res.json({ games: result.rows, total: result.total, page, limit });
  } catch (err) {
    logger.error('Admin archive query failed: ' + err);
    res.status(500).json({ error: 'Failed to load archive' });
  }
});

/* ─── Admin: Tournaments ─── */

router.get('/admin/api/tournaments', adminAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const ts = await db.getTournaments();
    const participantCounts = await Promise.all(ts.map((t) => db.getParticipantCount((t as { id: string }).id)));
    const enriched = ts.map((t, i) => ({ ...t, participantCount: participantCounts[i] }));
    res.json(enriched);
  } catch (err) {
    logger.error('Admin tournaments query failed: ' + err);
    res.status(500).json({ error: 'Failed to load tournaments' });
  }
});

router.get('/admin/api/tournaments/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const t = await db.getTournament(req.params.id);
    if (!t) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const participants = await db.getTournamentParticipants(req.params.id);
    const matches = await db.getTournamentMatches(req.params.id);
    res.json({ ...t, participants, matches, participantCount: participants.length });
  } catch (err) {
    logger.error('Admin tournament detail query failed: ' + err);
    res.status(500).json({ error: 'Failed to load tournament details' });
  }
});

router.delete('/admin/api/tournaments/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const t = await db.getTournament(req.params.id);
    if (!t) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    await db.deleteTournament(req.params.id);
    logger.audit('admin_tournament_deleted', `tournament="${req.params.id}" by admin`);
    res.json({ success: true });
  } catch (err) {
    logger.error('Admin tournament deletion failed: ' + err);
    res.status(500).json({ error: 'Failed to delete tournament' });
  }
});

/* ─── Admin: Tournament Notify All Participants ─── */

router.post('/admin/api/tournaments/:id/notify', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const t = await db.getTournament(req.params.id);
    if (!t) { res.status(404).json({ error: 'Tournament not found' }); return; }
    const parsed = z.object({ message: z.string().min(1).max(500) }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const participants = await db.getTournamentParticipants(req.params.id);
    let sent = 0;
    for (const _p of participants) {
      const count = game.broadcastToAll({ type: 'tournament_notification', tournamentId: req.params.id, message: parsed.data.message, timestamp: Date.now() });
      sent += count;
    }
    logger.audit('admin_tournament_notified', `tournament="${req.params.id}" message="${parsed.data.message}" by admin`);
    res.json({ success: true, sentCount: sent, participantCount: participants.length });
  } catch (err) {
    logger.error('Admin tournament notify failed: ' + err);
    res.status(500).json({ error: 'Failed to notify tournament participants' });
  }
});

/* ─── Admin: Bot Games stats ─── */

router.get('/admin/api/bot-games', adminAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const allGames = await game.getAllGames();
    const botGames = allGames.filter((g) => game.isBotGame(g));
    res.json({
      total: botGames.length,
      active: botGames.filter((g) => g.status === 'active').length,
      games: botGames.map((g) => ({
        id: g.id,
        status: g.status,
        players: g.players,
        moves: g.moveHistory.length,
        createdAt: g.createdAt,
      })),
    });
  } catch (err) {
    logger.error('Admin bot games query failed: ' + err);
    res.status(500).json({ error: 'Failed to load bot games' });
  }
});

/* ─── Admin: Broadcast message ─── */

router.post('/admin/api/broadcast', adminAuthMiddleware, (req: Request, res: Response) => {
  try {
    const parsed = broadcastMessageSchema.safeParse(req.body.message);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const count = game.broadcastToAll({ type: 'admin_broadcast', message: parsed.data, timestamp: Date.now() });
    logger.audit('admin_broadcast', `message="${parsed.data}" sent to ${count} players by admin`);
    res.json({ success: true, recipientCount: count });
  } catch (err) {
    logger.error('Admin broadcast failed: ' + err);
    res.status(500).json({ error: 'Failed to broadcast message' });
  }
});

/* ─── Admin: Server config ─── */

router.get('/admin/api/config', adminAuthMiddleware, (_req: Request, res: Response) => {
  function source(key: string, _def: string): 'env' | 'default' {
    return process.env[key] !== undefined ? 'env' : 'default';
  }
  res.json({
    maxGamesPerPlayer: parseInt(process.env.MAX_GAMES_PER_PLAYER ?? '20', 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10),
    waitingTtl: parseInt(process.env.WAITING_TTL_MINUTES ?? '10', 10),
    adminUsername: ADMIN_USERNAME,
    dbPath: process.env.DB_PATH || 'data/chess.db',
    nodeVersion: process.version,
    platform: process.platform,
    _sources: {
      maxGamesPerPlayer: source('MAX_GAMES_PER_PLAYER', '20'),
      rateLimitWindowMs: source('RATE_LIMIT_WINDOW_MS', '60000'),
      rateLimitMaxRequests: source('RATE_LIMIT_MAX_REQUESTS', '100'),
      waitingTtl: source('WAITING_TTL_MINUTES', '10'),
      dbPath: source('DB_PATH', 'data/chess.db'),
    },
  });
});

/* ─── Admin: Create Account ─── */

router.post('/admin/api/accounts', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const parsed = z
      .object({
        username: z.string().min(2).max(30),
        password: z.string().min(4),
        displayName: z.string().min(1).max(50).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { username, password, displayName } = parsed.data;
    const existing = await db.getUserByUsername(username);
    if (existing) {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }
    const id = uuidv4();
    const salt = crypto.randomBytes(16).toString('hex');
    const key = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    await db.createUser(id, username, `${salt}:${key}`, displayName || username);
    logger.audit('admin_account_created', `account="${id}" username="${username}" by admin`);
    res.json({ success: true, id });
  } catch (err) {
    logger.error('Admin create account failed: ' + err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

/* ─── Admin: View User's Games ─── */

router.get('/admin/api/accounts/:id/games', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await db.getUserById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    const activeGames = await game.getPlayerGames(req.params.id);
    const archiveResult = await db.getArchivedGames(1, 100, req.params.id);
    const completedGames = archiveResult.rows.map((g) => ({
      id: g.id,
      white: g.white_display_name || g.white_player_id,
      black: g.black_display_name || g.black_player_id,
      winner: g.winner,
      status: g.status,
      playedAt: g.played_at,
      pgn: g.pgn,
    }));
    res.json({
      active: activeGames.map((g) => ({
        id: g.id,
        status: g.status,
        white: g.whiteName || g.players.white || '—',
        black: g.blackName || g.players.black || '—',
        turn: g.turn,
        moves: g.moveHistory.length,
        createdAt: g.createdAt,
      })),
      completed: completedGames,
      totalCompleted: archiveResult.total,
    });
  } catch (err) {
    logger.error('Admin user games query failed: ' + err);
    res.status(500).json({ error: 'Failed to load user games' });
  }
});

/* ─── Admin: Impersonate User ─── */

router.post('/admin/api/accounts/:id/impersonate', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await db.getUserById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    const token = game.addToken(req.params.id);
    if (!token) {
      res.status(400).json({ error: 'User is not currently logged in' });
      return;
    }
    logger.audit('admin_impersonate', `account="${req.params.id}" by admin`);
    res.json({ token, userId: req.params.id, username: user.username });
  } catch (err) {
    logger.error('Admin impersonate failed: ' + err);
    res.status(500).json({ error: 'Failed to impersonate user' });
  }
});

/* ─── Admin: Tournament Edit ─── */

router.put('/admin/api/tournaments/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const t = await db.getTournament(req.params.id);
    if (!t) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    const parsed = z
      .object({
        name: z.string().min(1).max(100).optional(),
        maxPlayers: z.number().int().min(2).max(256).optional(),
        status: z.enum(['waiting', 'running', 'completed']).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { name, maxPlayers, status } = parsed.data;
    if (name !== undefined || maxPlayers !== undefined) {
      await db.updateTournamentDetails(
        req.params.id,
        name || t.name,
        maxPlayers || t.max_players,
        t.is_private ? 1 : 0,
      );
    }
    if (status !== undefined) {
      await db.updateTournamentStatus(req.params.id, status);
    }
    logger.audit('admin_tournament_updated', `tournament="${req.params.id}" by admin`);
    res.json({ success: true });
  } catch (err) {
    logger.error('Admin tournament update failed: ' + err);
    res.status(500).json({ error: 'Failed to update tournament' });
  }
});

/* ─── Admin: Tournament Force Start ─── */

router.post('/admin/api/tournaments/:id/force-start', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const t = await db.getTournament(req.params.id);
    if (!t) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    if (t.status !== 'waiting') {
      res.status(400).json({ error: 'Tournament is not in waiting status' });
      return;
    }
    await db.updateTournamentStatus(req.params.id, 'running', Date.now());
    logger.audit('admin_tournament_force_started', `tournament="${req.params.id}" by admin`);
    res.json({ success: true });
  } catch (err) {
    logger.error('Admin tournament force start failed: ' + err);
    res.status(500).json({ error: 'Failed to force start tournament' });
  }
});

/* ─── Admin: WebSocket Monitor ─── */

router.get('/admin/api/ws', adminAuthMiddleware, (_req: Request, res: Response) => {
  try {
    const playerConnections: { playerId: string; username: string; connectionCount: number }[] = [];
    for (const [playerId, sockets] of wsConnections) {
      if (sockets.size > 0) {
        const player = game.getAllPlayers().find((p) => p.id === playerId);
        playerConnections.push({
          playerId,
          username: player?.username || player?.displayName || playerId.slice(0, 8),
          connectionCount: sockets.size,
        });
      }
    }
    const spectatorConnectionsList: { gameId: string; connectionCount: number }[] = [];
    for (const [gameId, sockets] of spectatorConnections) {
      if (sockets.size > 0) {
        spectatorConnectionsList.push({ gameId, connectionCount: sockets.size });
      }
    }
    const totalPlayerConns = playerConnections.reduce((sum, p) => sum + p.connectionCount, 0);
    const totalSpecConns = spectatorConnectionsList.reduce((sum, s) => sum + s.connectionCount, 0);
    logger.info('Admin WS monitor: players=' + playerConnections.length + ' specs=' + spectatorConnectionsList.length);
    res.json({
      totalPlayerConnections: totalPlayerConns,
      totalSpectatorConnections: totalSpecConns,
      connectedPlayers: playerConnections.length,
      spectatedGames: spectatorConnectionsList.length,
      players: playerConnections,
      spectators: spectatorConnectionsList,
      disconnectEvents: wsDisconnectEvents,
    });
  } catch (err) {
    logger.error('Admin WS monitor failed: ' + err);
    res.status(500).json({ error: 'Failed to get WS info' });
  }
});

/* ─── Admin: Health Check ─── */

router.get('/admin/api/health', adminAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const pool = db.getDb();
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    const dbLatency = Date.now() - dbStart;
    const { gamesActive, playersOnline } = game.getStats();
    const memUsage = process.memoryUsage();
    res.json({
      status: 'ok',
      database: { connected: true, latencyMs: dbLatency },
      server: {
        uptime: process.uptime(),
        nodeVersion: process.version,
        pid: process.pid,
        memory: {
          rss: memUsage.rss,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
        },
      },
      game: {
        activeGames: gamesActive,
        onlinePlayers: playersOnline,
      },
      timestamp: Date.now(),
    });
  } catch (err) {
    logger.error('Admin health check failed: ' + err);
    res.status(500).json({
      status: 'error',
      error: String(err),
      database: { connected: false },
      timestamp: Date.now(),
    });
  }
});

/* ─── Admin: Health History (DB latency) ─── */

router.get('/admin/api/health/history', adminAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const pool = db.getDb();
    const start = Date.now();
    await pool.query('SELECT 1');
    const latency = Date.now() - start;
    dbLatencyHistory.push(latency);
    if (dbLatencyHistory.length > MAX_LATENCY_SAMPLES) dbLatencyHistory.shift();
    res.json({ history: dbLatencyHistory });
  } catch (err) {
    logger.error('Admin health history failed: ' + err);
    res.status(500).json({ error: 'Failed to get health history' });
  }
});

/* ─── Admin: Database Browser - List Tables ─── */

router.get('/admin/api/db/tables', adminAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const pool = db.getDb();
    const { rows } = await pool.query(`
      SELECT 
        table_name,
        (SELECT reltuples::bigint FROM pg_class WHERE oid = (quote_ident(table_name))::regclass) as row_count
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    res.json({ tables: rows.map((r: { table_name: string; row_count: number | null }) => ({
      name: r.table_name,
      estimatedRows: r.row_count || 0,
    })) });
  } catch (err) {
    logger.error('Admin DB tables query failed: ' + err);
    res.status(500).json({ error: 'Failed to list tables' });
  }
});

/* ─── Admin: Database Browser - Execute Query ─── */

router.post('/admin/api/db/query', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const parsed = z.object({ sql: z.string().min(1).max(5000) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const sql = parsed.data.sql.trim();
    const upper = sql.toUpperCase();
    if (!upper.startsWith('SELECT') && !upper.startsWith('EXPLAIN') && !upper.startsWith('WITH')) {
      res.status(403).json({ error: 'Only SELECT queries are allowed' });
      return;
    }
    if (/(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\s/i.test(sql)) {
      res.status(403).json({ error: 'Write queries are not allowed' });
      return;
    }
    const pool = db.getDb();
    const startTime = Date.now();
    const { rows, fields } = await pool.query({ text: sql, rowMode: 'array' });
    const elapsed = Date.now() - startTime;
    const columnNames = fields ? fields.map((f: { name: string }) => f.name) : [];
    res.json({
      columns: columnNames,
      rows: rows.slice(0, 500),
      totalRows: rows.length,
      elapsedMs: elapsed,
    });
  } catch (err) {
    logger.error('Admin DB query failed: ' + err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
