import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { WebSocket } from 'ws';
import type { GameState } from '../src/types.js';

const mockQuery = jest.fn();
const mockGetDb = jest.fn(() => ({ query: mockQuery }));
const mockCreateGroupConversation = jest.fn();
const mockGetGroupMembers = jest.fn();
const mockGetConversationOwnerId = jest.fn();
const mockAddGroupMember = jest.fn();
const mockRemoveGroupMember = jest.fn();
const mockUpdateMemberRole = jest.fn();
const mockTransferGroupOwnership = jest.fn();
const mockDisbandGroupConversation = jest.fn();
const mockGetUserById = jest.fn().mockResolvedValue(null);
const mockGetUserByUsername = jest.fn();
const mockLoggerInfo = jest.fn();
const mockSendToPlayer = jest.fn();
const mockSendToSpectators = jest.fn();

jest.unstable_mockModule('../src/db.js', () => ({
  getDb: mockGetDb,
  createGroupConversation: mockCreateGroupConversation,
  getGroupMembers: mockGetGroupMembers,
  getConversationOwnerId: mockGetConversationOwnerId,
  addGroupMember: mockAddGroupMember,
  removeGroupMember: mockRemoveGroupMember,
  updateMemberRole: mockUpdateMemberRole,
  transferGroupOwnership: mockTransferGroupOwnership,
  disbandGroupConversation: mockDisbandGroupConversation,
  getUserById: mockGetUserById,
  getUserByUsername: mockGetUserByUsername,
}));

jest.unstable_mockModule('../src/logger.js', () => ({
  default: { info: mockLoggerInfo },
}));

const mockChatHistory = new Map();
const mockGames = new Map();
const mockSpectatorConnections = new Map();
const mockWsConnections = new Map();

jest.unstable_mockModule('../src/state.js', () => ({
  chatHistory: mockChatHistory,
  games: mockGames,
  spectatorConnections: mockSpectatorConnections,
  wsConnections: mockWsConnections,
  sendToPlayer: mockSendToPlayer,
  sendToSpectators: mockSendToSpectators,
}));

const chat = await import('../src/chat.js');
const playerModule = await import('../src/player.js');

beforeEach(() => {
  jest.clearAllMocks();
  mockChatHistory.clear();
  mockGames.clear();
  mockSpectatorConnections.clear();
  mockWsConnections.clear();
  playerModule.players.clear();
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [] });
});

/* ─── Lobby ─── */

describe('ensureLobbyConversation', () => {
  test('creates lobby if not exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await chat.ensureLobbyConversation();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO chat_conversations'),
      expect.arrayContaining(['lobby']),
    );
  });

  test('skips if lobby exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'lobby' }] });
    await chat.ensureLobbyConversation();
    const insertCalls = mockQuery.mock.calls.filter((c: unknown[]) => String(c[0]).includes('INSERT'));
    expect(insertCalls).toHaveLength(0);
  });
});

describe('handleLobbyChat', () => {
  test('broadcasts lobby message to all WS connections', async () => {
    playerModule.players.set('p1', { id: 'p1', username: 'u1', displayName: 'U1', tokens: [], isRegistered: true });
    const ws1 = { readyState: WebSocket.OPEN, send: jest.fn() };
    const ws2 = { readyState: WebSocket.OPEN, send: jest.fn() };
    mockWsConnections.set('other', new Set([ws1]));
    mockWsConnections.set('p1', new Set([ws2]));
    mockQuery.mockResolvedValue({ rows: [] });

    await chat.handleLobbyChat('p1', 'Hello lobby!');

    expect(ws1.send).toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalled();
    const sent = JSON.parse(ws1.send.mock.calls[0][0]);
    expect(sent.type).toBe('lobby_chat_message');
    expect(sent.text).toBe('Hello lobby!');
  });

  test('does nothing for empty text', async () => {
    await chat.handleLobbyChat('p1', '');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('truncates long text', async () => {
    playerModule.players.set('p1', { id: 'p1', username: 'u1', displayName: 'U1', tokens: [], isRegistered: true });
    mockQuery.mockResolvedValue({ rows: [] });
    await chat.handleLobbyChat('p1', 'a'.repeat(600));
    const insertCalls = mockQuery.mock.calls.filter((c: unknown[]) =>
      String(c[0]).includes('INSERT INTO chat_messages'),
    );
    expect(insertCalls[0][1][3].length).toBe(500);
  });

  test('does nothing for unknown player', async () => {
    await chat.handleLobbyChat('unknown', 'Hello');
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('sendLobbyChatHistory', () => {
  test('sends formatted history to WS', async () => {
    const ws = { send: jest.fn() };
    mockQuery.mockResolvedValue({
      rows: [{ id: 'm1', sender_id: 'p1', text: 'Hi', created_at: 1000, display_name: 'U1' }],
    });
    await chat.sendLobbyChatHistory(ws as unknown as WebSocket);
    const data = JSON.parse(ws.send.mock.calls[0][0]);
    expect(data.type).toBe('lobby_chat_history');
    expect(data.messages).toHaveLength(1);
  });
});

/* ─── Private Chat ─── */

describe('getOrCreatePrivateConversation', () => {
  test('creates new private conversation', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const convId = await chat.getOrCreatePrivateConversation('p1', 'p2');
    expect(convId).toMatch(/^priv_/);
  });

  test('returns existing conversation', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'priv_p1_p2' }] });
    const convId = await chat.getOrCreatePrivateConversation('p1', 'p2');
    expect(convId).toBe('priv_p1_p2');
  });
});

describe('handlePrivateChat', () => {
  test('sends to both sender and target', async () => {
    playerModule.players.set('p1', { id: 'p1', username: 'u1', displayName: 'U1', tokens: [], isRegistered: true });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await chat.handlePrivateChat('p1', 'p2', 'Hey there!');

    expect(mockSendToPlayer).toHaveBeenCalledTimes(2);
    expect(mockSendToPlayer).toHaveBeenCalledWith('p1', expect.objectContaining({ text: 'Hey there!' }));
    expect(mockSendToPlayer).toHaveBeenCalledWith('p2', expect.objectContaining({ text: 'Hey there!' }));
  });
});

/* ─── Group Chat ─── */

describe('handleCreateGroupConversation', () => {
  test('creates group with default name when empty', async () => {
    mockCreateGroupConversation.mockResolvedValue('conv1');
    const id = await chat.handleCreateGroupConversation('p1', '');
    expect(id).toBe('conv1');
    expect(mockCreateGroupConversation).toHaveBeenCalledWith('p1', 'Group Chat');
  });

  test('truncates long name', async () => {
    mockCreateGroupConversation.mockResolvedValue('conv1');
    await chat.handleCreateGroupConversation('p1', 'a'.repeat(100));
    expect(mockCreateGroupConversation.mock.calls[0][1].length).toBe(50);
  });
});

describe('handleGroupChat', () => {
  test('sends message to all group members', async () => {
    playerModule.players.set('p1', { id: 'p1', username: 'u1', displayName: 'U1', tokens: [], isRegistered: true });
    mockGetGroupMembers.mockResolvedValue([
      { user_id: 'p1', role: 'owner' },
      { user_id: 'p2', role: 'member' },
    ]);
    mockQuery.mockResolvedValue({ rows: [] });
    await chat.handleGroupChat('conv1', 'p1', 'Hello group!');
    expect(mockSendToPlayer).toHaveBeenCalledTimes(2);
    expect(mockSendToPlayer).toHaveBeenCalledWith('p2', expect.objectContaining({ text: 'Hello group!' }));
  });

  test('does nothing for non-member', async () => {
    playerModule.players.set('p3', { id: 'p3', username: 'u3', displayName: 'U3', tokens: [], isRegistered: true });
    mockGetGroupMembers.mockResolvedValue([{ user_id: 'p1', role: 'owner' }]);
    await chat.handleGroupChat('conv1', 'p3', 'Hello?');
    expect(mockSendToPlayer).not.toHaveBeenCalled();
  });
});

/* ─── Group Member Management ─── */

describe('handleAddGroupMember', () => {
  test('owner can add members', async () => {
    mockGetConversationOwnerId.mockResolvedValue('p1');
    mockGetGroupMembers.mockResolvedValue([{ user_id: 'p1', role: 'owner' }]);
    mockAddGroupMember.mockResolvedValue(undefined);
    await chat.handleAddGroupMember('conv1', 'p1', 'p2');
    expect(mockAddGroupMember).toHaveBeenCalledWith('conv1', 'p2');
  });

  test('admin can add members', async () => {
    mockGetConversationOwnerId.mockResolvedValue('p1');
    mockGetGroupMembers.mockResolvedValue([
      { user_id: 'p1', role: 'owner' },
      { user_id: 'admin1', role: 'admin' },
    ]);
    mockAddGroupMember.mockResolvedValue(undefined);
    await chat.handleAddGroupMember('conv1', 'admin1', 'p3');
    expect(mockAddGroupMember).toHaveBeenCalledWith('conv1', 'p3');
  });

  test('non-admin non-owner throws', async () => {
    mockGetConversationOwnerId.mockResolvedValue('p1');
    mockGetGroupMembers.mockResolvedValue([
      { user_id: 'p1', role: 'owner' },
      { user_id: 'member1', role: 'member' },
    ]);
    await expect(chat.handleAddGroupMember('conv1', 'member1', 'p3')).rejects.toThrow('add members');
  });
});

describe('handleAddGroupMemberByName', () => {
  test('resolves username and delegates', async () => {
    mockGetUserByUsername.mockResolvedValue({ id: 'p2' });
    mockGetConversationOwnerId.mockResolvedValue('p1');
    mockGetGroupMembers.mockResolvedValue([{ user_id: 'p1', role: 'owner' }]);
    mockAddGroupMember.mockResolvedValue(undefined);
    await chat.handleAddGroupMemberByName('conv1', 'p1', 'targetuser');
    expect(mockAddGroupMember).toHaveBeenCalledWith('conv1', 'p2');
  });

  test('throws if user not found', async () => {
    mockGetUserByUsername.mockResolvedValue(null);
    await expect(chat.handleAddGroupMemberByName('conv1', 'p1', 'unknown')).rejects.toThrow('User not found');
  });
});

describe('handleRemoveGroupMember', () => {
  test('owner can remove member', async () => {
    mockGetConversationOwnerId.mockResolvedValue('p1');
    mockGetGroupMembers.mockResolvedValue([{ user_id: 'p1', role: 'owner' }]);
    mockRemoveGroupMember.mockResolvedValue(undefined);
    await chat.handleRemoveGroupMember('conv1', 'p1', 'p2');
    expect(mockRemoveGroupMember).toHaveBeenCalledWith('conv1', 'p2');
  });

  test('non-owner throws', async () => {
    mockGetConversationOwnerId.mockResolvedValue('p1');
    await expect(chat.handleRemoveGroupMember('conv1', 'p2', 'p3')).rejects.toThrow('group owner');
  });

  test('cannot remove owner', async () => {
    mockGetConversationOwnerId.mockResolvedValue('p1');
    await expect(chat.handleRemoveGroupMember('conv1', 'p1', 'p1')).rejects.toThrow('Cannot remove the group owner');
  });
});

describe('handlePromoteGroupMember', () => {
  test('owner can promote', async () => {
    mockGetConversationOwnerId.mockResolvedValue('p1');
    mockGetGroupMembers.mockResolvedValue([{ user_id: 'p1', role: 'owner' }]);
    mockUpdateMemberRole.mockResolvedValue(undefined);
    await chat.handlePromoteGroupMember('conv1', 'p1', 'p2');
    expect(mockUpdateMemberRole).toHaveBeenCalledWith('conv1', 'p2', 'admin');
  });

  test('non-owner throws', async () => {
    mockGetConversationOwnerId.mockResolvedValue('p1');
    await expect(chat.handlePromoteGroupMember('conv1', 'p2', 'p3')).rejects.toThrow('group owner');
  });
});

describe('handleDemoteGroupMember', () => {
  test('owner can demote', async () => {
    mockGetConversationOwnerId.mockResolvedValue('p1');
    mockGetGroupMembers.mockResolvedValue([{ user_id: 'p1', role: 'owner' }]);
    mockUpdateMemberRole.mockResolvedValue(undefined);
    await chat.handleDemoteGroupMember('conv1', 'p1', 'p2');
    expect(mockUpdateMemberRole).toHaveBeenCalledWith('conv1', 'p2', 'member');
  });
});

describe('handleTransferGroupOwnership', () => {
  test('owner can transfer', async () => {
    mockGetConversationOwnerId.mockResolvedValue('p1');
    mockGetGroupMembers.mockResolvedValue([{ user_id: 'p1', role: 'owner' }]);
    mockTransferGroupOwnership.mockResolvedValue(undefined);
    await chat.handleTransferGroupOwnership('conv1', 'p1', 'p2');
    expect(mockTransferGroupOwnership).toHaveBeenCalledWith('conv1', 'p2');
  });
});

describe('handleLeaveGroup', () => {
  test('member can leave', async () => {
    mockGetConversationOwnerId.mockResolvedValue('p1');
    mockGetGroupMembers.mockResolvedValue([{ user_id: 'p2', role: 'member' }]);
    mockRemoveGroupMember.mockResolvedValue(undefined);
    await chat.handleLeaveGroup('conv1', 'p2');
    expect(mockRemoveGroupMember).toHaveBeenCalledWith('conv1', 'p2');
  });

  test('owner cannot leave', async () => {
    mockGetConversationOwnerId.mockResolvedValue('p1');
    await expect(chat.handleLeaveGroup('conv1', 'p1')).rejects.toThrow('transfer ownership');
  });
});

describe('handleDisbandGroup', () => {
  test('owner can disband', async () => {
    mockGetConversationOwnerId.mockResolvedValue('p1');
    mockGetGroupMembers.mockResolvedValue([
      { user_id: 'p1', role: 'owner' },
      { user_id: 'p2', role: 'member' },
    ]);
    mockDisbandGroupConversation.mockResolvedValue(undefined);
    await chat.handleDisbandGroup('conv1', 'p1');
    expect(mockDisbandGroupConversation).toHaveBeenCalledWith('conv1');
    expect(mockSendToPlayer).toHaveBeenCalledWith('p2', expect.objectContaining({ type: 'group_disbanded' }));
  });

  test('non-owner throws', async () => {
    mockGetConversationOwnerId.mockResolvedValue('p1');
    await expect(chat.handleDisbandGroup('conv1', 'p2')).rejects.toThrow('group owner');
  });
});

/* ─── Game Chat ─── */

describe('handleChatMessage', () => {
  test('sends to both players and spectators', () => {
    playerModule.players.set('p1', { id: 'p1', username: 'u1', displayName: 'U1', tokens: [], isRegistered: true });
    mockGames.set('g1', { id: 'g1', players: { white: 'p1', black: 'p2' } } as Partial<GameState> as GameState);
    const ws = {} as WebSocket;
    mockSpectatorConnections.set('g1', new Set([ws]));

    chat.handleChatMessage('g1', 'p1', 'Hello game!', ws);

    expect(mockSendToPlayer).toHaveBeenCalledWith('p1', expect.objectContaining({ text: 'Hello game!' }));
    expect(mockSendToPlayer).toHaveBeenCalledWith('p2', expect.objectContaining({ text: 'Hello game!' }));
    expect(mockSendToSpectators).toHaveBeenCalledWith('g1', expect.objectContaining({ text: 'Hello game!' }));
  });

  test('does nothing for empty text', () => {
    const ws = {} as WebSocket;
    chat.handleChatMessage('g1', 'p1', '', ws);
    expect(mockSendToPlayer).not.toHaveBeenCalled();
  });

  test('does nothing for unknown player', () => {
    const ws = {} as WebSocket;
    mockGames.set('g1', { id: 'g1', players: { white: 'p1', black: 'p2' } } as Partial<GameState> as GameState);
    chat.handleChatMessage('g1', 'unknown', 'Hello', ws);
    expect(mockSendToPlayer).not.toHaveBeenCalled();
  });

  test('does nothing for non-player non-spectator', () => {
    playerModule.players.set('p3', { id: 'p3', username: 'u3', displayName: 'U3', tokens: [], isRegistered: true });
    mockGames.set('g1', { id: 'g1', players: { white: 'p1', black: 'p2' } } as Partial<GameState> as GameState);
    const ws = {} as WebSocket;
    chat.handleChatMessage('g1', 'p3', 'Hello', ws);
    expect(mockSendToPlayer).not.toHaveBeenCalled();
  });

  test('limits history to 50 messages', () => {
    playerModule.players.set('p1', { id: 'p1', username: 'u1', displayName: 'U1', tokens: [], isRegistered: true });
    mockGames.set('g1', { id: 'g1', players: { white: 'p1', black: 'p2' } } as Partial<GameState> as GameState);
    const ws = {} as WebSocket;
    mockSpectatorConnections.set('g1', new Set([ws]));

    for (let i = 0; i < 55; i++) {
      chat.handleChatMessage('g1', 'p1', `msg ${i}`, ws);
    }

    const history = mockChatHistory.get('g1');
    expect(history).toHaveLength(50);
    expect(history![0].text).toBe('msg 5');
  });
});

describe('sendChatHistory', () => {
  test('sends empty array when no history', () => {
    const ws = { send: jest.fn() };
    chat.sendChatHistory('g1', ws as unknown as WebSocket);
    const data = JSON.parse(ws.send.mock.calls[0][0]);
    expect(data.messages).toEqual([]);
  });

  test('sends stored history', () => {
    mockChatHistory.set('g1', [{ playerId: 'p1', username: 'U1', text: 'Hi', timestamp: 1000 }]);
    const ws = { send: jest.fn() };
    chat.sendChatHistory('g1', ws as unknown as WebSocket);
    const data = JSON.parse(ws.send.mock.calls[0][0]);
    expect(data.messages).toHaveLength(1);
  });
});

describe('cleanupChatHistory', () => {
  test('removes from map', () => {
    mockChatHistory.set('g1', []);
    chat.cleanupChatHistory('g1');
    expect(mockChatHistory.has('g1')).toBe(false);
  });
});
