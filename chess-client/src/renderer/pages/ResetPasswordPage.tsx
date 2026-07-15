import { useState, useEffect } from 'react';
import logger from '../logger';
import { store } from '../store';
import * as api from '../api';
import { useSearchParams, Link } from 'react-router-dom';
import { t } from '../translate';
import { passwordSchema } from '../validation';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      store.toast(t('resetPassword.invalidToken'), 'error');
    }
  }, [token]);

  async function handleSubmit() {
    if (!token) {
      store.toast(t('resetPassword.invalidToken'), 'error');
      return;
    }
    if (password !== confirmPassword) {
      store.toast(t('resetPassword.passwordsDontMatch'), 'error');
      return;
    }
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      store.toast(parsed.error.issues[0].message, 'error');
      return;
    }
    setLoading(true);
    try {
      const result = await api.resetPassword(token, password);
      logger.info('resetPassword success');
      setDone(true);
      store.toast(result.message || t('resetPassword.success'), 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('resetPassword failed', { error: msg });
      store.toast(msg || t('resetPassword.failed'));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 24 }}>
        <div
          className="card login-card"
          style={{ padding: '48px 40px', width: '100%', maxWidth: 400, textAlign: 'center' }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
            {t('resetPassword.invalidLink')}
          </h1>
          <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'underline', fontSize: 13 }}>
            {t('forgotPassword.backToLogin')}
          </Link>
        </div>
      </div>
    );
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
          {done ? t('resetPassword.done') : t('resetPassword.title')}
        </h1>
        <p style={{ fontSize: 13, fontWeight: 300, color: 'var(--muted)', marginBottom: 24, letterSpacing: '0.3px' }}>
          {done ? t('resetPassword.doneDesc') : t('resetPassword.desc')}
        </p>

        {!done ? (
          <>
            <input
              className="input-clean"
              type="password"
              placeholder={t('resetPassword.newPassword')}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
            />
            <input
              className="input-clean"
              type="password"
              placeholder={t('resetPassword.confirmPassword')}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
              style={{ marginTop: 8 }}
            />

            <button
              className="btn btn-primary"
              style={{ marginTop: 24, width: '100%', padding: 14, fontSize: 16 }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? <span className="spinner" style={{ display: 'inline-block' }} /> : t('resetPassword.reset')}
            </button>
          </>
        ) : (
          <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'underline', fontSize: 13 }}>
            {t('resetPassword.goToLogin')}
          </Link>
        )}
      </div>
    </div>
  );
}
