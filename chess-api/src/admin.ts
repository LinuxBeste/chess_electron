import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import * as game from './game';
import * as db from './db';

const router: ReturnType<typeof Router> = Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

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

router.post('/admin/api/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Invalid admin credentials' });
    return;
  }
  const token = uuidv4();
  adminTokens.add(token);
  res.json({ token });
});

router.get('/admin/api/stats', adminAuthMiddleware, (_req: Request, res: Response) => {
  const { gamesActive, playersOnline } = game.getStats();
  const allPlayers = game.getAllPlayers();
  const registeredUsers = allPlayers.filter((p) => p.isRegistered).length;
  const totalUsers = db.loadAllUsers().length;
  res.json({ gamesActive, playersOnline, registeredUsers, totalUsers });
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
  }));
  res.json(list);
});

router.get('/admin/api/accounts', adminAuthMiddleware, (_req: Request, res: Response) => {
  const users = db.loadAllUsers();
  const list = users.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    createdAt: u.created_at,
    wins: u.wins,
    losses: u.losses,
    draws: u.draws,
  }));
  res.json(list);
});

router.put('/admin/api/accounts/:id', adminAuthMiddleware, (req: Request, res: Response) => {
  const { displayName } = req.body;
  if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
    res.status(400).json({ error: 'displayName is required' });
    return;
  }
  const user = db.getUserById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  db.updateUserDisplayName(req.params.id, displayName.trim());
  const player = game.getAllPlayers().find((p) => p.id === req.params.id);
  if (player) {
    player.displayName = displayName.trim();
  }
  res.json({ success: true });
});

router.post('/admin/api/accounts/:id/reset-password', adminAuthMiddleware, (req: Request, res: Response) => {
  const { newPassword } = req.body;
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 4) {
    res.status(400).json({ error: 'newPassword must be at least 4 characters' });
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
  res.json({ success: true });
});

export default router;
