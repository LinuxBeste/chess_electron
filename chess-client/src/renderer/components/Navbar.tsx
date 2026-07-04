import { useState } from 'react';
import { useStoreValue } from '../hooks/useStore';
import { store } from '../store';
import { useNavigate } from 'react-router-dom';
import SettingsDialog from './SettingsDialog';
import MatchHistoryDialog from './MatchHistoryDialog';
import FriendsTab from './FriendsTab';
import { t } from '../translate';
import { avatarSrc } from '../api';
import logger from '../logger';

export default function Navbar() {
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const username = useStoreValue('username');
  const token = useStoreValue('token');
  const avatarUrl = useStoreValue('avatarUrl');
  const wsStatus = useStoreValue('wsStatus');
  const offline = useStoreValue('offline');
  const navigate = useNavigate();

  const isLoggedIn = !!(token && username);
  const isOffline = !!(offline && username);

  function handleLogout() {
    logger.info('User logged out', { username });
    store.set('token', null);
    store.set('playerId', null);
    store.set('username', null);
    store.set('avatarUrl', null);
    store.set('offline', false);
    store.clearSession();
    store.set('currentGame', null);
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

  return (
    <nav className="navbar">
      <span className="navbar-brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/lobby')}>
        ♟ Chess
      </span>
      <div className="navbar-actions">
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
                    style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: '#2a2a2a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
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
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#2a2a2a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    color: '#555',
                  }}
                >
                  {(username || '?')[0].toUpperCase()}
                </div>
                <span className="navbar-dot offline" />
                {username}
              </span>
            )}
          </>
        )}
        <button
          className="navbar-btn"
          onClick={() => {
            const isOpen = store.get('sidebarOpen');
            const isMinimized = store.get('sidebarMinimized');
            if (!isOpen || isMinimized) {
              store.set('sidebarOpen', true);
              store.set('sidebarMinimized', false);
            } else {
              store.set('sidebarOpen', false);
            }
          }}
          title="Sidebar"
        >
          ☰
        </button>
        <button className="navbar-btn" onClick={handleOpenSettings} title={t('navbar.settings')}>
          ⚙
        </button>
        {isLoggedIn && (
          <button className="navbar-btn" onClick={handleOpenHistory} title={t('navbar.history')}>
            📋
          </button>
        )}
        {(isLoggedIn || isOffline) && (
          <button className="navbar-btn" onClick={handleLogout} title={t('navbar.logout')}>
            ✕
          </button>
        )}
        {!isLoggedIn && !isOffline && (
          <button className="navbar-btn" onClick={() => navigate('/login')}>
            {t('login.signIn')}
          </button>
        )}
      </div>
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showHistory && <MatchHistoryDialog onClose={() => setShowHistory(false)} />}
      {showFriends && <FriendsTab onClose={() => setShowFriends(false)} />}
    </nav>
  );
}
