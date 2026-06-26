import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayerProfile, sendFriendRequest, PlayerProfile, avatarSrc } from '../api';
import { store } from '../store';
import { t } from '../translate';
import logger from '../logger';
import { X, ChevronRight } from 'lucide-react';

interface Props {
  playerId: string;
  onClose: () => void;
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function PlayerProfileDialog({ playerId, onClose }: Props) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState('');
  const [friendLoading, setFriendLoading] = useState(false);
  const [friendMsg, setFriendMsg] = useState('');

  useEffect(() => {
    logger.info('Loading profile for playerId=' + playerId);
    const aborted = { current: false };
    getPlayerProfile(playerId)
      .then((p) => {
        if (aborted.current) return;
        logger.info('Profile loaded: username=' + (p.username || '?'));
        setProfile(p);
      })
      .catch((e: unknown) => {
        if (aborted.current) return;
        logger.error('Profile load failed: playerId=' + playerId + ' error=' + e);
        setError(e instanceof Error ? e.message : 'Failed to load profile');
      });
    return () => {
      aborted.current = true;
    };
  }, [playerId]);

  async function handleAddFriend() {
    if (!profile?.username) return;
    logger.info('Sending friend request from profile: username=' + profile.username);
    setFriendLoading(true);
    setFriendMsg('');
    try {
      await sendFriendRequest(profile.username);
      logger.info('Friend request sent from profile: username=' + profile.username);
      setFriendMsg(t('friends.requestSent', { name: profile.displayName || profile.username }));
      store.toast(t('friends.requestSent', { name: profile.displayName || profile.username }), 'info');
    } catch (e: unknown) {
      logger.error('Friend request failed from profile: ' + e);
      setFriendMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setFriendLoading(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card"
        style={{
          width: 360,
          maxWidth: '90vw',
          padding: 28,
          textAlign: 'center',
          cursor: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4, fontSize: 18 }}
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <p style={{ color: '#f44336', fontSize: 13 }}>{error}</p>
        ) : !profile ? (
          <p style={{ color: '#888', fontSize: 13 }}>Loading...</p>
        ) : (
          <>
            {/* Avatar */}
            {profile.avatarUrl ? (
              <img
                src={avatarSrc(profile.avatarUrl)}
                alt=""
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  margin: '0 auto 12px',
                  display: 'block',
                }}
              />
            ) : (
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: '#2a2a2a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  fontSize: 28,
                  color: '#555',
                }}
              >
                {(profile.displayName || profile.username || '?')[0].toUpperCase()}
              </div>
            )}

            {/* Name & badge */}
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e0e0e0', margin: '0 0 4px' }}>
              {profile.displayName || profile.username || t('common.unknown')}
            </h2>
            {profile.username && profile.displayName && profile.username !== profile.displayName && (
              <p style={{ fontSize: 12, color: '#888', margin: '0 0 8px' }}>@{profile.username}</p>
            )}

            <span
              style={{
                display: 'inline-block',
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 4,
                fontWeight: 600,
                marginBottom: 16,
                background: profile.isRegistered ? 'rgba(76,175,80,0.2)' : 'rgba(255,152,0,0.2)',
                color: profile.isRegistered ? '#4caf50' : '#ff9800',
              }}
            >
              {profile.isRegistered ? t('settings.account.registered') : t('settings.account.temporary')}
            </span>

            {/* Joined date */}
            {profile.createdAt && (
              <p style={{ fontSize: 12, color: '#888', margin: '0 0 16px' }}>
                {t('settings.account.joined')}: {fmtDate(profile.createdAt)}
              </p>
            )}

            {/* Add Friend */}
            {profile.isRegistered && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleAddFriend}
                disabled={friendLoading}
                style={{ marginBottom: 16 }}
              >
                {friendLoading ? '...' : t('friends.add')}
              </button>
            )}
            {friendMsg && <p style={{ fontSize: 12, color: '#888', margin: '-8px 0 16px' }}>{friendMsg}</p>}

            {/* Stats */}
            {profile.stats ? (
              <div
                style={{
                  display: 'flex',
                  gap: 24,
                  justifyContent: 'center',
                  padding: '12px 0',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#4caf50' }}>{profile.stats.wins}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{t('settings.account.wins')}</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#f44336' }}>{profile.stats.losses}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{t('settings.account.losses')}</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#ff9800' }}>{profile.stats.draws}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{t('settings.account.draws')}</div>
                </div>
              </div>
            ) : (
              <p
                style={{
                  fontSize: 12,
                  color: '#888',
                  margin: '12px 0 0',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  paddingTop: 12,
                }}
              >
                {t('stats.unregistered')}
              </p>
            )}

            <div style={{ marginTop: 12 }}>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  onClose();
                  navigate(`/profile/${profile.id}`);
                }}
              >
                {t('profile.viewFullProfile')} <ChevronRight size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
