import { store } from './store';
import { socketManager } from './socket';
import { initRouter } from './router';
import { el } from './chess';
import type { ToastMessage } from '../types';

import { loginView } from './views/login';
import { lobbyView } from './views/lobby';
import { gameView } from './views/game';
import { resultView } from './views/result';

const container = document.getElementById('app')!;

/* Persistent toast bar above all views */
const toastBar = el('div', ['toast-bar'], { style: 'position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;flex-direction:column;align-items:center;pointer-events:none;padding:8px 16px 0' });
document.body.appendChild(toastBar);

/* Sync DOM toasts with store array — add new, remove dismissed */
let toastElements: Map<number, HTMLElement> = new Map();
store.subscribe('toasts', (toasts: ToastMessage[]) => {
  const currentIds = new Set(toasts.map(t => t.id));
  for (const [id, elm] of toastElements) {
    if (!currentIds.has(id)) {
      elm.remove();
      toastElements.delete(id);
    }
  }
  for (const t of toasts) {
    if (!toastElements.has(t.id)) {
      const bar = el('div', ['toast'], {
        style: `background:${t.type === 'error' ? 'rgba(220,50,50,0.95)' : 'rgba(79,142,247,0.95)'};color:#fff;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:500;margin-bottom:6px;box-shadow:0 4px 16px rgba(0,0,0,0.3);animation:toastIn 200ms ease;pointer-events:auto;max-width:480px;text-align:center`,
      }, t.text);
      toastBar.appendChild(bar);
      toastElements.set(t.id, bar);
    }
  }
});

const styleSheet = document.createElement('style');
styleSheet.textContent = `@keyframes toastIn { from { opacity:0; transform:translateY(-12px) } to { opacity:1; transform:translateY(0) } }`;
document.head.appendChild(styleSheet);

initRouter(container, {
  login: loginView,
  lobby: lobbyView,
  game: gameView,
  result: resultView,
});

/* Auto-connect WS when token appears (after login), disconnect on logout */
store.subscribe('token', (token) => {
  if (token) {
    socketManager.connect();
  } else {
    socketManager.disconnect();
  }
});
