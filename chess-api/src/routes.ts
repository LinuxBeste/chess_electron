/* Thin route handlers — each one parses input, delegates to game.ts,
 * and sends the response.  No business logic lives here. */

import { Router, Request, Response } from 'express';
import { PieceType } from './types';
import * as game from './game';

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

/* Register a new player (no auth — this is how you get your token) */
router.post('/auth/register', (req: Request, res: Response) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    res.status(400).json({ error: 'Username is required' });
    return;
  }
  const result = game.registerPlayer(username.trim());
  res.status(201).json(result);
});

/* Get the authenticated player's info */
router.get('/auth/me', authMiddleware, (req: Request, res: Response) => {
  res.json({ id: req.player.id, username: req.player.username });
});

/* Create a new game (player becomes white).
 * Optional body field: visibility ('public' | 'private', defaults to 'public'). */
router.post('/games', authMiddleware, (req: Request, res: Response) => {
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

/* Join a game as the black player */
router.post('/games/:gameId/join', authMiddleware, (req: Request, res: Response) => {
  const result = game.joinGame(req.params.gameId, req.player.id);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result.game);
});

/* Make a move in a game */
router.post('/games/:gameId/move', authMiddleware, rateLimitMiddleware, (req: Request, res: Response) => {
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
router.post('/games/:gameId/resign', authMiddleware, rateLimitMiddleware, (req: Request, res: Response) => {
  const result = game.resignGame(req.params.gameId, req.player.id);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result.state);
});

/* Get match history for the authenticated player */
router.get('/players/:playerId/games', authMiddleware, (req: Request, res: Response) => {
  if (req.player.id !== req.params.playerId) {
    res.status(403).json({ error: 'Can only view your own match history' });
    return;
  }
  const playerGames = game.getPlayerGames(req.params.playerId);
  res.json(playerGames);
});

/* Get all legal moves for the authenticated player in a game */
router.get('/games/:gameId/moves', authMiddleware, (req: Request, res: Response) => {
  const result = game.getLegalMovesForPlayer(req.params.gameId, req.player.id);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ moves: result.moves });
});

export default router;
