import { useState, useEffect, useRef } from 'react';
import { store } from '../store';
import * as api from '../api';
import { setBaseUrl } from '../api';
import { socketManager } from '../socket';
import { getSetting } from '../settings';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [username, setUsername] = useState(() => window.electronAPI?.defaultUsername || '');
  const alwaysAsk = getSetting('alwaysAskServerUrl');
  const [serverUrl, setServerUrl] = useState(() => {
    if (alwaysAsk) return '';
    return localStorage.getItem('chess_server_url') || window.electronAPI?.serverUrl || 'http://localhost:3000';
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleServerUrlChange(url: string) {
    setServerUrl(url);
    setBaseUrl(url);
    const wsUrl = window.electronAPI?.wsUrl || url;
    socketManager.setServerUrl(wsUrl);
    if (!alwaysAsk) {
      localStorage.setItem('chess_server_url', url);
    }
    if (store.get('token')) {
      socketManager.disconnect();
    }
  }

  useEffect(() => {
    if (store.get('token')) {
      navigate('/lobby', { replace: true });
      return;
    }
    const def = window.electronAPI?.defaultUsername;
    if (def && window.electronAPI?.autoConnect !== false) {
      handleSubmit();
    } else {
      inputRef.current?.focus();
    }
  }, []);

  async function handleSubmit() {
    const trimmed = username.trim();
    if (!trimmed) {
      const input = inputRef.current;
      if (input) {
        input.style.borderBottomColor = 'rgba(220,50,50,0.6)';
        setTimeout(() => {
          input.style.borderBottomColor = '';
        }, 2000);
      }
      return;
    }
    setLoading(true);
    try {
      const { playerId, token } = await api.register(trimmed);
      store.set('token', token);
      store.set('playerId', playerId);
      store.set('username', trimmed);
      navigate('/lobby');
    } catch (err: any) {
      store.toast(err.message || 'Failed to connect');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 24 }}>
      <div
        className="card"
        style={{
          padding: '48px 40px',
          width: '100%',
          maxWidth: 400,
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 4 }}>
          Where every <span style={{ color: 'var(--accent)' }}>move</span> matters.
        </h1>
        <p style={{ fontSize: 13, fontWeight: 300, color: 'var(--muted)', marginBottom: 24, letterSpacing: '0.3px' }}>
          ♚ Chess
        </p>
        <input
          className="input-clean"
          type="text"
          placeholder="Server URL"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={serverUrl}
          onChange={(e) => handleServerUrlChange(e.target.value)}
          style={{ fontSize: 12, marginBottom: 8, opacity: 0.65 }}
        />
        <input
          ref={inputRef}
          className="input-clean"
          type="text"
          placeholder="Enter your username"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
        />
        <button
          className="btn btn-primary"
          style={{ marginTop: 24, width: '100%', padding: 14, fontSize: 16 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Connecting...' : 'Enter'}
        </button>
      </div>
    </div>
  );
}
