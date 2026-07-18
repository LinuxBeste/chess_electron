import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '../store';
import * as api from '../api';
import { t } from '../translate';
import logger from '../logger';

// Lobby sidebar panel: create/join/spectate games and play vs bot
export default function LobbyPanel() {
  const navigate = useNavigate();
  const [isPrivate, setIsPrivate] = useState(false);
  const [chess960, setChess960] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [spectateId, setSpectateId] = useState('');
  const [botSkill, setBotSkill] = useState(5);
  const [botColor, setBotColor] = useState<'white' | 'black'>('white');
  const offline = store.get('offline');

  async function createGame() {
    const visibility = isPrivate ? 'private' : 'public';
    logger.info('Creating game', { visibility, chess960 });
    try {
      const game = chess960 ? await api.createChess960Game(visibility) : await api.createGame(visibility);
      logger.info('Game created', { gameId: game.id, visibility, chess960 });
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

  return (
    <div className="lobby-panel">
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)', letterSpacing: '0.2px' }}>
              {t('lobby.chess960')}
            </span>
            <div className={`toggle ${chess960 ? 'active' : ''}`} onClick={() => setChess960(!chess960)}>
              <div className="toggle-knob" />
            </div>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', padding: 14, fontSize: 16 }} onClick={createGame}>
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
  );
}
