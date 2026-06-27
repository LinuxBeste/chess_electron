import { describe, test, expect, jest } from '@jest/globals';

delete process.env.REDIS_URL;

const mockSetex = jest.fn();
const mockGet = jest.fn();
const mockDel = jest.fn();
const mockKeys = jest.fn();
const mockRpush = jest.fn();
const mockSubscribe = jest.fn();
const mockPublish = jest.fn();

const mockRedis = jest.fn(() => ({
  setex: mockSetex,
  get: mockGet,
  del: mockDel,
  keys: mockKeys,
  lrange: jest.fn(),
  rpush: mockRpush,
  expire: jest.fn(),
  sadd: jest.fn(),
  smembers: jest.fn(),
  srem: jest.fn(),
  publish: mockPublish,
  subscribe: mockSubscribe,
  psubscribe: jest.fn(),
  unsubscribe: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
}));

jest.unstable_mockModule('ioredis', () => ({ Redis: mockRedis }));

const redis = await import('../src/redis.js');

describe('Redis (disabled — no REDIS_URL)', () => {
  test('isRedisEnabled returns false', () => {
    expect(redis.isRedisEnabled()).toBe(false);
  });

  test('initRedis logs and returns without connecting', async () => {
    await redis.initRedis();
    expect(mockRedis).not.toHaveBeenCalled();
  });

  test('saveGame is noop', async () => {
    await redis.saveGame('g1', { id: 'g1' } as any);
    expect(mockSetex).not.toHaveBeenCalled();
  });

  test('getGame returns null', async () => {
    const g = await redis.getGame('g1');
    expect(g).toBeNull();
  });

  test('deleteGame is noop', async () => {
    await redis.deleteGame('g1');
    expect(mockDel).not.toHaveBeenCalled();
  });

  test('getAllGameIds returns empty array', async () => {
    const ids = await redis.getAllGameIds();
    expect(ids).toEqual([]);
  });

  test('getAllGames returns empty map', async () => {
    const map = await redis.getAllGames();
    expect(map.size).toBe(0);
  });

  test('UCI functions return defaults', async () => {
    expect(await redis.getUciHistory('g1')).toEqual([]);
    await redis.pushUciMove('g1', 'e2e4');
    expect(mockRpush).not.toHaveBeenCalled();
    await redis.deleteUciHistory('g1');
    expect(mockDel).not.toHaveBeenCalled();
  });

  test('player index functions return defaults', async () => {
    expect(await redis.getPlayerGames('p1')).toEqual([]);
  });

  test('draw/rematch offers return null', async () => {
    expect(await redis.getDrawOffer('g1')).toBeNull();
    expect(await redis.getRematchOffer('g1')).toBeNull();
  });

  test('chat history returns empty', async () => {
    expect(await redis.getChatHistory('g1')).toEqual([]);
  });

  test('completed-at returns null', async () => {
    expect(await redis.getGameCompletedAt('g1')).toBeNull();
    expect(await redis.getAllCompletedGameIds()).toEqual([]);
  });

  test('subscribe/publish are noops', () => {
    redis.subscribe('ch');
    redis.publish('ch', 'msg');
    expect(mockSubscribe).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  test('closeRedis is noop', async () => {
    await redis.closeRedis();
  });

  test('subscribeToGame is noop', () => {
    redis.subscribeToGame('g1');
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  test('publishGameEvent is noop', () => {
    redis.publishGameEvent('g1', 'event', {});
    expect(mockPublish).not.toHaveBeenCalled();
  });

  test('setMessageHandler registers but never fires', () => {
    const handler = jest.fn();
    redis.setMessageHandler(handler);
    expect(handler).not.toHaveBeenCalled();
  });
});
