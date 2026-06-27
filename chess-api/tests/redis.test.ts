import { describe, test, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';

const mockSetex = jest.fn();
const mockGet = jest.fn();
const mockDel = jest.fn();
const mockKeys = jest.fn();
const mockPipelineGet = jest.fn();
const mockPipeline = jest.fn(() => ({ get: mockPipelineGet, exec: mockPipelineExec }));
const mockLrange = jest.fn();
const mockRpush = jest.fn();
const mockExpire = jest.fn();
const mockSadd = jest.fn();
const mockSmembers = jest.fn();
const mockSrem = jest.fn();
const mockPublish = jest.fn();
const mockSubscribe = jest.fn();
const mockPsubscribe = jest.fn();
const mockUnsubscribe = jest.fn();
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
const mockOn = jest.fn();
const mockPipelineExec = jest.fn().mockResolvedValue([]);

const mockRedis = jest.fn(() => ({
  setex: mockSetex,
  get: mockGet,
  del: mockDel,
  keys: mockKeys,
  pipeline: mockPipeline,
  lrange: mockLrange,
  rpush: mockRpush,
  expire: mockExpire,
  sadd: mockSadd,
  smembers: mockSmembers,
  srem: mockSrem,
  publish: mockPublish,
  subscribe: mockSubscribe,
  psubscribe: mockPsubscribe,
  unsubscribe: mockUnsubscribe,
  connect: mockConnect,
  disconnect: mockDisconnect,
  on: mockOn,
}));

jest.unstable_mockModule('ioredis', () => ({ Redis: mockRedis }));

process.env.REDIS_URL = 'redis://localhost:6379';

const redis = await import('../src/redis.js');

describe('Redis (enabled)', () => {
  beforeAll(async () => {
    mockOn.mockImplementation((_event: string, _handler: unknown) => undefined);
    mockConnect.mockResolvedValue(undefined);
    mockDisconnect.mockResolvedValue(undefined);
    mockUnsubscribe.mockResolvedValue(undefined);
    mockSetex.mockResolvedValue('OK');
    mockGet.mockResolvedValue(null);
    mockDel.mockResolvedValue(1);
    mockKeys.mockResolvedValue([]);

    mockLrange.mockResolvedValue([]);
    mockRpush.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);
    mockSadd.mockResolvedValue(1);
    mockSmembers.mockResolvedValue([]);
    mockSrem.mockResolvedValue(1);
    mockPublish.mockResolvedValue(0);
    mockSubscribe.mockResolvedValue(undefined);
    mockPsubscribe.mockResolvedValue(undefined);
    await redis.initRedis();
  });

  afterAll(async () => {
    await redis.closeRedis();
    delete process.env.REDIS_URL;
  });

  describe('init and primitives', () => {
    test('isRedisEnabled returns true', () => {
      expect(redis.isRedisEnabled()).toBe(true);
    });

    test('initRedis created pub/sub clients', () => {
      expect(mockConnect).toHaveBeenCalled();
      expect(mockOn).toHaveBeenCalled();
    });

    test('subscribe calls subClient.subscribe', () => {
      redis.subscribe('test-channel');
      expect(mockSubscribe).toHaveBeenCalledWith('test-channel');
    });

    test('psubscribe calls subClient.psubscribe', () => {
      redis.psubscribe('test:*');
      expect(mockPsubscribe).toHaveBeenCalledWith('test:*');
    });

    test('subscribeToGame subscribes to game: channel', () => {
      redis.subscribeToGame('game-1');
      expect(mockSubscribe).toHaveBeenCalledWith('game:game-1');
    });

    test('publish sends to channel', () => {
      redis.publish('chan', 'msg');
      expect(mockPublish).toHaveBeenCalledWith('chan', 'msg');
    });

    test('publishGameEvent sends JSON to game: channel', () => {
      redis.publishGameEvent('g1', 'move', { from: 'e2', to: 'e4' });
      const call = mockPublish.mock.calls[mockPublish.mock.calls.length - 1];
      expect(call[0]).toBe('game:g1');
      const parsed = JSON.parse(call[1]);
      expect(parsed.event).toBe('move');
      expect(parsed.data.from).toBe('e2');
    });

    test('setMessageHandler registers handler and fires on message', () => {
      const handler = jest.fn();
      redis.setMessageHandler(handler);
      const messageCbs = mockOn.mock.calls.filter((c: unknown[]) => c[0] === 'message');
      expect(messageCbs.length).toBeGreaterThanOrEqual(1);
      messageCbs[0][1]('ch', 'hello');
      expect(handler).toHaveBeenCalledWith('ch', 'hello');
    });

    test('setMessageHandler fires pmessage', () => {
      const handler = jest.fn();
      redis.setMessageHandler(handler);
      const pmessageCbs = mockOn.mock.calls.filter((c: unknown[]) => c[0] === 'pmessage');
      expect(pmessageCbs.length).toBeGreaterThanOrEqual(1);
      pmessageCbs[0][1]('p', 'ch', 'hello');
      expect(handler).toHaveBeenCalledWith('ch', 'hello');
    });
  });

  describe('CRUD operations', () => {
    beforeEach(() => {
      mockSetex.mockClear();
      mockGet.mockClear();
      mockDel.mockClear();
      mockKeys.mockClear();
      mockLrange.mockClear();
      mockRpush.mockClear();
      mockExpire.mockClear();
      mockSadd.mockClear();
      mockSmembers.mockClear();
      mockSrem.mockClear();
      /* Restore defaults */
      mockGet.mockResolvedValue(null);
      mockKeys.mockResolvedValue([]);
      mockLrange.mockResolvedValue([]);
      mockSmembers.mockResolvedValue([]);
      mockPipelineExec.mockResolvedValue([]);
    });

    test('saveGame calls setex with TTL', async () => {
      const game = { id: 'g1', status: 'active' } as any;
      await redis.saveGame('g1', game);
      expect(mockSetex).toHaveBeenCalled();
      const call = mockSetex.mock.calls[mockSetex.mock.calls.length - 1];
      expect(call[0]).toBe('game:g1');
      expect(typeof call[1]).toBe('number');
      expect(JSON.parse(call[2]).id).toBe('g1');
    });

    test('getGame returns parsed game', async () => {
      mockGet.mockResolvedValue(JSON.stringify({ id: 'g1', status: 'active' }));
      const g = await redis.getGame('g1');
      expect(g).toEqual({ id: 'g1', status: 'active' });
    });

    test('getGame returns null when missing', async () => {
      const g = await redis.getGame('nonexistent');
      expect(g).toBeNull();
    });

    test('deleteGame calls del', async () => {
      await redis.deleteGame('g1');
      expect(mockDel).toHaveBeenCalledWith('game:g1');
    });

    test('getAllGameIds returns ids without prefix', async () => {
      mockKeys.mockResolvedValue(['game:a', 'game:b']);
      const ids = await redis.getAllGameIds();
      expect(ids).toEqual(['a', 'b']);
    });

    test('getAllGames returns a map via pipeline', async () => {
      mockKeys.mockResolvedValue(['game:g1', 'game:g2']);
      const results: [Error | null, string | null][] = [
        [null, JSON.stringify({ id: 'g1', status: 'active' })],
        [null, JSON.stringify({ id: 'g2', status: 'waiting' })],
      ];
      mockPipelineExec.mockResolvedValue(results);
      const ids = await redis.getAllGameIds();
      expect(ids).toEqual(['g1', 'g2']);
      const map = await redis.getAllGames();
      expect(map.size).toBe(2);
      expect(map.get('g1')?.status).toBe('active');
    });

    test('getAllGames returns empty map when no keys', async () => {
      const map = await redis.getAllGames();
      expect(map.size).toBe(0);
    });

    test('UCI history functions', async () => {
      mockLrange.mockResolvedValue(['e2e4', 'e7e5']);
      const history = await redis.getUciHistory('g1');
      expect(history).toEqual(['e2e4', 'e7e5']);

      await redis.pushUciMove('g1', 'g1f3');
      expect(mockRpush).toHaveBeenCalledWith('uci:g1', 'g1f3');
      expect(mockExpire).toHaveBeenCalledWith('uci:g1', expect.any(Number));

      await redis.deleteUciHistory('g1');
      expect(mockDel).toHaveBeenCalledWith('uci:g1');
    });

    test('player game index functions', async () => {
      await redis.addPlayerGame('p1', 'g1');
      expect(mockSadd).toHaveBeenCalledWith('playerGames:p1', 'g1');

      mockSmembers.mockResolvedValue(['g1', 'g2']);
      const games = await redis.getPlayerGames('p1');
      expect(games).toEqual(['g1', 'g2']);

      await redis.removePlayerGame('p1', 'g1');
      expect(mockSrem).toHaveBeenCalledWith('playerGames:p1', 'g1');
    });

    test('draw offer functions', async () => {
      await redis.setDrawOffer('g1', 'p1');
      expect(mockSetex).toHaveBeenCalledWith('draw:g1', 300, 'p1');

      mockGet.mockResolvedValue('p1');
      const offer = await redis.getDrawOffer('g1');
      expect(offer).toBe('p1');

      await redis.deleteDrawOffer('g1');
      expect(mockDel).toHaveBeenCalledWith('draw:g1');
    });

    test('rematch offer functions', async () => {
      await redis.setRematchOffer('g1', 'p1');
      expect(mockSetex).toHaveBeenCalledWith('rematch:g1', 300, 'p1');

      mockGet.mockResolvedValue('p1');
      const offer = await redis.getRematchOffer('g1');
      expect(offer).toBe('p1');

      await redis.deleteRematchOffer('g1');
      expect(mockDel).toHaveBeenCalledWith('rematch:g1');
    });

    test('chat message functions', async () => {
      const msg = { playerId: 'p1', username: 'bob', text: 'hello', timestamp: 1000 };
      await redis.addChatMessage('g1', msg);
      expect(mockRpush).toHaveBeenCalledWith('chat:g1', JSON.stringify(msg));
      expect(mockExpire).toHaveBeenCalledWith('chat:g1', expect.any(Number));

      mockLrange.mockResolvedValue([JSON.stringify(msg)]);
      const chat = await redis.getChatHistory('g1');
      expect(chat).toEqual([msg]);

      await redis.deleteChatHistory('g1');
      expect(mockDel).toHaveBeenCalledWith('chat:g1');
    });

    test('completed-at functions', async () => {
      await redis.setGameCompletedAt('g1');
      expect(mockSetex).toHaveBeenCalledWith('completed:g1', 300, expect.any(String));

      mockGet.mockResolvedValue('1234567890');
      const ts = await redis.getGameCompletedAt('g1');
      expect(ts).toBe(1234567890);

      mockKeys.mockResolvedValue(['completed:g1', 'completed:g2']);
      const ids = await redis.getAllCompletedGameIds();
      expect(ids).toEqual(['g1', 'g2']);

      await redis.deleteGameCompletedAt('g1');
      expect(mockDel).toHaveBeenCalledWith('completed:g1');
    });

    test('closeRedis disconnects clients', async () => {
      await redis.closeRedis();
      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});
