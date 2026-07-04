/**
 * useStore — React binding for the observable Store.
 *
 * Subscribes to the given key on mount, re-renders the component when
 * the value changes, and unsubscribes on unmount (the subscribe function
 * returns an unsubscribe callback which useEffect's cleanup calls).
 *
 * The StateMap type mirrors the store's internal map so callers get
 * full type inference on the returned value.
 */

import { useState, useEffect } from 'react';
import logger from '../logger';
import { store } from '../store';

type StateMap = {
  token: string | null;
  playerId: string | null;
  username: string | null;
  avatarUrl: string | null;
  isRegistered: boolean;
  currentGame: import('../../types').GameState | null;
  wsStatus: import('../../types').WsStatus;
  toasts: import('../../types').ToastMessage[];
  currentView: string;
  offline: boolean;
  friends: import('../../types').FriendInfo[];
  incomingRequests: import('../../types').FriendRequestInfo[];
  outgoingRequests: import('../../types').FriendRequestInfo[];
  sidebarOpen: boolean;
  sidebarMinimized: boolean;
  sidebarPosition: 'left' | 'right';
  sidebarTab: 'play' | 'chat' | 'friends';
  navOpen: boolean;
  navMinimized: boolean;
  conversations: import('../../types').ConversationInfo[];
  unreadCount: number;
};

// React binding: subscribes on mount, re-renders on change, cleans up on unmount
export function useStoreValue<K extends keyof StateMap>(key: K): StateMap[K] {
  const [val, setVal] = useState<StateMap[K]>(store.get(key)); // initial value from store
  useEffect(() => {
    logger.debug('Subscribing to store key', key);
    const unsubscribe = store.subscribe(key, (v: StateMap[K]) => setVal(v)); // triggers re-render
    return () => {
      logger.debug('Unsubscribing from store key', key);
      unsubscribe(); // prevent stale subscription after unmount
    };
  }, [key]); // re-subscribe only when observed key changes
  return val;
}
