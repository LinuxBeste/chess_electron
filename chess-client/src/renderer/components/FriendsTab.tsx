import { useEffect, useState } from 'react';
import { useStoreValue } from '../hooks/useStore';
import { store } from '../store';
import {
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
  getFriends,
  createGame,
} from '../api';
import { avatarSrc } from '../api';
import { socketManager } from '../socket';
import { t } from '../translate';
import type { FriendInfo, FriendRequestInfo } from '../../types';
import { X } from 'lucide-react';
import PlayerProfileDialog from './PlayerProfileDialog';
import logger from '../logger';

type Tab = 'friends' | 'requests' | 'sent';

export default function FriendsTab({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('friends');
  const friends = useStoreValue('friends');
  const incomingRequests = useStoreValue('incomingRequests');
  const outgoingRequests = useStoreValue('outgoingRequests');
  const [addUsername, setAddUsername] = useState('');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);

  useEffect(() => {
    logger.debug('FriendsTab mounted, loading friends and requests');
    loadFriends();
    loadRequests();
  }, []);

  async function loadFriends() {
    try {
      const f = await getFriends();
      store.set('friends', f);
      logger.debug('Friend list refreshed', { count: f.length });
    } catch (err: unknown) {
      logger.error('Failed to load friends list', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  async function loadRequests() {
    try {
      const r = await getFriendRequests();
      store.set('incomingRequests', r.incoming);
      store.set('outgoingRequests', r.outgoing);
      logger.debug('Friend requests loaded', {
        incoming: r.incoming.length,
        outgoing: r.outgoing.length,
      });
    } catch (err: unknown) {
      logger.error('Failed to load friend requests', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  async function handleAdd() {
    const name = addUsername.trim();
    if (name.length < 2) {
      setAddError(t('friends.usernameTooShort'));
      return;
    }
    if (name.length > 30) {
      setAddError(t('friends.usernameTooLong'));
      return;
    }
    setAddLoading(true);
    setAddError('');
    try {
      await sendFriendRequest(name);
      logger.info('Friend request sent', { username: name });
      setAddUsername('');
      loadRequests();
      store.toast(t('friends.requestSent', { name }), 'info');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('Failed to send friend request', { username: name, error: msg });
      setAddError(msg || 'Failed to send request');
    } finally {
      setAddLoading(false);
    }
  }

  async function handleAccept(id: string) {
    try {
      await acceptFriendRequest(id);
      logger.info('Friend request accepted', { requestId: id });
      loadRequests();
      loadFriends();
    } catch (err: unknown) {
      logger.error('Failed to accept friend request', {
        requestId: id,
        error: err instanceof Error ? err.message : String(err),
      });
      store.toast(t('friends.failedAccept'), 'error');
    }
  }

  async function handleDecline(id: string) {
    try {
      await declineFriendRequest(id);
      logger.info('Friend request declined', { requestId: id });
      loadRequests();
    } catch (err: unknown) {
      logger.error('Failed to decline friend request', {
        requestId: id,
        error: err instanceof Error ? err.message : String(err),
      });
      store.toast(t('friends.failedDecline'), 'error');
    }
  }

  async function handleCancel(id: string) {
    try {
      await cancelFriendRequest(id);
      logger.info('Friend request cancelled', { requestId: id });
      loadRequests();
    } catch (err: unknown) {
      logger.error('Failed to cancel friend request', {
        requestId: id,
        error: err instanceof Error ? err.message : String(err),
      });
      store.toast(t('friends.failedCancel'), 'error');
    }
  }

  async function handleRemove(friendId: string) {
    try {
      await removeFriend(friendId);
      logger.info('Friend removed', { friendId });
      loadFriends();
    } catch (err: unknown) {
      logger.error('Failed to remove friend', { friendId, error: err instanceof Error ? err.message : String(err) });
      store.toast(t('friends.failedRemove'), 'error');
    }
  }

  async function handleChallenge(friend: FriendInfo) {
    try {
      const game = await createGame('private');
      socketManager.send({
        type: 'challenge',
        toPlayerId: friend.playerId,
        gameId: game.id,
      });
      logger.info('Challenge sent to friend', {
        friendId: friend.playerId,
        friendName: friend.displayName,
        gameId: game.id,
      });
      store.toast(t('friends.challengeSent', { name: friend.displayName }), 'info');
    } catch (err: unknown) {
      logger.error('Failed to challenge friend', {
        friendId: friend.playerId,
        error: err instanceof Error ? err.message : String(err),
      });
      store.toast(t('friends.failedChallenge'), 'error');
    }
  }

  function renderFriend(f: FriendInfo) {
    const initial = (f.displayName || f.username || '?')[0].toUpperCase();
    return (
      <div
        key={f.playerId}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 0',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {f.avatarUrl ? (
          <img
            src={avatarSrc(f.avatarUrl)}
            alt=""
            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
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
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setProfilePlayerId(f.playerId)}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#e0e0e0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {f.displayName}
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: f.isOnline ? 'var(--success)' : '#555',
                marginLeft: 8,
                verticalAlign: 'middle',
              }}
            />
          </div>
          {f.currentGameId && <span style={{ fontSize: 11, color: '#888' }}>{t('friends.inGame')}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {f.isOnline && (
            <button className="btn btn-xs btn-secondary" onClick={() => handleChallenge(f)}>
              {t('friends.challenge')}
            </button>
          )}
          <button
            className="btn btn-xs btn-ghost"
            onClick={() => handleRemove(f.playerId)}
            style={{ color: '#f44336' }}
          >
            {t('friends.remove')}
          </button>
        </div>
      </div>
    );
  }

  function renderRequest(r: FriendRequestInfo, isIncoming: boolean) {
    const initial = (r.displayName || r.username || '?')[0].toUpperCase();
    return (
      <div
        key={r.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 0',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {r.avatarUrl ? (
          <img
            src={avatarSrc(r.avatarUrl)}
            alt=""
            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
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
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setProfilePlayerId(r.playerId)}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0' }}>{r.displayName}</div>
        </div>
        {isIncoming && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button className="btn btn-xs btn-primary" onClick={() => handleAccept(r.id)}>
              {t('friends.accept')}
            </button>
            <button className="btn btn-xs btn-ghost" onClick={() => handleDecline(r.id)}>
              {t('friends.decline')}
            </button>
          </div>
        )}
        {!isIncoming && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#888' }}>{t('friends.pending')}</span>
            <button className="btn btn-xs btn-ghost" onClick={() => handleCancel(r.id)}>
              {t('friends.cancel')}
            </button>
          </div>
        )}
      </div>
    );
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
          width: 480,
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          cursor: 'auto',
          textAlign: 'left',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px 0',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>{t('friends.title')}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              padding: 4,
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Add friend input */}
        <div style={{ padding: '12px 20px', display: 'flex', gap: 8 }}>
          <input
            className="input"
            placeholder={t('friends.addPlaceholder')}
            value={addUsername}
            onChange={(e) => setAddUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
            maxLength={30}
            style={{ flex: 1 }}
          />
          <button className="btn btn-sm btn-primary" onClick={handleAdd} disabled={addLoading}>
            {addLoading ? '...' : t('friends.add')}
          </button>
        </div>
        {addError && <p style={{ fontSize: 12, color: '#f44336', padding: '0 20px', margin: 0 }}>{addError}</p>}

        {/* Tabs */}
        <div className="settings-tabs" style={{ padding: '8px 20px 0' }}>
          <button className={`settings-tab${tab === 'friends' ? ' active' : ''}`} onClick={() => setTab('friends')}>
            {t('friends.friends')} ({friends.length})
          </button>
          <button className={`settings-tab${tab === 'requests' ? ' active' : ''}`} onClick={() => setTab('requests')}>
            {t('friends.requests')} ({incomingRequests.length})
          </button>
          <button className={`settings-tab${tab === 'sent' ? ' active' : ''}`} onClick={() => setTab('sent')}>
            {t('friends.sent')} ({outgoingRequests.length})
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
          {tab === 'friends' &&
            (friends.length === 0 ? (
              <p style={{ fontSize: 13, color: '#888', textAlign: 'center', padding: 24 }}>{t('friends.noFriends')}</p>
            ) : (
              friends.map(renderFriend)
            ))}
          {tab === 'requests' &&
            (incomingRequests.length === 0 ? (
              <p style={{ fontSize: 13, color: '#888', textAlign: 'center', padding: 24 }}>{t('friends.noRequests')}</p>
            ) : (
              incomingRequests.map((r) => renderRequest(r, true))
            ))}
          {tab === 'sent' &&
            (outgoingRequests.length === 0 ? (
              <p style={{ fontSize: 13, color: '#888', textAlign: 'center', padding: 24 }}>{t('friends.noSent')}</p>
            ) : (
              outgoingRequests.map((r) => renderRequest(r, false))
            ))}
        </div>
      </div>

      {profilePlayerId && <PlayerProfileDialog playerId={profilePlayerId} onClose={() => setProfilePlayerId(null)} />}
    </div>
  );
}
