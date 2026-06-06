/**
 * App — root component with lazy-loaded routes, session restore, and
 * one-time initialisation (server URL, settings, socket lifecycle).
 *
 * Routing uses React Router v6 with lazy imports (code-split at page
 * boundaries) so the initial bundle stays small.  HashRouter is used
 * in index.tsx for Electron compatibility (file:// protocol).
 */

import { useEffect, lazy, Suspense, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ToastContainer from './components/ToastContainer';
import ErrorBoundary from './components/ErrorBoundary';
import { store } from './store';
import { socketManager } from './socket';
import { ApiError, setBaseUrl, getMe } from './api';
import { type AppSettings, loadSettings, saveSettings, applyTheme, getSetting } from './settings';
import { setSoundVolume } from './sound';

/* Code-split page bundles — each page is loaded only when first navigated to */
const LoginPage = lazy(() => import('./pages/LoginPage'));
const LobbyPage = lazy(() => import('./pages/LobbyPage'));
const GamePage = lazy(() => import('./pages/GamePage'));
const ResultPage = lazy(() => import('./pages/ResultPage'));
const LocalGamePage = lazy(() => import('./pages/LocalGamePage'));

function Loading() {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 24, color: '#888' }}
    >
      Loading...
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();

  /* One-shot initialisation on app mount:
     - Resolve server URL from Electron preload, localStorage, or default
     - Load persisted settings and override with Electron env vars if present
     - Restore last session (token + playerId) and validate against server
     - Subscribe to token changes so the WebSocket connects/disconnects
       automatically */
  useEffect(() => {
    /* Server URL resolution: Electron preload takes precedence, then
       a stored override in localStorage, then the hardcoded default */
    const storedUrl = localStorage.getItem('chess_server_url');
    const serverUrl = storedUrl || window.electronAPI?.serverUrl || 'http://localhost:3000';
    setBaseUrl(serverUrl);
    const wsUrl = window.electronAPI?.wsUrl || serverUrl;
    socketManager.setServerUrl(wsUrl);

    /* Merge Electron-provided defaults (if any) into persisted settings.
       This lets the Electron wrapper force specific themes for the standalone app
       without requiring users to open the settings dialog. */
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
    setSoundVolume(existing.soundVolume);

    /* Subscribe to token changes FIRST so the initial restore triggers it */
    const unsubToken = store.subscribe('token', (token) => {
      if (token) {
        socketManager.connect();
      } else {
        socketManager.disconnect();
        navigate('/login', { replace: true });
      }
    });

    /* Restore persisted session and validate credentials against the server.
       If the token is stale (401), clear session and redirect to login.
       The subscribe above will fire on store.set('token', ...) and connect
       or disconnect the WebSocket accordingly. */
    const session = store.restoreSession();
    if (session) {
      store.set('token', session.token);
      store.set('playerId', session.playerId);
      store.set('username', session.username);
      getMe()
        .then(() => {
          navigate('/lobby', { replace: true });
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 401) {
            store.set('token', null);
            store.set('playerId', null);
            store.set('username', null);
            store.clearSession();
          } else {
            store.toast('Failed to connect to server. Check the Server URL.', 'error');
          }
        });
    }

    return () => unsubToken();
  }, []);

  /* Auto-logout: track user activity and clear session after inactivity period */
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const idleMinutes = getSetting('autoLogoutMinutes');
    if (idleMinutes <= 0) return;

    function resetIdleTimer() {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        if (store.get('token')) {
          store.set('token', null);
          store.set('playerId', null);
          store.set('username', null);
          store.clearSession();
          store.set('currentGame', null);
        }
      }, idleMinutes * 60 * 1000);
    }

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    for (const ev of events) {
      window.addEventListener(ev, resetIdleTimer, { passive: true });
    }
    resetIdleTimer();

    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, resetIdleTimer);
      }
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  return (
    <ErrorBoundary>
      <Navbar />
      <ToastContainer />
      <div id="app-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/game/:gameId" element={<GamePage />} />
            <Route path="/result/:gameId" element={<ResultPage />} />
            <Route path="/result" element={<ResultPage />} />
            <Route path="/local" element={<LocalGamePage />} />
          </Routes>
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
