import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import logger from '../logger';
import { store } from '../store';
import * as api from '../api';
import { t } from '../translate';
import { copyToClipboard } from '../clipboard';

export default function ResultPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(() => store.get('currentGame'));
  const myId = store.get('playerId');

  useEffect(() => {
    logger.info('ResultPage mounted', { gameId });
    if (game && game.id === gameId) return;
    if (!gameId) return;
    logger.info('Fetching game for results', { gameId });
    api
      .getGame(gameId)
      .then((g) => {
        logger.info('Game result loaded', { gameId, status: g.status });
        setGame(g);
        store.set('currentGame', g);
      })
      .catch((err) => {
        logger.error('Failed to load game results', { gameId, error: err });
        store.toast(t('game.failedLoad'));
        navigate('/lobby');
      });
    return () => logger.info('ResultPage unmounting');
  }, []);
  const [rematching, setRematching] = useState(false);

  let outcomeText = t('result.draw');
  let reasonText = '';
  let won = false;
  let lost = false;

  if (game) {
    if (game.status === 'checkmate' || game.status === 'resigned') {
      if (game.winner) {
        const winnerIsMe =
          (game.winner === 'white' && game.players.white === myId) ||
          (game.winner === 'black' && game.players.black === myId);
        if (winnerIsMe) {
          outcomeText = t('result.youWon');
          won = true;
        } else if (myId && (game.players.white === myId || game.players.black === myId)) {
          outcomeText = t('result.youLost');
          lost = true;
        }
      }
    } else if (game.status === 'stalemate' || game.status === 'draw') {
      outcomeText = t('result.draw');
    }

    if (game.reason) {
      const reasonMap: Record<string, string> = {
        'Draw by agreement': t('result.byAgreement'),
        'Draw by 50-move rule': t('result.by50MoveRule'),
        'Draw by stalemate': t('result.byStalemate'),
        'Engine error — game cancelled': t('result.byEngineError'),
        'Ended by admin': t('result.byAdminAction'),
      };
      reasonText = reasonMap[game.reason] || game.reason;
    } else {
      switch (game.status) {
        case 'checkmate':
          reasonText = t('result.byCheckmate');
          break;
        case 'resigned':
          reasonText = won ? t('result.byResignation') : t('result.opponentResigned');
          break;
        case 'stalemate':
          reasonText = t('result.byStalemate');
          break;
        case 'draw':
          reasonText = t('result.by50MoveRule');
          break;
      }
    }
  }

  const wasPlayer = !!myId && game && (game.players.white === myId || game.players.black === myId);

  async function handleRematch() {
    if (!game) return;
    logger.info('Creating rematch', { previousGameId: game.id });
    setRematching(true);
    try {
      const g = await api.createGame(game.visibility === 'private' ? 'private' : 'public');
      logger.info('Rematch created', { newGameId: g.id });
      store.set('currentGame', g);
      navigate(`/game/${g.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Rematch failed', { error: msg });
      store.toast(msg || t('result.failedRematch'));
      setRematching(false);
    }
  }

  const outcomeColor = won ? '#4f8ef7' : lost ? 'rgba(220,80,80,0.9)' : '#888';

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ padding: '48px 40px' }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: outcomeColor, letterSpacing: '-0.5px', marginBottom: 8 }}>
          {outcomeText}
        </h1>
        {reasonText && (
          <p style={{ fontSize: 16, fontWeight: 300, color: '#888', marginBottom: 32, letterSpacing: '0.3px' }}>
            {reasonText}
          </p>
        )}
        <div className="game-btn-row" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            className="btn btn-primary"
            style={{ padding: '12px 24px', fontSize: 15 }}
            onClick={() => navigate('/lobby')}
          >
            {t('common.backToLobby')}
          </button>
          {game && game.boardHistory && game.boardHistory.length > 0 && (
            <button
              className="btn btn-secondary"
              style={{ padding: '12px 24px', fontSize: 15 }}
              onClick={() => navigate(`/game/${game.id}`)}
            >
              {t('result.review')}
            </button>
          )}
          {wasPlayer && (
            <button
              className="btn btn-primary"
              style={{ padding: '12px 24px', fontSize: 15 }}
              onClick={handleRematch}
              disabled={rematching}
            >
              {rematching ? t('result.creating') : t('result.rematch')}
            </button>
          )}
          <button
            className="btn btn-ghost"
            style={{ padding: '12px 24px', fontSize: 15 }}
            onClick={() => {
              const id = game?.id || gameId;
              if (id) {
                copyToClipboard(id);
                const btn = document.activeElement as HTMLElement;
                btn.textContent = t('common.copied');
                setTimeout(() => {
                  btn.textContent = t('common.copyGameId');
                }, 2000);
              }
            }}
          >
            Copy Game ID
          </button>
        </div>
      </div>
    </div>
  );
}
