import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { store as realStore } from '../src/renderer/store';

class Store {
  private state: Record<string, unknown> = {
    token: null,
    playerId: null,
    username: null,
    currentGame: null,
    wsStatus: 'disconnected',
    toasts: [],
    currentView: 'login',
  };

  private listeners = new Map<string, Set<(value: unknown) => void>>();
  private toastIdCounter = 0;

  subscribe(key: string, handler: (value: unknown) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(handler);
    return () => {
      this.listeners.get(key)!.delete(handler);
    };
  }

  get(key: string): unknown {
    return this.state[key];
  }

  set(key: string, value: unknown): void {
    this.state[key] = value;
    const handlers = this.listeners.get(key);
    if (handlers) {
      for (const h of handlers) {
        h(value);
      }
    }
  }

  toast(text: string, type: 'error' | 'info' = 'error'): void {
    const id = ++this.toastIdCounter;
    const msg = { text, type, id };
    const current = this.get('toasts') as Array<{ text: string; type: string; id: number }>;
    this.set('toasts', [...current, msg]);
    setTimeout(() => {
      const cur = this.get('toasts');
      this.set(
        'toasts',
        (cur as Array<{ text: string; type: string; id: number }>).filter((t) => t.id !== id),
      );
    }, 4000);
  }

  persistSession(): void {
    const token = this.get('token');
    const playerId = this.get('playerId');
    const username = this.get('username');
    if (token && playerId && username) {
      localStorage.setItem('chess_session', JSON.stringify({ token, playerId, username }));
    }
  }

  restoreSession(): { token: string; playerId: string; username: string } | null {
    try {
      const raw = localStorage.getItem('chess_session');
      return raw ? (JSON.parse(raw) as { token: string; playerId: string; username: string }) : null;
    } catch {
      return null;
    }
  }

  clearSession(): void {
    localStorage.removeItem('chess_session');
  }
}

describe('Store', () => {
  test('get returns default values', () => {
    const store = new Store();
    expect(store.get('token')).toBeNull();
    expect(store.get('playerId')).toBeNull();
    expect(store.get('currentView')).toBe('login');
    expect(store.get('wsStatus')).toBe('disconnected');
    expect(store.get('toasts')).toEqual([]);
  });

  test('set updates value and notifies subscribers', () => {
    const store = new Store();
    const handler = jest.fn();
    store.subscribe('token', handler);
    store.set('token', 'abc123');
    expect(store.get('token')).toBe('abc123');
    expect(handler).toHaveBeenCalledWith('abc123');
  });

  test('set does not notify subscribers of different keys', () => {
    const store = new Store();
    const handler = jest.fn();
    store.subscribe('token', handler);
    store.set('playerId', 'p1');
    expect(handler).not.toHaveBeenCalled();
  });

  test('subscribe returns unsubscribe function', () => {
    const store = new Store();
    const handler = jest.fn();
    const unsub = store.subscribe('token', handler);
    unsub();
    store.set('token', 'xyz');
    expect(handler).not.toHaveBeenCalled();
  });

  test('toast adds message and auto-removes after timeout', () => {
    jest.useFakeTimers();
    const store = new Store();
    store.toast('Error!', 'error');
    const toasts1 = store.get('toasts') as Array<{ text: string; type: string; id: number }>;
    expect(toasts1).toHaveLength(1);
    expect(toasts1[0].text).toBe('Error!');
    expect(toasts1[0].type).toBe('error');

    jest.advanceTimersByTime(4000);
    expect(store.get('toasts')).toHaveLength(0);
    jest.useRealTimers();
  });

  test('toast with info type', () => {
    jest.useFakeTimers();
    const store = new Store();
    store.toast('Info message', 'info');
    const toasts = store.get('toasts') as Array<{ text: string; type: string; id: number }>;
    expect(toasts[0].type).toBe('info');
    jest.useRealTimers();
  });

  test('multiple toasts accumulate', () => {
    jest.useFakeTimers();
    const store = new Store();
    store.toast('First');
    store.toast('Second');
    expect(store.get('toasts')).toHaveLength(2);
    jest.useRealTimers();
  });

  test('set triggers subscriber with correct value type', () => {
    const store = new Store();
    const handler = jest.fn();
    store.subscribe('wsStatus', handler);
    store.set('wsStatus', 'connected');
    expect(handler).toHaveBeenCalledWith('connected');
  });
});

describe('session persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('persistSession saves token, playerId, username', () => {
    const store = new Store();
    store.set('token', 'tok_123');
    store.set('playerId', 'p1');
    store.set('username', 'Alice');
    store.persistSession();
    const raw = localStorage.getItem('chess_session');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.token).toBe('tok_123');
    expect(parsed.playerId).toBe('p1');
    expect(parsed.username).toBe('Alice');
  });

  test('persistSession overwrites previous session', () => {
    const store = new Store();
    store.set('token', 'tok_old');
    store.set('playerId', 'p_old');
    store.set('username', 'Old');
    store.persistSession();
    store.set('token', 'tok_new');
    store.set('playerId', 'p_new');
    store.set('username', 'New');
    store.persistSession();
    const raw = localStorage.getItem('chess_session');
    const parsed = JSON.parse(raw!);
    expect(parsed.token).toBe('tok_new');
    expect(parsed.username).toBe('New');
  });

  test('restoreSession returns null when no session saved', () => {
    const store = new Store();
    const result = store.restoreSession();
    expect(result).toBeNull();
  });

  test('restoreSession returns saved session data', () => {
    const store = new Store();
    store.set('token', 'tok_abc');
    store.set('playerId', 'p99');
    store.set('username', 'Bob');
    store.persistSession();
    const session = store.restoreSession();
    expect(session).not.toBeNull();
    expect(session!.token).toBe('tok_abc');
    expect(session!.playerId).toBe('p99');
    expect(session!.username).toBe('Bob');
  });

  test('restoreSession handles corrupted JSON gracefully', () => {
    localStorage.setItem('chess_session', 'corrupted');
    const store = new Store();
    const result = store.restoreSession();
    expect(result).toBeNull();
  });

  test('clearSession removes saved session data', () => {
    const store = new Store();
    store.set('token', 'tok_xyz');
    store.set('playerId', 'p7');
    store.set('username', 'Charlie');
    store.persistSession();
    store.clearSession();
    const result = store.restoreSession();
    expect(result).toBeNull();
  });

  test('restoreSession returns correct types', () => {
    const store = new Store();
    store.set('token', 'tok_abc');
    store.set('playerId', 'p99');
    store.set('username', 'Bob');
    store.persistSession();
    const session = store.restoreSession();
    expect(typeof session!.token).toBe('string');
    expect(typeof session!.playerId).toBe('string');
    expect(typeof session!.username).toBe('string');
  });
});

describe('real store — offline field', () => {
  beforeEach(() => {
    realStore.set('offline', false);
    realStore.set('token', null);
    realStore.set('playerId', null);
    realStore.set('username', null);
  });

  test('offline defaults to false', () => {
    expect(realStore.get('offline')).toBe(false);
  });

  test('can set offline to true and get it back', () => {
    realStore.set('offline', true);
    expect(realStore.get('offline')).toBe(true);
  });

  test('can toggle offline back and forth', () => {
    realStore.set('offline', true);
    expect(realStore.get('offline')).toBe(true);
    realStore.set('offline', false);
    expect(realStore.get('offline')).toBe(false);
    realStore.set('offline', true);
    expect(realStore.get('offline')).toBe(true);
  });

  test('subscribes to offline changes', () => {
    const handler = jest.fn();
    realStore.subscribe('offline', handler);
    realStore.set('offline', true);
    expect(handler).toHaveBeenCalledWith(true);
  });

  test('unsubscribe from offline stops notifications', () => {
    const handler = jest.fn();
    const unsub = realStore.subscribe('offline', handler);
    unsub();
    realStore.set('offline', true);
    expect(handler).not.toHaveBeenCalled();
  });

  test('setting offline does not trigger token subscribers', () => {
    const handler = jest.fn();
    realStore.subscribe('token', handler);
    realStore.set('offline', true);
    expect(handler).not.toHaveBeenCalled();
  });

  test('offline is independent of token', () => {
    realStore.set('offline', true);
    realStore.set('token', 'abc');
    expect(realStore.get('offline')).toBe(true);
    realStore.set('token', null);
    expect(realStore.get('offline')).toBe(true);
  });

  test('username can be set without token when offline', () => {
    realStore.set('offline', true);
    realStore.set('username', 'OfflinePlayer');
    expect(realStore.get('username')).toBe('OfflinePlayer');
    expect(realStore.get('token')).toBeNull();
  });
});
