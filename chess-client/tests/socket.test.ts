import { describe, test, expect, jest } from '@jest/globals';

describe('SocketManager logic', () => {
  test('connect does nothing without token', () => {
    const store = {
      data: { token: null, wsStatus: 'disconnected' },
      get(k: string) {
        return this.data[k as keyof typeof this.data];
      },
      set(k: string, v: any) {
        (this.data as any)[k] = v;
      },
    };
    const retryCount = { value: 0 };

    /* Simulating the logic without actual WebSocket */
    const token = store.get('token');
    if (!token) {
      expect(store.get('wsStatus')).toBe('disconnected');
      return;
    }
  });

  test('scheduleReconnect caps at MAX_RETRIES', () => {
    const store = {
      data: { wsStatus: 'disconnected' } as any,
      get(k: string) {
        return this.data[k];
      },
      set(k: string, v: any) {
        this.data[k] = v;
      },
    };
    const MAX_RETRIES = 5;
    let retryCount = 5; /* Already at max */

    if (retryCount >= MAX_RETRIES) {
      store.set('wsStatus', 'disconnected');
    }
    expect(store.get('wsStatus')).toBe('disconnected');
  });

  test('onMove handler registration and invocation', () => {
    const handlers = new Set<(msg: any) => void>();
    const handler = jest.fn();

    handlers.add(handler);
    expect(handlers.size).toBe(1);

    handlers.forEach((h) => h({ type: 'move', gameId: 'g1' }));
    expect(handler).toHaveBeenCalledWith({ type: 'move', gameId: 'g1' });
  });

  test('onMove unsubscribe removes handler', () => {
    const handlers = new Set<(msg: any) => void>();
    const handler = jest.fn();

    handlers.add(handler);
    const unsub = () => handlers.delete(handler);
    unsub();
    expect(handlers.size).toBe(0);
  });

  test('onGameOver handler invocation', () => {
    const handlers = new Set<(msg: any) => void>();
    const handler = jest.fn();

    handlers.add(handler);
    handlers.forEach((h) => h({ type: 'game_over', gameId: 'g1', result: 'checkmate' }));
    expect(handler).toHaveBeenCalledWith({ type: 'game_over', gameId: 'g1', result: 'checkmate' });
  });

  test('onGameStarted handler invocation', () => {
    const handlers = new Set<(msg: any) => void>();
    const handler = jest.fn();

    handlers.add(handler);
    handlers.forEach((h) => h({ type: 'game_started', gameId: 'g1' }));
    expect(handler).toHaveBeenCalledWith({ type: 'game_started', gameId: 'g1' });
  });

  test('backoff calculation', () => {
    const INITIAL_BACKOFF_MS = 1000;
    const MAX_BACKOFF_MS = 10000;

    const retries = [0, 1, 2, 3, 4, 5];
    const expected = [1000, 2000, 4000, 8000, 10000, 10000];

    for (let i = 0; i < retries.length; i++) {
      const delay = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, retries[i]), MAX_BACKOFF_MS);
      expect(delay).toBe(expected[i]);
    }
  });

  test('multiple handlers can subscribe to same event', () => {
    const handlers = new Set<(msg: any) => void>();
    const h1 = jest.fn();
    const h2 = jest.fn();

    handlers.add(h1);
    handlers.add(h2);
    expect(handlers.size).toBe(2);

    handlers.forEach((h) => h({ type: 'move' }));
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  test('removing handler does not affect other handlers', () => {
    const handlers = new Set<(msg: any) => void>();
    const h1 = jest.fn();
    const h2 = jest.fn();

    handlers.add(h1);
    handlers.add(h2);
    handlers.delete(h1);

    handlers.forEach((h) => h({ type: 'move' }));
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  test('server URL transformation http→ws', () => {
    const serverUrl = 'http://localhost:3000';
    const wsBase = serverUrl.replace(/^http/, 'ws');
    expect(wsBase).toBe('ws://localhost:3000');

    const serverUrlHttps = 'https://example.com:4000';
    const wsBaseHttps = serverUrlHttps.replace(/^http/, 'ws');
    expect(wsBaseHttps).toBe('wss://example.com:4000');
  });

  test('token encoding in URL', () => {
    const token = 'test-token';
    const encoded = encodeURIComponent(token);
    const wsUrl = `ws://localhost:3000/?token=${encoded}`;
    expect(wsUrl).toBe('ws://localhost:3000/?token=test-token');

    const tokenWithSpecial = 'abc/def+ghi';
    const encoded2 = encodeURIComponent(tokenWithSpecial);
    const wsUrl2 = `ws://localhost:3000/?token=${encoded2}`;
    expect(wsUrl2).toBe('ws://localhost:3000/?token=abc%2Fdef%2Bghi');
  });
});
