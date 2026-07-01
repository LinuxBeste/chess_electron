import { WebSocket } from 'ws';
import crypto from 'crypto';
import logger from './logger.js';
import { players } from './player.js';

const CHAT_MAX_LENGTH = parseInt(process.env.CHAT_MAX_LENGTH ?? '500', 10);
const CHAT_HISTORY_MAX = parseInt(process.env.CHAT_HISTORY_MAX ?? '50', 10);
const GROUP_NAME_MAX_LENGTH = parseInt(process.env.GROUP_NAME_MAX_LENGTH ?? '50', 10);
const GROUP_HISTORY_LIMIT = parseInt(process.env.GROUP_HISTORY_LIMIT ?? '200', 10);
import {
  getDb,
  createGroupConversation,
  getGroupMembers,
  getConversationOwnerId,
  addGroupMember,
  removeGroupMember,
  updateMemberRole,
  transferGroupOwnership,
  disbandGroupConversation,
  getUserById,
  getUserByUsername,
} from './db.js';
import { chatHistory, games, spectatorConnections, sendToPlayer, sendToSpectators, wsConnections } from './state.js';

const LOBBY_CONVERSATION_ID = 'lobby';

function now(): number {
  return Date.now();
}

function makeId(): string {
  return crypto.randomUUID();
}

export async function ensureLobbyConversation(): Promise<void> {
  const db = getDb();
  const { rows } = await db.query('SELECT id FROM chat_conversations WHERE id = $1', [LOBBY_CONVERSATION_ID]);
  if (rows.length === 0) {
    await db.query('INSERT INTO chat_conversations (id, type, name, created_at) VALUES ($1, $2, $3, $4)', [
      LOBBY_CONVERSATION_ID,
      'lobby',
      'Lobby',
      now(),
    ]);
    logger.info('Lobby conversation created');
  }
}

export async function handleLobbyChat(playerId: string, text: string): Promise<void> {
  if (!text) return;
  if (text.length > CHAT_MAX_LENGTH) text = text.slice(0, CHAT_MAX_LENGTH);
  const player = players.get(playerId);
  if (!player) return;

  const db = getDb();
  const msgId = makeId();
  const timestamp = now();

  await db.query(
    'INSERT INTO chat_messages (id, conversation_id, sender_id, text, created_at) VALUES ($1, $2, $3, $4, $5)',
    [msgId, LOBBY_CONVERSATION_ID, playerId, text, timestamp],
  );
  await db.query('UPDATE chat_conversations SET last_message_at = $1 WHERE id = $2', [
    timestamp,
    LOBBY_CONVERSATION_ID,
  ]);

  const message = {
    type: 'lobby_chat_message',
    conversationId: LOBBY_CONVERSATION_ID,
    messageId: msgId,
    playerId,
    username: player.displayName,
    text,
    timestamp,
  };

  for (const [, conns] of wsConnections) {
    for (const ws of conns) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
    }
  }
}

export async function sendLobbyChatHistory(ws: WebSocket): Promise<void> {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT m.id, m.conversation_id, m.sender_id, m.text, m.created_at, u.display_name
     FROM chat_messages m JOIN users u ON m.sender_id = u.id
     WHERE m.conversation_id = $1
     ORDER BY m.created_at ASC LIMIT $2`,
    [LOBBY_CONVERSATION_ID, GROUP_HISTORY_LIMIT],
  );
  ws.send(
    JSON.stringify({
      type: 'lobby_chat_history',
      conversationId: LOBBY_CONVERSATION_ID,
      messages: rows.map(
        (r: { id: string; sender_id: string; text: string; created_at: number; display_name: string }) => ({
          messageId: r.id,
          playerId: r.sender_id,
          username: r.display_name,
          text: r.text,
          timestamp: r.created_at,
        }),
      ),
    }),
  );
}

export async function getOrCreatePrivateConversation(playerA: string, playerB: string): Promise<string> {
  const db = getDb();
  const ids = [playerA, playerB].sort();
  const convId = 'priv_' + ids.join('_');

  const { rows } = await db.query('SELECT id FROM chat_conversations WHERE id = $1', [convId]);
  if (rows.length === 0) {
    const ts = now();
    await db.query('INSERT INTO chat_conversations (id, type, created_at) VALUES ($1, $2, $3)', [
      convId,
      'private',
      ts,
    ]);
    for (const uid of ids) {
      await db.query(
        'INSERT INTO chat_conversation_members (conversation_id, user_id, joined_at) VALUES ($1, $2, $3)',
        [convId, uid, ts],
      );
    }
    logger.info('Private conversation created: ' + convId);
  }
  return convId;
}

export async function handlePrivateChat(senderId: string, targetPlayerId: string, text: string): Promise<void> {
  if (!text) return;
  if (text.length > CHAT_MAX_LENGTH) text = text.slice(0, CHAT_MAX_LENGTH);
  const player = players.get(senderId);
  if (!player) return;

  const convId = await getOrCreatePrivateConversation(senderId, targetPlayerId);
  const db = getDb();
  const msgId = makeId();
  const timestamp = now();

  await db.query(
    'INSERT INTO chat_messages (id, conversation_id, sender_id, text, created_at) VALUES ($1, $2, $3, $4, $5)',
    [msgId, convId, senderId, text, timestamp],
  );
  await db.query('UPDATE chat_conversations SET last_message_at = $1 WHERE id = $2', [timestamp, convId]);

  const message = {
    type: 'private_chat_message',
    conversationId: convId,
    messageId: msgId,
    playerId: senderId,
    username: player.displayName,
    text,
    timestamp,
  };

  sendToPlayer(senderId, message);
  sendToPlayer(targetPlayerId, message);
}

export async function sendPrivateChatHistory(convId: string, ws: WebSocket): Promise<void> {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT m.id, m.sender_id, m.text, m.created_at, u.display_name
     FROM chat_messages m JOIN users u ON m.sender_id = u.id
     WHERE m.conversation_id = $1
     ORDER BY m.created_at ASC LIMIT $2`,
    [convId, GROUP_HISTORY_LIMIT],
  );
  ws.send(
    JSON.stringify({
      type: 'private_chat_history',
      conversationId: convId,
      messages: rows.map(
        (r: { id: string; sender_id: string; text: string; created_at: number; display_name: string }) => ({
          messageId: r.id,
          playerId: r.sender_id,
          username: r.display_name,
          text: r.text,
          timestamp: r.created_at,
        }),
      ),
    }),
  );
}

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  const dbPool = getDb();
  await dbPool.query(
    'UPDATE chat_conversation_members SET last_read_at = $1 WHERE conversation_id = $2 AND user_id = $3',
    [Date.now(), conversationId, userId],
  );
}

export async function getConversationsForUser(
  userId: string,
): Promise<
  { id: string; type: string; name: string | null; lastMessageAt: number; unread: number; ownerId?: string }[]
> {
  const dbPool = getDb();
  const { rows } = await dbPool.query(
    `SELECT c.id, c.type, c.name, c.last_message_at, c.owner_id
     FROM chat_conversations c
     JOIN chat_conversation_members m ON c.id = m.conversation_id
     WHERE m.user_id = $1 AND c.type != 'game'
     ORDER BY c.last_message_at DESC`,
    [userId],
  );

  const convIds = rows.map((r: { id: string }) => r.id);
  const unreadMap = new Map<string, number>();
  if (convIds.length > 0) {
    const placeholders = convIds.map((_: string, i: number) => '$' + (i + 2)).join(',');
    const { rows: unreadRows } = await dbPool.query(
      `SELECT m.conversation_id, COUNT(*) AS cnt
       FROM chat_messages m
       JOIN chat_conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = $1
       WHERE m.conversation_id IN (` +
        placeholders +
        `) AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
       GROUP BY m.conversation_id`,
      [userId, ...convIds],
    );
    for (const ur of unreadRows as { conversation_id: string; cnt: number }[]) {
      unreadMap.set(ur.conversation_id, ur.cnt);
    }
  }

  const results: {
    id: string;
    type: string;
    name: string | null;
    lastMessageAt: number;
    unread: number;
    ownerId?: string;
  }[] = [];

  for (const r of rows) {
    let name = r.type === 'lobby' ? 'Lobby' : r.name;
    if (r.type === 'private' && !name) {
      const ids = r.id.replace('priv_', '').split('_');
      const otherId = ids[0] === userId ? ids[1] : ids[0];
      const player = players.get(otherId);
      name = player?.displayName || otherId.slice(0, 8);
    }
    const result: {
      id: string;
      type: string;
      name: string | null;
      lastMessageAt: number;
      unread: number;
      ownerId?: string;
    } = {
      id: r.id,
      type: r.type,
      name,
      lastMessageAt: r.last_message_at,
      unread: unreadMap.get(r.id) ?? 0,
    };
    if (r.type === 'group' && r.owner_id) {
      result.ownerId = r.owner_id;
    }
    results.push(result);
  }

  return results;
}

/* ─── Group Chat ─── */

export async function handleCreateGroupConversation(ownerId: string, name: string): Promise<string> {
  if (!name || name.trim().length === 0) name = 'Group Chat';
  if (name.length > GROUP_NAME_MAX_LENGTH) name = name.slice(0, GROUP_NAME_MAX_LENGTH);
  const convId = await createGroupConversation(ownerId, name.trim());
  logger.info('Group conversation created: id=' + convId + ' owner=' + ownerId + ' name=' + name);
  return convId;
}

export async function handleGroupChat(convId: string, senderId: string, text: string): Promise<void> {
  if (!text) return;
  if (text.length > CHAT_MAX_LENGTH) text = text.slice(0, CHAT_MAX_LENGTH);
  const player = players.get(senderId);
  if (!player) return;

  const members = await getGroupMembers(convId);
  if (!members.some((m) => m.user_id === senderId)) return;

  const dbPool = getDb();
  const msgId = makeId();
  const timestamp = now();

  await dbPool.query(
    'INSERT INTO chat_messages (id, conversation_id, sender_id, text, created_at) VALUES ($1, $2, $3, $4, $5)',
    [msgId, convId, senderId, text, timestamp],
  );
  await dbPool.query('UPDATE chat_conversations SET last_message_at = $1 WHERE id = $2', [timestamp, convId]);

  const message = {
    type: 'group_chat_message',
    conversationId: convId,
    messageId: msgId,
    playerId: senderId,
    username: player.displayName,
    text,
    timestamp,
  };

  for (const m of members) {
    sendToPlayer(m.user_id, message);
  }
}

export async function sendGroupChatHistory(convId: string, ws: WebSocket): Promise<void> {
  const dbPool = getDb();
  const { rows } = await dbPool.query(
    `SELECT m.id, m.sender_id, m.text, m.created_at, u.display_name
     FROM chat_messages m JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC LIMIT $2`,
    [convId, GROUP_HISTORY_LIMIT],
  );
  const members = await getGroupMembers(convId);
  const memberInfos: { playerId: string; username: string; displayName: string; role: string }[] = [];
  for (const m of members) {
    const p = players.get(m.user_id);
    const u = p ? null : await getUserById(m.user_id).catch(() => null);
    memberInfos.push({
      playerId: m.user_id,
      username: p?.username ?? u?.username ?? '?',
      displayName: p?.displayName ?? u?.display_name ?? '?',
      role: m.role,
    });
  }
  ws.send(
    JSON.stringify({
      type: 'group_chat_history',
      conversationId: convId,
      messages: rows.map(
        (r: { id: string; sender_id: string; text: string; created_at: number; display_name: string }) => ({
          messageId: r.id,
          playerId: r.sender_id,
          username: r.display_name,
          text: r.text,
          timestamp: r.created_at,
        }),
      ),
      members: memberInfos,
    }),
  );
}

export async function handleAddGroupMember(convId: string, requesterId: string, targetUserId: string): Promise<void> {
  const ownerId = await getConversationOwnerId(convId);
  if (!ownerId || ownerId !== requesterId) {
    const members = await getGroupMembers(convId);
    const requesterMember = members.find((m) => m.user_id === requesterId);
    if (!requesterMember || requesterMember.role !== 'admin') {
      throw new Error('Only the owner or an admin can add members');
    }
  }
  await addGroupMember(convId, targetUserId);
  const targetPlayer = players.get(targetUserId);
  const targetUser = targetPlayer ? null : await getUserById(targetUserId).catch(() => null);
  const displayName = targetPlayer?.displayName ?? targetUser?.display_name ?? targetUserId.slice(0, 8);
  const username = targetPlayer?.username ?? targetUser?.username ?? '?';
  logger.info('Group member added: conv=' + convId + ' user=' + targetUserId);
  const members = await getGroupMembers(convId);
  for (const m of members) {
    sendToPlayer(m.user_id, {
      type: 'group_member_added',
      conversationId: convId,
      playerId: targetUserId,
      username,
      displayName,
      role: 'member',
    });
  }
}

export async function handleAddGroupMemberByName(convId: string, requesterId: string, username: string): Promise<void> {
  const targetUser = await getUserByUsername(username);
  if (!targetUser) {
    throw new Error('User not found');
  }
  return handleAddGroupMember(convId, requesterId, targetUser.id);
}

export async function handleRemoveGroupMember(
  convId: string,
  requesterId: string,
  targetUserId: string,
): Promise<void> {
  const ownerId = await getConversationOwnerId(convId);
  if (!ownerId || ownerId !== requesterId) {
    throw new Error('Only the group owner can remove members');
  }
  if (targetUserId === ownerId) {
    throw new Error('Cannot remove the group owner');
  }
  await removeGroupMember(convId, targetUserId);
  logger.info('Group member removed: conv=' + convId + ' user=' + targetUserId + ' by=' + requesterId);
  const members = await getGroupMembers(convId);
  for (const m of members) {
    sendToPlayer(m.user_id, {
      type: 'group_member_removed',
      conversationId: convId,
      playerId: targetUserId,
    });
  }
  sendToPlayer(targetUserId, {
    type: 'group_member_removed',
    conversationId: convId,
    playerId: targetUserId,
  });
}

export async function handlePromoteGroupMember(
  convId: string,
  requesterId: string,
  targetUserId: string,
): Promise<void> {
  const ownerId = await getConversationOwnerId(convId);
  if (!ownerId || ownerId !== requesterId) {
    throw new Error('Only the group owner can promote members');
  }
  await updateMemberRole(convId, targetUserId, 'admin');
  logger.info('Group member promoted: conv=' + convId + ' user=' + targetUserId);
  const members = await getGroupMembers(convId);
  for (const m of members) {
    sendToPlayer(m.user_id, {
      type: 'group_member_promoted',
      conversationId: convId,
      playerId: targetUserId,
      role: 'admin',
    });
  }
}

export async function handleDemoteGroupMember(
  convId: string,
  requesterId: string,
  targetUserId: string,
): Promise<void> {
  const ownerId = await getConversationOwnerId(convId);
  if (!ownerId || ownerId !== requesterId) {
    throw new Error('Only the group owner can demote members');
  }
  await updateMemberRole(convId, targetUserId, 'member');
  logger.info('Group member demoted: conv=' + convId + ' user=' + targetUserId);
  const members = await getGroupMembers(convId);
  for (const m of members) {
    sendToPlayer(m.user_id, {
      type: 'group_member_demoted',
      conversationId: convId,
      playerId: targetUserId,
      role: 'member',
    });
  }
}

export async function handleTransferGroupOwnership(
  convId: string,
  requesterId: string,
  targetUserId: string,
): Promise<void> {
  const ownerId = await getConversationOwnerId(convId);
  if (!ownerId || ownerId !== requesterId) {
    throw new Error('Only the group owner can transfer ownership');
  }
  await transferGroupOwnership(convId, targetUserId);
  logger.info('Group ownership transferred: conv=' + convId + ' from=' + requesterId + ' to=' + targetUserId);
  const members = await getGroupMembers(convId);
  for (const m of members) {
    sendToPlayer(m.user_id, {
      type: 'group_ownership_transferred',
      conversationId: convId,
      newOwnerId: targetUserId,
    });
  }
}

export async function handleLeaveGroup(convId: string, userId: string): Promise<void> {
  const ownerId = await getConversationOwnerId(convId);
  if (ownerId === userId) {
    throw new Error('Owner must transfer ownership or disband instead of leaving');
  }
  await removeGroupMember(convId, userId);
  logger.info('Group member left: conv=' + convId + ' user=' + userId);
  const members = await getGroupMembers(convId);
  for (const m of members) {
    sendToPlayer(m.user_id, {
      type: 'group_member_left',
      conversationId: convId,
      playerId: userId,
    });
  }
}

export async function handleDisbandGroup(convId: string, requesterId: string): Promise<void> {
  const ownerId = await getConversationOwnerId(convId);
  if (!ownerId || ownerId !== requesterId) {
    throw new Error('Only the group owner can disband the group');
  }
  const members = await getGroupMembers(convId);
  await disbandGroupConversation(convId);
  logger.info('Group disbanded: conv=' + convId + ' by=' + requesterId);
  for (const m of members) {
    if (m.user_id !== requesterId) {
      sendToPlayer(m.user_id, {
        type: 'group_disbanded',
        conversationId: convId,
      });
    }
  }
}

export function cleanupChatHistory(gameId: string): void {
  chatHistory.delete(gameId);
}

export function handleChatMessage(gameId: string, playerId: string, text: string, ws: WebSocket): void {
  if (!text) return;
  if (text.length > CHAT_MAX_LENGTH) text = text.slice(0, CHAT_MAX_LENGTH);
  const player = players.get(playerId);
  if (!player) return;
  const game = games.get(gameId);
  if (!game) return;

  const isPlayer = game.players.white === playerId || game.players.black === playerId;
  const isSpectating = spectatorConnections.get(gameId)?.has(ws);
  if (!isPlayer && !isSpectating) return;

  if (!chatHistory.has(gameId)) chatHistory.set(gameId, []);
  const displayName = player.displayName;
  const history = chatHistory.get(gameId)!;
  history.push({ playerId, username: displayName, text, timestamp: Date.now() });
  if (history.length > CHAT_HISTORY_MAX) history.shift();

  const message = {
    type: 'chat_message',
    gameId,
    playerId,
    username: displayName,
    text,
    timestamp: Date.now(),
  };

  const { white, black } = game.players;
  if (white) sendToPlayer(white, message);
  if (black) sendToPlayer(black, message);
  sendToSpectators(gameId, message);
}

export function sendChatHistory(gameId: string, ws: WebSocket): void {
  const history = chatHistory.get(gameId);
  if (!history || history.length === 0) {
    ws.send(JSON.stringify({ type: 'chat_history', gameId, messages: [] }));
    return;
  }
  ws.send(JSON.stringify({ type: 'chat_history', gameId, messages: history }));
}
