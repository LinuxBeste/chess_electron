/**
 * Navbar — top bar with branding, connection status indicator,
 * username display, settings trigger, and logout.
 *
 * Uses the observable store (useStoreValue) so it re-renders when
 * auth state or connection status changes without prop drilling.
 */

import { useState } from 'react';
import { useStoreValue } from '../hooks/useStore';
import { store } from '../store';
import { useNavigate } from 'react-router-dom';
import SettingsDialog from './SettingsDialog';
import MatchHistoryDialog from './MatchHistoryDialog';
import StatsDialog from './StatsDialog';
import FriendsTab from './FriendsTab';
import { t } from '../translate';
import { avatarSrc } from '../api';
import logger from '../logger';

export default function Navbar() {
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const username = useStoreValue('username');
  const token = useStoreValue('token');
  const avatarUrl = useStoreValue('avatarUrl');
  const isRegistered = useStoreValue('isRegistered');
  const wsStatus = useStoreValue('wsStatus');
  const offline = useStoreValue('offline');
  const navigate = useNavigate();

  const isLoggedIn = !!(token && username);
  const isOffline = !!(offline && username);
  const unreadCount = useStoreValue('unreadCount');

  function handleLogout() {
    logger.info('User logged out', { username });
    store.set('token', null); // clear all auth state from store
    store.set('playerId', null);
    store.set('username', null);
    store.set('avatarUrl', null);
    store.set('offline', false);
    store.clearSession(); // also clear persisted session from localStorage
    store.set('currentGame', null); // drop any in-progress game reference
    navigate('/login');
  }

  function handleOpenSettings() {
    logger.debug('Settings dialog opened');
    setShowSettings(true);
  }

  function handleOpenHistory() {
    logger.debug('Match history dialog opened');
    setShowHistory(true);
  }

  function handleOpenStats() {
    logger.debug('Stats dialog opened');
    setShowStats(true);
  }

  return (
    <nav className="navbar">
      <span className="navbar-brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/lobby')}>
        {t('navbar.chess')}
      </span>
      <div className="navbar-center" />
      <div className="navbar-actions">
        <button className="navbar-btn" onClick={() => navigate('/lobby')}>
          {t('navbar.play')}
        </button>
        <button className="navbar-btn" onClick={() => navigate('/leaderboard')}>
          {t('navbar.leaderboard')}
        </button>
        <button className="navbar-btn" onClick={() => navigate('/archive')}>
          {t('navbar.archive')}
        </button>
        <button className="navbar-btn" onClick={() => navigate('/tournaments')}>
          {t('navbar.tournaments')}
        </button>
        <button className="navbar-btn" onClick={handleOpenStats}>
          {t('navbar.stats')}
        </button>

        {(isLoggedIn || isOffline) && (
          <>
            {isLoggedIn && (
              <span
                className="navbar-player"
                style={{ gap: 8, cursor: 'pointer' }}
                onClick={() => {
                  const pid = store.get('playerId');
                  if (pid) navigate(`/profile/${pid}`);
                }}
              >
                {avatarUrl ? (
                  <img
                    src={avatarSrc(avatarUrl)}
                    alt=""
                    style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: '#2a2a2a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      color: '#555',
                    }}
                  >
                    {(username || '?')[0].toUpperCase()}
                  </div>
                )}
                <span className={`navbar-dot ${wsStatus === 'connected' ? 'online' : 'offline'}`} />
                {username}
              </span>
            )}
            {isOffline && (
              <span className="navbar-player" style={{ gap: 8 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: '#2a2a2a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    color: '#555',
                  }}
                >
                  {(username || '?')[0].toUpperCase()}
                </div>
                <span className="navbar-dot offline" />
                {username}
              </span>
            )}
            {isLoggedIn && isRegistered && (
              <button
                className="navbar-btn"
                onClick={() => {
                  const isOpen = store.get('sidebarOpen');
                  const isMinimized = store.get('sidebarMinimized');
                  if (!isOpen || isMinimized) {
                    store.set('sidebarOpen', true);
                    store.set('sidebarMinimized', false);
                    store.set('sidebarTab', 'chat');
                  } else {
                    store.set('sidebarOpen', false);
                  }
                  logger.info('Chat button clicked', { sidebarOpen: !isOpen });
                }}
                style={{ position: 'relative' }}
              >
                {t('sidebar.chat')}
                {unreadCount > 0 && <span className="navbar-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </button>
            )}
            <button className="navbar-btn" onClick={handleOpenSettings}>
              {t('navbar.settings')}
            </button>
            {isLoggedIn && (
              <button className="navbar-btn" onClick={handleOpenHistory}>
                {t('navbar.history')}
              </button>
            )}
            <button className="navbar-btn" onClick={handleLogout}>
              {t('navbar.logout')}
            </button>
          </>
        )}
        {!isLoggedIn && !isOffline && (
          <>
            <button className="navbar-btn" onClick={handleOpenSettings}>
              {t('navbar.settings')}
            </button>
            <button className="navbar-btn" onClick={() => navigate('/login')}>
              {t('login.signIn')}
            </button>
          </>
        )}
      </div>
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showHistory && <MatchHistoryDialog onClose={() => setShowHistory(false)} />}
      {showStats && <StatsDialog onClose={() => setShowStats(false)} />}
      {showFriends && <FriendsTab onClose={() => setShowFriends(false)} />}
    </nav>
  );
}
