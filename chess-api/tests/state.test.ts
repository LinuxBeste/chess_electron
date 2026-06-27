import { describe, test, expect, jest, beforeEach } from '@jest/globals';

const mockIsRedisEnabled = jest.fn();
const mockSaveGame = jest.fn().mockResolvedValue(undefined);
const mockPublishGameEvent = jest.fn();
const mockDeleteGame = jest.fn().mockResolvedValue(undefined);
const mockDeleteChatHistory = jest.fn().mockResolvedValue(undefined);
const mockDeleteGameCompletedAt = jest.fn().mockResolvedValue(undefined);
const mockDeleteUciHistory = jest.fn().mockResolvedValue(undefined);
const mockAddPlayerGame = jest.fn().mockResolvedValue(undefined);
const mockSetDrawOffer = jest.fn().mockResolvedValue(undefined);
const mockDeleteDrawOffer = jest.fn().mockResolvedValue(undefined);
const mockSetRematchOffer = jest.fn().mockResolvedValue(undefined);
const mockDeleteRematchOffer = jest.fn().mockResolvedValue(undefined);
const mockAddChatMessage = jest.fn().mockResolvedValue(undefined);
const mockSetGameCompletedAt = jest.fn().mockResolvedValue(undefined);
const mockGetAllGames = jest.fn().mockResolvedValue(undefined);
const mockPublish = jest.fn();

jest.unstable_mockModule('../src/redis.js', () => ({
  isRedisEnabled: mockIsRedisEnabled,
  saveGame: mockSaveGame,
  publishGameEvent: mockPublishGameEvent,
  deleteGame: mockDeleteGame,
  deleteChatHistory: mockDeleteChatHistory,
  deleteGameCompletedAt: mockDeleteGameCompletedAt,
  deleteUciHistory: mockDeleteUciHistory,
  addPlayerGame: mockAddPlayerGame,
  setDrawOffer: mockSetDrawOffer,
  deleteDrawOffer: mockDeleteDrawOffer,
  setRematchOffer: mockSetRematchOffer,
  deleteRematchOffer: mockDeleteRematchOffer,
  addChatMessage: mockAddChatMessage,
  setGameCompletedAt: mockSetGameCompletedAt,
  getAllGames: mockGetAllGames,
  publish: mockPublish,
}));

const state = await import('../src/state.js');

function makeGame(id: string, white?: string, black?: string): any {
  return {
    id,
    players: { white: white || 'w' + id, black: black || 'b' + id },
    status: 'active',
    board: [],
    turn: 'white',
    moveHistory: [],
    boardHistory: [],
    enPassantTarget: null,
    castlingRights: { white: { kingside: true, queenside: true }, black: { kingside: true, queenside: true } },
    lastMove: null,
    winner: null,
    createdAt: Date.now(),
    visibility: 'public',
    spectateMode: 'public',
    halfMoveClock: 0,
  };
}

describe('state.ts', () => {
  beforeEach(() => {
    state.games.clear();
    state.uciHistory.clear();
    state.wsConnections.clear();
    state.spectatorConnections.clear();
    state.playerGameIndex.clear();
    state.drawOffers.clear();
    state.rematchOffers.clear();
    state.chatHistory.clear();
    state.gameCompletedAt.clear();
    jest.clearAllMocks();
  });

  describe('persistGame', () => {
    test('saves game to Redis when enabled', () => {
      mockIsRedisEnabled.mockReturnValue(true);
      const g = makeGame('g1');
      state.games.set('g1', g);
      state.persistGame('g1');
      expect(mockSaveGame).toHaveBeenCalledWith('g1', g);
    });

    test('does nothing when Redis disabled', () => {
      mockIsRedisEnabled.mockReturnValue(false);
      const g = makeGame('g1');
      state.games.set('g1', g);
      state.persistGame('g1');
      expect(mockSaveGame).not.toHaveBeenCalled();
    });

    test('does nothing when game not in map', () => {
      mockIsRedisEnabled.mockReturnValue(true);
      state.persistGame('nonexistent');
      expect(mockSaveGame).not.toHaveBeenCalled();
    });
  });

  describe('persistGameAndPublish', () => {
    test('saves and publishes when Redis enabled', () => {
      mockIsRedisEnabled.mockReturnValue(true);
      state.games.set('g1', makeGame('g1'));
      state.persistGameAndPublish('g1');
      expect(mockSaveGame).toHaveBeenCalled();
      expect(mockPublishGameEvent).toHaveBeenCalledWith('g1', 'game_updated', {});
    });

    test('noop when Redis disabled', () => {
      mockIsRedisEnabled.mockReturnValue(false);
      state.games.set('g1', makeGame('g1'));
      state.persistGameAndPublish('g1');
      expect(mockSaveGame).not.toHaveBeenCalled();
      expect(mockPublishGameEvent).not.toHaveBeenCalled();
    });

    test('noop when game missing', () => {
      mockIsRedisEnabled.mockReturnValue(true);
      state.persistGameAndPublish('g1');
      expect(mockSaveGame).not.toHaveBeenCalled();
      expect(mockPublishGameEvent).not.toHaveBeenCalled();
    });
  });

  describe('removeGameById', () => {
    test('removes from maps and Redis when enabled', () => {
      mockIsRedisEnabled.mockReturnValue(true);
      state.games.set('g1', makeGame('g1'));
      state.chatHistory.set('g1', []);
      state.gameCompletedAt.set('g1', 100);
      state.removeGameById('g1');
      expect(state.games.has('g1')).toBe(false);
      expect(state.chatHistory.has('g1')).toBe(false);
      expect(state.gameCompletedAt.has('g1')).toBe(false);
      expect(mockDeleteGame).toHaveBeenCalledWith('g1');
      expect(mockDeleteChatHistory).toHaveBeenCalledWith('g1');
      expect(mockDeleteGameCompletedAt).toHaveBeenCalledWith('g1');
      expect(mockDeleteUciHistory).toHaveBeenCalledWith('g1');
    });

    test('removes from maps only when Redis disabled', () => {
      mockIsRedisEnabled.mockReturnValue(false);
      state.games.set('g1', makeGame('g1'));
      state.removeGameById('g1');
      expect(state.games.has('g1')).toBe(false);
      expect(mockDeleteGame).not.toHaveBeenCalled();
    });
  });

  describe('syncGamesFromRedis', () => {
    test('loads games into memory when Redis enabled', async () => {
      mockIsRedisEnabled.mockReturnValue(true);
      const remote = new Map([
        ['g1', makeGame('g1')],
        ['g2', makeGame('g2')],
      ]);
      mockGetAllGames.mockResolvedValue(remote);
      await state.syncGamesFromRedis();
      expect(state.games.size).toBe(2);
    });

    test('does nothing when Redis disabled', async () => {
      mockIsRedisEnabled.mockReturnValue(false);
      await state.syncGamesFromRedis();
      expect(state.games.size).toBe(0);
    });
  });

  describe('syncPlayerIndexFromRedis', () => {
    test('builds player index from loaded games', async () => {
      mockIsRedisEnabled.mockReturnValue(true);
      state.games.set('g1', makeGame('g1', 'p1', 'p2'));
      state.games.set('g2', makeGame('g2', 'p1', 'p3'));
      await state.syncPlayerIndexFromRedis();
      expect(state.playerGameIndex.get('p1')).toEqual(new Set(['g1', 'g2']));
      expect(state.playerGameIndex.get('p2')).toEqual(new Set(['g1']));
      expect(state.playerGameIndex.get('p3')).toEqual(new Set(['g2']));
    });
  });

  describe('addPlayerGameIndex', () => {
    test('adds to in-memory index and Redis when enabled', () => {
      mockIsRedisEnabled.mockReturnValue(true);
      state.addPlayerGameIndex('p1', 'g1');
      expect(state.playerGameIndex.get('p1')).toEqual(new Set(['g1']));
      expect(mockAddPlayerGame).toHaveBeenCalledWith('p1', 'g1');
    });

    test('skips Redis when disabled', () => {
      mockIsRedisEnabled.mockReturnValue(false);
      state.addPlayerGameIndex('p1', 'g1');
      expect(state.playerGameIndex.get('p1')).toEqual(new Set(['g1']));
      expect(mockAddPlayerGame).not.toHaveBeenCalled();
    });

    test('appends to existing set', () => {
      state.playerGameIndex.set('p1', new Set(['g1']));
      state.addPlayerGameIndex('p1', 'g2');
      expect(state.playerGameIndex.get('p1')).toEqual(new Set(['g1', 'g2']));
    });
  });

  describe('draw/rematch offers', () => {
    test('setDrawOfferEntry writes to memory and Redis', () => {
      mockIsRedisEnabled.mockReturnValue(true);
      state.setDrawOfferEntry('g1', 'p1');
      expect(state.drawOffers.get('g1')).toBe('p1');
      expect(mockSetDrawOffer).toHaveBeenCalledWith('g1', 'p1');
    });

    test('deleteDrawOfferEntry removes from both', () => {
      mockIsRedisEnabled.mockReturnValue(true);
      state.drawOffers.set('g1', 'p1');
      state.deleteDrawOfferEntry('g1');
      expect(state.drawOffers.has('g1')).toBe(false);
      expect(mockDeleteDrawOffer).toHaveBeenCalledWith('g1');
    });

    test('setRematchOfferEntry writes to memory and Redis', () => {
      mockIsRedisEnabled.mockReturnValue(true);
      state.setRematchOfferEntry('g1', 'p1');
      expect(state.rematchOffers.get('g1')).toBe('p1');
      expect(mockSetRematchOffer).toHaveBeenCalledWith('g1', 'p1');
    });

    test('deleteRematchOfferEntry removes from both', () => {
      mockIsRedisEnabled.mockReturnValue(true);
      state.rematchOffers.set('g1', 'p1');
      state.deleteRematchOfferEntry('g1');
      expect(state.rematchOffers.has('g1')).toBe(false);
      expect(mockDeleteRematchOffer).toHaveBeenCalledWith('g1');
    });
  });

  describe('chat', () => {
    test('addChatMessageEntry appends to memory and Redis', () => {
      mockIsRedisEnabled.mockReturnValue(true);
      const msg = { playerId: 'p1', username: 'bob', text: 'hi', timestamp: 1 };
      state.addChatMessageEntry('g1', msg);
      expect(state.chatHistory.get('g1')).toEqual([msg]);
      expect(mockAddChatMessage).toHaveBeenCalledWith('g1', msg);
    });

    test('addChatMessageEntry creates array if not exist', () => {
      state.addChatMessageEntry('g1', { playerId: 'p1', username: 'bob', text: 'hi', timestamp: 1 });
      expect(state.chatHistory.get('g1')?.length).toBe(1);
    });
  });

  describe('gameCompletedAt', () => {
    test('setGameCompletedAtEntry writes to memory and Redis', () => {
      mockIsRedisEnabled.mockReturnValue(true);
      state.setGameCompletedAtEntry('g1');
      expect(state.gameCompletedAt.has('g1')).toBe(true);
      expect(mockSetGameCompletedAt).toHaveBeenCalledWith('g1');
    });
  });

  describe('sweep timer', () => {
    test('get/setSweepTimer', () => {
      expect(state.getSweepTimer()).toBeNull();
      const timer = setTimeout(() => {}, 1000);
      state.setSweepTimer(timer);
      expect(state.getSweepTimer()).toBe(timer);
      clearTimeout(timer);
      state.setSweepTimer(null);
    });
  });

  describe('WS messaging', () => {
    test('sendToPlayerRaw sends to connected players', () => {
      const mockWs = { readyState: 1, send: jest.fn() } as any;
      const mockWs2 = { readyState: 1, send: jest.fn() } as any;
      state.wsConnections.set('p1', new Set([mockWs, mockWs2]));
      state.sendToPlayerRaw('p1', 'hello');
      expect(mockWs.send).toHaveBeenCalledWith('hello');
      expect(mockWs2.send).toHaveBeenCalledWith('hello');
    });

    test('sendToPlayerRaw skips closed connections', () => {
      const mockOpen = { readyState: 1, send: jest.fn() } as any;
      const mockClosed = { readyState: 3, send: jest.fn() } as any;
      state.wsConnections.set('p1', new Set([mockOpen, mockClosed]));
      state.sendToPlayerRaw('p1', 'data');
      expect(mockOpen.send).toHaveBeenCalled();
      expect(mockClosed.send).not.toHaveBeenCalled();
    });

    test('sendToPlayerRaw publishes to Redis when enabled', () => {
      mockIsRedisEnabled.mockReturnValue(true);
      state.sendToPlayerRaw('p1', 'data');
      expect(mockPublish).toHaveBeenCalledWith('player:p1', expect.stringContaining('ws_message'));
    });

    test('sendToPlayerRaw noop when no connections', () => {
      const mockWs = { readyState: 1, send: jest.fn() } as any;
      state.sendToPlayerRaw('nobody', 'data');
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    test('sendToPlayer wraps JSON', () => {
      const mockWs = { readyState: 1, send: jest.fn() } as any;
      state.wsConnections.set('p1', new Set([mockWs]));
      state.sendToPlayer('p1', { type: 'test', payload: 42 });
      expect(mockWs.send).toHaveBeenCalledWith('{"type":"test","payload":42}');
    });

    test('sendToSpectators sends string data to spectators', () => {
      const mockWs = { readyState: 1, send: jest.fn() } as any;
      state.spectatorConnections.set('g1', new Set([mockWs]));
      state.sendToSpectators('g1', '{"type":"move"}');
      expect(mockWs.send).toHaveBeenCalledWith('{"type":"move"}');
    });

    test('sendToSpectators JSON-stringifies object data', () => {
      const mockWs = { readyState: 1, send: jest.fn() } as any;
      state.spectatorConnections.set('g1', new Set([mockWs]));
      state.sendToSpectators('g1', { type: 'move', from: 'e2' });
      expect(mockWs.send).toHaveBeenCalledWith('{"type":"move","from":"e2"}');
    });

    test('sendToSpectators publishes to Redis when enabled', () => {
      mockIsRedisEnabled.mockReturnValue(true);
      state.sendToSpectators('g1', 'data');
      expect(mockPublish).toHaveBeenCalledWith('spectate:g1', expect.stringContaining('ws_message'));
    });

    test('sendToSpectators skips send when no spectators', () => {
      mockIsRedisEnabled.mockReturnValue(false);
      state.sendToSpectators('nogame', 'data');
      expect(mockPublish).not.toHaveBeenCalled();
    });
  });
});
