import type { GameState, ViewName, WsStatus, ToastMessage } from '../types';

interface StateMap {
  token: string | null;
  playerId: string | null;
  username: string | null;
  currentGame: GameState | null;
  wsStatus: WsStatus;
  toasts: ToastMessage[];
  currentView: ViewName;
}

/* Typed observable store. subscribe/get/set are key-constrained to StateMap keys. */
class Store {
  private state: StateMap = {
    token: null,
    playerId: null,
    username: null,
    currentGame: null,
    wsStatus: 'disconnected',
    toasts: [],
    currentView: 'login',
  };

  /* Listeners stored by key string; cast internally since the map is heterogenous */
  private listeners = new Map<string, Set<(value: unknown) => void>>();

  private toastIdCounter = 0;

  subscribe<K extends keyof StateMap>(key: K, handler: (value: StateMap[K]) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    (this.listeners.get(key) as Set<(value: StateMap[K]) => void>).add(handler);
    return () => {
      (this.listeners.get(key) as Set<(value: StateMap[K]) => void>).delete(handler);
    };
  }

  get<K extends keyof StateMap>(key: K): StateMap[K] {
    return this.state[key];
  }

  set<K extends keyof StateMap>(key: K, value: StateMap[K]): void {
    this.state[key] = value;
    const handlers = this.listeners.get(key);
    if (handlers) {
      for (const h of handlers) {
        (h as (value: StateMap[K]) => void)(value);
      }
    }
  }

  /* Auto-dismiss toast after 4s; tracks by incrementing ID for removal */
  toast(text: string, type: 'error' | 'info' = 'error'): void {
    const id = ++this.toastIdCounter;
    const msg: ToastMessage = { text, type, id };
    const current = this.get('toasts');
    this.set('toasts', [...current, msg]);
    setTimeout(() => {
      const cur = this.get('toasts');
      this.set('toasts', cur.filter(t => t.id !== id));
    }, 4000);
  }
}

export const store = new Store();
