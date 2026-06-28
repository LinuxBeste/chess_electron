import { useState, useEffect } from 'react';
import logger from '../logger';
import * as api from '../api';
import { t } from '../translate';
import { store } from '../store';
import PlayerProfileDialog from '../components/PlayerProfileDialog';
import { Trophy, Medal, ChevronLeft, ChevronRight } from 'lucide-react';
import { SkeletonLine } from '../components/Skeleton';

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

const rankIcons = [
  <Trophy key={1} size={16} color="#f5a623" fill="#f5a623" />,
  <Medal key={2} size={16} color="#c0c0c0" fill="#c0c0c0" />,
  <Medal key={3} size={16} color="#cd7f32" fill="#cd7f32" />,
];

export default function LeaderboardPage() {
  const myId = store.get('playerId');
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
    } catch (err: unknown) {
      logger.warn('Failed to load leaderboard', err);
      store.toast(err instanceof Error ? err.message : 'Failed to load leaderboard', 'error');
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="page-container" style={{ flex: 1, padding: '0 24px' }}>
      <h2 style={{ margin: '24px 0 16px', fontSize: 20, fontWeight: 600 }}>{t('stats.title')}</h2>

      {loading ? (
        <div style={{ padding: 16 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonLine key={i} style={{ marginBottom: 12 }} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>{t('stats.empty')}</div>
      ) : (
        <>
          <div className="game-list" style={{ marginBottom: 16 }}>
            {entries.map((e, i) => {
              const totalGames = e.wins + e.losses + e.draws;
              const winRate = totalGames > 0 ? Math.round((e.wins / totalGames) * 100) : 0;
              const globalRank = (page - 1) * limit + i + 1;
              const isMe = e.playerId === myId;
              const perfRating = e.rating + (e.wins - e.losses) * 20;
              const wPct = totalGames > 0 ? Math.round((e.wins / totalGames) * 100) : 0;
              const dPct = totalGames > 0 ? Math.round((e.draws / totalGames) * 100) : 0;
              const lPct = totalGames > 0 ? Math.round((e.losses / totalGames) * 100) : 0;
              return (
                <div
                  key={e.playerId}
                  className="game-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    ...(isMe ? { borderColor: 'var(--accent)', borderWidth: 2 } : {}),
                  }}
                >
                  <span
                    style={{
                      width: 32,
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: i < 3 ? 16 : 13,
                      color: i < 3 ? '#f5a623' : 'var(--muted)',
                    }}
                  >
                    {i < 3 ? rankIcons[i] : globalRank + '.'}
                  </span>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: '#2a2a2a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      color: '#555',
                      overflow: 'hidden',
                      flexShrink: 0,
                      ...(isMe ? { border: '2px solid var(--accent)' } : {}),
                    }}
                  >
                    {e.avatarUrl ? (
                      <img
                        src={api.avatarSrc(e.avatarUrl)}
                        alt=""
                        style={{ width: 36, height: 36, objectFit: 'cover' }}
                      />
                    ) : (
                      (e.displayName || e.username || '?')[0].toUpperCase()
                    )}
                  </div>
                  <div
                    style={{ flex: '0 0 170px', cursor: 'pointer', minWidth: 0 }}
                    onClick={() => setProfilePlayerId(e.playerId)}
                  >
                    <div
                      style={{
                        fontWeight: 500,
                        fontSize: 14,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {e.displayName || e.username}
                      {isMe && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: 'var(--accent)',
                            background: 'rgba(79,142,247,0.12)',
                            padding: '1px 5px',
                            borderRadius: 4,
                          }}
                        >
                          You
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>@{e.username}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        style={{
                          flex: 1,
                          height: 6,
                          borderRadius: 3,
                          background: 'var(--surface2)',
                          display: 'flex',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ width: wPct + '%', background: 'var(--success)', transition: 'width 0.3s' }} />
                        {dPct > 0 && <div style={{ width: dPct + '%', background: '#777' }} />}
                        <div style={{ width: lPct + '%', background: '#e55' }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {winRate}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>W{e.wins}</span>
                      {e.draws > 0 && <span style={{ fontSize: 11, color: '#888' }}>D{e.draws}</span>}
                      <span style={{ fontSize: 11, color: '#e55', fontWeight: 600 }}>L{e.losses}</span>
                      <span style={{ fontSize: 11, color: '#666' }}>—</span>
                      <span style={{ fontSize: 11, color: '#777' }}>{totalGames} games</span>
                      <span style={{ fontSize: 10, color: '#555' }}>PR {perfRating}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>{e.rating}</div>
                  </div>
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

      {profilePlayerId && <PlayerProfileDialog playerId={profilePlayerId} onClose={() => setProfilePlayerId(null)} />}
    </div>
  );
}
