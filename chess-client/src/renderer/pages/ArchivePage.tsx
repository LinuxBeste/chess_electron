import { useState, useEffect, useRef } from 'react';
import logger from '../logger';
import * as api from '../api';
import { t } from '../translate';
import { useNavigate } from 'react-router-dom';
import { Crown, ChevronLeft, ChevronRight } from 'lucide-react';
import { SkeletonLine } from '../components/Skeleton';
import type { ArchivedGame } from '../../types';

// Archive page: browse and filter completed games
export default function ArchivePage() {
  const navigate = useNavigate();
  const [games, setGames] = useState<ArchivedGame[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterPlayer, setFilterPlayer] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const limit = 20;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilter(filterPlayer), 300);
    return () => clearTimeout(timer);
  }, [filterPlayer]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    load(controller.signal);
    return () => controller.abort();
  }, [page, debouncedFilter]);

  async function load(signal: AbortSignal) {
    setLoading(true);
    try {
      const result = await api.getArchivedGames({
        page,
        limit,
        player: debouncedFilter.trim().slice(0, 100) || undefined,
        signal,
      });
      if (signal.aborted) return;
      setGames(result.games);
      setTotal(result.total);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      logger.warn('Failed to load archive');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="page-container" style={{ padding: '0 24px' }}>
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
        <div style={{ padding: 16 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonLine key={i} style={{ marginBottom: 12 }} />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>{t('matchHistory.noGames')}</div>
      ) : (
        <>
          <div className="game-list" style={{ marginBottom: 16 }}>
            {games.map((g) => {
              const resultColor = !g.winner ? '#888' : '#4f8ef7';
              const resultLabel = g.winner ? g.result : '½–½';
              const date = new Date(g.played_at);
              const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
              const now = Date.now();
              const diffMs = now - g.played_at;
              const mins = Math.floor(diffMs / 60000);
              const hrs = Math.floor(mins / 60);
              const days = Math.floor(hrs / 24);
              const relativeTime =
                days > 0 ? dateStr : hrs > 0 ? `${hrs}h ago` : mins > 0 ? `${mins}m ago` : 'just now';
              const moveCount = g.move_history ? g.move_history.split(' ').filter(Boolean).length : 0;
              const borderColor = !g.winner ? '#555' : g.winner === 'white' ? '#22c55e' : '#e55';
              const resultDesc = g.reason
                ? (g.result === '1-0' ? 'White won' : g.result === '0-1' ? 'Black won' : 'Draw') + ' by ' + g.reason
                : '';
              return (
                <div
                  key={g.id}
                  className="game-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderLeft: '4px solid ' + borderColor,
                  }}
                >
                  <div style={{ flex: 1, cursor: 'pointer', minWidth: 0 }} onClick={() => navigate('/result/' + g.id)}>
                    <div
                      style={{
                        fontWeight: 500,
                        fontSize: 14,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ color: g.winner === 'white' ? 'var(--text)' : 'var(--muted)' }}>
                        <Crown size={14} style={{ marginRight: 2, verticalAlign: 'middle' }} /> {g.white_display_name}
                      </span>
                      <span style={{ color: 'var(--muted)', margin: '0 6px' }}>vs</span>
                      <span style={{ color: g.winner === 'black' ? 'var(--text)' : 'var(--muted)' }}>
                        <Crown size={14} style={{ marginRight: 2, verticalAlign: 'middle' }} /> {g.black_display_name}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                        marginTop: 2,
                      }}
                    >
                      <span>{relativeTime}</span>
                      <span style={{ color: 'var(--accent)', fontSize: 10, fontWeight: 600 }}>{g.time_control}</span>
                      <span style={{ color: '#777' }}>{moveCount} moves</span>
                    </div>
                    {resultDesc && <div style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>{resultDesc}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: resultColor }}>{resultLabel}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{g.status}</div>
                  </div>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '4px 8px', fontSize: 11, flexShrink: 0 }}
                    onClick={() => navigate('/game/' + g.id)}
                  >
                    {t('gameReview.review')}
                  </button>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={14} /> {t('common.prev')}
              </button>
              <span style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>
                {page} / {totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('common.next')} <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
