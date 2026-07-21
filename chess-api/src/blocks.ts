import { Router, Request, Response } from 'express';
import { authMiddleware, banCheckMiddleware, rateLimitMiddleware } from './routes.js';
import { blockedPlayers, mutedPlayers, players } from './state.js';
import * as db from './db.js';
import logger from './logger.js';

const router = Router();

router.post(
  '/blocks/block',
  authMiddleware,
  banCheckMiddleware,
  rateLimitMiddleware,
  async (req: Request, res: Response) => {
    const { playerId: targetId } = req.body;
    if (typeof targetId !== 'string') {
      res.status(400).json({ error: 'playerId required' });
      return;
    }
    if (targetId === req.player.id) {
      res.status(400).json({ error: 'Cannot block yourself' });
      return;
    }
    const target = players.get(targetId);
    if (!target) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    try {
      await db.blockPlayer(req.player.id, targetId, 'block');
      let set = blockedPlayers.get(req.player.id);
      if (!set) {
        set = new Set();
        blockedPlayers.set(req.player.id, set);
      }
      set.add(targetId);
      mutedPlayers.get(req.player.id)?.delete(targetId);
      logger.info(`Player ${req.player.id} blocked ${targetId}`);
      res.json({ success: true, reason: 'block' });
    } catch (err) {
      logger.error('Block failed: ' + err);
      res.status(500).json({ error: 'Failed to block player' });
    }
  },
);

router.post(
  '/blocks/mute',
  authMiddleware,
  banCheckMiddleware,
  rateLimitMiddleware,
  async (req: Request, res: Response) => {
    const { playerId: targetId } = req.body;
    if (typeof targetId !== 'string') {
      res.status(400).json({ error: 'playerId required' });
      return;
    }
    if (targetId === req.player.id) {
      res.status(400).json({ error: 'Cannot mute yourself' });
      return;
    }
    const target = players.get(targetId);
    if (!target) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    // If currently blocked, downgrade to mute
    blockedPlayers.get(req.player.id)?.delete(targetId);
    try {
      await db.blockPlayer(req.player.id, targetId, 'mute');
      let set = mutedPlayers.get(req.player.id);
      if (!set) {
        set = new Set();
        mutedPlayers.set(req.player.id, set);
      }
      set.add(targetId);
      logger.info(`Player ${req.player.id} muted ${targetId}`);
      res.json({ success: true, reason: 'mute' });
    } catch (err) {
      logger.error('Mute failed: ' + err);
      res.status(500).json({ error: 'Failed to mute player' });
    }
  },
);

router.post(
  '/blocks/unblock',
  authMiddleware,
  banCheckMiddleware,
  rateLimitMiddleware,
  async (req: Request, res: Response) => {
    const { playerId: targetId } = req.body;
    if (typeof targetId !== 'string') {
      res.status(400).json({ error: 'playerId required' });
      return;
    }
    try {
      await db.unblockPlayer(req.player.id, targetId);
      blockedPlayers.get(req.player.id)?.delete(targetId);
      mutedPlayers.get(req.player.id)?.delete(targetId);
      logger.info(`Player ${req.player.id} unblocked ${targetId}`);
      res.json({ success: true });
    } catch (err) {
      logger.error('Unblock failed: ' + err);
      res.status(500).json({ error: 'Failed to unblock player' });
    }
  },
);

router.get('/blocks', authMiddleware, async (req: Request, res: Response) => {
  try {
    const blocked = await db.getBlockedIds(req.player.id);
    const enriched = blocked.map((b) => {
      const p = players.get(b.blocked_id);
      return {
        playerId: b.blocked_id,
        username: p?.username || 'unknown',
        displayName: p?.displayName || 'Unknown',
        reason: b.reason,
      };
    });
    res.json(enriched);
  } catch (err) {
    logger.error('Get blocks failed: ' + err);
    res.status(500).json({ error: 'Failed to load blocked players' });
  }
});

// Check if player A has blocked/muted player B — used by chat/game modules
export function isBlockedBy(blockerId: string, targetId: string): boolean {
  return blockedPlayers.get(blockerId)?.has(targetId) ?? false;
}

export function isMutedBy(blockerId: string, targetId: string): boolean {
  return mutedPlayers.get(blockerId)?.has(targetId) ?? false;
}

export function isBlockedOrMutedBy(blockerId: string, targetId: string): boolean {
  return isBlockedBy(blockerId, targetId) || isMutedBy(blockerId, targetId);
}

export async function loadPersistedBlocks(): Promise<void> {
  try {
    const all = await db.loadAllBlocks();
    for (const b of all) {
      if (b.reason === 'mute') {
        let set = mutedPlayers.get(b.blocker_id);
        if (!set) {
          set = new Set();
          mutedPlayers.set(b.blocker_id, set);
        }
        set.add(b.blocked_id);
      } else {
        let set = blockedPlayers.get(b.blocker_id);
        if (!set) {
          set = new Set();
          blockedPlayers.set(b.blocker_id, set);
        }
        set.add(b.blocked_id);
      }
    }
    logger.info('Persisted blocks loaded: ' + all.length + ' relations');
  } catch (err) {
    logger.error('Failed to load persisted blocks: ' + err);
  }
}

export default router;
