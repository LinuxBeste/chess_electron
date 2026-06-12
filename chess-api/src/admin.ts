import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import * as game from './game';
import * as db from './db';
import logger from './logger';
import { ipRateLimitMiddleware } from './routes';

const router: ReturnType<typeof Router> = Router();

let ADMIN_USERNAME: string;
let ADMIN_PASSWORD: string;

function initAdminCreds(): void {
  ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
  if (process.env.ADMIN_PASSWORD) {
    ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  } else {
    ADMIN_PASSWORD = crypto.randomBytes(24).toString('hex');
    logger.warn('No ADMIN_PASSWORD set. Generated random password: ' + ADMIN_PASSWORD);
    logger.warn('Set ADMIN_PASSWORD env var to use a custom password.');
  }
}

initAdminCreds();

const adminTokens = new Set<string>();

function adminAuthMiddleware(req: Request, res: Response, next: () => void): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Admin authentication required' });
    return;
  }
  const token = header.slice(7);
  if (!adminTokens.has(token)) {
    res.status(401).json({ error: 'Invalid admin token' });
    return;
  }
  next();
}

router.post('/admin/api/login', ipRateLimitMiddleware, (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    logger.audit('admin_login_failed', `username="${username}" ip="${req.ip || ''}"`);
    res.status(401).json({ error: 'Invalid admin credentials' });
    return;
  }
  const token = uuidv4();
  adminTokens.add(token);
  logger.audit('admin_login_ok', `username="${username}" ip="${req.ip || ''}"`);
  res.json({ token });
});

router.get('/admin/api/stats', adminAuthMiddleware, (_req: Request, res: Response) => {
  try {
    const { gamesActive, playersOnline } = game.getStats();
    const allPlayers = game.getAllPlayers();
    const registeredUsers = allPlayers.filter((p) => p.isRegistered).length;
    const totalUsers = db.loadAllUsers().length;
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

  let diskTotal = 0;
  let diskFree = 0;
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
      const user = parts[0];
      const pid = parseInt(parts[1], 10);
      const cpu = parseFloat(parts[2]);
      const mem = parseFloat(parts[3]);
      const rss = parseInt(parts[5], 10) * 1024;
      const command = parts.slice(10).join(' ').slice(0, 80);
      processes.push({ user, pid, cpu, mem, rss, command });
    }
    logger.info('Admin processes listed: count=' + processes.length);
    res.json(processes);
  } catch (e) {
    logger.error('Failed to list processes: ' + e);
    res.json([]);
  }
});

router.get('/admin/api/games', adminAuthMiddleware, (_req: Request, res: Response) => {
  const allGames = game.getAllGames();
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
});

router.get('/admin/api/players', adminAuthMiddleware, (_req: Request, res: Response) => {
  const allPlayers = game.getAllPlayers();
  const onlineIds = game.getOnlinePlayerIds();
  const list = allPlayers.map((p) => ({
    id: p.id,
    username: p.username,
    displayName: p.displayName,
    isRegistered: p.isRegistered,
    online: onlineIds.has(p.id),
    tokens: p.tokens.length,
    ip: game.getPlayerIp(p.id) || null,
  }));
  logger.info('Admin players listed: count=' + list.length + ' online=' + onlineIds.size);
  res.json(list);
});

router.get('/admin/api/accounts', adminAuthMiddleware, (_req: Request, res: Response) => {
  const users = db.loadAllUsers();
  const list = users.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    avatarUrl: u.avatar_url,
    createdAt: u.created_at,
    wins: u.wins,
    losses: u.losses,
    draws: u.draws,
  }));
  logger.info('Admin accounts listed: count=' + list.length);
  res.json(list);
});

router.put('/admin/api/accounts/:id', adminAuthMiddleware, (req: Request, res: Response) => {
  const { username, displayName, wins, losses, draws } = req.body;
  const user = db.getUserById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'Account not found' });
    return;
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
    const existing = db.getUserByUsername(trimmed);
    if (existing && existing.id !== req.params.id) {
      res.status(409).json({ error: 'Username is already taken' });
      return;
    }
    db.updateUsername(req.params.id, trimmed);
    const player = game.getAllPlayers().find((p) => p.id === req.params.id);
    if (player) player.username = trimmed;
  }

  if (displayName !== undefined) {
    if (typeof displayName !== 'string' || displayName.trim().length === 0) {
      res.status(400).json({ error: 'displayName cannot be empty' });
      return;
    }
    db.updateUserDisplayName(req.params.id, displayName.trim());
    const player = game.getAllPlayers().find((p) => p.id === req.params.id);
    if (player) player.displayName = displayName.trim();
  }

  if (wins !== undefined || losses !== undefined || draws !== undefined) {
    const newWins = wins !== undefined ? wins : user.wins;
    const newLosses = losses !== undefined ? losses : user.losses;
    const newDraws = draws !== undefined ? draws : user.draws;
    if (typeof newWins !== 'number' || typeof newLosses !== 'number' || typeof newDraws !== 'number') {
      res.status(400).json({ error: 'Stats must be numbers' });
      return;
    }
    db.updateUserStats(req.params.id, newWins, newLosses, newDraws);
  }

  logger.audit('admin_account_updated', `account="${req.params.id}" by admin`);
  res.json({ success: true });
});

router.delete('/admin/api/accounts/:id/avatar', adminAuthMiddleware, (req: Request, res: Response) => {
  const user = db.getUserById(req.params.id);
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
  db.updateUserAvatar(req.params.id, null);
  logger.audit('admin_avatar_cleared', `account="${req.params.id}" by admin`);
  res.json({ success: true });
});

router.post('/admin/api/accounts/:id/reset-password', adminAuthMiddleware, (req: Request, res: Response) => {
  const { newPassword } = req.body;
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    res.status(400).json({ error: 'newPassword must be at least 8 characters' });
    return;
  }
  const user = db.getUserById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.pbkdf2Sync(newPassword, salt, 100000, 64, 'sha512').toString('hex');
  const hash = `${salt}:${key}`;
  db.updateUserPasswordHash(req.params.id, hash);
  logger.audit('admin_password_reset', `account="${req.params.id}" by admin`);
  res.json({ success: true });
});

router.delete('/admin/api/accounts/:id', adminAuthMiddleware, (req: Request, res: Response) => {
  const user = db.getUserById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  db.deleteUserTokens(req.params.id);
  db.deleteUserRecord(req.params.id);
  logger.audit('admin_account_deleted', `account="${req.params.id}" by admin`);
  res.json({ success: true });
});

/* ─── Admin bans, kicks, end-game ─── */

router.post('/admin/api/players/:id/ban', adminAuthMiddleware, (req: Request, res: Response) => {
  const result = game.banPlayer(req.params.id);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  logger.audit('admin_player_banned', `player="${req.params.id}" by admin`);
  res.json({ success: true });
});

router.post('/admin/api/players/:id/kick', adminAuthMiddleware, (req: Request, res: Response) => {
  const result = game.kickPlayer(req.params.id);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  logger.audit('admin_player_kicked', `player="${req.params.id}" by admin`);
  res.json({ success: true });
});

router.post('/admin/api/games/:id/end', adminAuthMiddleware, (req: Request, res: Response) => {
  const result = game.endGame(req.params.id);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  logger.audit('admin_game_ended', `game="${req.params.id}" by admin`);
  res.json({ success: true });
});

router.post('/admin/api/bans/ip', adminAuthMiddleware, (req: Request, res: Response) => {
  const { ip } = req.body;
  if (!ip || typeof ip !== 'string') {
    res.status(400).json({ error: 'IP is required' });
    return;
  }
  const result = game.banIp(ip.trim());
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  logger.audit('admin_ip_banned', `ip="${ip.trim()}" by admin`);
  res.json({ success: true });
});

router.get('/admin/api/bans', adminAuthMiddleware, (_req: Request, res: Response) => {
  const players = game.getBannedPlayers();
  const ips = game.getBannedIps();
  logger.info('Admin bans listed: players=' + players.length + ' ips=' + ips.length);
  res.json({ players, ips });
});

router.delete('/admin/api/bans/player/:id', adminAuthMiddleware, (req: Request, res: Response) => {
  game.unbanPlayer(req.params.id);
  logger.audit('admin_player_unbanned', `player="${req.params.id}" by admin`);
  res.json({ success: true });
});

router.delete('/admin/api/bans/ip/:ip', adminAuthMiddleware, (req: Request, res: Response) => {
  game.unbanIp(req.params.ip);
  logger.audit('admin_ip_unbanned', `ip="${req.params.ip}" by admin`);
  res.json({ success: true });
});

/* ─── Log viewer ─── */

const LOG_DIR = path.join(__dirname, '..', 'logs');

function tailFile(filePath: string, lines: number): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const allLines = content.split('\n').filter(Boolean);
    return allLines.slice(-lines);
  } catch {
    return [];
  }
}

router.get('/admin/api/logs', adminAuthMiddleware, (req: Request, res: Response) => {
  const maxLines = Math.min(parseInt(req.query.lines as string) || 200, 5000);
  const type = (req.query.type as string) || 'all';

  const today = new Date().toISOString().slice(0, 10);
  const result: Record<string, string[]> = {};

  if (type === 'all' || type === 'app') {
    result.app = tailFile(path.join(LOG_DIR, `app-${today}.log`), maxLines);
  }
  if (type === 'all' || type === 'audit') {
    result.audit = tailFile(path.join(LOG_DIR, `audit-${today}.log`), maxLines);
  }
  if (type === 'all' || type === 'http') {
    result.http = tailFile(path.join(LOG_DIR, `http-${today}.log`), maxLines);
  }

  const logFiles: string[] = [];
  try {
    const files = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith('.log'));
    logFiles.push(...files.sort().reverse());
  } catch {
    /* ok */
  }

  logger.info('Admin logs viewed: type=' + type + ' lines=' + maxLines);
  res.json({ logs: result, files: logFiles });
});

/* ─── Admin: Leaderboard ─── */
router.get('/admin/api/leaderboard', adminAuthMiddleware, (_req: Request, res: Response) => {
  const page = Math.max(1, parseInt(_req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(_req.query.limit as string) || 50));
  const offset = (page - 1) * limit;
  const result = db.getLeaderboard(limit, offset);
  res.json({ entries: result.rows, total: result.total, page, limit });
});

/* ─── Admin: Game Archive ─── */
router.get('/admin/api/archive', adminAuthMiddleware, (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const player = req.query.player as string | undefined;
  const status = req.query.status as string | undefined;
  const result = db.getArchivedGames(page, limit, player, status);
  res.json({ games: result.rows, total: result.total, page, limit });
});

/* ─── Admin: Tournaments ─── */
router.get('/admin/api/tournaments', adminAuthMiddleware, (_req: Request, res: Response) => {
  const ts = db.getTournaments();
  const enriched = ts.map((t: any) => ({ ...t, participantCount: db.getParticipantCount(t.id) }));
  res.json(enriched);
});

router.get('/admin/api/tournaments/:id', adminAuthMiddleware, (req: Request, res: Response) => {
  const t = db.getTournament(req.params.id);
  if (!t) { res.status(404).json({ error: 'Not found' }); return; }
  const participants = db.getTournamentParticipants(req.params.id);
  const matches = db.getTournamentMatches(req.params.id);
  res.json({ ...t, participants, matches, participantCount: participants.length });
});

router.delete('/admin/api/tournaments/:id', adminAuthMiddleware, (req: Request, res: Response) => {
  const t = db.getTournament(req.params.id);
  if (!t) { res.status(404).json({ error: 'Not found' }); return; }
  /* Cascade delete via foreign keys */
  const d = (db as any).getDb();
  d.prepare('DELETE FROM tournament_matches WHERE tournament_id = ?').run(req.params.id);
  d.prepare('DELETE FROM tournament_participants WHERE tournament_id = ?').run(req.params.id);
  d.prepare('DELETE FROM tournaments WHERE id = ?').run(req.params.id);
  logger.audit('admin_tournament_deleted', `tournament="${req.params.id}" by admin`);
  res.json({ success: true });
});

/* ─── Admin: Bot Games stats (count active Bot games) ─── */
router.get('/admin/api/bot-games', adminAuthMiddleware, (_req: Request, res: Response) => {
  const allGames = game.getAllGames();
  const botGames = allGames.filter((g: any) => game.isBotGame(g));
  res.json({
    total: botGames.length,
    active: botGames.filter((g: any) => g.status === 'active').length,
    games: botGames.map((g: any) => ({
      id: g.id,
      status: g.status,
      players: g.players,
      moves: g.moveHistory.length,
      createdAt: g.createdAt,
    })),
  });
});

/* ─── Admin: Broadcast message to all connected players ─── */
router.post('/admin/api/broadcast', adminAuthMiddleware, (req: Request, res: Response) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }
  const count = game.broadcastToAll({
    type: 'admin_broadcast',
    message: message.trim(),
    timestamp: Date.now(),
  });
  logger.audit('admin_broadcast', `message="${message.trim()}" sent to ${count} players by admin`);
  res.json({ success: true, recipientCount: count });
});

/* ─── Admin: Server config ─── */
router.get('/admin/api/config', adminAuthMiddleware, (_req: Request, res: Response) => {
  res.json({
    maxGamesPerPlayer: parseInt(process.env.MAX_GAMES_PER_PLAYER ?? '20', 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10),
    waitingTtl: parseInt(process.env.WAITING_TTL_MINUTES ?? '10', 10),
    adminUsername: ADMIN_USERNAME,
    dbPath: process.env.DB_PATH || 'data/chess.db',
    nodeVersion: process.version,
    platform: process.platform,
  });
});

export default router;
