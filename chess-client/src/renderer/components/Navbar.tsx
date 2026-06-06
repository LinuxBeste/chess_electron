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
import { t, getLanguage } from '../translate';
import { getLanguageNames } from '../locales';

interface NavbarProps {
  onLanguageChange: () => void;
}

export default function Navbar({ onLanguageChange }: NavbarProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const username = useStoreValue('username');
  const token = useStoreValue('token');
  const wsStatus = useStoreValue('wsStatus');
  const offline = useStoreValue('offline');
  const navigate = useNavigate();

  const isLoggedIn = !!(token && username);
  const isOffline = !!(offline && username);

  return (
    <nav className="navbar">
      <span className="navbar-brand">
        {t('navbar.chess')}
      </span>
      <div className="navbar-center" />
      <button className="navbar-btn" onClick={onLanguageChange} style={{ fontSize: 11, padding: '4px 8px' }}>
        {getLanguageNames()[getLanguage() === 'de' ? 'en' : 'de']}
      </button>
      <div className="navbar-actions">
        {(isLoggedIn || isOffline) && (
          <>
            {isLoggedIn && (
              <span className="navbar-player">
                <span className={`navbar-dot ${wsStatus === 'connected' ? 'online' : 'offline'}`} />
                {username}
              </span>
            )}
            {isOffline && (
              <span className="navbar-player">
                <span className="navbar-dot offline" />
                {username}
              </span>
            )}
            {isLoggedIn && (
              <button className="navbar-btn" onClick={() => setShowStats(true)}>
                {t('navbar.stats')}
              </button>
            )}
            <button className="navbar-btn" onClick={() => setShowSettings(true)}>
              {t('navbar.settings')}
            </button>
            {isLoggedIn && (
              <button className="navbar-btn" onClick={() => setShowHistory(true)}>
                {t('navbar.history')}
              </button>
            )}
            <button
              className="navbar-btn"
              onClick={() => {
                store.set('token', null);
                store.set('playerId', null);
                store.set('username', null);
                store.set('offline', false);
                store.clearSession();
                store.set('currentGame', null);
                navigate('/login');
              }}
            >
              {t('navbar.logout')}
            </button>
          </>
        )}
      </div>
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showHistory && <MatchHistoryDialog onClose={() => setShowHistory(false)} />}
      {showStats && <StatsDialog onClose={() => setShowStats(false)} />}
    </nav>
  );
}
