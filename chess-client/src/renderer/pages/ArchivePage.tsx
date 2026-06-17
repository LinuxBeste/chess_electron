import { useState, useEffect } from 'react';
import logger from '../logger';
import * as api from '../api';
import { t } from '../translate';
import { useNavigate } from 'react-router-dom';

export default function ArchivePage() {
  const navigate = useNavigate();
  const [games, setGames] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterPlayer, setFilterPlayer] = useState('');
  const limit = 20;

  useEffect(() => {
    load();
  }, [page, filterPlayer]);

  async function load() {
    setLoading(true);
    try {
      const result = await api.getArchivedGames({
        page,
        limit,
        player: filterPlayer.trim().slice(0, 100) || undefined,
      });
      setGames(result.games);
      setTotal(result.total);
    } catch {
      logger.warn('Failed to load archive');
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="page-container" style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>
      <h2 style={{ margin: '24px 0 16px', fontSize: 20, fontWeight: 600 }}>{t('matchHistory.title')}</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          className="input"
          type="text"
          placeholder={t('matchHistory.searchPlayer')}
          style={{ flex: 1, fontSize: 13 }}
          value={filterPlayer}
          onChange={(e) => {
            setFilterPlayer(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>{t('common.loading')}</div>
      ) : games.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>{t('matchHistory.noGames')}</div>
      ) : (
        <>
          <div className="game-list" style={{ marginBottom: 16 }}>
            {games.map((g) => (
              <div
                key={g.id}
                className="game-card"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer' }}
                onClick={() => navigate('/result/' + g.id)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>
                    {g.white_display_name} vs {g.black_display_name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {new Date(g.played_at).toLocaleDateString()} — {g.status} — {g.reason || ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: g.winner ? '#4f8ef7' : 'var(--muted)' }}>
                  {g.winner
                    ? (g.winner === g.white_player_id ? g.white_display_name : g.black_display_name) + ' won'
                    : 'Draw'}
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
    </div>
  );
}
