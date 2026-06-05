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

export default function Navbar() {
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const username = useStoreValue('username');
  const token = useStoreValue('token');
  const wsStatus = useStoreValue('wsStatus');
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      <span className="navbar-brand">
        ♚ <span>Chess</span>
        <span className="navbar-tagline">Where every move matters.</span>
      </span>
      <div className="navbar-center" />
      <div className="navbar-actions">
        {token && username ? (
          <>
            <span className="navbar-player">
              <span className={`navbar-dot ${wsStatus === 'connected' ? 'online' : 'offline'}`} />
              {username}
            </span>
            <button className="navbar-btn" onClick={() => setShowSettings(true)}>
              Settings
            </button>
            <button className="navbar-btn" onClick={() => setShowHistory(true)}>
              History
            </button>
            <button
              className="navbar-btn"
              onClick={() => {
                store.set('token', null);
                store.set('playerId', null);
                store.set('username', null);
                store.clearSession();
                store.set('currentGame', null);
                navigate('/login');
              }}
            >
              Logout
            </button>
          </>
        ) : null}
      </div>
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showHistory && <MatchHistoryDialog onClose={() => setShowHistory(false)} />}
    </nav>
  );
}
