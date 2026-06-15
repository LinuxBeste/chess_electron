import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { PieceType } from './types';
import * as game from './game';
import * as db from './db';
import logger from './logger';
import fs from 'fs';
import path from 'path';

const router: ReturnType<typeof Router> = Router();

const IMAGE_MAGIC: Record<string, Uint8Array[]> = {
  'image/jpeg': [new Uint8Array([0xff, 0xd8, 0xff])],
  'image/png': [new Uint8Array([0x89, 0x50, 0x4e, 0x47])],
  'image/gif': [new Uint8Array([0x47, 0x49, 0x46])],
  'image/webp': [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
};

function isValidImageType(filePath: string, mimeType: string): boolean {
  try {
    const magic = IMAGE_MAGIC[mimeType];
    if (!magic) return false;
    const header = new Uint8Array(fs.readFileSync(filePath).subarray(0, 8));
    return magic.some((sig) => sig.every((b, i) => b === header[i]));
  } catch {
    return false;
  }
}

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', 'data', 'avatars'),
    filename: (_req, file, cb) => {
      const ext =
        file.mimetype === 'image/png'
          ? '.png'
          : file.mimetype === 'image/gif'
            ? '.gif'
            : file.mimetype === 'image/webp'
              ? '.webp'
              : '.jpg';
      cb(null, uuidv4() + ext);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error('Unsupported file type. Allowed: PNG, JPEG, GIF, WebP.'));
      return;
    }
    cb(null, true);
  },
});

const ipRateBuckets = new Map<string, number[]>();
const IP_RATE_LIMIT_WINDOW_MS = 60000;
const IP_RATE_LIMIT_MAX = process.env.NODE_ENV === 'test' ? Infinity : 20;

export function ipRateLimitMiddleware(req: Request, res: Response, next: () => void): void {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const windowStart = now - IP_RATE_LIMIT_WINDOW_MS;
  let timestamps = ipRateBuckets.get(ip) ?? [];
  timestamps = timestamps.filter((t) => t > windowStart);
  if (timestamps.length >= IP_RATE_LIMIT_MAX) {
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
    return;
  }
  timestamps.push(now);
  ipRateBuckets.set(ip, timestamps);
  next();
}

export function cleanupIpRateBuckets(): void {
  const cutoff = Date.now() - IP_RATE_LIMIT_WINDOW_MS;
  for (const [ip, timestamps] of ipRateBuckets) {
    const filtered = timestamps.filter((t) => t > cutoff);
    if (filtered.length === 0) ipRateBuckets.delete(ip);
    else ipRateBuckets.set(ip, filtered);
  }
}

function authMiddleware(req: Request, res: Response, next: () => void): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const token = header.slice(7);
  const player = game.authenticatePlayer(token);
  if (!player) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  req.player = player;
  const ip = req.ip || req.socket.remoteAddress || '';
  game.setPlayerIp(player.id, ip);
  next();
}

function rateLimitMiddleware(req: Request, res: Response, next: () => void): void {
  if (!game.checkRateLimit(req.player.id)) {
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
    return;
  }
  next();
}

function banCheckMiddleware(req: Request, res: Response, next: () => void): void {
  const ip = req.ip || req.socket.remoteAddress || '';
  if (game.isBanned(req.player.id, ip)) {
    res.status(403).json({ error: 'You have been banned' });
    return;
  }
  next();
}

const globalGetLimiter = ipRateLimitMiddleware;

router.get('/health', globalGetLimiter, (_req: Request, res: Response) => {
  const { gamesActive, playersOnline } = game.getStats();
  logger.info('GET /health: gamesActive=' + gamesActive + ' playersOnline=' + playersOnline);
  res.json({ status: 'ok', uptime: process.uptime(), gamesActive, playersOnline });
});

router.post('/auth/register', ipRateLimitMiddleware, (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || '';
  if (game.isBanned('', ip)) {
    res.status(403).json({ error: 'Your IP has been banned' });
    return;
  }
  const { username, password } = req.body;
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    res.status(400).json({ error: 'Username is required' });
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
  if (password !== undefined && (typeof password !== 'string' || password.length < 8)) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  try {
    const result = game.registerPlayer(trimmed, password || undefined);
    game.setPlayerIp(result.playerId, ip);
    logger.audit('register', `username="${trimmed}" registered=${result.isRegistered} ip="${ip}"`);
    res.status(201).json({ playerId: result.playerId, token: result.token });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Register error:', msg);
    res.status(500).json({ error: 'Registration failed: ' + msg });
  }
});

router.post('/auth/logout', authMiddleware, (req: Request, res: Response) => {
  const header = req.headers.authorization;
  const token = header!.slice(7);
  game.logoutPlayer(token);
  logger.info('Logout: playerId=' + req.player.id);
  res.json({ success: true });
});

router.post('/auth/login', ipRateLimitMiddleware, (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || '';
  if (game.isBanned('', ip)) {
    res.status(403).json({ error: 'Your IP has been banned' });
    return;
  }
  const { username, password } = req.body;
  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }
  const trimmed = username.trim();
  const lockout = game.checkLoginLockout(trimmed);
  if (lockout.locked) {
    const minutes = Math.ceil(lockout.remainingMs! / 60000);
    logger.audit('login_locked', `username="${trimmed}" ip="${ip}" remaining=${lockout.remainingMs}ms`);
    res.status(429).json({ error: 'Account temporarily locked. Try again in ' + minutes + ' minute(s).' });
    return;
  }
  const result = game.loginPlayer(trimmed, password);
  if (!result.success) {
    game.recordFailedAttempt(trimmed);
    logger.audit('login_failed', `username="${trimmed}" ip="${ip}"`);
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }
  game.clearLoginAttempts(trimmed);
  logger.audit('login_ok', `playerId="${result.playerId}" username="${trimmed}" ip="${ip}"`);
  res.json(result);
});

router.get('/auth/me', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const stats = game.getPlayerStats(req.player.id);
  const user = db.getUserById(req.player.id);
  logger.info('GET /auth/me: playerId=' + req.player.id + ' username=' + req.player.username);
  res.json({
    id: req.player.id,
    username: req.player.username,
    displayName: req.player.displayName,
    isRegistered: req.player.isRegistered,
    createdAt: user?.created_at ?? null,
    avatarUrl: user?.avatar_url ?? null,
    ...(stats ? { stats } : {}),
  });
});

router.put('/auth/me', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const { displayName } = req.body;
  if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
    res.status(400).json({ error: 'Display name is required' });
    return;
  }
  const result = game.updateDisplayName(req.player.id, displayName.trim());
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  logger.info('Display name updated: playerId=' + req.player.id + ' displayName=' + displayName.trim());
  res.json({ success: true, displayName: displayName.trim() });
});

router.put('/auth/me/password', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current password and new password are required' });
    return;
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters' });
    return;
  }
  const result = game.changePassword(req.player.id, currentPassword, newPassword);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  logger.audit('password_changed', `playerId="${req.player.id}"`);
  res.json({ success: true });
});

router.post('/auth/me/avatar', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(400).json({ error: 'Only registered accounts can set a profile picture' });
    return;
  }
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'File too large. Maximum size is 2 MB.' });
        return;
      }
      res.status(400).json({ error: 'Upload failed: ' + err.message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    if (process.env.NODE_ENV !== 'test' && !isValidImageType(req.file.path, req.file.mimetype)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ok */
      }
      res.status(400).json({ error: 'Invalid image content' });
      return;
    }

    const ext = path.extname(req.file.filename) || '.jpg';
    const finalName = req.player.id + ext;
    const finalPath = path.join(__dirname, '..', 'data', 'avatars', finalName);
    try {
      fs.renameSync(req.file.path, finalPath);
    } catch {
      /* ok */
    }

    const avatarUrl = '/avatars/' + finalName;
    db.updateUserAvatar(req.player.id, avatarUrl);
    logger.info('Avatar uploaded: playerId=' + req.player.id + ' url=' + avatarUrl);
    res.json({ avatarUrl });
  });
});

router.delete('/auth/me/avatar', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const user = db.getUserById(req.player.id);
  if (user?.avatar_url) {
    const filePath = path.join(__dirname, '..', 'data', 'avatars', path.basename(user.avatar_url));
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ok */
    }
  }
  db.updateUserAvatar(req.player.id, null);
  logger.info('Avatar removed: playerId=' + req.player.id);
  res.json({ success: true });
});

router.get('/players/:playerId/profile', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  try {
    if (!req.params.playerId) {
      res.status(400).json({ error: 'Player ID is required' });
      return;
    }
    const onlineIds = game.getOnlinePlayerIds();
    const player = game.getPlayerById(req.params.playerId);
    const user = db.getUserById(req.params.playerId);
    const friendStatus = req.params.playerId === req.player.id ? 'none' : db.getFriendStatus(req.player.id, req.params.playerId);
    const isOnline = onlineIds.has(req.params.playerId);
    const currentGameId = isOnline ? game.getPlayerCurrentGameId(req.params.playerId) : null;
    const friendIds = db.getFriendIds(req.params.playerId);
    const archivedStats = db.getPlayerWinLossDraw(req.params.playerId);
    const tournamentStats = db.getPlayerTournamentStats(req.params.playerId);
    logger.info('GET /players/' + req.params.playerId + '/profile: viewed by playerId=' + req.player.id + ' online=' + isOnline);
    res.json({
      id: req.params.playerId,
      username: player?.username ?? user?.username ?? null,
      displayName: player?.displayName ?? user?.display_name ?? null,
      isRegistered: player?.isRegistered ?? !!user,
      avatarUrl: user?.avatar_url ?? null,
      createdAt: user?.created_at ?? null,
      rating: user?.rating ?? null,
      friendStatus,
      friendCount: friendIds.length,
      isOnline,
      currentGameId,
      totalGames: archivedStats.wins + archivedStats.losses + archivedStats.draws,
      archivedStats,
      tournaments: tournamentStats,
      stats: user ? { wins: user.wins, losses: user.losses, draws: user.draws } : null,
    });
  } catch (err) {
    logger.error('Profile fetch failed: ' + err);
    res.status(500).json({ error: 'Failed to load profile data' });
  }
});

router.delete('/auth/me', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const result = game.deleteAccount(req.player.id);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  logger.audit('account_deleted', 'playerId=' + req.player.id + ' username=' + req.player.username);
  res.json({ success: true });
});

router.post('/games', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const visibility: 'public' | 'private' = req.body.visibility === 'private' ? 'private' : 'public';
  const spectateMode: 'public' | 'code' = req.body.spectateMode === 'code' ? 'code' : 'public';
  try {
    const g = game.createGame(req.player.id, visibility, spectateMode);
    logger.info('Game created: gameId=' + g.id + ' by playerId=' + req.player.id + ' visibility=' + visibility + ' spectateMode=' + spectateMode);
    res.status(201).json(g);
  } catch (err) {
    logger.error('Game creation failed: ' + err);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

router.post('/games/bot', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const skillLevel = Math.max(1, Math.min(20, parseInt(req.body.skillLevel as string) || 1));
  const playerColor: 'white' | 'black' = req.body.playerColor === 'black' ? 'black' : 'white';
  try {
    const result = game.createBotGame(req.player.id, skillLevel, playerColor);
    if (!result.success) {
      res.status(503).json({ error: result.error });
      return;
    }
    logger.info('Bot game created: gameId=' + result.game.id + ' by playerId=' + req.player.id + ' skill=' + skillLevel);
    res.status(201).json(result.game);
  } catch (err) {
    logger.error('Bot game creation failed: ' + err);
    res.status(500).json({ error: 'Failed to create bot game' });
  }
});

router.get('/games', globalGetLimiter, (_req: Request, res: Response) => {
  const openGames = game.getOpenGames();
  logger.info('GET /games: count=' + openGames.length);
  res.json(openGames);
});

router.get('/games/active', globalGetLimiter, (_req: Request, res: Response) => {
  const activeGames = game.getActiveGames();
  logger.info('GET /games/active: count=' + activeGames.length);
  res.json(activeGames);
});

router.get('/games/archive', globalGetLimiter, (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const playerId = req.query.player as string | undefined;
    const status = req.query.status as string | undefined;
    const fromDate = req.query.from ? parseInt(req.query.from as string) : undefined;
    const toDate = req.query.to ? parseInt(req.query.to as string) : undefined;
    const result = db.getArchivedGames(page, limit, playerId, status, fromDate, toDate);
    res.json({ games: result.rows, total: result.total, page, limit });
  } catch (err) {
    logger.error('Archive query failed: ' + err);
    res.status(500).json({ error: 'Failed to load archived games' });
  }
});

router.get('/games/archive/:gameId', globalGetLimiter, (req: Request, res: Response) => {
  try {
    const game = db.getArchivedGame(req.params.gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    res.json(game);
  } catch (err) {
    logger.error('Archive game query failed: ' + err);
    res.status(500).json({ error: 'Failed to load archived game' });
  }
});

router.get('/games/:gameId', globalGetLimiter, (req: Request, res: Response) => {
  const g = game.getGame(req.params.gameId);
  if (!g) {
    logger.info('GET /games/' + req.params.gameId + ': not found');
    res.status(404).json({ error: 'Game not found' });
    return;
  }
  logger.info('GET /games/' + req.params.gameId + ': found');
  res.json(g);
});

router.post('/games/:gameId/abort', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const result = game.abortGame(req.params.gameId, req.player.id);
  if (!result.success) {
    logger.info('Abort failed: gameId=' + req.params.gameId + ' playerId=' + req.player.id + ' error=' + result.error);
    res.status(400).json({ error: result.error });
    return;
  }
  logger.info('Game aborted: gameId=' + req.params.gameId + ' by playerId=' + req.player.id);
  res.json({ success: true });
});

router.post('/games/:gameId/join', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const result = game.joinGame(req.params.gameId, req.player.id);
  if (!result.success) {
    logger.info('Join failed: gameId=' + req.params.gameId + ' playerId=' + req.player.id + ' error=' + result.error);
    res.status(400).json({ error: result.error });
    return;
  }
  logger.info('Game joined: gameId=' + req.params.gameId + ' by playerId=' + req.player.id);
  res.json(result.game);
});

router.post(
  '/games/:gameId/move',
  authMiddleware,
  banCheckMiddleware,
  rateLimitMiddleware,
  (req: Request, res: Response) => {
    const { from, to, promotion } = req.body;
    if (!from || !to) {
      logger.info('Move failed: gameId=' + req.params.gameId + ' playerId=' + req.player.id + ' error=missing from/to');
      res.status(400).json({ error: 'from and to are required' });
      return;
    }
    const result = game.makeMove(
      req.params.gameId,
      req.player.id,
      from as string,
      to as string,
      promotion as PieceType | undefined,
    );
    if (!result.success) {
      logger.info(
        'Move failed: gameId=' +
          req.params.gameId +
          ' playerId=' +
          req.player.id +
          ' move=' +
          from +
          '-' +
          to +
          ' error=' +
          result.error,
      );
      res.status(400).json({ error: result.error });
      return;
    }
    logger.info(
      'Move made: gameId=' +
        req.params.gameId +
        ' playerId=' +
        req.player.id +
        ' move=' +
        from +
        '-' +
        to +
        (promotion ? ' promotion=' + promotion : ''),
    );
    res.json(result.state);
  },
);

router.post(
  '/games/:gameId/resign',
  authMiddleware,
  banCheckMiddleware,
  rateLimitMiddleware,
  (req: Request, res: Response) => {
    const result = game.resignGame(req.params.gameId, req.player.id);
    if (!result.success) {
      logger.info(
        'Resign failed: gameId=' + req.params.gameId + ' playerId=' + req.player.id + ' error=' + result.error,
      );
      res.status(400).json({ error: result.error });
      return;
    }
    logger.info('Game resigned: gameId=' + req.params.gameId + ' playerId=' + req.player.id);
    res.json(result.state);
  },
);

router.get('/players/me/active-game', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const gameId = game.getPlayerCurrentGameId(req.player.id);
  if (!gameId) {
    res.json({ game: null });
    return;
  }
  const g = game.getGame(gameId);
  res.json({ game: g ?? null });
});

router.get('/players/:playerId/games', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  if (req.player.id !== req.params.playerId) {
    logger.info('Match history forbidden: requester=' + req.player.id + ' target=' + req.params.playerId);
    res.status(403).json({ error: 'Can only view your own match history' });
    return;
  }
  const playerGames = game.getPlayerGames(req.params.playerId);
  logger.info('Match history: playerId=' + req.params.playerId + ' count=' + playerGames.length);
  res.json(playerGames);
});

router.get('/games/:gameId/moves', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const result = game.getLegalMovesForPlayer(req.params.gameId, req.player.id);
  if (!result.success) {
    logger.info(
      'Legal moves failed: gameId=' + req.params.gameId + ' playerId=' + req.player.id + ' error=' + result.error,
    );
    res.status(400).json({ error: result.error });
    return;
  }
  logger.info(
    'Legal moves: gameId=' + req.params.gameId + ' playerId=' + req.player.id + ' count=' + result.moves!.length,
  );
  res.json({ moves: result.moves! });
});

/* ─── Friends ─── */

router.post(
  '/friends/request',
  authMiddleware,
  banCheckMiddleware,
  rateLimitMiddleware,
  (req: Request, res: Response) => {
    if (!req.player.isRegistered) {
      res.status(403).json({ error: 'Only registered users can send friend requests' });
      return;
    }
    const { username } = req.body;
    if (!username || typeof username !== 'string') {
      res.status(400).json({ error: 'Username is required' });
      return;
    }
    const trimmed = username.trim();
    if (trimmed.length < 2 || trimmed.length > 30) {
      res.status(400).json({ error: 'Username must be between 2 and 30 characters' });
      return;
    }
    const targetUser = db.getUserByUsername(trimmed);
    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (targetUser.id === req.player.id) {
      res.status(400).json({ error: 'Cannot send friend request to yourself' });
      return;
    }
    if (db.areFriends(req.player.id, targetUser.id)) {
      res.status(409).json({ error: 'Already friends with this user' });
      return;
    }
    if (db.hasPendingRequest(req.player.id, targetUser.id)) {
      res.status(409).json({ error: 'Friend request already pending' });
      return;
    }
    try {
      const requestId = db.createFriendRequest(req.player.id, targetUser.id);
      game.broadcastFriendRequest(req.player.id, targetUser.id, requestId);
      logger.info('Friend request sent: from=' + req.player.id + ' to=' + targetUser.id);
      res.status(201).json({ id: requestId });
    } catch (err) {
      logger.error('Friend request creation failed: ' + err);
      res.status(500).json({ error: 'Failed to send friend request' });
    }
  },
);

router.get('/friends/requests', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can view friend requests' });
    return;
  }
  const incoming = db.getPendingIncomingRequests(req.player.id);
  const outgoing = db.getPendingOutgoingRequests(req.player.id);
  logger.info(
    'Friend requests listed: playerId=' +
      req.player.id +
      ' incoming=' +
      incoming.length +
      ' outgoing=' +
      outgoing.length,
  );

  const enrich = (rows: db.FriendRequestRow[], key: 'from_user_id' | 'to_user_id') =>
    rows.map((r) => {
      const pid = r[key];
      const p = game.getPlayerById(pid);
      const u = db.getUserById(pid);
      return {
        id: r.id,
        playerId: pid,
        username: p?.username ?? u?.username ?? '?',
        displayName: p?.displayName ?? u?.display_name ?? '?',
        avatarUrl: u?.avatar_url ?? null,
        createdAt: r.created_at,
      };
    });

  res.json({ incoming: enrich(incoming, 'from_user_id'), outgoing: enrich(outgoing, 'to_user_id') });
});

router.post('/friends/requests/:id/accept', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can accept friend requests' });
    return;
  }
  const fr = db.getFriendRequest(req.params.id);
  if (!fr) {
    res.status(404).json({ error: 'Friend request not found' });
    return;
  }
  if (fr.to_user_id !== req.player.id) {
    res.status(403).json({ error: 'Not your friend request to accept' });
    return;
  }
  if (fr.status !== 'pending') {
    res.status(400).json({ error: 'Friend request is no longer pending' });
    return;
  }
  try {
    db.updateFriendRequestStatus(fr.id, 'accepted');
    db.addFriendRelationship(fr.from_user_id, fr.to_user_id);
    game.broadcastFriendRequestAccepted(req.player.id, fr.from_user_id);
    logger.info('Friend request accepted: from=' + fr.from_user_id + ' to=' + fr.to_user_id);
    res.json({ success: true });
  } catch (err) {
    logger.error('Friend request accept failed: ' + err);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

router.post('/friends/requests/:id/decline', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can decline friend requests' });
    return;
  }
  const fr = db.getFriendRequest(req.params.id);
  if (!fr) {
    res.status(404).json({ error: 'Friend request not found' });
    return;
  }
  if (fr.to_user_id !== req.player.id) {
    res.status(403).json({ error: 'Not your friend request to decline' });
    return;
  }
  if (fr.status !== 'pending') {
    res.status(400).json({ error: 'Friend request is no longer pending' });
    return;
  }
  try {
    db.updateFriendRequestStatus(fr.id, 'declined');
    game.broadcastFriendRequestDeclined(req.player.id, fr.from_user_id);
    logger.info('Friend request declined: from=' + fr.from_user_id + ' to=' + fr.to_user_id);
    res.json({ success: true });
  } catch (err) {
    logger.error('Friend request decline failed: ' + err);
    res.status(500).json({ error: 'Failed to decline friend request' });
  }
});

router.post('/friends/requests/:id/cancel', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can cancel friend requests' });
    return;
  }
  const fr = db.getFriendRequest(req.params.id);
  if (!fr) {
    res.status(404).json({ error: 'Friend request not found' });
    return;
  }
  if (fr.from_user_id !== req.player.id) {
    res.status(403).json({ error: 'Not your friend request to cancel' });
    return;
  }
  if (fr.status !== 'pending') {
    res.status(400).json({ error: 'Friend request is no longer pending' });
    return;
  }
  try {
    db.updateFriendRequestStatus(fr.id, 'cancelled');
    logger.info('Friend request cancelled: from=' + fr.from_user_id + ' to=' + fr.to_user_id);
    res.json({ success: true });
  } catch (err) {
    logger.error('Friend request cancel failed: ' + err);
    res.status(500).json({ error: 'Failed to cancel friend request' });
  }
});

router.delete('/friends/:friendId', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can remove friends' });
    return;
  }
  if (!db.areFriends(req.player.id, req.params.friendId)) {
    res.status(404).json({ error: 'Not friends with this user' });
    return;
  }
  try {
    db.removeFriendRelationship(req.player.id, req.params.friendId);
    game.broadcastFriendRemoved(req.player.id, req.params.friendId);
    logger.info('Friend removed: playerId=' + req.player.id + ' friendId=' + req.params.friendId);
    res.json({ success: true });
  } catch (err) {
    logger.error('Friend remove failed: ' + err);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

router.get('/leaderboard', globalGetLimiter, (_req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(_req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(_req.query.limit as string) || 50));
    const offset = (page - 1) * limit;
    const result = db.getLeaderboard(limit, offset);
    const entries = result.rows.map((r) => ({
      playerId: r.id,
      username: r.username,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      rating: r.rating,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
    }));
    res.json({ entries, total: result.total, page, limit });
  } catch (err) {
    logger.error('Leaderboard query failed: ' + err);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

router.get('/friends', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can list friends' });
    return;
  }
  const friends = game.getFriendList(req.player.id);
  logger.info('Friend list: playerId=' + req.player.id + ' count=' + friends.length);
  res.json(friends);
});

/* ─── Tournaments ─── */

router.post('/tournaments', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can create tournaments' });
    return;
  }
  const name = ((req.body.name as string) || '').trim();
  if (!name) {
    res.status(400).json({ error: 'Tournament name is required' });
    return;
  }
  const maxPlayers = Math.max(2, Math.min(64, parseInt(req.body.maxPlayers as string) || 8));
  const isPrivate = req.body.isPrivate === true;
  try {
    const t = db.createTournament(name, req.player.id, maxPlayers, isPrivate);
    db.addTournamentParticipant(t.id, req.player.id, req.player.displayName || req.player.username, 0);
    const tournament = db.getTournament(t.id);
    if (t.joinCode) tournament.join_code = t.joinCode;
    res.status(201).json(tournament);
  } catch (err) {
    logger.error('Tournament creation failed: ' + err);
    res.status(500).json({ error: 'Tournament creation failed' });
  }
});

router.get('/tournaments', globalGetLimiter, (_req: Request, res: Response) => {
  try {
    const tournaments = db.getPublicTournaments();
    const enriched = tournaments.map((t: any) => ({ ...t, participantCount: db.getParticipantCount(t.id) }));
    res.json(enriched);
  } catch (err) {
    logger.error('Tournament list query failed: ' + err);
    res.status(500).json({ error: 'Failed to load tournaments' });
  }
});

router.post('/tournaments/join-by-code', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can join tournaments' });
    return;
  }
  const code = ((req.body.code as string) || '').trim().toUpperCase();
  if (!code) {
    res.status(400).json({ error: 'Join code is required' });
    return;
  }
  const t = db.getTournamentByJoinCode(code);
  if (!t) {
    res.status(404).json({ error: 'Invalid join code' });
    return;
  }
  if (t.status !== 'waiting') {
    res.status(400).json({ error: 'Tournament is not open' });
    return;
  }
  if (db.isTournamentParticipant(t.id, req.player.id)) {
    res.status(409).json({ error: 'Already joined' });
    return;
  }
  const count = db.getParticipantCount(t.id);
  if (count >= t.max_players) {
    res.status(400).json({ error: 'Tournament is full' });
    return;
  }
  try {
    db.addTournamentParticipant(t.id, req.player.id, req.player.displayName || req.player.username, count);
    logger.info('Tournament joined via code: tournamentId=' + t.id + ' playerId=' + req.player.id);
    res.json(db.getTournament(t.id));
  } catch (err) {
    logger.error('Failed to join tournament: ' + err);
    res.status(500).json({ error: 'Failed to join tournament' });
  }
});

router.get('/tournaments/:id', globalGetLimiter, (req: Request, res: Response) => {
  try {
    const t = db.getTournament(req.params.id);
    if (!t) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    const participants = db.getTournamentParticipants(req.params.id);
    const matches = db.getTournamentMatches(req.params.id);
    const result: any = { ...t, participants, matches, participantCount: participants.length };
    const playerId = (req as any).player?.id;
    if (playerId !== t.created_by) delete result.join_code;
    res.json(result);
  } catch (err) {
    logger.error('Tournament detail query failed: ' + err);
    res.status(500).json({ error: 'Failed to load tournament details' });
  }
});

router.post('/tournaments/:id/join', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can join tournaments' });
    return;
  }
  const t = db.getTournament(req.params.id);
  if (!t) {
    res.status(404).json({ error: 'Tournament not found' });
    return;
  }
  if (t.status !== 'waiting') {
    res.status(400).json({ error: 'Tournament is not open' });
    return;
  }
  if (db.isTournamentParticipant(t.id, req.player.id)) {
    res.status(409).json({ error: 'Already joined' });
    return;
  }
  const count = db.getParticipantCount(t.id);
  if (count >= t.max_players) {
    res.status(400).json({ error: 'Tournament is full' });
    return;
  }
  try {
    db.addTournamentParticipant(t.id, req.player.id, req.player.displayName || req.player.username, count);
    logger.info('Tournament joined: tournamentId=' + t.id + ' playerId=' + req.player.id);
    res.json(db.getTournament(t.id));
  } catch (err) {
    logger.error('Failed to join tournament: ' + err);
    res.status(500).json({ error: 'Failed to join tournament' });
  }
});

router.post('/tournaments/:id/leave', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can leave tournaments' });
    return;
  }
  const t = db.getTournament(req.params.id);
  if (!t) {
    res.status(404).json({ error: 'Tournament not found' });
    return;
  }
  if (t.status !== 'waiting') {
    res.status(400).json({ error: 'Tournament already started' });
    return;
  }
  try {
    db.removeTournamentParticipant(t.id, req.player.id);
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to leave tournament: ' + err);
    res.status(500).json({ error: 'Failed to leave tournament' });
  }
});

router.put('/tournaments/:id', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can edit tournaments' });
    return;
  }
  const t = db.getTournament(req.params.id);
  if (!t) {
    res.status(404).json({ error: 'Tournament not found' });
    return;
  }
  if (t.created_by !== req.player.id) {
    res.status(403).json({ error: 'Only the creator can edit' });
    return;
  }
  if (t.status !== 'waiting') {
    res.status(400).json({ error: 'Cannot edit a started tournament' });
    return;
  }
  const name = ((req.body.name as string) || '').trim();
  if (!name) {
    res.status(400).json({ error: 'Tournament name is required' });
    return;
  }
  const maxPlayers = Math.max(2, Math.min(64, parseInt(req.body.maxPlayers as string) || t.max_players));
  const isPrivate = req.body.isPrivate === true ? 1 : 0;
  try {
    db.updateTournamentDetails(t.id, name, maxPlayers, isPrivate);
    logger.info('Tournament updated: tournamentId=' + t.id);
    res.json(db.getTournament(t.id));
  } catch (err) {
    logger.error('Tournament update failed: ' + err);
    res.status(500).json({ error: 'Failed to update tournament' });
  }
});

router.delete('/tournaments/:id', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can delete tournaments' });
    return;
  }
  const t = db.getTournament(req.params.id);
  if (!t) {
    res.status(404).json({ error: 'Tournament not found' });
    return;
  }
  if (t.created_by !== req.player.id) {
    res.status(403).json({ error: 'Only the creator can delete' });
    return;
  }
  if (t.status !== 'waiting') {
    res.status(400).json({ error: 'Cannot delete a started tournament' });
    return;
  }
  try {
    db.deleteTournament(t.id);
    logger.info('Tournament deleted: tournamentId=' + t.id);
    res.json({ success: true });
  } catch (err) {
    logger.error('Tournament delete failed: ' + err);
    res.status(500).json({ error: 'Failed to delete tournament' });
  }
});

router.post('/tournaments/:id/start', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can start tournaments' });
    return;
  }
  const t = db.getTournament(req.params.id);
  if (!t) {
    res.status(404).json({ error: 'Tournament not found' });
    return;
  }
  if (t.created_by !== req.player.id) {
    res.status(403).json({ error: 'Only the creator can start' });
    return;
  }
  if (t.status !== 'waiting') {
    res.status(400).json({ error: 'Tournament already started' });
    return;
  }

  const participants = db.getTournamentParticipants(t.id);
  const playerIds = participants.map((p: any) => p.player_id);
  const count = playerIds.length;
  if (count < 2) {
    res.status(400).json({ error: 'Need at least 2 players' });
    return;
  }

  const size = Math.pow(2, Math.ceil(Math.log2(count)));
  const seeds: (string | null)[] = new Array(size).fill(null);
  for (let i = 0; i < count; i++) seeds[i] = playerIds[i];

  try {
    const matches: { round: number; position: number; white: string | null; black: string | null }[] = [];
    for (let i = 0; i < size / 2; i++) {
      matches.push({ round: 1, position: i, white: seeds[i * 2], black: seeds[i * 2 + 1] });
    }

    for (const m of matches) {
      db.createTournamentMatch(t.id, m.round, m.position, m.white, m.black);
    }

    db.updateTournamentStatus(t.id, 'active', Date.now());
    logger.info('Tournament started: tournamentId=' + t.id + ' players=' + count);
    res.json(db.getTournament(t.id));
  } catch (err) {
    logger.error('Failed to start tournament: ' + err);
    res.status(500).json({ error: 'Failed to start tournament' });
  }
});

export default router;
