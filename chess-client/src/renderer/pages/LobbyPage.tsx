/**
 * LobbyPage — game discovery and creation hub.
 *
 * Polls the server every 3 s for open games and active (in-progress) games.
 * Also loads the current player's match history on mount.
 * The three-column layout shows: open games, live games for spectating,
 * and a right sidebar with local-play / create / join / history cards.
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

  const [isPrivate, setIsPrivate] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [spectateId, setSpectateId] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState('');
  const [botSkill, setBotSkill] = useState(5);
  const [botColor, setBotColor] = useState<'white' | 'black'>('white');

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

  /* If the player was in an active game (e.g. after a page refresh), resume it */
  useEffect(() => {
    if (!store.get('offline')) checkActiveGame();
  }, []);

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

  async function createGame() {
    const visibility = isPrivate ? 'private' : 'public';
    logger.info('Creating game', { visibility });
    try {
      const game = await api.createGame(visibility);
      logger.info('Game created', { gameId: game.id, visibility });
      store.set('currentGame', game);
      navigate(`/game/${game.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to create game', { error: msg });
      store.toast(msg || t('lobby.failedCreate'));
    }
  }

  async function startBotGame() {
    logger.info('Starting Bot game', { skill: botSkill, color: botColor });
    try {
      const game = await api.createBotGame(botSkill, botColor);
      logger.info('Bot game created', { gameId: game.id });
      store.set('currentGame', game);
      navigate(`/game/${game.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to create Bot game', { error: msg });
      store.toast(msg || t('lobby.failedCreate'));
    }
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
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 300, color: 'var(--muted)', letterSpacing: '0.2px' }}>
                          {t('lobby.waiting')}
                        </span>
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

      <div className="lobby-sidebar">
        <div className="card" style={{ padding: 24 }}>
          <h2 className="card-title">{t('lobby.local1v1')}</h2>
          <p style={{ fontSize: 13, fontWeight: 300, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
            {t('lobby.localDescription')}
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: 14, fontSize: 16 }}
            onClick={() => navigate('/local')}
          >
            {t('lobby.startLocal')}
          </button>
        </div>

        {!offline && (
          <div className="card" style={{ padding: 24 }}>
            <h2 className="card-title">{t('lobby.createGame')}</h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)', letterSpacing: '0.2px' }}>
                {t('lobby.privateGame')}
              </span>
              <div className={`toggle ${isPrivate ? 'active' : ''}`} onClick={() => setIsPrivate(!isPrivate)}>
                <div className="toggle-knob" />
              </div>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: 14, fontSize: 16 }}
              onClick={createGame}
            >
              {t('lobby.newGame')}
            </button>
            {window.electronAPI && (
              <button
                className="btn btn-ghost"
                style={{ marginTop: 12, width: '100%', fontSize: 13 }}
                onClick={() => window.electronAPI?.openNewWindow()}
              >
                {t('lobby.newWindow')}
              </button>
            )}
          </div>
        )}

        {!offline && (
          <div className="card" style={{ padding: 24 }}>
            <h2 className="card-title">{t('lobby.playBot')}</h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)', letterSpacing: '0.2px' }}>
                {t('lobby.botDifficulty')}
              </span>
              <select
                className="input"
                style={{ width: 100, fontSize: 13 }}
                value={botSkill}
                onChange={(e) => setBotSkill(parseInt(e.target.value))}
              >
                <option value={1}>{t('lobby.botBeginner')}</option>
                <option value={5}>{t('lobby.botIntermediate')}</option>
                <option value={10}>{t('lobby.botAdvanced')}</option>
                <option value={15}>{t('lobby.botExpert')}</option>
                <option value={20}>{t('lobby.botMaster')}</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)', letterSpacing: '0.2px' }}>
                {t('game.playAs')}
              </span>
              <select
                className="input"
                style={{ width: 80, fontSize: 13 }}
                value={botColor}
                onChange={(e) => setBotColor(e.target.value as 'white' | 'black')}
              >
                <option value="white">{t('common.white')}</option>
                <option value="black">{t('common.black')}</option>
              </select>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: 14, fontSize: 16 }}
              onClick={startBotGame}
            >
              {t('lobby.startBot')}
            </button>
          </div>
        )}

        {!offline && (
          <div className="card" style={{ padding: 24 }}>
            <h2 className="card-title">{t('lobby.joinById')}</h2>
            <input
              className="input"
              type="text"
              placeholder={t('lobby.pasteGameId')}
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && joinId.trim()) joinGame(joinId.trim());
              }}
            />
            <button
              className="btn btn-secondary"
              style={{ marginTop: 12, width: '100%' }}
              onClick={() => {
                if (joinId.trim()) joinGame(joinId.trim());
              }}
            >
              {t('lobby.join')}
            </button>
          </div>
        )}

        {!offline && (
          <div className="card" style={{ padding: 24 }}>
            <h2 className="card-title">{t('lobby.spectateById')}</h2>
            <input
              className="input"
              type="text"
              placeholder={t('lobby.pasteGameId')}
              value={spectateId}
              onChange={(e) => setSpectateId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && spectateId.trim()) spectateGame(spectateId.trim());
              }}
            />
            <button
              className="btn btn-secondary"
              style={{ marginTop: 12, width: '100%' }}
              onClick={() => {
                if (spectateId.trim()) spectateGame(spectateId.trim());
              }}
            >
              {t('lobby.spectate')}
            </button>
          </div>
        )}
      </div>

      {profilePlayerId && <PlayerProfileDialog playerId={profilePlayerId} onClose={() => setProfilePlayerId(null)} />}
    </div>
  );
}
