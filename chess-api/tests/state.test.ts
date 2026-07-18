import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import type { GameState } from '../src/types.js';

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
const mockSetTakebackOffer = jest.fn().mockResolvedValue(undefined);
const mockDeleteTakebackOffer = jest.fn().mockResolvedValue(undefined);
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
  setTakebackOffer: mockSetTakebackOffer,
  deleteTakebackOffer: mockDeleteTakebackOffer,
  setRematchOffer: mockSetRematchOffer,
  deleteRematchOffer: mockDeleteRematchOffer,
  addChatMessage: mockAddChatMessage,
  setGameCompletedAt: mockSetGameCompletedAt,
  getAllGames: mockGetAllGames,
  publish: mockPublish,
}));

const state = await import('../src/state.js');

interface MockWs {
  readyState: number;
  send: jest.Mock;
}

function makeGame(id: string, white?: string, black?: string): Partial<GameState> {
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

    test('multiple rapid calls do not throw', () => {
      mockIsRedisEnabled.mockReturnValue(true);
      const g = makeGame('g1');
      state.games.set('g1', g);
      expect(() => {
        state.persistGame('g1');
        state.persistGame('g1');
        state.persistGame('g1');
      }).not.toThrow();
      expect(mockSaveGame).toHaveBeenCalledTimes(3);
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

  describe('syncGamesFromRedis edge cases', () => {
    test('handles empty result from getAllGames', async () => {
      mockIsRedisEnabled.mockReturnValue(true);
      mockGetAllGames.mockResolvedValue(new Map());
      await state.syncGamesFromRedis();
      expect(state.games.size).toBe(0);
    });

    test('handles getAllGames throwing', async () => {
      mockIsRedisEnabled.mockReturnValue(true);
      mockGetAllGames.mockRejectedValue(new Error('Redis connection failed'));
      /* Should not throw — catch inside syncGamesFromRedis handles it */
      await expect(state.syncGamesFromRedis()).resolves.toBeUndefined();
      expect(state.games.size).toBe(0);
    });

    test('handles non-iterable return from getAllGames', async () => {
      mockIsRedisEnabled.mockReturnValue(true);
      mockGetAllGames.mockResolvedValue(undefined);
      /* Should not throw — undefined is not iterable but caught by try/catch */
      await expect(state.syncGamesFromRedis()).resolves.toBeUndefined();
    });
  });

  describe('Redis reconnection', () => {
    test('persistGame works after simulated disconnect-reconnect', () => {
      /* Simulate Redis connected: save works */
      mockIsRedisEnabled.mockReturnValue(true);
      mockSaveGame.mockResolvedValue(undefined);
      const g = makeGame('g_recon');
      state.games.set('g_recon', g);
      state.persistGame('g_recon');
      expect(mockSaveGame).toHaveBeenCalledWith('g_recon', g);

      /* Simulate disconnect: saveGame throws */
      mockSaveGame.mockRejectedValue(new Error('Redis connection lost'));
      g.status = 'active';
      state.persistGame('g_recon');
      /* Should not throw — persistGame catches Redis errors */

      /* Simulate reconnect: save works again */
      mockSaveGame.mockResolvedValue(undefined);
      g.status = 'checkmate';
      state.persistGame('g_recon');
      expect(mockSaveGame).toHaveBeenCalledWith('g_recon', g);
    });

    test('syncGamesFromRedis works after simulated disconnect-reconnect', async () => {
      /* Simulate Redis connected: sync works */
      mockIsRedisEnabled.mockReturnValue(true);
      const remote = new Map([['g1', makeGame('g1')]]);
      mockGetAllGames.mockResolvedValue(remote);
      await state.syncGamesFromRedis();
      expect(state.games.size).toBe(1);

      /* Simulate disconnect: sync catches error */
      mockGetAllGames.mockRejectedValue(new Error('Connection lost'));
      state.games.clear();
      await state.syncGamesFromRedis();
      expect(state.games.size).toBe(0);
      /* In-memory state preserved (games was already cleared by test) */

      /* Simulate reconnect: sync works again */
      const remote2 = new Map([['g2', makeGame('g2')]]);
      mockGetAllGames.mockResolvedValue(remote2);
      await state.syncGamesFromRedis();
      expect(state.games.size).toBe(1);
      expect(state.games.has('g2')).toBe(true);
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

    test('setTakebackOfferEntry writes to memory and Redis', () => {
      mockIsRedisEnabled.mockReturnValue(true);
      state.setTakebackOfferEntry('g1', 'p1');
      expect(state.takebackOffers.get('g1')).toBe('p1');
      expect(mockSetTakebackOffer).toHaveBeenCalledWith('g1', 'p1');
    });

    test('deleteTakebackOfferEntry removes from both', () => {
      mockIsRedisEnabled.mockReturnValue(true);
      state.takebackOffers.set('g1', 'p1');
      state.deleteTakebackOfferEntry('g1');
      expect(state.takebackOffers.has('g1')).toBe(false);
      expect(mockDeleteTakebackOffer).toHaveBeenCalledWith('g1');
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
      const mockWs: MockWs = { readyState: 1, send: jest.fn() };
      const mockWs2: MockWs = { readyState: 1, send: jest.fn() };
      state.wsConnections.set('p1', new Set([mockWs, mockWs2]));
      state.sendToPlayerRaw('p1', 'hello');
      expect(mockWs.send).toHaveBeenCalledWith('hello');
      expect(mockWs2.send).toHaveBeenCalledWith('hello');
    });

    test('sendToPlayerRaw skips closed connections', () => {
      const mockOpen: MockWs = { readyState: 1, send: jest.fn() };
      const mockClosed: MockWs = { readyState: 3, send: jest.fn() };
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
      const mockWs: MockWs = { readyState: 1, send: jest.fn() };
      state.sendToPlayerRaw('nobody', 'data');
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    test('sendToPlayer wraps JSON', () => {
      const mockWs: MockWs = { readyState: 1, send: jest.fn() };
      state.wsConnections.set('p1', new Set([mockWs]));
      state.sendToPlayer('p1', { type: 'test', payload: 42 });
      expect(mockWs.send).toHaveBeenCalledWith('{"type":"test","payload":42}');
    });

    test('sendToSpectators sends string data to spectators', () => {
      const mockWs: MockWs = { readyState: 1, send: jest.fn() };
      state.spectatorConnections.set('g1', new Set([mockWs]));
      state.sendToSpectators('g1', '{"type":"move"}');
      expect(mockWs.send).toHaveBeenCalledWith('{"type":"move"}');
    });

    test('sendToSpectators JSON-stringifies object data', () => {
      const mockWs: MockWs = { readyState: 1, send: jest.fn() };
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
