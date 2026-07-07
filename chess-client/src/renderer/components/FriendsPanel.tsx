import { useState, useEffect, useRef } from 'react';
import { useStoreValue } from '../hooks/useStore';
import { store } from '../store';
import { socketManager } from '../socket';
import {
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
  searchUsers,
} from '../api';
import type { UserSearchResult } from '../api';
import { t } from '../translate';
import logger from '../logger';

// Friends panel: manage friends, requests, and challenges
export default function FriendsPanel() {
  const friends = useStoreValue('friends');
  const incomingRequests = useStoreValue('incomingRequests');
  const outgoingRequests = useStoreValue('outgoingRequests');
  const isRegistered = useStoreValue('isRegistered');
  const [activeTab, setActiveTab] = useState<'online' | 'all' | 'requests' | 'sent'>('online');
  const [addUsername, setAddUsername] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    getFriends()
      .then((f) => store.set('friends', f))
      .catch(() => {});
    getFriendRequests()
      .then((r) => {
        store.set('incomingRequests', r.incoming);
        store.set('outgoingRequests', r.outgoing);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (showAdd && addInputRef.current) addInputRef.current.focus();
  }, [showAdd]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = addUsername.trim();
    if (q.length < 2 || !showAdd) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      searchUsers(q)
        .then((results) => {
          setSearchResults(results);
          setShowResults(results.length > 0);
        })
        .catch(() => {});
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [addUsername, showAdd]);

  function handleAddFriend() {
    const name = addUsername.trim();
    if (!name || name.length < 2 || sending) return;
    setSending(true);
    sendFriendRequest(name)
      .then(() => {
        store.toast(t('friends.requestSent', { name }), 'info');
        setAddUsername('');
        setShowAdd(false);
        setSearchResults([]);
        setShowResults(false);
        getFriendRequests()
          .then((r) => {
            store.set('incomingRequests', r.incoming);
            store.set('outgoingRequests', r.outgoing);
          })
          .catch(() => {});
      })
      .catch((err) => {
        logger.error('Failed to send friend request', err);
        store.toast(err instanceof Error ? err.message : 'Failed to send request', 'error');
      })
      .finally(() => setSending(false));
  }

  function handleAcceptRequest(requestId: string) {
    acceptFriendRequest(requestId)
      .then(() => {
        getFriends()
          .then((f) => store.set('friends', f))
          .catch(() => {});
        getFriendRequests()
          .then((r) => {
            store.set('incomingRequests', r.incoming);
            store.set('outgoingRequests', r.outgoing);
          })
          .catch(() => {});
      })
      .catch(() => store.toast(t('friends.failedAccept'), 'error'));
  }

  function handleDeclineRequest(requestId: string) {
    declineFriendRequest(requestId)
      .then(() => {
        getFriendRequests()
          .then((r) => {
            store.set('incomingRequests', r.incoming);
            store.set('outgoingRequests', r.outgoing);
          })
          .catch(() => {});
      })
      .catch(() => store.toast(t('friends.failedDecline'), 'error'));
  }

  function handleCancelRequest(requestId: string) {
    cancelFriendRequest(requestId)
      .then(() => {
        getFriendRequests()
          .then((r) => {
            store.set('incomingRequests', r.incoming);
            store.set('outgoingRequests', r.outgoing);
          })
          .catch(() => {});
      })
      .catch(() => store.toast(t('friends.failedCancel'), 'error'));
  }

  function handleRemoveFriend(friendId: string) {
    removeFriend(friendId)
      .then(() => {
        getFriends()
          .then((f) => store.set('friends', f))
          .catch(() => {});
      })
      .catch(() => store.toast(t('friends.failedRemove'), 'error'));
  }

  function handleStartPrivateChat(playerId: string, displayName: string) {
    socketManager.send({ type: 'private_chat_start', toPlayerId: playerId, displayName });
    socketManager.requestConversations();
    store.set('sidebarTab', 'chat');
  }

  function handleChallenge(playerId: string) {
    const currentGameId = store.get('currentGameId');
    if (!currentGameId) {
      store.toast('You need to create a game first', 'error');
      return;
    }
    socketManager.send({ type: 'challenge', toPlayerId: playerId, gameId: currentGameId });
    store.toast(t('friends.challengeSent', { name: '' }), 'info');
  }

  const onlineFriends = friends.filter((f) => f.isOnline);
  const displayedFriends = activeTab === 'online' ? onlineFriends : friends;

  return (
    <div className="sidebar-friends">
      <div className="sidebar-friends-tabs">
        <button
          className={`sidebar-friends-tab ${activeTab === 'online' ? 'sidebar-friends-tab-active' : ''}`}
          onClick={() => setActiveTab('online')}
        >
          {t('friends.online')} ({onlineFriends.length})
        </button>
        <button
          className={`sidebar-friends-tab ${activeTab === 'all' ? 'sidebar-friends-tab-active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          {t('friends.friends')}
        </button>
        {incomingRequests.length > 0 && (
          <button
            className={`sidebar-friends-tab ${activeTab === 'requests' ? 'sidebar-friends-tab-active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            {t('friends.requests')} ({incomingRequests.length})
          </button>
        )}
        {outgoingRequests.length > 0 && (
          <button
            className={`sidebar-friends-tab ${activeTab === 'sent' ? 'sidebar-friends-tab-active' : ''}`}
            onClick={() => setActiveTab('sent')}
          >
            {t('friends.sent')}
          </button>
        )}
      </div>

      <div className="sidebar-friends-list">
        {activeTab === 'online' && onlineFriends.length === 0 && (
          <div className="sidebar-friends-empty">{t('friends.noFriends')}</div>
        )}
        {activeTab === 'all' && friends.length === 0 && (
          <div className="sidebar-friends-empty">{t('friends.noFriends')}</div>
        )}
        {activeTab === 'requests' && incomingRequests.length === 0 && (
          <div className="sidebar-friends-empty">{t('friends.noRequests')}</div>
        )}
        {activeTab === 'sent' && outgoingRequests.length === 0 && (
          <div className="sidebar-friends-empty">{t('friends.noSent')}</div>
        )}

        {(activeTab === 'online' || activeTab === 'all') &&
          displayedFriends.map((f) => (
            <div key={f.playerId} className="sidebar-friend-item">
              <div className="sidebar-friend-info">
                <span className={`sidebar-friend-dot ${f.isOnline ? 'online' : 'offline'}`} />
                <span className="sidebar-friend-name">{f.displayName}</span>
                {f.isOnline && f.currentGameId && <span className="sidebar-friend-status">{t('friends.inGame')}</span>}
              </div>
              <div className="sidebar-friend-actions">
                <button
                  className="btn btn-ghost"
                  style={{ padding: '4px 8px', fontSize: 11, color: '#4f8ef7' }}
                  onClick={() => handleStartPrivateChat(f.playerId, f.displayName)}
                >
                  {t('chat.title')}
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '4px 8px', fontSize: 11 }}
                  onClick={() => handleChallenge(f.playerId)}
                >
                  {t('friends.challenge')}
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '4px 8px', fontSize: 11, color: '#e55' }}
                  onClick={() => handleRemoveFriend(f.playerId)}
                >
                  {t('friends.remove')}
                </button>
              </div>
            </div>
          ))}

        {activeTab === 'requests' &&
          incomingRequests.map((r) => (
            <div key={r.id} className="sidebar-friend-item">
              <div className="sidebar-friend-info">
                <span className="sidebar-friend-name">{r.displayName}</span>
              </div>
              <div className="sidebar-friend-actions">
                <button
                  className="btn btn-primary"
                  style={{ padding: '4px 8px', fontSize: 11 }}
                  onClick={() => handleAcceptRequest(r.id)}
                >
                  {t('friends.accept')}
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '4px 8px', fontSize: 11 }}
                  onClick={() => handleDeclineRequest(r.id)}
                >
                  {t('friends.decline')}
                </button>
              </div>
            </div>
          ))}

        {activeTab === 'sent' &&
          outgoingRequests.map((r) => (
            <div key={r.id} className="sidebar-friend-item">
              <div className="sidebar-friend-info">
                <span className="sidebar-friend-name">{r.displayName}</span>
                <span className="sidebar-friend-status">{t('friends.pending')}</span>
              </div>
              <div className="sidebar-friend-actions">
                <button
                  className="btn btn-ghost"
                  style={{ padding: '4px 8px', fontSize: 11 }}
                  onClick={() => handleCancelRequest(r.id)}
                >
                  {t('friends.cancel')}
                </button>
              </div>
            </div>
          ))}
      </div>

      {!showAdd && isRegistered && (
        <button
          className="btn btn-primary"
          style={{ margin: '8px 12px', fontSize: 13 }}
          onClick={() => setShowAdd(true)}
        >
          {t('friends.add')}
        </button>
      )}
      {showAdd && (
        <div className="sidebar-friends-add" style={{ padding: '8px 12px', position: 'relative' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              ref={addInputRef}
              className="input"
              type="text"
              placeholder={t('friends.addPlaceholder')}
              style={{ flex: 1, fontSize: 13 }}
              value={addUsername}
              onChange={(e) => setAddUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddFriend();
              }}
            />
            <button
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: 13, opacity: sending ? 0.6 : 1 }}
              onClick={handleAddFriend}
              disabled={sending}
            >
              {t('friends.add')}
            </button>
          </div>
          {showResults && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 12,
                right: 12,
                zIndex: 100,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                maxHeight: 200,
                overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              }}
            >
              {searchResults.map((u) => (
                <div
                  key={u.id}
                  style={{
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontSize: 13,
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseDown={() => {
                    setAddUsername(u.username);
                    setShowResults(false);
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{u.username}</span>
                  {u.displayName !== u.username && (
                    <span style={{ color: 'var(--muted)', marginLeft: 6 }}>({u.displayName})</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
