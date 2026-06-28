import { describe, test, expect, jest, beforeEach } from '@jest/globals';

const mockSaveBan = jest.fn();
const mockDeleteBanById = jest.fn();
const mockLoadAllBans = jest.fn();
const mockLoggerInfo = jest.fn();
const mockSendToPlayer = jest.fn();
const mockRemoveGameById = jest.fn();

jest.unstable_mockModule('../src/db.js', () => ({
  saveBan: mockSaveBan,
  deleteBanById: mockDeleteBanById,
  loadAllBans: mockLoadAllBans,
}));

jest.unstable_mockModule('../src/logger.js', () => ({
  default: { info: mockLoggerInfo },
}));

jest.unstable_mockModule('../src/state.js', () => ({
  bannedPlayers: new Set<string>(),
  bannedIps: new Set<string>(),
  games: new Map(),
  wsConnections: new Map(),
  playerGameIndex: new Map(),
  removeGameById: mockRemoveGameById,
  sendToPlayer: mockSendToPlayer,
}));

const bans = await import('../src/bans.js');
const state = await import('../src/state.js');
const playerModule = await import('../src/player.js');

beforeEach(() => {
  jest.clearAllMocks();
  state.bannedPlayers.clear();
  state.bannedIps.clear();
  state.games.clear();
  state.wsConnections.clear();
  state.playerGameIndex.clear();
  playerModule.players.clear();
  playerModule.playerIps.clear();
});

describe('isBanned', () => {
  test('returns true if playerId in bannedPlayers', () => {
    state.bannedPlayers.add('p1');
    expect(bans.isBanned('p1')).toBe(true);
  });

  test('returns true if ip in bannedIps', () => {
    state.bannedIps.add('1.2.3.4');
    expect(bans.isBanned('p1', '1.2.3.4')).toBe(true);
  });

  test('returns true if historically tracked IP is banned', () => {
    playerModule.playerIps.set('p1', '5.6.7.8');
    state.bannedIps.add('5.6.7.8');
    expect(bans.isBanned('p1')).toBe(true);
  });

  test('returns false for unbanned player', () => {
    expect(bans.isBanned('p1')).toBe(false);
  });
});

describe('banPlayer', () => {
  test('bans player, persists, closes WS, resigns active games', async () => {
    playerModule.players.set('p1', { id: 'p1', username: 'u1', displayName: 'U1', tokens: [], isRegistered: true });
    const mockWs = { close: jest.fn() };
    state.wsConnections.set('p1', new Set([mockWs]));
    state.playerGameIndex.set('p1', new Set(['g1']));
    state.games.set('g1', {
      id: 'g1',
      status: 'active',
      players: { white: 'p1', black: 'p2' },
      winner: null,
    } as any);
    mockSaveBan.mockResolvedValue(undefined);

    const result = await bans.banPlayer('p1');

    expect(result).toEqual({ success: true });
    expect(state.bannedPlayers.has('p1')).toBe(true);
    expect(mockSaveBan).toHaveBeenCalledWith('p1', 'p1', null);
    expect(mockWs.close).toHaveBeenCalledWith(4001, 'Banned');
    expect(state.wsConnections.has('p1')).toBe(false);
    expect(state.games.get('g1')!.status).toBe('resigned');
    expect(state.games.get('g1')!.winner).toBe('black');
    expect(mockSendToPlayer).toHaveBeenCalledWith('p2', expect.objectContaining({ reason: 'opponent_banned' }));
  });

  test('returns error for non-existent player', async () => {
    const result = await bans.banPlayer('nonexistent');
    expect(result).toEqual({ success: false, error: 'Player not found' });
  });

  test('returns error for already banned player', async () => {
    playerModule.players.set('p1', { id: 'p1', username: 'u1', displayName: 'U1', tokens: [], isRegistered: true });
    state.bannedPlayers.add('p1');
    const result = await bans.banPlayer('p1');
    expect(result).toEqual({ success: false, error: 'Player already banned' });
  });

  test('handles player with no WS connections', async () => {
    playerModule.players.set('p1', { id: 'p1', username: 'u1', displayName: 'U1', tokens: [], isRegistered: true });
    mockSaveBan.mockResolvedValue(undefined);
    const result = await bans.banPlayer('p1');
    expect(result).toEqual({ success: true });
  });

  test('handles waiting game status (calls removeGameById)', async () => {
    playerModule.players.set('p1', { id: 'p1', username: 'u1', displayName: 'U1', tokens: [], isRegistered: true });
    state.playerGameIndex.set('p1', new Set(['g1']));
    state.games.set('g1', { id: 'g1', status: 'waiting', players: { white: 'p1' } } as any);
    mockSaveBan.mockResolvedValue(undefined);
    await bans.banPlayer('p1');
    expect(mockRemoveGameById).toHaveBeenCalledWith('g1');
  });
});

describe('banIp', () => {
  test('bans IP and disconnects affected players', async () => {
    state.bannedIps.clear();
    playerModule.playerIps.set('p1', '1.2.3.4');
    const mockWs = { close: jest.fn() };
    state.wsConnections.set('p1', new Set([mockWs]));
    mockSaveBan.mockResolvedValue(undefined);

    const result = await bans.banIp('1.2.3.4');

    expect(result).toEqual({ success: true });
    expect(state.bannedIps.has('1.2.3.4')).toBe(true);
    expect(mockSaveBan).toHaveBeenCalledWith('ip:1.2.3.4', null, '1.2.3.4');
    expect(mockWs.close).toHaveBeenCalledWith(4001, 'Banned');
  });

  test('returns error for empty IP', async () => {
    const result = await bans.banIp('');
    expect(result).toEqual({ success: false, error: 'IP is required' });
  });

  test('returns error for already banned IP', async () => {
    state.bannedIps.add('1.2.3.4');
    const result = await bans.banIp('1.2.3.4');
    expect(result).toEqual({ success: false, error: 'IP already banned' });
  });
});

describe('unbanPlayer', () => {
  test('removes from set and deletes from DB', async () => {
    state.bannedPlayers.add('p1');
    mockDeleteBanById.mockResolvedValue(undefined);
    await bans.unbanPlayer('p1');
    expect(state.bannedPlayers.has('p1')).toBe(false);
    expect(mockDeleteBanById).toHaveBeenCalledWith('p1');
  });
});

describe('unbanIp', () => {
  test('removes from set and deletes from DB', async () => {
    state.bannedIps.add('1.2.3.4');
    mockDeleteBanById.mockResolvedValue(undefined);
    await bans.unbanIp('1.2.3.4');
    expect(state.bannedIps.has('1.2.3.4')).toBe(false);
    expect(mockDeleteBanById).toHaveBeenCalledWith('ip:1.2.3.4');
  });
});

describe('getBannedPlayers', () => {
  test('returns banned player IDs', () => {
    state.bannedPlayers.add('p1');
    state.bannedPlayers.add('p2');
    expect(bans.getBannedPlayers()).toEqual(['p1', 'p2']);
  });
});

describe('getBannedIps', () => {
  test('returns banned IPs', () => {
    state.bannedIps.add('1.2.3.4');
    expect(bans.getBannedIps()).toEqual(['1.2.3.4']);
  });
});

describe('loadPersistedBans', () => {
  test('loads bans from DB into memory', async () => {
    mockLoadAllBans.mockResolvedValue([
      { player_id: 'p1', ip: null },
      { player_id: null, ip: '1.2.3.4' },
    ]);
    await bans.loadPersistedBans();
    expect(state.bannedPlayers.has('p1')).toBe(true);
    expect(state.bannedIps.has('1.2.3.4')).toBe(true);
  });
});
