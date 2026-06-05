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

export default function LobbyPage() {
  const navigate = useNavigate();
  const [openGames, setOpenGames] = useState<GameState[]>([]);
  const [liveGames, setLiveGames] = useState<GameState[]>([]);
  const [matchHistory, setMatchHistory] = useState<GameState[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [liveStatus, setLiveStatus] = useState('');

  /* Poll the server for open and active games. Errors are surfaced as status
     messages so the UI degrades gracefully when the server is unreachable. */
  const poll = useCallback(async () => {
    try {
      const games = await api.getOpenGames();
      setOpenGames(games);
      setStatusMsg(games.length === 0 ? 'No open games yet' : '');
      const active = await api.getActiveGames();
      setLiveGames(active);
      setLiveStatus(active.length === 0 ? 'No active games' : '');
    } catch {
      setStatusMsg('Cannot connect to server');
    }
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [poll]);

  /* Load the player's last 10 completed games for the match-history panel */
  useEffect(() => {
    const pid = store.get('playerId');
    if (pid) {
      api
        .getPlayerGames(pid)
        .then((games) => {
          setMatchHistory(games.slice(-10).reverse());
        })
        .catch(() => {});
    }
  }, []);

  /* If the player was in an active game (e.g. after a page refresh), resume it */
  useEffect(() => {
    checkActiveGame();
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
      store.toast(err.message || 'Failed to create game');
    }
  }

  async function joinGame(gid: string) {
    try {
      const game = await api.joinGame(gid);
      store.set('currentGame', game);
      navigate(`/game/${game.id}`);
    } catch (err: any) {
      store.toast(err.message || 'Failed to join game');
    }
  }

  async function spectateGame(gid: string) {
    try {
      const fresh = await api.getGame(gid);
      store.set('currentGame', fresh);
      navigate(`/game/${gid}?spectate=1`);
    } catch (err: any) {
      store.toast(err.message || 'Failed to load game');
    }
  }

  const myId = store.get('playerId');

  return (
    <div
      style={{ display: 'flex', gap: 24, padding: '20px 32px', flex: 1, width: '100%', minHeight: 0, overflow: 'hidden' }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <h2 className="card-title">Open Games</h2>
        {statusMsg && (
          <div
            style={{
              fontSize: 13,
              fontWeight: 300,
              color: statusMsg === 'Cannot connect to server' ? 'var(--danger)' : 'var(--muted)',
              textAlign: 'center',
              padding: 16,
            }}
          >
            {statusMsg}
          </div>
        )}
        <div style={{ flex: '1 1 0', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4, minHeight: 0 }}>
          {openGames
            .filter((g) => g.visibility !== 'private')
            .map((game) => {
              const creatorId = game.players.white;
              const creatorName = creatorId === myId ? 'You' : (creatorId?.slice(0, 8) ?? 'Unknown');
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
                        {game.visibility === 'private' && <span className="badge badge-private">Private</span>}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 300, color: 'var(--muted)', letterSpacing: '0.2px' }}>
                        Waiting
                      </span>
                    </div>
                  </div>
                  <button className="btn btn-sm btn-secondary" onClick={() => joinGame(game.id)}>
                    Join
                  </button>
                </div>
              );
            })}
        </div>

        <h2 className="card-title" style={{ marginTop: 16 }}>
          Live Games
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
          {liveGames.map((game) => (
            <div
              key={game.id}
              className="live-game-card card-elevated"
              style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', letterSpacing: '0.2px' }}>
                  Game in progress
                </span>
              </div>
              <button
                className="btn btn-sm"
                style={{ color: 'var(--success)', borderColor: 'var(--success)', background: 'transparent' }}
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
                Spectate
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', minHeight: 0 }}>
        <div className="card" style={{ padding: 24 }}>
          <h2 className="card-title">Local 1v1</h2>
          <p style={{ fontSize: 13, fontWeight: 300, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
            Play against a friend on the same screen. No server needed.
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: 14, fontSize: 16 }}
            onClick={() => navigate('/local')}
          >
            Start Local Game
          </button>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h2 className="card-title">Create Game</h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)', letterSpacing: '0.2px' }}>
              Private game
            </span>
            <div className={`toggle ${isPrivate ? 'active' : ''}`} onClick={() => setIsPrivate(!isPrivate)}>
              <div className="toggle-knob" />
            </div>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', padding: 14, fontSize: 16 }} onClick={createGame}>
            New Game
          </button>
          {window.electronAPI && (
            <button
              className="btn btn-ghost"
              style={{ marginTop: 12, width: '100%', fontSize: 13 }}
              onClick={() => window.electronAPI?.openNewWindow()}
            >
              New Window
            </button>
          )}
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h2 className="card-title">Join by ID</h2>
          <input
            className="input"
            type="text"
            placeholder="Paste game ID..."
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
            Join
          </button>
        </div>

        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <h2 className="card-title">Match History</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0, overflowY: 'auto' }}>
            {matchHistory.length === 0 ? (
              <div style={{ fontSize: 13, fontWeight: 300, color: '#555', textAlign: 'center', padding: 12 }}>
                No completed games yet
              </div>
            ) : (
              matchHistory.map((g) => {
                const isWhite = g.players.white === myId;
                const won = g.winner === (isWhite ? 'white' : 'black');
                const resultText = g.status === 'draw' ? 'Draw' : won ? 'Won' : 'Lost';
                const resultColor = g.status === 'draw' ? 'var(--muted)' : won ? 'var(--accent)' : 'var(--danger)';
                const opponent = isWhite ? g.players.black || '?' : g.players.white || '?';
                return (
                  <div
                    key={g.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.02)',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: 'var(--text)', fontWeight: 500, letterSpacing: '0.2px' }}>
                      vs {opponent.slice(0, 8)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: resultColor, fontWeight: 600, letterSpacing: '0.3px' }}>{resultText}</span>
                      <button
                        className="btn btn-ghost btn-xs"
                        style={{ fontSize: 11, padding: '2px 8px' }}
                        onClick={() => navigate(`/game/${g.id}`)}
                      >
                        Review
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <button
            className="btn btn-ghost"
            style={{ marginTop: 10, width: '100%', fontSize: 12 }}
            onClick={() => {
              const pid = store.get('playerId');
              if (pid)
                api
                  .getPlayerGames(pid)
                  .then((games) => setMatchHistory(games.slice(-10).reverse()))
                  .catch(() => {});
            }}
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
