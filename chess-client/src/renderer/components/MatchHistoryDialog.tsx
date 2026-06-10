import { useState, useEffect } from 'react';
import { store } from '../store';
import * as api from '../api';
import { useNavigate } from 'react-router-dom';
import type { GameState } from '../../types';
import { t } from '../translate';
import logger from '../logger';
import PlayerProfileDialog from './PlayerProfileDialog';

interface Props {
  onClose: () => void;
}

export default function MatchHistoryDialog({ onClose }: Props) {
  const navigate = useNavigate();
  const [games, setGames] = useState<GameState[]>([]);
  const [loading, setLoading] = useState(true);
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);

  useEffect(() => {
    const pid = store.get('playerId');
    if (pid) {
      logger.info('Fetching match history for playerId=' + pid);
      api
        .getPlayerGames(pid)
        .then((g) => {
          logger.info('Match history loaded: count=' + g.length);
          setGames(g.slice(-20).reverse());
        })
        .catch((e) => logger.error('Match history fetch failed: ' + e))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  const myId = store.get('playerId');

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className="modal-card"
        style={{
          width: 520,
          maxWidth: '90vw',
          maxHeight: '80vh',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          cursor: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e0e0e0', letterSpacing: '-0.3px' }}>
            {t('matchHistory.title')}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: 18,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 4,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '16px 24px 24px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ fontSize: 13, fontWeight: 300, color: '#888', textAlign: 'center', padding: 32 }}>
              {t('matchHistory.loading')}
            </div>
          ) : games.length === 0 ? (
            <div style={{ fontSize: 13, fontWeight: 300, color: '#555', textAlign: 'center', padding: 32 }}>
              {t('matchHistory.noGames')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {games.map((g) => {
                const isWhite = g.players.white === myId;
                const won = g.winner === (isWhite ? 'white' : 'black');
                const resultText =
                  g.status === 'draw' ? t('matchHistory.draw') : won ? t('matchHistory.won') : t('matchHistory.lost');
                const resultColor = g.status === 'draw' ? 'var(--muted)' : won ? 'var(--accent)' : 'var(--danger)';
                const opponentName = isWhite
                  ? g.blackName || g.players.black?.slice(0, 8) || '?'
                  : g.whiteName || g.players.white?.slice(0, 8) || '?';
                return (
                  <div
                    key={g.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.02)',
                      fontSize: 13,
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--text)',
                        fontWeight: 500,
                        letterSpacing: '0.2px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {t('common.vs')}{' '}
                      {isWhite ? (
                        g.blackAvatarUrl ? (
                          <img
                            src={api.avatarSrc(g.blackAvatarUrl)}
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
                            {(opponentName || '?')[0].toUpperCase()}
                          </div>
                        )
                      ) : g.whiteAvatarUrl ? (
                        <img
                          src={api.avatarSrc(g.whiteAvatarUrl)}
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
                          {(opponentName || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <span
                        onClick={() => {
                          const oppId = isWhite ? g.players.black : g.players.white;
                          if (oppId) setProfilePlayerId(oppId);
                        }}
                        style={{ cursor: 'pointer', borderBottom: '1px dashed transparent' }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = 'var(--muted)')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = 'transparent')}
                      >
                        {opponentName}
                      </span>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: resultColor, fontWeight: 600, letterSpacing: '0.3px' }}>{resultText}</span>
                      <button
                        className="btn btn-ghost btn-xs"
                        style={{ fontSize: 11, padding: '2px 8px' }}
                        onClick={() => {
                          onClose();
                          navigate(`/game/${g.id}`);
                        }}
                      >
                        {t('matchHistory.review')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {profilePlayerId && <PlayerProfileDialog playerId={profilePlayerId} onClose={() => setProfilePlayerId(null)} />}
    </div>
  );
}
