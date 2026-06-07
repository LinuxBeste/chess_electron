import { useState, useEffect } from 'react';
import * as api from '../api';
import { t } from '../translate';

interface Props {
  onClose: () => void;
}

export default function StatsDialog({ onClose }: Props) {
  const [stats, setStats] = useState<{ wins: number; losses: number; draws: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getMe()
      .then((data) => {
        if (data.stats) setStats(data.stats);
        else setStats(null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className="modal-card"
        style={{
          width: 360,
          maxWidth: '90vw',
          padding: 0,
          cursor: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e0e0e0', letterSpacing: '-0.3px' }}>
            {t('stats.title')}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: 18,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 4,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '16px 24px 24px' }}>
          {loading ? (
            <div style={{ fontSize: 13, fontWeight: 300, color: '#888', textAlign: 'center', padding: 24 }}>
              {t('stats.loading')}
            </div>
          ) : !stats ? (
            <div style={{ fontSize: 13, fontWeight: 300, color: '#555', textAlign: 'center', padding: 24 }}>
              {t('stats.unregistered')} <span style={{ color: 'var(--text)' }}>{t('stats.signUpPrompt')}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-around',
                  padding: '16px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <StatItem label={t('stats.wins')} value={stats.wins} color="var(--accent)" />
                <StatItem label={t('stats.losses')} value={stats.losses} color="var(--danger)" />
                <StatItem label={t('stats.draws')} value={stats.draws} color="var(--muted)" />
              </div>
              <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
                {t('stats.total', { count: stats.wins + stats.losses + stats.draws })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color, letterSpacing: '-0.5px' }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}
