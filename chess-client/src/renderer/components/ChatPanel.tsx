import { useState, useEffect, useRef, useCallback } from 'react';
import { socketManager } from '../socket';
import { store } from '../store';
import { useStoreValue } from '../hooks/useStore';
import { searchUsers } from '../api';
import type { UserSearchResult } from '../api';
import { t } from '../translate';
import type { ChatMessageData, GroupMember } from '../../types';
import {
  Hash,
  AtSign,
  ArrowLeft,
  Plus,
  MessageCircle,
  Settings,
  UserMinus,
  UserPlus,
  Crown,
  Shield,
  ShieldOff,
  LogOut,
  Trash2,
  ArrowUpRight,
  Users,
} from 'lucide-react';

// Chat panel for lobby, private, and group conversations
function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('chat.justNow');
  if (mins < 60) return mins + 'm';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h';
  const days = Math.floor(hours / 24);
  if (days < 7) return days + 'd';
  return new Date(ts).toLocaleDateString();
}

export default function ChatPanel() {
  const conversations = useStoreValue('conversations');
  const playerId = useStoreValue('playerId');
  const friends = useStoreValue('friends');
  const [activeConv, setActiveConv] = useState<string>('lobby');
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [input, setInput] = useState('');
  const [showList, setShowList] = useState(true);
  const [showNewConv, setShowNewConv] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [showGroupManage, setShowGroupManage] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [addMemberResults, setAddMemberResults] = useState<UserSearchResult[]>([]);
  const [showAddMemberResults, setShowAddMemberResults] = useState(false);
  const [membersMap, setMembersMap] = useState<Record<string, GroupMember[]>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const addMemberSearchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const currentConv = conversations.find((c) => c.id === activeConv);
  const convName = currentConv?.name || t('sidebar.lobby');
  const isGroup = currentConv?.type === 'group';
  const isGroupOwner = isGroup && currentConv?.ownerId === playerId;
  const currentMembers = membersMap[activeConv] || [];

  useEffect(() => {
    if (activeConv === 'lobby') {
      socketManager.requestLobbyChatHistory();
    } else if (activeConv.startsWith('priv_')) {
      socketManager.requestPrivateChatHistory(activeConv);
    } else if (isGroup) {
      socketManager.requestGroupChatHistory(activeConv);
    }

    const unsubLobbyChat = socketManager.onLobbyChat((msg) => {
      if (activeConv === 'lobby') {
        setMessages((prev) => {
          const next = [
            ...prev,
            { playerId: msg.playerId, username: msg.username, text: msg.text, timestamp: msg.timestamp },
          ];
          if (next.length > 200) next.splice(0, next.length - 200);
          return next;
        });
      }
    });

    const unsubLobbyHistory = socketManager.onLobbyChatHistory((msg) => {
      if (activeConv === 'lobby') {
        setMessages(
          msg.messages.map((m) => ({
            playerId: m.playerId,
            username: m.username,
            text: m.text,
            timestamp: m.timestamp,
          })),
        );
      }
    });

    const unsubPrivateChat = socketManager.onPrivateChat((msg) => {
      if (msg.conversationId === activeConv) {
        setMessages((prev) => {
          const next = [
            ...prev,
            { playerId: msg.playerId, username: msg.username, text: msg.text, timestamp: msg.timestamp },
          ];
          if (next.length > 200) next.splice(0, next.length - 200);
          return next;
        });
      }
      if (msg.conversationId !== activeConv) {
        store.set('unreadCount', (store.get('unreadCount') || 0) + 1);
      }
    });

    const unsubPrivateHistory = socketManager.onPrivateChatHistory((msg) => {
      if (msg.conversationId === activeConv) {
        setMessages(
          msg.messages.map((m) => ({
            playerId: m.playerId,
            username: m.username,
            text: m.text,
            timestamp: m.timestamp,
          })),
        );
      }
    });

    const unsubGroupChat = socketManager.onGroupChat((msg) => {
      if (msg.conversationId === activeConv) {
        setMessages((prev) => {
          const next = [
            ...prev,
            { playerId: msg.playerId, username: msg.username, text: msg.text, timestamp: msg.timestamp },
          ];
          if (next.length > 200) next.splice(0, next.length - 200);
          return next;
        });
      }
    });

    const unsubGroupHistory = socketManager.onGroupChatHistory((msg) => {
      if (msg.conversationId === activeConv) {
        setMessages(
          msg.messages.map((m) => ({
            playerId: m.playerId,
            username: m.username,
            text: m.text,
            timestamp: m.timestamp,
          })),
        );
        const members: GroupMember[] = (msg.members || []).map((m) => ({
          playerId: m.playerId,
          username: m.username,
          displayName: m.displayName,
          role: m.role as 'owner' | 'admin' | 'member',
        }));
        setMembersMap((prev) => ({ ...prev, [msg.conversationId]: members }));
      }
    });

    const unsubGroupMemberAdded = socketManager.onGroupMemberAdded((msg) => {
      if (msg.conversationId === activeConv) {
        setMembersMap((prev) => {
          const existing = prev[msg.conversationId] || [];
          if (existing.some((m) => m.playerId === msg.playerId)) return prev;
          return {
            ...prev,
            [msg.conversationId]: [
              ...existing,
              {
                playerId: msg.playerId,
                username: msg.username,
                displayName: msg.displayName,
                role: msg.role as 'owner' | 'admin' | 'member',
              },
            ],
          };
        });
      }
      socketManager.requestConversations();
    });

    const unsubGroupMemberRemoved = socketManager.onGroupMemberRemoved((msg) => {
      if (msg.conversationId === activeConv) {
        setMembersMap((prev) => ({
          ...prev,
          [msg.conversationId]: (prev[msg.conversationId] || []).filter((m) => m.playerId !== msg.playerId),
        }));
      }
      if (msg.playerId === playerId) {
        setShowList(true);
        setShowGroupManage(false);
      }
      socketManager.requestConversations();
    });

    const unsubGroupMemberPromoted = socketManager.onGroupMemberPromoted((msg) => {
      if (msg.conversationId === activeConv) {
        setMembersMap((prev) => ({
          ...prev,
          [msg.conversationId]: (prev[msg.conversationId] || []).map((m) =>
            m.playerId === msg.playerId ? { ...m, role: msg.role as 'owner' | 'admin' | 'member' } : m,
          ),
        }));
      }
    });

    const unsubGroupMemberDemoted = socketManager.onGroupMemberDemoted((msg) => {
      if (msg.conversationId === activeConv) {
        setMembersMap((prev) => ({
          ...prev,
          [msg.conversationId]: (prev[msg.conversationId] || []).map((m) =>
            m.playerId === msg.playerId ? { ...m, role: msg.role as 'owner' | 'admin' | 'member' } : m,
          ),
        }));
      }
    });

    const unsubGroupOwnershipTransferred = socketManager.onGroupOwnershipTransferred((_msg) => {
      socketManager.requestConversations();
    });

    const unsubGroupMemberLeft = socketManager.onGroupMemberLeft((msg) => {
      if (msg.conversationId === activeConv) {
        setMembersMap((prev) => ({
          ...prev,
          [msg.conversationId]: (prev[msg.conversationId] || []).filter((m) => m.playerId !== msg.playerId),
        }));
      }
    });

    const unsubGroupDisbanded = socketManager.onGroupDisbanded((msg) => {
      if (msg.conversationId === activeConv) {
        setShowList(true);
        setShowGroupManage(false);
      }
      socketManager.requestConversations();
    });

    const unsubConvCreated = socketManager.onConversationCreated((_msg) => {
      socketManager.requestConversations();
      setShowNewConv(false);
      setSearchQuery('');
    });

    const unsubGroupCreated = socketManager.onGroupCreated((msg) => {
      socketManager.requestConversations();
      setShowGroupCreate(false);
      setGroupName('');
      setActiveConv(msg.conversationId);
      setMessages([]);
      setShowList(false);
      socketManager.requestGroupChatHistory(msg.conversationId);
    });

    socketManager.requestConversations();

    return () => {
      unsubLobbyChat();
      unsubLobbyHistory();
      unsubPrivateChat();
      unsubPrivateHistory();
      unsubGroupChat();
      unsubGroupHistory();
      unsubGroupMemberAdded();
      unsubGroupMemberRemoved();
      unsubGroupMemberPromoted();
      unsubGroupMemberDemoted();
      unsubGroupOwnershipTransferred();
      unsubGroupMemberLeft();
      unsubGroupDisbanded();
      unsubConvCreated();
      unsubGroupCreated();
    };
  }, [activeConv, isGroup, playerId]);

  useEffect(() => {
    if (listRef.current && !showScrollBtn) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, showScrollBtn]);

  function handleScroll() {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 150);
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBtn(false);
  }

  const send = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    if (activeConv === 'lobby') {
      socketManager.sendLobbyChat(text);
    } else if (activeConv.startsWith('priv_')) {
      const parts = activeConv.split('_');
      const targetId = parts[1] === playerId ? parts[2] : parts[1];
      socketManager.sendPrivateChat(targetId, text);
    } else if (isGroup) {
      socketManager.sendGroupChat(activeConv, text);
    } else {
      socketManager.sendLobbyChat(text);
    }
    setInput('');
  }, [input, activeConv, playerId, isGroup]);

  function handleSelectConversation(id: string) {
    setActiveConv(id);
    setMessages([]);
    setShowList(false);
    setShowNewConv(false);
    setShowGroupManage(false);
  }

  function handleStartConversation(friendId: string, _friendName: string) {
    socketManager.startPrivateConversation(friendId);
  }

  function handleCreateGroup() {
    const name = groupName.trim();
    if (!name || name.length < 2) {
      store.toast(t('chat.groupNameTooShort') || 'Group name must be at least 2 characters');
      return;
    }
    if (store.get('wsStatus') !== 'connected') {
      store.toast(t('chat.notConnected') || 'Not connected to server');
      return;
    }
    socketManager.createGroup(name);
    setShowGroupCreate(false);
    setGroupName('');
    store.toast(t('chat.creatingGroup') || 'Creating group...', 'info');
  }

  useEffect(() => {
    if (addMemberSearchTimer.current) clearTimeout(addMemberSearchTimer.current);
    const q = addMemberSearch.trim();
    if (q.length < 2) {
      setAddMemberResults([]);
      setShowAddMemberResults(false);
      return;
    }
    addMemberSearchTimer.current = setTimeout(() => {
      searchUsers(q)
        .then((results) => {
          setAddMemberResults(results);
          setShowAddMemberResults(results.length > 0);
        })
        .catch(() => {});
    }, 300);
    return () => {
      if (addMemberSearchTimer.current) clearTimeout(addMemberSearchTimer.current);
    };
  }, [addMemberSearch]);

  function handleGroupAddMember(targetId: string) {
    socketManager.groupAddMember(activeConv, targetId);
  }

  function handleAddByUsername(username?: string) {
    const name = (username || addMemberSearch).trim();
    if (!name) return;
    socketManager.groupAddMemberByName(activeConv, name);
    setAddMemberSearch('');
    setAddMemberResults([]);
    setShowAddMemberResults(false);
  }

  function handleGroupRemoveMember(targetId: string) {
    socketManager.groupRemoveMember(activeConv, targetId);
  }

  function handleGroupPromote(targetId: string) {
    socketManager.groupPromoteMember(activeConv, targetId);
  }

  function handleGroupDemote(targetId: string) {
    socketManager.groupDemoteMember(activeConv, targetId);
  }

  function handleGroupTransfer(targetId: string) {
    if (confirm(t('chat.transferConfirm') || 'Transfer ownership?')) {
      socketManager.groupTransferOwnership(activeConv, targetId);
    }
  }

  function handleGroupLeave() {
    if (confirm(t('chat.leaveConfirm') || 'Leave this group?')) {
      socketManager.groupLeave(activeConv);
    }
  }

  function handleGroupDisband() {
    if (confirm(t('chat.disbandConfirm') || 'Disband this group? This cannot be undone.')) {
      socketManager.groupDisband(activeConv);
    }
  }

  const filteredFriends = friends
    .filter((f) => f.playerId !== playerId)
    .filter(
      (f) =>
        f.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.username.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  const nonMemberFriends = friends
    .filter((f) => f.playerId !== playerId)
    .filter((f) => !currentMembers.some((m) => m.playerId === f.playerId))
    .filter(
      (f) =>
        f.displayName.toLowerCase().includes(addMemberSearch.toLowerCase()) ||
        f.username.toLowerCase().includes(addMemberSearch.toLowerCase()),
    );

  const myRole = currentMembers.find((m) => m.playerId === playerId)?.role;
  const canManage = isGroupOwner || myRole === 'owner' || myRole === 'admin';

  if (showGroupManage && isGroup) {
    return (
      <div className="sidebar-chat">
        <div className="sidebar-chat-header">
          <button className="sidebar-back-btn" onClick={() => setShowGroupManage(false)}>
            <ArrowLeft size={16} />
          </button>
          <span className="sidebar-chat-title">{t('chat.manageGroup')}</span>
        </div>
        <div className="sidebar-chat-messages" style={{ padding: '8px 12px' }}>
          <div className="sidebar-group-section">
            <h4 style={{ margin: '8px 0', fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase' }}>
              {t('chat.members')} ({currentMembers.length})
            </h4>
            {currentMembers.map((m) => (
              <div
                key={m.playerId}
                className="sidebar-group-member-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 13,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{m.displayName}</span>
                  {m.role === 'owner' && <Crown size={12} color="#ffd700" />}
                  {m.role === 'admin' && <Shield size={12} color="#4f8ef7" />}
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{m.role}</span>
                </div>
                {isGroupOwner && m.playerId !== playerId && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {m.role === 'member' ? (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 6px', fontSize: 11 }}
                        onClick={() => handleGroupPromote(m.playerId)}
                        title={t('chat.promote')}
                      >
                        <Shield size={12} />
                      </button>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 6px', fontSize: 11 }}
                        onClick={() => handleGroupDemote(m.playerId)}
                        title={t('chat.demote')}
                      >
                        <ShieldOff size={12} />
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 6px', fontSize: 11, color: '#e55' }}
                      onClick={() => handleGroupRemoveMember(m.playerId)}
                      title={t('chat.remove')}
                    >
                      <UserMinus size={12} />
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 6px', fontSize: 11 }}
                      onClick={() => handleGroupTransfer(m.playerId)}
                      title={t('chat.transferOwnership')}
                    >
                      <ArrowUpRight size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {canManage && (
            <div className="sidebar-group-section" style={{ marginTop: 16 }}>
              <h4 style={{ margin: '8px 0', fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase' }}>
                {t('chat.addMember')}
              </h4>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, position: 'relative' }}>
                <input
                  className="input"
                  type="text"
                  placeholder={t('friends.searchPlaceholder')}
                  value={addMemberSearch}
                  onChange={(e) => setAddMemberSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddByUsername();
                  }}
                  style={{ flex: 1, fontSize: 13 }}
                />
                <button
                  className="btn btn-primary"
                  style={{ padding: '4px 12px', fontSize: 13 }}
                  onClick={() => handleAddByUsername()}
                >
                  {t('chat.addMember')}
                </button>
                {showAddMemberResults && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 72,
                      zIndex: 100,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      maxHeight: 200,
                      overflowY: 'auto',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}
                  >
                    {addMemberResults.map((u) => (
                      <div
                        key={u.id}
                        style={{
                          padding: '6px 10px',
                          cursor: 'pointer',
                          fontSize: 13,
                          borderBottom: '1px solid var(--border)',
                        }}
                        onMouseDown={() => handleAddByUsername(u.username)}
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
              {nonMemberFriends.length === 0 ? (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('friends.noFriends')}</span>
              ) : (
                nonMemberFriends.map((f) => (
                  <div
                    key={f.playerId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 0',
                      fontSize: 13,
                    }}
                  >
                    <span>{f.displayName}</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 6px', fontSize: 11 }}
                      onClick={() => handleGroupAddMember(f.playerId)}
                    >
                      <UserPlus size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
          <div
            className="sidebar-group-section"
            style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 12 }}
          >
            {isGroupOwner ? (
              <button
                className="btn btn-danger"
                style={{ width: '100%', fontSize: 13, marginBottom: 6 }}
                onClick={handleGroupDisband}
              >
                <Trash2 size={14} style={{ marginRight: 6 }} />
                {t('chat.disbandGroup')}
              </button>
            ) : (
              <button
                className="btn btn-ghost"
                style={{ width: '100%', fontSize: 13, color: '#e55' }}
                onClick={handleGroupLeave}
              >
                <LogOut size={14} style={{ marginRight: 6 }} />
                {t('chat.leaveGroup')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (showGroupCreate) {
    return (
      <div className="sidebar-chat">
        <div className="sidebar-chat-header">
          <button className="sidebar-back-btn" onClick={() => setShowGroupCreate(false)}>
            <ArrowLeft size={16} />
          </button>
          <span className="sidebar-chat-title">{t('chat.createGroup')}</span>
        </div>
        <div className="sidebar-chat-messages" style={{ padding: '12px' }}>
          <input
            className="input"
            type="text"
            placeholder={t('chat.groupNamePlaceholder')}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateGroup();
            }}
            style={{ width: '100%', fontSize: 13, marginBottom: 12 }}
            autoFocus
            maxLength={50}
          />
          <button className="btn btn-primary" style={{ width: '100%', fontSize: 13 }} onClick={handleCreateGroup}>
            {t('chat.createGroup')}
          </button>
        </div>
      </div>
    );
  }

  if (showList || (conversations.length === 0 && !showNewConv)) {
    return (
      <div className="sidebar-chat">
        <div className="sidebar-chat-list">
          <div className="sidebar-chat-list-header">
            <span className="sidebar-conv-list-title">{t('sidebar.conversations')}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowGroupCreate(true)}
                title={t('chat.createGroup')}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Users size={14} />
                <span>{t('chat.createGroup')}</span>
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowNewConv(!showNewConv)}
                title={t('sidebar.startConversation')}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          {showNewConv && (
            <div className="sidebar-new-conv" style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
              <input
                className="input"
                type="text"
                placeholder={t('friends.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', fontSize: 13, marginBottom: 8 }}
                autoFocus
              />
              <div className="sidebar-new-conv-list" style={{ maxHeight: 160, overflowY: 'auto' }}>
                {filteredFriends.length === 0 ? (
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('friends.noFriends')}</span>
                ) : (
                  filteredFriends.map((f) => (
                    <button
                      key={f.playerId}
                      className="sidebar-conv-item"
                      onClick={() => handleStartConversation(f.playerId, f.displayName)}
                      style={{ width: '100%', textAlign: 'left' }}
                    >
                      <span className="sidebar-conv-icon">
                        <MessageCircle size={14} />
                      </span>
                      <span className="sidebar-conv-name">{f.displayName}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
          {conversations.map((conv) => (
            <button
              key={conv.id}
              className={`sidebar-conv-item ${activeConv === conv.id ? 'sidebar-conv-active' : ''}`}
              onClick={() => handleSelectConversation(conv.id)}
            >
              <span className="sidebar-conv-icon">
                {conv.type === 'private' ? <AtSign size={14} /> : <Hash size={14} />}
              </span>
              <span className="sidebar-conv-name">{conv.name || conv.id}</span>
              {conv.unread > 0 && <span className="sidebar-badge-sm">{conv.unread}</span>}
            </button>
          ))}
          {conversations.length === 0 && !showNewConv && (
            <div className="sidebar-friends-empty" style={{ padding: '12px', fontSize: 12, color: 'var(--muted)' }}>
              {t('sidebar.noConversations')}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar-chat">
      <div className="sidebar-chat-header">
        <button className="sidebar-back-btn" onClick={() => setShowList(true)}>
          <ArrowLeft size={16} />
        </button>
        <span className="sidebar-chat-title">{convName}</span>
        {isGroup && (
          <button className="sidebar-back-btn" onClick={() => setShowGroupManage(true)} title={t('chat.manageGroup')}>
            <Settings size={14} />
          </button>
        )}
      </div>
      <div ref={listRef} className="sidebar-chat-messages" onScroll={handleScroll}>
        {messages.map((msg, i) => {
          const isMe = msg.playerId === playerId;
          const showHeader = i === 0 || messages[i - 1].playerId !== msg.playerId;
          return (
            <div key={msg.timestamp + '-' + i} className={`sidebar-chat-msg ${isMe ? 'sidebar-chat-msg-self' : ''}`}>
              {showHeader && (
                <span className="sidebar-chat-name" style={{ color: isMe ? '#4f8ef7' : '#888' }}>
                  {isMe ? t('chat.you') : msg.username}
                </span>
              )}
              <span className="sidebar-chat-text">{msg.text}</span>
              <span className="sidebar-chat-time">{formatRelativeTime(msg.timestamp)}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {showScrollBtn && (
        <button className="sidebar-scroll-btn" onClick={scrollToBottom}>
          ↓
        </button>
      )}
      <div className="sidebar-chat-input">
        <input
          className="input"
          type="text"
          placeholder={t('sidebar.messagePlaceholder')}
          maxLength={500}
          style={{ flex: 1, fontSize: 13 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
        />
        <button className="btn btn-primary" style={{ padding: '8px 12px', fontSize: 13 }} onClick={send}>
          {t('chat.send')}
        </button>
      </div>
    </div>
  );
}
