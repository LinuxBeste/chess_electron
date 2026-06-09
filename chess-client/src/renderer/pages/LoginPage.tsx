import { useState, useEffect, useRef } from 'react';
import { store } from '../store';
import * as api from '../api';
import { setBaseUrl } from '../api';
import { socketManager } from '../socket';
import { getSetting } from '../settings';
import { useNavigate } from 'react-router-dom';
import { t } from '../translate';

type Mode = 'quick' | 'signin' | 'register';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('quick');
  const [username, setUsername] = useState(() => window.electronAPI?.defaultUsername || '');
  const [password, setPassword] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [offlineMode, setOfflineMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const alwaysAsk = getSetting('alwaysAskServerUrl');
  const [serverUrl, setServerUrl] = useState(() => {
    if (alwaysAsk) return '';
    return localStorage.getItem('chess_server_url') || window.electronAPI?.serverUrl || 'http://localhost:3000';
  });
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
    if (def && mode === 'quick' && window.electronAPI?.autoConnect !== false) {
      handleQuickPlay();
    } else {
      inputRef.current?.focus();
    }
  }, []);

  async function handleQuickPlay() {
    const trimmed = username.trim();
    if (!trimmed) {
      flashInput(inputRef.current);
      return;
    }
    if (offlineMode) {
      store.set('username', trimmed);
      store.set('playerId', null);
      store.set('offline', true);
      navigate('/lobby');
      return;
    }
    setLoading(true);
    try {
      const result = await api.register(trimmed);
      store.set('token', result.token);
      store.set('playerId', result.playerId);
      store.set('username', trimmed);
      store.set('isRegistered', result.isRegistered);
      navigate('/lobby');
    } catch (err: any) {
      store.toast(err.message || t('login.failedConnect'));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    const trimmed = username.trim();
    if (!trimmed) {
      flashInput(inputRef.current);
      return;
    }
    if (registerPassword.length < 4) {
      store.toast(t('login.passwordTooShort'), 'error');
      return;
    }
    setLoading(true);
    try {
      const result = await api.register(trimmed, registerPassword);
      store.set('token', result.token);
      store.set('playerId', result.playerId);
      store.set('username', result.displayName);
      store.set('isRegistered', result.isRegistered);
      navigate('/lobby');
    } catch (err: any) {
      store.toast(err.message || t('login.registrationFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    const trimmed = username.trim();
    if (!trimmed || !password) {
      store.toast(t('login.credentialsRequired'), 'error');
      return;
    }
    setLoading(true);
    try {
      const result = await api.login(trimmed, password);
      store.set('token', result.token);
      store.set('playerId', result.playerId);
      store.set('username', result.displayName);
      store.set('isRegistered', true);
      navigate('/lobby');
    } catch (err: any) {
      store.toast(err.message || t('login.loginFailed'));
    } finally {
      setLoading(false);
    }
  }

  function flashInput(el: HTMLElement | null) {
    if (!el) return;
    el.style.borderBottomColor = 'rgba(220,50,50,0.6)';
    setTimeout(() => {
      el.style.borderBottomColor = '';
    }, 2000);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 24 }}>
      <div
        className="card login-card"
        style={{
          padding: '48px 40px',
          width: '100%',
          maxWidth: 400,
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 4 }}>
          {t('login.tagline')}
        </h1>
        <p style={{ fontSize: 13, fontWeight: 300, color: 'var(--muted)', marginBottom: 24, letterSpacing: '0.3px' }}>
          {t('login.subtitle')}
        </p>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
          {(['quick', 'signin', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: '10px 0',
                fontSize: 13,
                fontWeight: mode === m ? 600 : 400,
                color: mode === m ? 'var(--accent)' : 'var(--muted)',
                background: 'none',
                border: 'none',
                borderBottom: mode === m ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {m === 'quick' ? t('login.quickPlay') : m === 'signin' ? t('login.signIn') : t('login.register')}
            </button>
          ))}
        </div>

        <input
          className="input-clean"
          type="text"
          placeholder={t('login.serverUrl')}
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
          placeholder={mode === 'quick' ? t('login.displayName') : t('login.username')}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (mode === 'quick') handleQuickPlay();
              else if (mode === 'signin') handleSignIn();
              else handleRegister();
            }
          }}
        />

        {mode !== 'quick' ? (
          <input
            className="input-clean"
            type="password"
            placeholder={mode === 'signin' ? t('login.password') : t('login.passwordMin')}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={mode === 'signin' ? password : registerPassword}
            onChange={(e) => {
              if (mode === 'signin') setPassword(e.target.value);
              else setRegisterPassword(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (mode === 'signin') handleSignIn();
                else handleRegister();
              }
            }}
            style={{ marginTop: 8 }}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }}>
            <div className={`toggle ${offlineMode ? 'active' : ''}`} onClick={() => setOfflineMode(!offlineMode)}>
              <div className="toggle-knob" />
            </div>
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)', letterSpacing: '0.2px' }}>
              {t('login.offlineMode')}
            </span>
            <span style={{ fontSize: 11, fontWeight: 300, color: 'var(--muted)', opacity: 0.6, marginLeft: 4 }}>
              {t('login.offlineModeDesc')}
            </span>
          </div>
        )}

        <button
          className="btn btn-primary"
          style={{ marginTop: 24, width: '100%', padding: 14, fontSize: 16 }}
          onClick={() => {
            if (mode === 'quick') handleQuickPlay();
            else if (mode === 'signin') handleSignIn();
            else handleRegister();
          }}
          disabled={loading}
        >
          {loading
            ? t('login.connecting')
            : mode === 'quick'
              ? t('login.enter')
              : mode === 'signin'
                ? t('login.signIn')
                : t('login.createAccount')}
        </button>

        {mode === 'signin' && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
            {t('login.noAccount')}{' '}
            <span
              style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => setMode('register')}
            >
              {t('login.registerHere')}
            </span>
          </p>
        )}

        {mode === 'register' && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
            {t('login.haveAccount')}{' '}
            <span
              style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => setMode('signin')}
            >
              {t('login.signInLink')}
            </span>
          </p>
        )}

        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 16, opacity: 0.6 }}>
          {mode === 'quick' ? t('login.quickPlayInfo') : t('login.registeredInfo')}
        </p>
      </div>
    </div>
  );
}
