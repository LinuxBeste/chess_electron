import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import logger from '../logger';
import * as api from '../api';
import { store } from '../store';
import { t } from '../translate';
import type { ArchivedGame } from '../../types';
import { ArrowLeft, Crown } from 'lucide-react';
import { Skeleton, SkeletonAvatar, SkeletonCard, SkeletonLine } from '../components/Skeleton';

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(ts);
}

export default function ProfilePage() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<api.PlayerProfile | null>(null);
  const [games, setGames] = useState<ArchivedGame[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingGames, setLoadingGames] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [archiveError, setArchiveError] = useState('');

  const [friendLoading, setFriendLoading] = useState(false);

  const myId = store.get('playerId');
  const isMe = myId === playerId;

  useEffect(() => {
    if (!playerId) return;
    logger.info('ProfilePage mounted', { playerId });
    setLoadingProfile(true);
    setLoadingGames(true);
    setProfileError('');
    setArchiveError('');

    api
      .getPlayerProfile(playerId)
      .then((p) => {
        setProfile(p);
      })
      .catch((e) => {
        const msg = e.message || t('common.loading');
        logger.error('Profile load failed', { playerId, msg });
        setProfileError(msg);
      })
      .finally(() => setLoadingProfile(false));

    api
      .getArchivedGamesForPlayer(playerId, 1, 20)
      .then((g) => setGames(g.games))
      .catch((e) => {
        const msg = e.message || t('common.loading');
        logger.error('Archive load failed', { playerId, msg });
        setArchiveError(msg);
      })
      .finally(() => setLoadingGames(false));
  }, [playerId]);

  async function handleAddFriend() {
    if (!profile?.username) return;
    setFriendLoading(true);
    try {
      await api.sendFriendRequest(profile.username);
      store.toast(t('friends.requestSent', { name: profile.displayName || profile.username }), 'info');
      setProfile({ ...profile, friendStatus: 'outgoing' });
    } catch (e: unknown) {
      store.toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setFriendLoading(false);
    }
  }

  async function handleRemoveFriend() {
    if (!profile) return;
    setFriendLoading(true);
    try {
      await api.removeFriend(profile.id);
      store.toast(t('profile.removeFriend'), 'info');
      setProfile({ ...profile, friendStatus: 'none' });
    } catch (e: unknown) {
      store.toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setFriendLoading(false);
    }
  }

  if (loadingProfile) {
    return (
      <div className="profile-page">
        <SkeletonCard width="100%" height={140} style={{ marginTop: 24 }} />
        <SkeletonAvatar size={80} />
        <SkeletonLine width="40%" style={{ marginTop: 16, marginLeft: 'auto', marginRight: 'auto' }} />
        <Skeleton width="100%" height={60} borderRadius="var(--radius)" style={{ marginTop: 16 }} />
        <SkeletonCard width="100%" height={200} style={{ marginTop: 16 }} />
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="profile-page" style={{ textAlign: 'center' }}>
        <p style={{ color: '#f44336', marginTop: 48, fontSize: 13 }}>{profileError || t('common.unknown')}</p>
        <p style={{ color: '#888', fontSize: 12, marginTop: 8 }}>
          {t('common.loading')}: {playerId}
        </p>
        <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate(-1)}>
          {t('profile.back')}
        </button>
      </div>
    );
  }

  const displayStats = profile.stats || profile.archivedStats || { wins: 0, losses: 0, draws: 0 };
  const totalGames = profile.totalGames || displayStats.wins + displayStats.losses + displayStats.draws;
  const winRate = totalGames > 0 ? Math.round((displayStats.wins / totalGames) * 100) : 0;

  function statBar(wins: number, losses: number, draws: number) {
    const total = wins + losses + draws || 1;
    return (
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 16 }}>
        <div style={{ flex: wins / total, background: '#4caf50', minWidth: wins > 0 ? 2 : 0 }} />
        <div style={{ flex: draws / total, background: '#ff9800', minWidth: draws > 0 ? 2 : 0 }} />
        <div style={{ flex: losses / total, background: '#f44336', minWidth: losses > 0 ? 2 : 0 }} />
      </div>
    );
  }

  const initial = (profile.displayName || profile.username || '?')[0].toUpperCase();

  return (
    <div className="profile-page">
      <button
        className="btn btn-ghost"
        style={{
          marginTop: 0,
          alignSelf: 'flex-start',
          flexShrink: 0,
          fontSize: 14,
          padding: '8px 18px',
          position: 'relative',
          zIndex: 10,
        }}
        onClick={() => navigate(-1)}
      >
        <ArrowLeft size={16} style={{ marginRight: 4 }} /> {t('profile.back')}
      </button>

      <div className="profile-body stagger-enter">
        {/* ─── Main column ─── */}
        <div className="profile-main">
          <div className="game-card" style={{ padding: '0 24px 24px', marginTop: 0 }}>
            <div className="profile-header-row">
              {profile.avatarUrl ? (
                <img className="profile-avatar" src={api.avatarSrc(profile.avatarUrl)} alt="" />
              ) : (
                <div className="profile-avatar-placeholder">{initial}</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>
                  {profile.displayName || profile.username || t('common.unknown')}
                </h2>
                {profile.username && profile.displayName && profile.username !== profile.displayName && (
                  <p style={{ fontSize: 15, color: '#888', margin: '2px 0 8px' }}>@{profile.username}</p>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span
                    className={
                      'profile-badge ' + (profile.isRegistered ? 'profile-badge-registered' : 'profile-badge-temp')
                    }
                  >
                    {profile.isRegistered ? t('settings.account.registered') : t('settings.account.temporary')}
                  </span>
                  <span
                    className={
                      profile.isOnline ? 'profile-badge profile-badge-online' : 'profile-badge profile-badge-offline'
                    }
                  >
                    <span
                      className={
                        'profile-badge-dot ' +
                        (profile.isOnline ? 'profile-badge-dot-online' : 'profile-badge-dot-offline')
                      }
                    />
                    {profile.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            <div className="profile-stats-grid">
              <div className="profile-stat">
                <div className="profile-stat-value">{profile.rating ?? '-'}</div>
                <div className="profile-stat-label">{t('profile.rating')}</div>
              </div>
              <div className="profile-stat">
                <div className="profile-stat-value">{totalGames}</div>
                <div className="profile-stat-label">{t('profile.gamesPlayed')}</div>
              </div>
              <div className="profile-stat">
                <div className="profile-stat-value">{profile.friendCount}</div>
                <div className="profile-stat-label">Friends</div>
              </div>
              <div className="profile-stat">
                <div className="profile-stat-value">{winRate}%</div>
                <div className="profile-stat-label">{t('profile.winRate')}</div>
              </div>
            </div>

            <div className="profile-about">
              {profile.createdAt && <span>Joined {fmtDate(profile.createdAt)}</span>}
              {profile.isOnline && profile.currentGameId && (
                <span className="profile-about-game">Currently in a game</span>
              )}
            </div>

            <div className="profile-action-row" style={{ marginTop: 12 }}>
              {!isMe && profile.isRegistered && profile.friendStatus === 'none' && (
                <button className="btn btn-sm btn-secondary" onClick={handleAddFriend} disabled={friendLoading}>
                  {friendLoading ? '...' : t('profile.addFriend')}
                </button>
              )}
              {!isMe && profile.friendStatus === 'outgoing' && (
                <span className="btn btn-sm btn-ghost" style={{ opacity: 0.6, cursor: 'default' }}>
                  {t('profile.pendingRequest')}
                </span>
              )}
              {!isMe && profile.friendStatus === 'incoming' && (
                <button className="btn btn-sm btn-primary" onClick={handleAddFriend} disabled={friendLoading}>
                  {friendLoading ? '...' : t('profile.acceptRequestShort')}
                </button>
              )}
              {!isMe && profile.friendStatus === 'friends' && (
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={handleRemoveFriend}
                  disabled={friendLoading}
                  style={{ color: '#f44336' }}
                >
                  {friendLoading ? '...' : t('profile.removeFriend')}
                </button>
              )}
            </div>
          </div>

          {/* Performance card */}
          <div className="game-card profile-card">
            <h3 className="profile-card-title">Performance</h3>
            <div className="profile-card-sub">
              Across {totalGames} completed {totalGames === 1 ? 'game' : 'games'}
            </div>
            <div className="profile-perf-row">
              <div>
                <div className="profile-perf-value" style={{ color: '#4caf50' }}>
                  {displayStats.wins}
                </div>
                <div className="profile-perf-label">{t('stats.wins')}</div>
                <div className="profile-perf-pct" style={{ color: totalGames > 0 ? '#4caf50' : '#888' }}>
                  {totalGames > 0 ? Math.round((displayStats.wins / totalGames) * 100) + '%' : '-'}
                </div>
              </div>
              <div>
                <div className="profile-perf-value" style={{ color: '#ff9800' }}>
                  {displayStats.draws}
                </div>
                <div className="profile-perf-label">{t('stats.draws')}</div>
                <div className="profile-perf-pct" style={{ color: totalGames > 0 ? '#ff9800' : '#888' }}>
                  {totalGames > 0 ? Math.round((displayStats.draws / totalGames) * 100) + '%' : '-'}
                </div>
              </div>
              <div>
                <div className="profile-perf-value" style={{ color: '#f44336' }}>
                  {displayStats.losses}
                </div>
                <div className="profile-perf-label">{t('stats.losses')}</div>
                <div className="profile-perf-pct" style={{ color: totalGames > 0 ? '#f44336' : '#888' }}>
                  {totalGames > 0 ? Math.round((displayStats.losses / totalGames) * 100) + '%' : '-'}
                </div>
              </div>
            </div>
            {statBar(displayStats.wins, displayStats.losses, displayStats.draws)}
            <div className="profile-wl-row">
              <span>
                W/L:{' '}
                {displayStats.losses > 0
                  ? (displayStats.wins / displayStats.losses).toFixed(2)
                  : displayStats.wins > 0
                    ? '∞'
                    : '-'}
              </span>
              <span>Win rate: {winRate}%</span>
            </div>
          </div>
        </div>

        {/* ─── Side column ─── */}
        <div className="profile-side">
          {/* Tournaments card */}
          {profile.isRegistered && (
            <div className="game-card profile-card">
              <h3 className="profile-card-title">Tournaments</h3>
              <div className="profile-tourney-row">
                <div>
                  <span className="profile-tourney-stat">{profile.tournaments.total}</span>
                  <span className="profile-tourney-label">entered</span>
                </div>
                <div>
                  <span className="profile-tourney-stat" style={{ color: '#f5a623' }}>
                    {profile.tournaments.wins}
                  </span>
                  <span className="profile-tourney-label">won</span>
                </div>
                {profile.tournaments.currentId && (
                  <div>
                    <span className="profile-tourney-active">In a tournament now</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Match History */}
          <div className="game-card profile-card" style={{ flex: 1 }}>
            <div className="profile-match-header">
              <h3 className="profile-card-title" style={{ margin: 0 }}>
                {t('profile.matchHistory')}
              </h3>
              {games.length > 0 && (
                <button className="btn btn-xs btn-ghost" onClick={() => navigate('/archive?player=' + playerId)}>
                  View all
                </button>
              )}
            </div>
            {loadingGames ? (
              <SkeletonCard width="100%" height={180} />
            ) : archiveError ? (
              <p style={{ fontSize: 12, color: '#888', textAlign: 'center', padding: 20 }}>{archiveError}</p>
            ) : games.length === 0 ? (
              <p style={{ fontSize: 13, color: '#888', textAlign: 'center', padding: 20 }}>{t('profile.noGames')}</p>
            ) : (
              <div className="game-list">
                {games.map((g) => {
                  const whitePid = g.white_player_id;
                  const blackPid = g.black_player_id;
                  const whiteName = g.white_display_name || whitePid || '?';
                  const blackName = g.black_display_name || blackPid || '?';
                  const winColor = g.winner;
                  const isWin = !!(
                    winColor &&
                    ((winColor === 'white' && whitePid === profile.id) ||
                      (winColor === 'black' && blackPid === profile.id))
                  );
                  const isLoss = !!(
                    profile.id &&
                    winColor &&
                    !isWin &&
                    (whitePid === profile.id || blackPid === profile.id)
                  );
                  const resultColor = isWin ? '#4caf50' : isLoss ? '#f44336' : '#ff9800';
                  const resultLabel = isWin
                    ? t('matchHistory.won')
                    : isLoss
                      ? t('matchHistory.lost')
                      : t('matchHistory.draw');
                  return (
                    <div key={g.id} className="game-card profile-match-row" onClick={() => navigate(`/game/${g.id}`)}>
                      <div className="profile-match-pawn">
                        <Crown size={16} />
                      </div>
                      <div className="profile-match-info">
                        <div className="profile-match-names">
                          {whiteName} vs {blackName}
                        </div>
                        <div className="profile-match-meta">
                          {g.played_at ? timeAgo(g.played_at) : ''}
                          {g.time_control ? ` · ${g.time_control}` : ''}
                        </div>
                      </div>
                      <span
                        className="profile-match-result"
                        style={{ color: resultColor, background: resultColor + '18' }}
                      >
                        {resultLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
