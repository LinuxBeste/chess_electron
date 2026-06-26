/**
 * Lightweight observable store for shared application state.
 *
 * Unlike useState (component-local) or a full state-management library,
 * this store lets any module subscribe to specific keys and get notified
 * on changes — used for cross-cutting concerns like auth tokens, the
 * current game, WebSocket status, and toast messages.
 *
 * Session persistence is handled automatically when token/playerId/username
 * are updated.
 */

import logger from './logger';
import type {
  GameState,
  ViewName,
  WsStatus,
  ToastMessage,
  FriendInfo,
  FriendRequestInfo,
  ConversationInfo,
} from '../types';

interface StateMap {
  token: string | null;
  playerId: string | null;
  username: string | null;
  avatarUrl: string | null;
  isRegistered: boolean;
  currentGame: GameState | null;
  currentGameId: string | null;
  wsStatus: WsStatus;
  toasts: ToastMessage[];
  currentView: ViewName;
  offline: boolean;
  friends: FriendInfo[];
  incomingRequests: FriendRequestInfo[];
  outgoingRequests: FriendRequestInfo[];
  sidebarOpen: boolean;
  sidebarMinimized: boolean;
  sidebarPosition: 'left' | 'right';
  sidebarTab: 'play' | 'chat' | 'friends';
  conversations: ConversationInfo[];
  unreadCount: number;
}

/* Typed observable store. subscribe/get/set are key-constrained to StateMap keys. */
class Store {
  private state: StateMap = {
    token: null,
    playerId: null,
    username: null,
    avatarUrl: null,
    isRegistered: false,
    currentGame: null,
    currentGameId: null,
    wsStatus: 'disconnected',
    toasts: [],
    currentView: 'login',
    offline: false,
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    sidebarOpen: false,
    sidebarMinimized: false,
    sidebarPosition: 'right',
    sidebarTab: 'chat',
    conversations: [],
    unreadCount: 0,
  };

  // Listeners by key string (heterogeneous callback types, cast internally)
  private listeners = new Map<string, Set<(value: unknown) => void>>();

  private toastIdCounter = 0; // incrementing ID lets us remove the right toast

  // Subscribe returns an unsubscribe function — callers must clean up on unmount
  subscribe<K extends keyof StateMap>(key: K, handler: (value: StateMap[K]) => void): () => void {
    logger.info(`subscribe: ${key}`);
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
    logger.info(`set: ${key}`);
    this.state[key] = value;
    const handlers = this.listeners.get(key);
    if (handlers) {
      for (const h of handlers) {
        (h as (value: StateMap[K]) => void)(value);
      }
    }
    if (key === 'currentGame') {
      const game = value as GameState | null;
      this.state.currentGameId = game?.id ?? null;
    }
    if (
      key === 'token' ||
      key === 'playerId' ||
      key === 'username' ||
      key === 'avatarUrl' ||
      key === 'isRegistered' ||
      key === 'currentGame'
    ) {
      this.persistSession();
    }
    if (key === 'sidebarOpen' || key === 'sidebarMinimized' || key === 'sidebarPosition') {
      const open = key === 'sidebarOpen' ? (value as boolean) : this.state.sidebarOpen;
      const minimized = key === 'sidebarMinimized' ? (value as boolean) : this.state.sidebarMinimized;
      const pos = key === 'sidebarPosition' ? (value as 'left' | 'right') : this.state.sidebarPosition;
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 900;
      let width: string;
      if (!open) {
        width = '0px';
      } else if (minimized) {
        width = '48px';
      } else if (isMobile) {
        width = '0px';
      } else {
        width = 'clamp(320px, 30vw, 420px)';
      }
      if (pos === 'right') {
        document.documentElement.style.setProperty('--sidebar-push-right', width);
        document.documentElement.style.setProperty('--sidebar-push-left', '0px');
      } else {
        document.documentElement.style.setProperty('--sidebar-push-left', width);
        document.documentElement.style.setProperty('--sidebar-push-right', '0px');
      }
    }
  }

  /* Auto-dismiss toast after 4s; tracks by incrementing ID for removal */
  toast(text: string, type: 'error' | 'info' = 'error'): void {
    logger.info(`toast: [${type}] ${text}`);
    const id = ++this.toastIdCounter;
    const msg: ToastMessage = { text, type, id };
    const current = this.get('toasts');
    this.set('toasts', [...current, msg]);
    setTimeout(() => {
      const cur = this.get('toasts');
      this.set(
        'toasts',
        cur.filter((t) => t.id !== id),
      );
    }, 4000);
  }

  // Auto-save auth/state to localStorage so reload doesn't lose session
  persistSession(): void {
    logger.info('session persisted');
    const token = this.get('token');
    const playerId = this.get('playerId');
    const username = this.get('username');
    const avatarUrl = this.get('avatarUrl');
    const isRegistered = this.get('isRegistered');
    const currentGame = this.get('currentGame');
    const currentGameId = currentGame?.id ?? null;
    if (token && playerId && username) {
      localStorage.setItem(
        'chess_session',
        JSON.stringify({ token, playerId, username, avatarUrl, isRegistered, currentGameId }),
      );
    }
  }

  /* Restore session from localStorage */
  restoreSession(): {
    token: string;
    playerId: string;
    username: string;
    avatarUrl: string | null;
    isRegistered: boolean;
    currentGameId: string | null;
  } | null {
    const raw = localStorage.getItem('chess_session');
    if (!raw) {
      logger.info('session not found');
      return null;
    }
    try {
      logger.info('session restored');
      const parsed = JSON.parse(raw);
      return { ...parsed, currentGameId: parsed.currentGameId ?? null };
    } catch {
      localStorage.removeItem('chess_session'); // corrupted data → discard
      return null;
    }
  }

  clearSession(): void {
    logger.info('session cleared');
    localStorage.removeItem('chess_session');
    this.set('avatarUrl', null);
    this.set('isRegistered', false);
  }
}

export const store = new Store();
