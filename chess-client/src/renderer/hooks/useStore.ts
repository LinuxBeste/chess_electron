import { useState, useEffect } from 'react';
import { store } from '../store';

type StateMap = {
  token: string | null;
  playerId: string | null;
  username: string | null;
  currentGame: import('../../types').GameState | null;
  wsStatus: import('../../types').WsStatus;
  toasts: import('../../types').ToastMessage[];
  currentView: string;
};

export function useStoreValue<K extends keyof StateMap>(key: K): StateMap[K] {
  const [val, setVal] = useState<StateMap[K]>(store.get(key as any) as StateMap[K]);
  useEffect(() => store.subscribe(key as any, (v: any) => setVal(v as StateMap[K])), [key]);
  return val;
}
