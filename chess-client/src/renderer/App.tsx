/**
 * App — root component with lazy-loaded routes, session restore, and
 * one-time initialisation (server URL, settings, socket lifecycle).
 *
 * Routing uses React Router v6 with lazy imports (code-split at page
 * boundaries) so the initial bundle stays small.  HashRouter is used
 * in index.tsx for Electron compatibility (file:// protocol).
 */

import { useEffect, lazy, Suspense, useRef, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import logger from './logger';
import Navbar from './components/Navbar';
import ToastContainer from './components/ToastContainer';
import ErrorBoundary from './components/ErrorBoundary';
import { store } from './store';
import { socketManager } from './socket';
import { ApiError, setBaseUrl, getMe, getFriends, getFriendRequests, joinGame } from './api';
import { type AppSettings, loadSettings, saveSettings, applyTheme, getSetting } from './settings';
import { setSoundVolume } from './sound';
import { t, setLanguage, getLanguage } from './translate';

/* Code-split page bundles — each page is loaded only when first navigated to */
const LoginPage = lazy(() => import('./pages/LoginPage'));
const LobbyPage = lazy(() => import('./pages/LobbyPage'));
const GamePage = lazy(() => import('./pages/GamePage'));
const ResultPage = lazy(() => import('./pages/ResultPage'));
const LocalGamePage = lazy(() => import('./pages/LocalGamePage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));

function Loading() {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 24, color: '#888' }}
    >
      {t('app.loading')}
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [langKey, setLangKey] = useState(0);
  const [pendingChallenge, setPendingChallenge] = useState<{
    gameId: string;
    fromPlayerId: string;
    fromDisplayName: string;
  } | null>(null);

  function handleLanguageChange() {
    const next = getLanguage() === 'de' ? 'en' : 'de';
    setLanguage(next);
    const current = loadSettings();
    saveSettings({ ...current, language: next });
    setLangKey((k) => k + 1);
  }

  /* One-shot initialisation on app mount:
      - Resolve server URL from Electron preload, localStorage, or default
      - Load persisted settings and override with Electron env vars if present
      - Restore last session (token + playerId) and validate against server
      - Subscribe to token changes so the WebSocket connects/disconnects
        automatically */
  useEffect(() => {
    logger.info('App mounted, initializing...');

    /* Server URL resolution: Electron preload takes precedence, then
        a stored override in localStorage, then the hardcoded default */
    const storedUrl = localStorage.getItem('chess_server_url');
    const serverUrl = storedUrl || window.electronAPI?.serverUrl || 'http://localhost:3000';
    setBaseUrl(serverUrl);
    const wsUrl = window.electronAPI?.wsUrl || serverUrl;
    socketManager.setServerUrl(wsUrl);
    logger.info('Server URL set', { serverUrl, hasElectron: !!window.electronAPI });

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
        logger.info('Token available, connecting WebSocket...');
        socketManager.connect();
      } else if (!store.get('offline')) {
        logger.info('Token cleared, disconnecting WebSocket and redirecting to login');
        socketManager.disconnect();
        navigate('/login', { replace: true });
      } else {
        logger.info('Offline mode, disconnecting WebSocket');
        socketManager.disconnect();
      }
    });

    /* Restore persisted session and validate credentials against the server.
        If the token is stale (401), clear session and redirect to login.
        The subscribe above will fire on store.set('token', ...) and connect
        or disconnect the WebSocket accordingly. */
    const session = store.restoreSession();
    logger.info('Session restore', { hasSession: !!session });
    if (session) {
      store.set('token', session.token);
      store.set('playerId', session.playerId);
      store.set('username', session.username);
      store.set('avatarUrl', session.avatarUrl);
      store.set('isRegistered', session.isRegistered);
      getMe()
        .then((me) => {
          logger.info('Session validated, navigating to lobby');
          store.set('avatarUrl', me.avatarUrl);
          store.set('isRegistered', me.isRegistered);
          navigate('/lobby', { replace: true });
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 401) {
            logger.warn('Session token expired, clearing session');
            store.set('token', null);
            store.set('playerId', null);
            store.set('username', null);
            store.clearSession();
          } else {
            logger.error('Failed to connect to server', err);
            store.toast(t('app.connectFailed'), 'error');
          }
        });
    }

    /* ─── Friend WS event handlers ─── */
    const unsubFriendOnline = socketManager.onFriendOnline((msg) => {
      logger.info('Friend online', { playerId: msg.playerId, currentGameId: msg.currentGameId });
      const cur = store.get('friends');
      store.set(
        'friends',
        cur.map((f) => (f.playerId === msg.playerId ? { ...f, isOnline: true, currentGameId: msg.currentGameId } : f)),
      );
    });
    const unsubFriendOffline = socketManager.onFriendOffline((msg) => {
      logger.info('Friend offline', { playerId: msg.playerId });
      const cur = store.get('friends');
      store.set(
        'friends',
        cur.map((f) => (f.playerId === msg.playerId ? { ...f, isOnline: false, currentGameId: null } : f)),
      );
    });
    const unsubFriendRequest = socketManager.onFriendRequest((msg) => {
      logger.info('Friend request received', { from: msg.fromDisplayName, fromPlayerId: msg.fromPlayerId });
      store.toast(t('friends.friendRequestFrom', { name: msg.fromDisplayName }), 'info');
      /* Refresh friend requests */
      getFriendRequests()
        .then((r) => {
          store.set('incomingRequests', r.incoming);
          store.set('outgoingRequests', r.outgoing);
        })
        .catch(() => {});
    });
    const unsubFriendRequestAccepted = socketManager.onFriendRequestAccepted((msg) => {
      logger.info('Friend request accepted', { by: msg.byDisplayName });
      store.toast(t('friends.friendRequestAccepted', { name: msg.byDisplayName }), 'info');
      getFriends()
        .then((f) => store.set('friends', f))
        .catch(() => {});
      getFriendRequests()
        .then((r) => {
          store.set('incomingRequests', r.incoming);
          store.set('outgoingRequests', r.outgoing);
        })
        .catch(() => {});
    });
    const unsubChallenge = socketManager.onChallenge((msg) => {
      logger.info('Challenge received', {
        from: msg.fromDisplayName,
        fromPlayerId: msg.fromPlayerId,
        gameId: msg.gameId,
      });
      setPendingChallenge({ gameId: msg.gameId, fromPlayerId: msg.fromPlayerId, fromDisplayName: msg.fromDisplayName });
    });
    const unsubChallengeAccept = socketManager.onChallengeAccept((msg) => {
      logger.info('Challenge accepted, navigating to game', { gameId: msg.gameId });
      store.toast(t('friends.challengeAccepted'), 'info');
      navigate(`/game/${msg.gameId}`);
    });
    const unsubChallengeDecline = socketManager.onChallengeDecline((_msg) => {
      logger.info('Challenge declined', { gameId: _msg.gameId });
      store.toast(t('friends.challengeDeclined'), 'info');
    });

    return () => {
      unsubToken();
      unsubFriendOnline();
      unsubFriendOffline();
      unsubFriendRequest();
      unsubFriendRequestAccepted();
      unsubChallenge();
      unsubChallengeAccept();
      unsubChallengeDecline();
    };
  }, []);

  /* Auto-logout: track user activity and clear session after inactivity period */
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const idleMinutes = getSetting('autoLogoutMinutes');
    if (idleMinutes <= 0) return;

    function resetIdleTimer() {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(
        () => {
          if (store.get('token')) {
            logger.info('Auto-logout due to inactivity', { idleMinutes });
            store.set('token', null);
            store.set('playerId', null);
            store.set('username', null);
            store.clearSession();
            store.set('currentGame', null);
          }
        },
        idleMinutes * 60 * 1000,
      );
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

  async function handleAcceptChallenge() {
    if (!pendingChallenge) return;
    const { gameId, fromPlayerId } = pendingChallenge;
    logger.info('Accepting challenge', { gameId, fromPlayerId });
    try {
      await joinGame(gameId);
      socketManager.send({ type: 'challenge_accept', toPlayerId: fromPlayerId, gameId });
      setPendingChallenge(null);
      navigate(`/game/${gameId}`);
    } catch (err) {
      logger.error('Failed to accept challenge', err);
      store.toast('Failed to join game', 'error');
    }
  }

  function handleDeclineChallenge() {
    if (!pendingChallenge) return;
    logger.info('Declining challenge', {
      gameId: pendingChallenge.gameId,
      fromPlayerId: pendingChallenge.fromPlayerId,
    });
    socketManager.send({
      type: 'challenge_decline',
      toPlayerId: pendingChallenge.fromPlayerId,
      gameId: pendingChallenge.gameId,
    });
    setPendingChallenge(null);
  }

  return (
    <ErrorBoundary>
      <Navbar key={langKey} onLanguageChange={handleLanguageChange} />
      <ToastContainer />

      {/* Challenge dialog */}
      {pendingChallenge && (
        <div className="modal-overlay" onClick={() => setPendingChallenge(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0', marginBottom: 12 }}>
              {t('game.challengeTitle')}
            </h3>
            <p style={{ fontSize: 14, color: '#888', marginBottom: 20 }}>
              {pendingChallenge.fromDisplayName} {t('game.challengedYou')}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={handleAcceptChallenge}>
                {t('game.accept')}
              </button>
              <button className="btn btn-ghost" onClick={handleDeclineChallenge}>
                {t('game.decline')}
              </button>
            </div>
          </div>
        </div>
      )}
      <div id="app-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Suspense fallback={<Loading />}>
          <Routes key={langKey}>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/game/:gameId" element={<GamePage />} />
            <Route path="/result/:gameId" element={<ResultPage />} />
            <Route path="/result" element={<ResultPage />} />
            <Route path="/local" element={<LocalGamePage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
          </Routes>
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
