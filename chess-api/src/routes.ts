/* Thin route handlers — each one parses input, delegates to game.ts,
 * and sends the response.  No business logic lives here. */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { PieceType } from './types';
import * as game from './game';
import * as db from './db';
import fs from 'fs';
import path from 'path';

const router: ReturnType<typeof Router> = Router();

/* ─── Avatar file upload middleware ─── */
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', 'data', 'avatars'),
    filename: (_req, file, cb) => {
      const ext = file.mimetype === 'image/png' ? '.png' : '.jpg';
      cb(null, 'temp' + ext);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

/**
 * Middleware: extract and validate the bearer token from the
 * Authorization header.  On success, attaches the Player object
 * to req.player so downstream handlers can access player info.
 *
 * Header format: "Authorization: Bearer <uuid>"
 */
function authMiddleware(req: Request, res: Response, next: () => void): void {
  const header = req.headers.authorization;
  /* No header or wrong scheme → 401 */
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
  /* Track player IP for ban enforcement */
  const ip = req.ip || req.socket.remoteAddress || '';
  game.setPlayerIp(player.id, ip);
  next();
}

/**
 * Rate-limit middleware: applies per-player request throttling.
 * Returns 429 if the player exceeds the configured limit. */
function rateLimitMiddleware(req: Request, res: Response, next: () => void): void {
  if (!game.checkRateLimit(req.player.id)) {
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
    return;
  }
  next();
}

/**
 * Ban-check middleware: rejects requests from banned players or IPs.
 * Must run after authMiddleware so req.player is available. */
function banCheckMiddleware(req: Request, res: Response, next: () => void): void {
  const ip = req.ip || req.socket.remoteAddress || '';
  if (game.isBanned(req.player.id, ip)) {
    res.status(403).json({ error: 'You have been banned' });
    return;
  }
  next();
}

/* Health check — no auth required */
router.get('/health', (_req: Request, res: Response) => {
  const { gamesActive, playersOnline } = game.getStats();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    gamesActive,
    playersOnline,
  });
});

/* Register a new player.
 *
 * Two modes:
 *   - Anonymous (no password): in-memory only, name can be duplicate.
 *   - Registered  (with password): persisted to SQLite, unique username.
 */
router.post('/auth/register', (req: Request, res: Response) => {
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
  if (password !== undefined && (typeof password !== 'string' || password.length < 4)) {
    res.status(400).json({ error: 'Password must be at least 4 characters' });
    return;
  }
  try {
    const result = game.registerPlayer(trimmed, password || undefined);
    game.setPlayerIp(result.playerId, ip);
    res.status(201).json(result);
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE constraint')) {
      res.status(409).json({ error: 'Username is already taken' });
      return;
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed: ' + String(err?.message || err) });
  }
});

/* Log in as an existing registered user */
router.post('/auth/login', (req: Request, res: Response) => {
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
  const result = game.loginPlayer(username.trim(), password);
  if (!result.success) {
    res.status(401).json({ error: result.error });
    return;
  }
  game.setPlayerIp(result.playerId, ip);
  res.json(result);
});

/* Get the authenticated player's info (includes stats for registered users) */
router.get('/auth/me', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const stats = game.getPlayerStats(req.player.id);
  const user = db.getUserById(req.player.id);
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

/* Update the authenticated player's display name */
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
  res.json({ success: true, displayName: displayName.trim() });
});

/* Change the authenticated player's password (registered users only) */
router.put('/auth/me/password', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current password and new password are required' });
    return;
  }
  if (typeof newPassword !== 'string' || newPassword.length < 4) {
    res.status(400).json({ error: 'New password must be at least 4 characters' });
    return;
  }
  const result = game.changePassword(req.player.id, currentPassword, newPassword);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ success: true });
});

/* Upload profile picture (registered users only) */
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

    const ext = path.extname(req.file.filename) || '.jpg';
    const finalName = req.player.id + ext;
    const finalPath = path.join(__dirname, '..', 'data', 'avatars', finalName);
    try {
      fs.renameSync(req.file.path, finalPath);
    } catch {
      /* file may already be under the final name on some platforms */
    }

    const avatarUrl = '/avatars/' + finalName;
    db.updateUserAvatar(req.player.id, avatarUrl);
    res.json({ avatarUrl });
  });
});

/* Remove profile picture */
router.delete('/auth/me/avatar', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const user = db.getUserById(req.player.id);
  if (user?.avatar_url) {
    const filePath = path.join(__dirname, '..', 'data', 'avatars', path.basename(user.avatar_url));
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* file might not exist */
    }
  }
  db.updateUserAvatar(req.player.id, null);
  res.json({ success: true });
});

/* Get a player's public profile */
router.get('/players/:playerId/profile', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const player = game.getPlayerById(req.params.playerId);
  const user = db.getUserById(req.params.playerId);
  res.json({
    id: req.params.playerId,
    username: player?.username ?? user?.username ?? null,
    displayName: player?.displayName ?? user?.display_name ?? null,
    isRegistered: player?.isRegistered ?? !!user,
    avatarUrl: user?.avatar_url ?? null,
    createdAt: user?.created_at ?? null,
    stats: user ? { wins: user.wins, losses: user.losses, draws: user.draws } : null,
  });
});

/* Delete the authenticated player's account (registered users only) */
router.delete('/auth/me', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const result = game.deleteAccount(req.player.id);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ success: true });
});

/* Create a new game (player becomes white).
 * Optional body field: visibility ('public' | 'private', defaults to 'public'). */
router.post('/games', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const visibility: 'public' | 'private' = req.body.visibility === 'private' ? 'private' : 'public';
  const g = game.createGame(req.player.id, visibility);
  res.status(201).json(g);
});

/* List all open (waiting) games */
router.get('/games', (_req: Request, res: Response) => {
  res.json(game.getOpenGames());
});

/* List all active games (for spectating) */
router.get('/games/active', (_req: Request, res: Response) => {
  res.json(game.getActiveGames());
});

/* Get a specific game by ID */
router.get('/games/:gameId', (req: Request, res: Response) => {
  const g = game.getGame(req.params.gameId);
  if (!g) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }
  res.json(g);
});

/* Abort a waiting game (creator only) */
router.post('/games/:gameId/abort', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const result = game.abortGame(req.params.gameId, req.player.id);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ success: true });
});

/* Join a game as the black player */
router.post('/games/:gameId/join', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const result = game.joinGame(req.params.gameId, req.player.id);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result.game);
});

/* Make a move in a game */
router.post(
  '/games/:gameId/move',
  authMiddleware,
  banCheckMiddleware,
  rateLimitMiddleware,
  (req: Request, res: Response) => {
    const { from, to, promotion } = req.body;
    if (!from || !to) {
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
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.state);
  },
);

/* Resign from a game */
router.post(
  '/games/:gameId/resign',
  authMiddleware,
  banCheckMiddleware,
  rateLimitMiddleware,
  (req: Request, res: Response) => {
    const result = game.resignGame(req.params.gameId, req.player.id);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.state);
  },
);

/* Get match history for the authenticated player */
router.get('/players/:playerId/games', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  if (req.player.id !== req.params.playerId) {
    res.status(403).json({ error: 'Can only view your own match history' });
    return;
  }
  const playerGames = game.getPlayerGames(req.params.playerId);
  res.json(playerGames);
});

/* Get all legal moves for the authenticated player in a game */
router.get('/games/:gameId/moves', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  const result = game.getLegalMovesForPlayer(req.params.gameId, req.player.id);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ moves: result.moves });
});

/* ─── Friends ─── */

/* Send a friend request by username */
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
    const requestId = db.createFriendRequest(req.player.id, targetUser.id);
    game.broadcastFriendRequest(req.player.id, targetUser.id, requestId);
    res.status(201).json({ id: requestId });
  },
);

/* List pending friend requests (incoming and outgoing) */
router.get('/friends/requests', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can view friend requests' });
    return;
  }
  const incoming = db.getPendingIncomingRequests(req.player.id);
  const outgoing = db.getPendingOutgoingRequests(req.player.id);

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

  res.json({
    incoming: enrich(incoming, 'from_user_id'),
    outgoing: enrich(outgoing, 'to_user_id'),
  });
});

/* Accept a friend request */
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
  db.updateFriendRequestStatus(fr.id, 'accepted');
  db.addFriendRelationship(fr.from_user_id, fr.to_user_id);
  game.broadcastFriendRequestAccepted(req.player.id, fr.from_user_id);
  res.json({ success: true });
});

/* Decline a friend request */
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
  db.updateFriendRequestStatus(fr.id, 'declined');
  res.json({ success: true });
});

/* Remove a friend */
router.delete('/friends/:friendId', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can remove friends' });
    return;
  }
  if (!db.areFriends(req.player.id, req.params.friendId)) {
    res.status(404).json({ error: 'Not friends with this user' });
    return;
  }
  db.removeFriendRelationship(req.player.id, req.params.friendId);
  res.json({ success: true });
});

/* List friends with online status and current game */
router.get('/friends', authMiddleware, banCheckMiddleware, (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can list friends' });
    return;
  }
  res.json(game.getFriendList(req.player.id));
});

export default router;
