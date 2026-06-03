import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ToastContainer from './components/ToastContainer';
import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import ResultPage from './pages/ResultPage';
import { store } from './store';
import { socketManager } from './socket';
import { setBaseUrl } from './api';
import { type AppSettings, loadSettings, saveSettings, applyTheme } from './settings';

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
      <Navbar />
      <ToastContainer />
      <div id="app-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/game/:gameId" element={<GamePage />} />
          <Route path="/result/:gameId" element={<ResultPage />} />
          <Route path="/result" element={<ResultPage />} />
        </Routes>
      </div>
    </HashRouter>
  );
}
