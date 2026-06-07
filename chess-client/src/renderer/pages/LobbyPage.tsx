/**
 * LobbyPage — game discovery and creation hub.
 *
 * Polls the server every 3 s for open games and active (in-progress) games.
 * Also loads the current player's match history on mount.
 * The three-column layout shows: open games, live games for spectating,
 * and a right sidebar with local-play / create / join / history cards.
 */

import { useState, useEffect, useCallback } from 'react';
import { store } from '../store';
import * as api from '../api';
import { useNavigate } from 'react-router-dom';
import type { GameState } from '../../types';
import { t } from '../translate';

export default function LobbyPage() {
  const navigate = useNavigate();
  const [openGames, setOpenGames] = useState<GameState[]>([]);
  const [liveGames, setLiveGames] = useState<GameState[]>([]);

  const [isPrivate, setIsPrivate] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [spectateId, setSpectateId] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [liveStatus, setLiveStatus] = useState('');

  /* Poll the server for open and active games. Errors are surfaced as status
     messages so the UI degrades gracefully when the server is unreachable. */
  const poll = useCallback(async () => {
    try {
      const games = await api.getOpenGames();
      setOpenGames(games);
      setStatusMsg(games.length === 0 ? t('lobby.noOpenGames') : '');
      const active = await api.getActiveGames();
      setLiveGames(active);
      setLiveStatus(active.length === 0 ? t('lobby.noActiveGames') : '');
    } catch {
      setStatusMsg(t('lobby.cannotConnect'));
    }
  }, []);

  useEffect(() => {
    if (store.get('offline')) return;
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [poll]);

  /* If the player was in an active game (e.g. after a page refresh), resume it */
  useEffect(() => {
    if (!store.get('offline')) checkActiveGame();
  }, []);

  async function checkActiveGame() {
    try {
      const game = store.get('currentGame');
      if (game && game.status === 'active') {
        const fresh = await api.getGame(game.id);
        if (fresh.status === 'active') {
          store.set('currentGame', fresh);
          navigate(`/game/${fresh.id}`);
        }
      }
    } catch {}
  }

  async function createGame() {
    try {
      const game = await api.createGame(isPrivate ? 'private' : 'public');
      store.set('currentGame', game);
      navigate(`/game/${game.id}`);
    } catch (err: any) {
      store.toast(err.message || t('lobby.failedCreate'));
    }
  }

  async function joinGame(gid: string) {
    try {
      const game = await api.joinGame(gid);
      store.set('currentGame', game);
      navigate(`/game/${game.id}`);
    } catch (err: any) {
      store.toast(err.message || t('lobby.failedJoin'));
    }
  }

  async function spectateGame(gid: string) {
    try {
      const fresh = await api.getGame(gid);
      store.set('currentGame', fresh);
      navigate(`/game/${gid}?spectate=1`);
    } catch (err: any) {
      store.toast(err.message || t('lobby.failedLoad'));
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
                          <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', letterSpacing: '0.2px' }}>
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
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', letterSpacing: '0.2px' }}>
                        {wName}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--muted)', margin: '0 4px' }}>{t('common.vs')}</span>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', letterSpacing: '0.2px' }}>
                        {bName}
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
    </div>
  );
}
