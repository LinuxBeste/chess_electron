import { store } from './store';
import { socketManager } from './socket';
import { initRouter } from './router';
import { el } from './chess';
import { setBaseUrl } from './api';
import { type AppSettings, loadSettings, saveSettings, applyTheme } from './settings';
import type { ToastMessage } from '../types';

import { loginView } from './views/login';
import { lobbyView } from './views/lobby';
import { gameView } from './views/game';
import { resultView } from './views/result';

const container = document.getElementById('app')!;
const navbar = el('nav', ['navbar']);
let navbarUnsub: (() => void) | null = null;

function buildNavbar(): void {
  navbar.innerHTML = '';
  const brand = el('span', ['navbar-brand'], {}, '♚ ', el('span', [], {}, 'Chess'));
  navbar.appendChild(brand);

  const center = el('span', ['navbar-center']);
  navbar.appendChild(center);

  const actions = el('div', ['navbar-actions']);
  const token = store.get('token');
  const username = store.get('username');

  if (token && username) {
    const playerInfo = el('span', ['navbar-player']);
    const dot = el('span', ['navbar-dot', store.get('wsStatus') === 'connected' ? 'online' : 'offline']);
    playerInfo.appendChild(dot);
    playerInfo.append(username);
    actions.appendChild(playerInfo);

    const settingsBtn = el('button', ['navbar-btn'], {}, 'Settings');
    settingsBtn.addEventListener('click', () => {
      import('./settings').then(m => m.showSettingsDialog());
    });
    actions.appendChild(settingsBtn);

    const disconnectBtn = el('button', ['navbar-btn'], {}, 'Logout');
    disconnectBtn.addEventListener('click', () => {
      store.set('token', null);
      store.set('playerId', null);
      store.set('username', null);
      store.clearSession();
      store.set('currentGame', null);
      window.location.hash = '#login';
    });
    actions.appendChild(disconnectBtn);
  }
  navbar.appendChild(actions);
}

store.subscribe('username', () => buildNavbar());
store.subscribe('wsStatus', () => buildNavbar());
buildNavbar();
document.body.prepend(navbar);

/* If session exists, validate the token before auto-navigating.
 * The server stores tokens in-memory only — a restart wipes them,
 * leaving the client with a stale token that causes "Invalid token"
 * errors on the first authenticated request. */
const session = store.restoreSession();
if (session) {
  store.set('token', session.token);
  store.set('playerId', session.playerId);
  store.set('username', session.username);

  /* Validate the restored token by calling an authenticated endpoint.
   * If the server doesn't recognize it, clear the session and show login. */
  import('./api').then(({ getMe }) => {
    getMe().catch(() => {
      store.set('token', null);
      store.set('playerId', null);
      store.set('username', null);
      store.clearSession();
      if (window.location.hash.startsWith('#lobby') || window.location.hash.startsWith('#game') || window.location.hash.startsWith('#result')) {
        window.location.hash = '#login';
      }
    });
  });

  if (!window.location.hash) window.location.hash = '#lobby';
}

/* Apply env-driven defaults for settings that haven't been saved yet */
const existing = loadSettings();
const envTheme = window.electronAPI?.defaultTheme;
const envSound = window.electronAPI?.defaultSound;
const envHints = window.electronAPI?.defaultHints;
const needsUpdate =
  (envTheme !== undefined && envTheme !== existing.boardTheme) ||
  (envSound !== undefined && envSound !== existing.soundEnabled) ||
  (envHints !== undefined && envHints !== existing.showLegalHints);
if (needsUpdate) {
  saveSettings({
    ...existing,
    ...(envTheme !== undefined ? { boardTheme: envTheme as AppSettings['boardTheme'] } : {}),
    ...(envSound !== undefined ? { soundEnabled: envSound } : {}),
    ...(envHints !== undefined ? { showLegalHints: envHints } : {}),
  });
} else {
  applyTheme(existing.boardTheme);
}

/* Configure server URL from Electron preload config or default to localhost */
const serverUrl = window.electronAPI?.serverUrl || 'http://localhost:3000';
setBaseUrl(serverUrl);
const wsUrl = window.electronAPI?.wsUrl || serverUrl;
socketManager.setServerUrl(wsUrl);

/* Persistent toast bar above all views */
const toastBar = el('div', ['toast-bar']);
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
      const bar = el('div', ['toast', `toast-${t.type}`], {}, t.text);
      toastBar.appendChild(bar);
      toastElements.set(t.id, bar);
    }
  }
});

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
