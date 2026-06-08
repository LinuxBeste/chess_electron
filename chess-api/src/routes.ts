/* Thin route handlers — each one parses input, delegates to game.ts,
 * and sends the response.  No business logic lives here. */

import { Router, Request, Response } from 'express';
import { PieceType } from './types';
import * as game from './game';
import * as db from './db';

const router: ReturnType<typeof Router> = Router();

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
  if (password !== undefined && (typeof password !== 'string' || password.length < 4)) {
    res.status(400).json({ error: 'Password must be at least 4 characters' });
    return;
  }
  try {
    const result = game.registerPlayer(username.trim(), password || undefined);
    game.setPlayerIp(result.playerId, ip);
    res.status(201).json(result);
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE constraint')) {
      res.status(409).json({ error: 'Username is already taken' });
      return;
    }
    res.status(500).json({ error: 'Registration failed' });
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
router.post('/games/:gameId/move', authMiddleware, banCheckMiddleware, rateLimitMiddleware, (req: Request, res: Response) => {
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
});

/* Resign from a game */
router.post('/games/:gameId/resign', authMiddleware, banCheckMiddleware, rateLimitMiddleware, (req: Request, res: Response) => {
  const result = game.resignGame(req.params.gameId, req.player.id);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result.state);
});

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

export default router;
