import { useState, useEffect } from 'react';
import logger from '../logger';
import * as api from '../api';
import { t } from '../translate';
import PlayerProfileDialog from '../components/PlayerProfileDialog';

interface LeaderboardEntry {
  playerId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const limit = 50;

  useEffect(() => {
    logger.info('LeaderboardPage mounted');
    load();
  }, [page]);

  async function load() {
    setLoading(true);
    try {
      const result = await api.getLeaderboard(page, limit);
      setEntries(result.entries);
      setTotal(result.total);
    } catch {
      logger.warn('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="page-container" style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <h2 style={{ margin: '24px 0 16px', fontSize: 20, fontWeight: 600 }}>{t('stats.title')}</h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>{t('common.loading')}</div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>{t('lobby.noOpenGames')}</div>
      ) : (
        <>
          <div className="game-list" style={{ marginBottom: 16 }}>
            {entries.map((e, i) => (
              <div
                key={e.playerId}
                className="game-card"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}
              >
                <span
                  style={{ width: 28, textAlign: 'right', fontWeight: 600, color: i < 3 ? '#f5a623' : 'var(--muted)' }}
                >
                  {(page - 1) * limit + i + 1}.
                </span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#2a2a2a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    color: '#555',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {e.avatarUrl ? (
                    <img
                      src={api.avatarSrc(e.avatarUrl)}
                      alt=""
                      style={{ width: 32, height: 32, objectFit: 'cover' }}
                    />
                  ) : (
                    (e.displayName || e.username || '?')[0].toUpperCase()
                  )}
                </div>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setProfilePlayerId(e.playerId)}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{e.displayName || e.username}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>@{e.username}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{e.rating}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {e.wins}W / {e.losses}L / {e.draws}D
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t('common.prev')}
              </button>
              <span style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>
                {page} / {totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('common.next')}
              </button>
            </div>
          )}
        </>
      )}

      {profilePlayerId && <PlayerProfileDialog playerId={profilePlayerId} onClose={() => setProfilePlayerId(null)} />}
    </div>
  );
}
