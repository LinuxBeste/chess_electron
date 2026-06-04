import { useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ToastContainer from './components/ToastContainer';
import ErrorBoundary from './components/ErrorBoundary';
import { store } from './store';
import { socketManager } from './socket';
import { setBaseUrl } from './api';
import { type AppSettings, loadSettings, saveSettings, applyTheme } from './settings';
import { setSoundVolume } from './sound';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const LobbyPage = lazy(() => import('./pages/LobbyPage'));
const GamePage = lazy(() => import('./pages/GamePage'));
const ResultPage = lazy(() => import('./pages/ResultPage'));

function Loading() {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 24, color: '#888' }}>Loading...</div>;
}

export default function App() {
  useEffect(() => {
    const serverUrl = window.electronAPI?.serverUrl || 'http://localhost:3000';
    setBaseUrl(serverUrl);
    const wsUrl = window.electronAPI?.wsUrl || serverUrl;
    socketManager.setServerUrl(wsUrl);

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

    const session = store.restoreSession();
    if (session) {
      store.set('token', session.token);
      store.set('playerId', session.playerId);
      store.set('username', session.username);
      import('./api').then(({ getMe }) => {
        getMe().catch(() => {
          store.set('token', null);
          store.set('playerId', null);
          store.set('username', null);
          store.clearSession();
        });
      });
    }

    const unsubToken = store.subscribe('token', (token) => {
      if (token) socketManager.connect();
      else socketManager.disconnect();
    });

    return () => unsubToken();
  }, []);

  return (
    <HashRouter>
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
            </Routes>
          </Suspense>
        </div>
      </ErrorBoundary>
    </HashRouter>
  );
}
