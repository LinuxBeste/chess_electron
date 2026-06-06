import { useState, useEffect } from 'react';
import { store } from '../store';
import * as api from '../api';

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
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e0e0e0', letterSpacing: '-0.3px' }}>Stats</h2>
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
              Loading...
            </div>
          ) : !stats ? (
            <div style={{ fontSize: 13, fontWeight: 300, color: '#555', textAlign: 'center', padding: 24 }}>
              Stats are only available for registered accounts.{' '}
              <span style={{ color: 'var(--text)' }}>Log in or create an account to track your stats.</span>
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
                <StatItem label="Wins" value={stats.wins} color="var(--accent)" />
                <StatItem label="Losses" value={stats.losses} color="var(--danger)" />
                <StatItem label="Draws" value={stats.draws} color="var(--muted)" />
              </div>
              <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
                Total: {stats.wins + stats.losses + stats.draws} games
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
