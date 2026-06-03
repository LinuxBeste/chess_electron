import { useStoreValue } from '../hooks/useStore';
import { store } from '../store';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const username = useStoreValue('username');
  const token = useStoreValue('token');
  const wsStatus = useStoreValue('wsStatus');
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      <span className="navbar-brand">♚ <span>Chess</span></span>
      <div className="navbar-center" />
      <div className="navbar-actions">
        {token && username ? (
          <>
            <span className="navbar-player">
              <span className={`navbar-dot ${wsStatus === 'connected' ? 'online' : 'offline'}`} />
              {username}
            </span>
            <button className="navbar-btn" onClick={() => {
              import('../settings').then(m => m.showSettingsDialog());
            }}>Settings</button>
            <button className="navbar-btn" onClick={() => {
              store.set('token', null);
              store.set('playerId', null);
              store.set('username', null);
              store.clearSession();
              store.set('currentGame', null);
              navigate('/login');
            }}>Logout</button>
          </>
        ) : null}
      </div>
    </nav>
  );
}
