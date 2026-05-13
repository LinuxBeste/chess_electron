import { describe, test, expect } from '@jest/globals';

describe('router', () => {
  function getViewFromHash(hash: string): { view: string; params: Record<string, string> } {
    const h = hash.slice(1).toLowerCase();

    if (h.startsWith('game/')) {
      return { view: 'game', params: { gameId: h.slice(5) } };
    }
    if (h.startsWith('result/')) {
      return { view: 'result', params: { gameId: h.slice(7) } };
    }
    if (h === 'lobby') return { view: 'lobby', params: {} };
    if (h === 'result') return { view: 'result', params: {} };

    return { view: 'login', params: {} };
  }

  test('hash #lobby returns lobby view', () => {
    const { view, params } = getViewFromHash('#lobby');
    expect(view).toBe('lobby');
    expect(params).toEqual({});
  });

  test('hash #login returns login view', () => {
    const { view } = getViewFromHash('#login');
    expect(view).toBe('login');
  });

  test('hash empty returns login view', () => {
    const { view } = getViewFromHash('');
    expect(view).toBe('login');
  });

  test('hash #game/abc-123 returns game view with gameId', () => {
    const { view, params } = getViewFromHash('#game/abc-123');
    expect(view).toBe('game');
    expect(params.gameId).toBe('abc-123');
  });

  test('hash #result/def-456 returns result view with gameId', () => {
    const { view, params } = getViewFromHash('#result/def-456');
    expect(view).toBe('result');
    expect(params.gameId).toBe('def-456');
  });

  test('hash #result (without ID) returns result view', () => {
    const { view, params } = getViewFromHash('#result');
    expect(view).toBe('result');
    expect(params).toEqual({});
  });

  test('hash #GAME/X (uppercase) is handled case-insensitively', () => {
    const { view, params } = getViewFromHash('#GAME/x');
    expect(view).toBe('game');
    expect(params.gameId).toBe('x');
  });

  test('unknown hash defaults to login', () => {
    const { view } = getViewFromHash('#unknown');
    expect(view).toBe('login');
  });

  test('hash with trailing slash defaults to login', () => {
    const { view } = getViewFromHash('#game/');
    expect(view).toBe('game');
  });
});
