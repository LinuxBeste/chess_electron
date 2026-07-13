import { useState, useEffect } from 'react';
import { useStoreValue } from '../hooks/useStore';
import { store } from '../store';
import { useNavigate } from 'react-router-dom';
import { Menu, Settings, ScrollText, LogOut, Search, ChessKnight } from 'lucide-react';
import SettingsDialog from './SettingsDialog';
import MatchHistoryDialog from './MatchHistoryDialog';
import FriendsTab from './FriendsTab';
import CommandPalette from './CommandPalette';
import { t } from '../translate';
import { avatarSrc } from '../api';
import logger from '../logger';

// Top navigation bar with user info, settings, and logout
export default function Navbar() {
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const username = useStoreValue('username');
  const token = useStoreValue('token');
  const avatarUrl = useStoreValue('avatarUrl');
  const wsStatus = useStoreValue('wsStatus');
  const offline = useStoreValue('offline');
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette((open) => !open);
      }
      if (e.key === 'Escape' && showCommandPalette) {
        setShowCommandPalette(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCommandPalette]);

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
        <ChessKnight size={16} style={{ marginRight: 4 }} /> Chess
      </span>
      <div className="navbar-search" onClick={() => setShowCommandPalette(true)} role="button" tabIndex={0}>
        <Search size={14} />
        <span className="navbar-search-text">Search commands...</span>
        <span className="navbar-search-kbd">Ctrl+K</span>
      </div>
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
          <Menu size={18} />
        </button>
        <button className="navbar-btn" onClick={handleOpenSettings} title={t('navbar.settings')}>
          <Settings size={18} />
        </button>
        {isLoggedIn && (
          <button className="navbar-btn" onClick={handleOpenHistory} title={t('navbar.history')}>
            <ScrollText size={18} />
          </button>
        )}
        {(isLoggedIn || isOffline) && (
          <button className="navbar-btn" onClick={handleLogout} title={t('navbar.logout')}>
            <LogOut size={18} />
          </button>
        )}
        {!isLoggedIn && !isOffline && (
          <button className="navbar-btn" onClick={() => navigate('/login')}>
            {t('login.signIn')}
          </button>
        )}
      </div>
      {showCommandPalette && (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenHistory={() => setShowHistory(true)}
        />
      )}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showHistory && <MatchHistoryDialog onClose={() => setShowHistory(false)} />}
      {showFriends && <FriendsTab onClose={() => setShowFriends(false)} />}
    </nav>
  );
}
