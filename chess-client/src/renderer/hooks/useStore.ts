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
};

export function useStoreValue<K extends keyof StateMap>(key: K): StateMap[K] {
  const [val, setVal] = useState<StateMap[K]>(store.get(key));
  useEffect(() => {
    logger.debug('Subscribing to store key', key);
    const unsubscribe = store.subscribe(key, (v: StateMap[K]) => setVal(v));
    return () => {
      logger.debug('Unsubscribing from store key', key);
      unsubscribe();
    };
  }, [key]);
  return val;
}
