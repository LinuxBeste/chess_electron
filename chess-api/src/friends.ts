import { Router, Request, Response } from 'express';
import * as game from './game.js';
import * as db from './db.js';
import logger from './logger.js';
import { friendRequestUsernameSchema } from './validation.js';
import { authMiddleware, banCheckMiddleware, rateLimitMiddleware } from './routes.js';

const router: ReturnType<typeof Router> = Router();

/* ─── Friends ─── */

router.post(
  '/friends/request',
  authMiddleware,
  banCheckMiddleware,
  rateLimitMiddleware,
  async (req: Request, res: Response) => {
    if (!req.player.isRegistered) {
      res.status(403).json({ error: 'Only registered users can send friend requests' });
      return;
    }
    const parsed = friendRequestUsernameSchema.safeParse(req.body.username);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const trimmed = parsed.data;
    const targetUser = await db.getUserByUsername(trimmed);
    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (targetUser.id === req.player.id) {
      // Prevent self-friending
      res.status(400).json({ error: 'Cannot send friend request to yourself' });
      return;
    }
    if (await db.areFriends(req.player.id, targetUser.id)) {
      res.status(409).json({ error: 'Already friends with this user' });
      return;
    }
    if (await db.hasPendingRequest(req.player.id, targetUser.id)) {
      // Check bi-directional pending requests
      res.status(409).json({ error: 'Friend request already pending' });
      return;
    }
    try {
      const requestId = await db.createFriendRequest(req.player.id, targetUser.id);
      game.broadcastFriendRequest(req.player.id, targetUser.id, requestId);
      logger.info('Friend request sent: from=' + req.player.id + ' to=' + targetUser.id);
      res.status(201).json({ id: requestId });
    } catch (err) {
      logger.error('Friend request creation failed: ' + err);
      res.status(500).json({ error: 'Failed to send friend request' });
    }
  },
);

router.get('/friends/requests', authMiddleware, banCheckMiddleware, async (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can view friend requests' });
    return;
  }
  const incoming = await db.getPendingIncomingRequests(req.player.id);
  const outgoing = await db.getPendingOutgoingRequests(req.player.id);
  logger.info(
    'Friend requests listed: playerId=' +
      req.player.id +
      ' incoming=' +
      incoming.length +
      ' outgoing=' +
      outgoing.length,
  );

  const allIds = new Set<string>();
  for (const r of incoming) allIds.add(r.from_user_id);
  for (const r of outgoing) allIds.add(r.to_user_id);
  const usersById = await db.getUsersByIds([...allIds]); // Batch-load all referenced users

  const enrich = (rows: db.FriendRequestRow[], key: 'from_user_id' | 'to_user_id') =>
    rows.map((r) => {
      const pid = r[key];
      const p = game.getPlayerById(pid);
      const u = usersById.get(pid);
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

router.post('/friends/requests/:id/accept', authMiddleware, banCheckMiddleware, async (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can accept friend requests' });
    return;
  }
  const fr = await db.getFriendRequest(req.params.id);
  if (!fr) {
    res.status(404).json({ error: 'Friend request not found' });
    return;
  }
  if (fr.to_user_id !== req.player.id) {
    // Only the recipient can accept
    res.status(403).json({ error: 'Not your friend request to accept' });
    return;
  }
  if (fr.status !== 'pending') {
    res.status(400).json({ error: 'Friend request is no longer pending' });
    return;
  }
  try {
    await db.updateFriendRequestStatus(fr.id, 'accepted');
    await db.addFriendRelationship(fr.from_user_id, fr.to_user_id);
    game.broadcastFriendRequestAccepted(req.player.id, fr.from_user_id);
    logger.info('Friend request accepted: from=' + fr.from_user_id + ' to=' + fr.to_user_id);
    res.json({ success: true });
  } catch (err) {
    logger.error('Friend request accept failed: ' + err);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

router.post(
  '/friends/requests/:id/decline',
  authMiddleware,
  banCheckMiddleware,
  async (req: Request, res: Response) => {
    if (!req.player.isRegistered) {
      res.status(403).json({ error: 'Only registered users can decline friend requests' });
      return;
    }
    const fr = await db.getFriendRequest(req.params.id);
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
      await db.updateFriendRequestStatus(fr.id, 'declined');
      game.broadcastFriendRequestDeclined(req.player.id, fr.from_user_id);
      logger.info('Friend request declined: from=' + fr.from_user_id + ' to=' + fr.to_user_id);
      res.json({ success: true });
    } catch (err) {
      logger.error('Friend request decline failed: ' + err);
      res.status(500).json({ error: 'Failed to decline friend request' });
    }
  },
);

router.post('/friends/requests/:id/cancel', authMiddleware, banCheckMiddleware, async (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can cancel friend requests' });
    return;
  }
  const fr = await db.getFriendRequest(req.params.id);
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
    await db.updateFriendRequestStatus(fr.id, 'cancelled');
    logger.info('Friend request cancelled: from=' + fr.from_user_id + ' to=' + fr.to_user_id);
    res.json({ success: true });
  } catch (err) {
    logger.error('Friend request cancel failed: ' + err);
    res.status(500).json({ error: 'Failed to cancel friend request' });
  }
});

router.delete('/friends/:friendId', authMiddleware, banCheckMiddleware, async (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can remove friends' });
    return;
  }
  if (!(await db.areFriends(req.player.id, req.params.friendId))) {
    res.status(404).json({ error: 'Not friends with this user' });
    return;
  }
  try {
    await db.removeFriendRelationship(req.player.id, req.params.friendId);
    game.broadcastFriendRemoved(req.player.id, req.params.friendId);
    logger.info('Friend removed: playerId=' + req.player.id + ' friendId=' + req.params.friendId);
    res.json({ success: true });
  } catch (err) {
    logger.error('Friend remove failed: ' + err);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

router.get('/users/search', authMiddleware, async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').trim();
  if (q.length < 2) {
    res.status(400).json({ error: 'Query must be at least 2 characters' });
    return;
  }
  const users = await db.searchUsers(q, 10);
  res.json(users.map((u) => ({ id: u.id, username: u.username, displayName: u.display_name })));
});

router.get('/friends', authMiddleware, banCheckMiddleware, async (req: Request, res: Response) => {
  if (!req.player.isRegistered) {
    res.status(403).json({ error: 'Only registered users can list friends' });
    return;
  }
  const friends = await game.getFriendList(req.player.id);
  logger.info('Friend list: playerId=' + req.player.id + ' count=' + friends.length);
  res.json(friends);
});

export default router;
