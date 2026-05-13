import { describe, test, expect, jest } from '@jest/globals';

class Store {
  private state: Record<string, any> = {
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

  get(key: string): any {
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
    const current = this.get('toasts');
    this.set('toasts', [...current, msg]);
    setTimeout(() => {
      const cur = this.get('toasts');
      this.set('toasts', cur.filter((t: any) => t.id !== id));
    }, 4000);
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
    expect(store.get('toasts')).toHaveLength(1);
    expect(store.get('toasts')[0].text).toBe('Error!');
    expect(store.get('toasts')[0].type).toBe('error');

    jest.advanceTimersByTime(4000);
    expect(store.get('toasts')).toHaveLength(0);
    jest.useRealTimers();
  });

  test('toast with info type', () => {
    const store = new Store();
    store.toast('Info message', 'info');
    expect(store.get('toasts')[0].type).toBe('info');
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
