import { useState } from 'react';
import logger from '../logger';
import { store } from '../store';
import * as api from '../api';
import { Link } from 'react-router-dom';
import { t } from '../translate';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    const trimmed = email.trim();
    if (!trimmed) {
      store.toast(t('forgotPassword.enterEmail'), 'error');
      return;
    }
    setLoading(true);
    try {
      const result = await api.forgotPassword(trimmed);
      logger.info('forgotPassword success');
      setSent(true);
      store.toast(result.message || t('forgotPassword.sent'), 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('forgotPassword failed', { error: msg });
      store.toast(msg || t('forgotPassword.failed'));
    } finally {
      setLoading(false);
    }
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
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 8 }}>
          {sent ? t('forgotPassword.checkEmail') : t('forgotPassword.title')}
        </h1>
        <p style={{ fontSize: 13, fontWeight: 300, color: 'var(--muted)', marginBottom: 24, letterSpacing: '0.3px' }}>
          {sent ? t('forgotPassword.sentDesc') : t('forgotPassword.desc')}
        </p>

        {!sent ? (
          <>
            <input
              className="input-clean"
              type="email"
              placeholder={t('forgotPassword.emailPlaceholder')}
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              {loading ? <span className="spinner" style={{ display: 'inline-block' }} /> : t('forgotPassword.send')}
            </button>

            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 16 }}>
              <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                {t('forgotPassword.backToLogin')}
              </Link>
            </p>
          </>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
            <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
              {t('forgotPassword.backToLogin')}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
