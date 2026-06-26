/**
 * LobbyPage — game discovery and creation hub.
 *
 * Polls the server every 3 s for open games and active (in-progress) games.
 * Also loads the current player's match history on mount.
 * Two-column layout shows open games and live games for spectating;
 * the play/create/join cards are in the global sidebar's Lobby tab.
 */

import { useState, useEffect } from 'react';
import logger from '../logger';
import { store } from '../store';
import * as api from '../api';
import { useNavigate } from 'react-router-dom';
import type { GameState } from '../../types';
import { t } from '../translate';
import { avatarSrc } from '../api';
import { socketManager } from '../socket';
import type { GameListUpdateMessage } from '../socket';
import PlayerProfileDialog from '../components/PlayerProfileDialog';

export default function LobbyPage() {
  const navigate = useNavigate();
  const [openGames, setOpenGames] = useState<GameState[]>([]);
  const [liveGames, setLiveGames] = useState<GameState[]>([]);

  const [statusMsg, setStatusMsg] = useState('');
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState('');

  useEffect(() => {
    logger.info('LobbyPage mounted');
    if (store.get('offline')) return;

    async function initialFetch() {
      try {
        const games = await api.getOpenGames();
        setOpenGames(games);
        setStatusMsg(games.length === 0 ? t('lobby.noOpenGames') : '');
        const active = await api.getActiveGames();
        setLiveGames(active);
        setLiveStatus(active.length === 0 ? t('lobby.noActiveGames') : '');
      } catch {
        logger.warn('Initial fetch failed: server unreachable');
        setStatusMsg(t('lobby.cannotConnect'));
      }
    }
    initialFetch();

    // WS pushes game list updates — no polling needed after initial fetch
    const unsubscribe = socketManager.onGameListUpdate((msg: GameListUpdateMessage) => {
      setOpenGames(msg.openGames);
      setLiveGames(msg.activeGames);
      setStatusMsg(msg.openGames.length === 0 ? t('lobby.noOpenGames') : '');
      setLiveStatus(msg.activeGames.length === 0 ? t('lobby.noActiveGames') : '');
    });

    return () => {
      logger.info('LobbyPage unmounting');
      unsubscribe();
    };
  }, []);

  /* Auto-open sidebar and switch to play tab on lobby entry */
  useEffect(() => {
    store.set('sidebarOpen', true);
    store.set('sidebarTab', 'play');
  }, []);

  /* On mount, check if player has an active game to resume (survives page refresh) */
  useEffect(() => {
    if (!store.get('offline')) checkActiveGame();
  }, []);

  // Check both in-memory and persisted game; redirect if still active
  async function checkActiveGame() {
    try {
      const game = store.get('currentGame');
      if (game && game.status === 'active') {
        logger.info('Checking active game (in-memory)', { gameId: game.id });
        const fresh = await api.getGame(game.id);
        if (fresh.status === 'active') {
          logger.info('Resuming active game', { gameId: fresh.id });
          store.set('currentGame', fresh);
          navigate(`/game/${fresh.id}`);
        }
        return;
      }
      const gameId = store.get('currentGameId');
      if (gameId) {
        logger.info('Checking persisted active game', { gameId });
        const fresh = await api.getGame(gameId);
        if (fresh.status === 'active') {
          logger.info('Resuming active game from persisted ID', { gameId: fresh.id });
          store.set('currentGame', fresh);
          navigate(`/game/${fresh.id}`);
        }
      }
    } catch {}
  }

  async function joinGame(gid: string) {
    logger.info('Joining game', { gameId: gid });
    try {
      const game = await api.joinGame(gid);
      logger.info('Joined game', { gameId: game.id });
      store.set('currentGame', game);
      navigate(`/game/${game.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to join game', { gameId: gid, error: msg });
      store.toast(msg || t('lobby.failedJoin'));
    }
  }

  // Fetch game then navigate with ?spectate=1 to enter read-only mode
  async function spectateGame(gid: string) {
    logger.info('Spectating game', { gameId: gid });
    try {
      const fresh = await api.getGame(gid);
      logger.info('Now spectating game', { gameId: gid });
      store.set('currentGame', fresh);
      navigate(`/game/${gid}?spectate=1`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to spectate game', { gameId: gid, error: msg });
      store.toast(msg || t('lobby.failedLoad'));
    }
  }

  const myId = store.get('playerId');
  const offline = store.get('offline');

  return (
    <div className="lobby-layout">
      {!offline && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <h2 className="card-title">{t('lobby.openGames')}</h2>
          {statusMsg && (
            <div
              style={{
                fontSize: 13,
                fontWeight: 300,
                color: statusMsg === t('lobby.cannotConnect') ? 'var(--danger)' : 'var(--muted)',
                textAlign: 'center',
                padding: 16,
              }}
            >
              {statusMsg}
            </div>
          )}
          <div
            style={{
              flex: '1 1 0',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              paddingRight: 4,
              minHeight: 0,
            }}
          >
            {openGames
              .filter((g) => g.visibility !== 'private')
              .map((game) => {
                const creatorId = game.players.white;
                const creatorName =
                  game.whiteName ||
                  (creatorId === myId ? t('common.you') : (creatorId?.slice(0, 8) ?? t('common.unknown')));
                const createdAt = game.createdAt || 0;
                const diffMs = Date.now() - createdAt;
                const mins = Math.floor(diffMs / 60000);
                const ageStr = mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
                return (
                  <div
                    key={game.id}
                    className="game-card card-elevated"
                    style={{
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          animation: 'pulse 2s ease-in-out infinite',
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {game.whiteAvatarUrl ? (
                            <img
                              src={avatarSrc(game.whiteAvatarUrl)}
                              alt=""
                              style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: '#2a2a2a',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                color: '#555',
                                flexShrink: 0,
                              }}
                            >
                              {(creatorName || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <span
                            onClick={() => creatorId && setProfilePlayerId(creatorId)}
                            style={{
                              fontSize: 15,
                              fontWeight: 500,
                              color: 'var(--text)',
                              letterSpacing: '0.2px',
                              cursor: 'pointer',
                              borderBottom: '1px dashed transparent',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = 'var(--muted)')}
                            onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = 'transparent')}
                          >
                            {creatorName}
                          </span>
                          {game.visibility === 'private' && (
                            <span className="badge badge-private">{t('lobby.private')}</span>
                          )}
                          {game.aiSkillLevel !== undefined && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: '#f5a623',
                                background: 'rgba(245,166,35,0.12)',
                                padding: '1px 5px',
                                borderRadius: 4,
                              }}
                            >
                              AI {game.aiSkillLevel}
                            </span>
                          )}
                        </div>
                        <div
                          style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <span>{t('lobby.waiting')}</span>
                          <span style={{ fontSize: 10, color: '#555' }}>{ageStr}</span>
                        </div>
                      </div>
                    </div>
                    <button className="btn btn-sm btn-secondary" onClick={() => joinGame(game.id)}>
                      {t('lobby.join')}
                    </button>
                  </div>
                );
              })}
          </div>

          <h2 className="card-title" style={{ marginTop: 16 }}>
            {t('lobby.liveGames')}
          </h2>
          {liveStatus && (
            <div style={{ fontSize: 13, fontWeight: 300, color: 'var(--muted)', textAlign: 'center', padding: 16 }}>
              {liveStatus}
            </div>
          )}
          <div
            style={{
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              paddingRight: 4,
              minHeight: 80,
            }}
          >
            {liveGames.map((game) => {
              const wName = game.whiteName || game.players.white?.slice(0, 8) || t('common.white');
              const bName = game.blackName || game.players.black?.slice(0, 8) || t('common.black');
              const statusLabel = game.status === 'active' ? t('lobby.inProgress') : game.status;
              return (
                <div
                  key={game.id}
                  className="live-game-card card-elevated"
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--success)',
                        animation: 'pulse 2s ease-in-out infinite',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {game.whiteAvatarUrl ? (
                          <img
                            src={avatarSrc(game.whiteAvatarUrl)}
                            alt=""
                            style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              background: '#2a2a2a',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 9,
                              color: '#555',
                            }}
                          >
                            {(wName || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <span
                          onClick={() => game.players.white && setProfilePlayerId(game.players.white)}
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: 'var(--text)',
                            letterSpacing: '0.2px',
                            cursor: 'pointer',
                            borderBottom: '1px dashed transparent',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = 'var(--muted)')}
                          onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = 'transparent')}
                        >
                          {wName}
                        </span>
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--muted)', margin: '0 4px' }}>{t('common.vs')}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {game.blackAvatarUrl ? (
                          <img
                            src={avatarSrc(game.blackAvatarUrl)}
                            alt=""
                            style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              background: '#2a2a2a',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 9,
                              color: '#555',
                            }}
                          >
                            {(bName || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <span
                          onClick={() => game.players.black && setProfilePlayerId(game.players.black)}
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: 'var(--text)',
                            letterSpacing: '0.2px',
                            cursor: 'pointer',
                            borderBottom: '1px dashed transparent',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = 'var(--muted)')}
                          onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = 'transparent')}
                        >
                          {bName}
                        </span>
                      </span>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{statusLabel}</div>
                    </div>
                  </div>
                  <button
                    className="btn btn-sm"
                    style={{
                      color: 'var(--success)',
                      borderColor: 'var(--success)',
                      background: 'transparent',
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.background = 'var(--success)';
                      (e.target as HTMLElement).style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.background = 'transparent';
                      (e.target as HTMLElement).style.color = 'var(--success)';
                    }}
                    onClick={() => spectateGame(game.id)}
                  >
                    {t('lobby.spectate')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {profilePlayerId && <PlayerProfileDialog playerId={profilePlayerId} onClose={() => setProfilePlayerId(null)} />}
    </div>
  );
}
