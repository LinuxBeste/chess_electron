/**
 * GamePage — online multiplayer chess game view.
 *
 * Connects to a game via REST (for initial state) and WebSocket (for
 * real-time updates).  Board state, moves, and game-over events arrive
 * through the socket; the player's own moves are sent via REST and
 * confirmed/overridden by the server's WebSocket broadcast.
 *
 * Supports spectating via ?spectate=1 query parameter (read-only view).
 * Move review after game-over uses the server's boardHistory snapshots.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import logger from '../logger';
import { store } from '../store';
import * as api from '../api';
import { socketManager } from '../socket';
import Board from '../components/Board';
import MoveHistory from '../components/MoveHistory';
import Chat from '../components/Chat';
import PromotionDialog from '../components/PromotionDialog';
import PlayerProfileDialog from '../components/PlayerProfileDialog';
import { deserializeBoard, cloneBoard, createInitialBoard, squareToIndices } from '../chess';
import { getSetting } from '../settings';
import { playMoveSound, playCaptureSound, playCheckSound, playGameOverSound } from '../sound';
import type { Board as BoardType, GameState, PieceType, LegalMoveHint, GameStatus } from '../../types';
import type {
  MoveMessage,
  GameOverMessage,
  GameStartedMessage,
  GameAbortedMessage,
  DrawOfferedMessage,
  DrawDeclinedMessage,
  RematchOfferMessage,
  RematchAcceptedMessage,
} from '../socket';
import { t } from '../translate';

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameState | null>(null);
  const [board, setBoard] = useState<BoardType>([]);
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalHints, setLegalHints] = useState<LegalMoveHint[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [moves, setMoves] = useState<string[]>([]);
  const initialMs = getSetting('timeControlMinutes') * 60 * 1000;
  const [whiteTime, setWhiteTime] = useState(initialMs);
  const [blackTime, setBlackTime] = useState(initialMs);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const [resignConfirmed, setResignConfirmed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [timeout, setTimeout_] = useState<'white' | 'black' | null>(null);
  const [drawOfferedBy, setDrawOfferedBy] = useState<string | null>(null);
  const [drawPending, setDrawPending] = useState(false);
  const [rematchOfferedBy, setRematchOfferedBy] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Spectator mode = read-only; no move interaction.  The ?spectate=1
     query param is set by LobbyPage when clicking "Spectate". */
  const isSpectator = searchParams.get('spectate') === '1';
  /* Refs that always reflect the latest state — used inside WebSocket
     event handlers (which are registered once and would otherwise capture
     stale values from the initial render). */
  const boardRef = useRef(board);
  boardRef.current = board;
  const gameRef = useRef(game);
  gameRef.current = game;
  const timeoutRef = useRef(timeout);
  timeoutRef.current = timeout;

  /* Countdown timer — decrement the active player every 50ms */
  useEffect(() => {
    if (!game || game.status !== 'active' || timeout) return;
    const interval = setInterval(() => {
      if (gameRef.current && gameRef.current.turn === 'white') {
        setWhiteTime((t) => {
          const next = t - 50;
          if (next <= 0) {
            setTimeout_('black');
            return 0;
          }
          return next;
        });
      } else {
        setBlackTime((t) => {
          const next = t - 50;
          if (next <= 0) {
            setTimeout_('white');
            return 0;
          }
          return next;
        });
      }
    }, 50);
    return () => clearInterval(interval);
  }, [game, timeout]);

  /* True when the current player can make a move */
  const isActive = !!game && game.turn === playerColor && game.status === 'active' && !isSpectator && !timeout;

  useEffect(() => {
    if (!gameId) {
      logger.warn('GamePage mounted without gameId, redirecting to lobby');
      navigate('/lobby');
      return;
    }
    logger.info('GamePage mounted', { gameId, isSpectator });
    window.location.hash = `#game/${gameId}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
  }, []);

  useEffect(() => {
    if (!gameId) return;

    logger.info('Registering WS handlers and fetching game', { gameId, isSpectator });

    const stored = store.get('currentGame');
    const initialGame = stored && stored.id === gameId ? stored : null;

    const unsubMove = socketManager.onMove((msg) => {
      if (msg.gameId === gameId) handleWsMove(msg);
    });
    const unsubGameOver = socketManager.onGameOver((msg) => {
      if (msg.gameId === gameId) handleWsGameOver(msg);
    });
    const unsubGameStarted = socketManager.onGameStarted((msg) => {
      if (msg.gameId === gameId) handleWsGameStarted(msg);
    });
    const unsubGameAborted = socketManager.onGameAborted((msg) => {
      if (msg.gameId === gameId) handleWsGameAborted(msg);
    });
    const unsubDrawOffered = socketManager.onDrawOffered((msg) => {
      if (msg.gameId === gameId) handleDrawOffered(msg);
    });
    const unsubDrawDeclined = socketManager.onDrawDeclined((msg) => {
      if (msg.gameId === gameId) handleDrawDeclined(msg);
    });
    const unsubRematchOffer = socketManager.onRematchOffer((msg) => {
      if (msg.gameId === gameId) handleRematchOffer(msg);
    });
    const unsubRematchAccepted = socketManager.onRematchAccepted((msg) => {
      if (msg.gameId === gameId) handleRematchAccepted(msg);
    });

    if (initialGame) {
      logger.info('Using cached game state', { gameId });
      initGame(initialGame);
    } else {
      fetchGame(gameId);
    }

    if (isSpectator) {
      const status = store.get('wsStatus');
      if (status === 'connected') {
        socketManager.send({ type: 'spectate', gameId });
      } else {
        const unsub = store.subscribe('wsStatus', (newStatus) => {
          if (newStatus === 'connected') {
            socketManager.send({ type: 'spectate', gameId });
            unsub();
          }
        });
      }
    }

    return () => {
      logger.info('GamePage unmounting, cleaning up WS handlers', { gameId });
      unsubMove();
      unsubGameOver();
      unsubGameStarted();
      unsubGameAborted();
      unsubDrawOffered();
      unsubDrawDeclined();
      unsubRematchOffer();
      unsubRematchAccepted();
      if (isSpectator) {
        socketManager.send({ type: 'unspectate' });
      }
    };
  }, [gameId]);

  useEffect(() => {
    if (!game) return;
    if (!gameRef.current) return;
    const g = gameRef.current;
    if (g.status === 'checkmate' || g.status === 'stalemate' || g.status === 'resigned' || g.status === 'draw') {
      if (!window.location.hash.startsWith('#result/')) {
        setReviewIndex(g.boardHistory.length > 0 ? g.boardHistory.length - 1 : null);
      } else {
        navigate(`/result/${g.id}`);
      }
    }
  }, [game?.status]);

  /* Close menu on click outside */
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  /* REST polling fallback for the waiting state — if the WebSocket
     game_started event is missed (e.g. reconnect race), this picks up
     the transition so P1 doesn't stay stuck on the waiting overlay. */
  useEffect(() => {
    if (!gameId || !waiting) return;
    const interval = setInterval(async () => {
      try {
        const fresh = await api.getGame(gameId);
        if (fresh.status === 'active') {
          applyGameStarted(fresh);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [gameId, waiting]);

  function initGame(g: GameState) {
    setGame(g);
    const pc = g.players.white === store.get('playerId') ? 'white' : 'black';
    setPlayerColor(isSpectator ? 'white' : pc);
    setBoard(cloneBoard(g.board));
    setLastMove(g.lastMove);
    setMoves(g.moveHistory);
    setWaiting(g.status === 'waiting');
    setReviewIndex(null);
    setDrawOfferedBy(null);
    setDrawPending(false);
    setRematchOfferedBy(null);
    const ms = getSetting('timeControlMinutes') * 60 * 1000;
    setWhiteTime(ms);
    setBlackTime(ms);
  }

  async function fetchGame(gid: string) {
    logger.info('Fetching game', { gameId: gid });
    try {
      const g = await api.getGame(gid);
      store.set('currentGame', g);
      initGame(g);
    } catch (err: any) {
      logger.error('Failed to fetch game', { gameId: gid, error: err.message });
      store.toast(err.message || t('game.failedLoad'));
      navigate('/lobby');
    }
  }

  function handleWsMove(msg: MoveMessage) {
    if (!gameRef.current) return;
    logger.info('WS move received', {
      gameId: msg.gameId,
      from: msg.lastMove.from,
      to: msg.lastMove.to,
      turn: msg.turn,
      status: msg.status,
    });
    const [toR, toF] = squareToIndices(msg.lastMove.to);
    const wasCapture = boardRef.current[toR]?.[toF] !== null;
    const newBoard = deserializeBoard(msg.board);
    setBoard(newBoard);
    setLastMove(msg.lastMove);
    setGame((prev) => (prev ? { ...prev, turn: msg.turn } : null));
    setDrawOfferedBy(null);
    setDrawPending(false);
    const incMs = getSetting('timeControlIncrement') * 1000;
    if (msg.turn === 'black') setWhiteTime((t) => t + incMs);
    else setBlackTime((t) => t + incMs);

    if (getSetting('soundEnabled') && playerColor !== msg.turn) {
      if (wasCapture) playCaptureSound();
      else playMoveSound();
      if (msg.status === 'check') setTimeout(() => playCheckSound(), 100);
    }
  }

  function handleWsGameOver(msg: GameOverMessage) {
    if (!gameRef.current) return;
    logger.info('WS game_over received', { gameId: msg.gameId, status: msg.status, winner: msg.winner });
    setBoard(deserializeBoard(msg.board));
    setLastMove(msg.lastMove);
    const updated = { ...gameRef.current, status: msg.status as GameStatus, winner: msg.winner || null };
    setGame(updated);
    store.set('currentGame', updated);
    if (getSetting('soundEnabled')) playGameOverSound();
    setTimeout(() => navigate(`/result/${msg.gameId}`), 500);
  }

  function applyGameStarted(g: GameState) {
    logger.info('Game started', { gameId: g.id });
    setGame(g);
    store.set('currentGame', g);
    setBoard(cloneBoard(g.board));
    setLastMove(g.lastMove);
    setMoves(g.moveHistory);
    setWaiting(false);
    const ms = getSetting('timeControlMinutes') * 60 * 1000;
    setWhiteTime(ms);
    setBlackTime(ms);
    setTimeout_(null);
  }

  function handleWsGameStarted(msg: GameStartedMessage) {
    logger.info('WS game_started received', { gameId: msg.game?.id });
    applyGameStarted(msg.game);
  }

  function handleWsGameAborted(_msg: GameAbortedMessage) {
    logger.info('WS game_aborted received', { gameId: _msg.gameId });
    store.set('currentGame', null);
    navigate('/lobby');
  }

  function handleDrawOffered(msg: DrawOfferedMessage) {
    logger.info('Draw offered', { gameId: msg.gameId, byPlayerId: msg.byPlayerId });
    if (msg.byPlayerId === store.get('playerId')) {
      setDrawPending(true);
    } else {
      setDrawOfferedBy(msg.byPlayerId);
    }
  }

  function handleDrawDeclined(_msg: DrawDeclinedMessage) {
    logger.info('Draw declined', { gameId: _msg.gameId });
    setDrawPending(false);
  }

  function handleRematchOffer(msg: RematchOfferMessage) {
    logger.info('Rematch offered', { gameId: msg.gameId, byPlayerId: msg.byPlayerId });
    if (msg.byPlayerId === store.get('playerId')) return;
    setRematchOfferedBy(msg.byPlayerId);
  }

  function handleRematchAccepted(msg: RematchAcceptedMessage) {
    logger.info('Rematch accepted, navigating to new game', { oldGameId: msg.gameId, newGameId: msg.newGameId });
    store.set('currentGame', null);
    navigate(`/game/${msg.newGameId}`);
  }

  function handleOfferDraw() {
    if (!gameId) return;
    logger.info('Offering draw', { gameId });
    setMenuOpen(false);
    socketManager.send({ type: 'offer_draw', gameId });
  }

  function handleAcceptDraw() {
    if (!gameId) return;
    logger.info('Accepting draw', { gameId });
    setDrawOfferedBy(null);
    socketManager.send({ type: 'accept_draw', gameId });
  }

  function handleDeclineDraw() {
    if (!gameId) return;
    logger.info('Declining draw', { gameId });
    setDrawOfferedBy(null);
    socketManager.send({ type: 'decline_draw', gameId });
  }

  function handleOfferRematch() {
    if (!gameId) return;
    logger.info('Offering rematch', { gameId });
    socketManager.sendRematchOffer(gameId);
  }

  function handleAcceptRematch() {
    if (!gameId) return;
    logger.info('Accepting rematch', { gameId });
    setRematchOfferedBy(null);
    socketManager.sendRematchAccept(gameId);
  }

  const requestLegalMoves = useCallback(async (square: string) => {
    if (!gameRef.current) return;
    try {
      const { moves } = await api.getLegalMoves(gameRef.current.id);
      setLegalHints(moves.filter((m) => m.from === square));
    } catch {}
  }, []);

  const handleSquareClick = useCallback(
    async (square: string) => {
      if (dragFrom.current) return;
      if (!gameRef.current || gameRef.current.turn !== playerColor || gameRef.current.status !== 'active') return;
      const [r, f] = squareToIndices(square);
      const clickedPiece = boardRef.current[r]?.[f];
      if (square === selectedSquare) {
        setSelectedSquare(null);
        setLegalHints([]);
        return;
      }
      if (selectedSquare && legalHints.some((h) => h.from === selectedSquare && h.to === square)) {
        if (checkPromotion(selectedSquare, square) && !getSetting('autoPromoteQueen')) {
          setPromotion({ from: selectedSquare, to: square });
        } else {
          executeMove(selectedSquare, square, checkPromotion(selectedSquare, square) ? 'queen' : undefined);
        }
        return;
      }
      if (clickedPiece && clickedPiece.color === playerColor) {
        setSelectedSquare(square);
        requestLegalMoves(square);
        return;
      }
      setSelectedSquare(null);
      setLegalHints([]);
    },
    [selectedSquare, legalHints, playerColor],
  );

  const dragFrom = useRef<string | null>(null);

  const handleDragStart = useCallback(
    (from: string) => {
      dragFrom.current = from;
      setSelectedSquare(from);
      requestLegalMoves(from);
    },
    [requestLegalMoves],
  );

  const handleDragEnd = useCallback(
    (to: string) => {
      const from = dragFrom.current;
      dragFrom.current = null;
      if (!from) {
        setSelectedSquare(null);
        setLegalHints([]);
        return;
      }
      const isLegal = legalHints.some((h) => h.from === from && h.to === to);
      if (isLegal) {
        if (checkPromotion(from, to) && !getSetting('autoPromoteQueen')) {
          setPromotion({ from, to });
        } else {
          executeMove(from, to, checkPromotion(from, to) ? 'queen' : undefined);
        }
      } else {
        setSelectedSquare(null);
        setLegalHints([]);
      }
    },
    [legalHints],
  );

  function checkPromotion(from: string, to: string): boolean {
    const [fr, ff] = squareToIndices(from);
    const [tr] = squareToIndices(to);
    const piece = boardRef.current[fr]?.[ff];
    return !!piece && piece.type === 'pawn' && (tr === 0 || tr === 7);
  }

  async function executeMove(from: string, to: string, promotion?: PieceType) {
    if (!gameRef.current) return;
    logger.info('Executing move', { gameId: gameRef.current.id, from, to, promotion });
    setSelectedSquare(null);
    setLegalHints([]);
    const oldBoard = cloneBoard(boardRef.current);
    const [fromR, fromF] = squareToIndices(from);
    const [toR, toF] = squareToIndices(to);
    const newBoard = cloneBoard(boardRef.current);
    const piece = newBoard[fromR][fromF];
    if (piece) {
      newBoard[toR][toF] = piece;
      newBoard[fromR][fromF] = null;
    }
    setBoard(newBoard);
    setLastMove({ from, to });
    try {
      const updated = await api.makeMove(gameRef.current.id, from, to, promotion);
      logger.info('Move confirmed by server', {
        gameId: gameRef.current.id,
        status: updated.status,
        turn: updated.turn,
      });
      setGame(updated);
      store.set('currentGame', updated);
      setBoard(cloneBoard(updated.board));
      setLastMove(updated.lastMove);
      setMoves(updated.moveHistory);
      /* Apply increment to the player who just moved (opposite of updated.turn) */
      const incMs = getSetting('timeControlIncrement') * 1000;
      if (updated.turn === 'black') setWhiteTime((t) => t + incMs);
      else setBlackTime((t) => t + incMs);
      if (getSetting('soundEnabled')) {
        if (oldBoard[toR]?.[toF]) playCaptureSound();
        else playMoveSound();
      }
      if (['checkmate', 'stalemate', 'resigned', 'draw'].includes(updated.status)) {
        logger.info('Game ended after move', { gameId: gameRef.current.id, status: updated.status });
        if (getSetting('soundEnabled')) playGameOverSound();
      }
    } catch (err: any) {
      logger.error('Move failed', { gameId: gameRef.current?.id, from, to, error: err.message });
      setBoard(oldBoard);
      setLastMove(gameRef.current?.lastMove || null);
      store.toast(err.message || t('game.moveFailed'));
    }
  }

  function handlePromotionSelect(pt: PieceType) {
    if (promotion) {
      executeMove(promotion.from, promotion.to, pt);
      setPromotion(null);
    }
  }

  function handleCopyId() {
    const id = gameRef.current?.id || gameId;
    if (id) {
      navigator.clipboard.writeText(id).catch(() => {});
    }
    setMenuOpen(false);
  }

  async function handleAbort() {
    logger.info('Aborting game', { gameId });
    try {
      if (gameId) await api.abortGame(gameId);
    } catch {}
    store.set('currentGame', null);
    navigate('/lobby');
  }

  function handleResign() {
    if (isSpectator) {
      logger.info('Spectator leaving game', { gameId });
      socketManager.send({ type: 'unspectate' });
      store.set('currentGame', null);
      navigate('/lobby');
      return;
    }
    if (getSetting('confirmResign') && !resignConfirmed) {
      setResignConfirmed(true);
      setTimeout(() => setResignConfirmed(false), 4000);
      return;
    }
    if (!gameRef.current) return;
    logger.info('Resigning game', { gameId: gameRef.current.id });
    api
      .resignGame(gameRef.current.id)
      .then((updated) => {
        logger.info('Resignation successful', { gameId: updated.id, status: updated.status });
        store.set('currentGame', updated);
        navigate(`/result/${updated.id}`);
      })
      .catch((err: any) => {
        logger.error('Resignation failed', { error: err.message });
        store.toast(err.message || t('game.failedResign'));
      });
    setResignConfirmed(false);
  }

  function reviewStep(direction: number) {
    if (reviewIndex === null || !gameRef.current) return;
    const newIndex = reviewIndex + direction;
    if (newIndex < -1 || newIndex >= gameRef.current.boardHistory.length) return;
    setReviewIndex(newIndex);
    if (newIndex === -1) {
      setBoard(createInitialBoard());
      setLastMove(null);
      setMoves([]);
    } else {
      const snapshot = gameRef.current.boardHistory[newIndex];
      setBoard(deserializeBoard(snapshot.board));
      setLastMove(extractLastMoveFromHistory(gameRef.current.moveHistory, newIndex));
      setMoves(gameRef.current.moveHistory.slice(0, newIndex + 1));
    }
  }

  function extractLastMoveFromHistory(history: string[], index: number): { from: string; to: string } | null {
    if (index < 0 || index >= history.length) return null;
    const parts = history[index].split('-');
    return parts.length === 2 ? { from: parts[0], to: parts[1] } : null;
  }

  function formatTime(ms: number): string {
    const totalSec = Math.max(0, ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    const decimals = getSetting('clockDecimalPlaces');
    const dec = decimals > 0 ? '.' + String(Math.floor((totalSec % 1) * 10 ** decimals)).padStart(decimals, '0') : '';
    return `${m}:${String(s).padStart(2, '0')}${dec}`;
  }

  const isFinished = (game && ['checkmate', 'stalemate', 'resigned', 'draw'].includes(game.status)) || !!timeout;
  const showReview = isFinished && !window.location.hash.startsWith('#result/');

  return (
    <div className="game-layout">
      <div className="game-center">
        <div className="player-bar">
          <span className="player-name" style={{ gap: 8 }}>
            {game?.players.black === store.get('playerId') ? (
              t('game.youBlack')
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {game?.blackAvatarUrl ? (
                  <img
                    src={api.avatarSrc(game.blackAvatarUrl)}
                    alt=""
                    style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: '#2a2a2a',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      color: '#555',
                    }}
                  >
                    {(game?.blackName || t('common.black'))[0].toUpperCase()}
                  </div>
                )}
                <span
                  onClick={() => game?.players.black && setProfilePlayerId(game.players.black)}
                  style={{ cursor: 'pointer', borderBottom: '1px dashed transparent' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = 'var(--muted)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = 'transparent')}
                >
                  {game?.blackName || t('common.black')}
                </span>
              </span>
            )}
          </span>
          <span className="player-clock">{formatTime(blackTime)}</span>
        </div>
        <Board
          board={board}
          playerColor={playerColor}
          selectedSquare={selectedSquare}
          legalHints={legalHints}
          lastMove={lastMove}
          isActive={isActive && !promotion}
          onSquareClick={handleSquareClick}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {waiting && game && (
            <div className="waiting-overlay">
              <div className="waiting-text">{t('game.waiting')}</div>
              <div className="waiting-id-row">
                <span className="waiting-id-label">{t('game.gameId')}</span>
                <span className="waiting-id-value">{game.id}</span>
                <button
                  className="btn btn-secondary btn-xs"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(game.id)
                      .then(() => {
                        /* copied */
                      })
                      .catch(() => {});
                  }}
                >
                  {t('common.copy')}
                </button>
              </div>
            </div>
          )}
          {drawOfferedBy && !isFinished && (
            <div className="waiting-overlay" style={{ background: 'rgba(0,0,0,0.75)' }}>
              <div className="waiting-text" style={{ fontSize: 16, marginBottom: 16 }}>
                {t('game.opponentDraw')}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-primary btn-sm" onClick={handleAcceptDraw}>
                  {t('game.accept')}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleDeclineDraw}>
                  {t('game.decline')}
                </button>
              </div>
            </div>
          )}
          {rematchOfferedBy && isFinished && (
            <div className="waiting-overlay" style={{ background: 'rgba(0,0,0,0.75)' }}>
              <div className="waiting-text" style={{ fontSize: 16, marginBottom: 16 }}>
                {t('game.opponentRematch')}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-primary btn-sm" onClick={handleAcceptRematch}>
                  {t('game.accept')}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setRematchOfferedBy(null)}>
                  {t('game.decline')}
                </button>
              </div>
            </div>
          )}
        </Board>
        <div className="player-bar">
          <span className="player-name" style={{ gap: 8 }}>
            {game?.players.white === store.get('playerId') ? (
              t('game.youWhite')
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {game?.whiteAvatarUrl ? (
                  <img
                    src={api.avatarSrc(game.whiteAvatarUrl)}
                    alt=""
                    style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: '#2a2a2a',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      color: '#555',
                    }}
                  >
                    {(game?.whiteName || t('common.white'))[0].toUpperCase()}
                  </div>
                )}
                <span
                  onClick={() => game?.players.white && setProfilePlayerId(game.players.white)}
                  style={{ cursor: 'pointer', borderBottom: '1px dashed transparent' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = 'var(--muted)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = 'transparent')}
                >
                  {game?.whiteName || t('common.white')}
                </span>
              </span>
            )}
          </span>
          <span className="player-clock">{formatTime(whiteTime)}</span>
        </div>
        <div className="game-btn-row">
          {showReview && (
            <div className="review-controls active">
              <button className="btn btn-ghost btn-sm" onClick={() => reviewStep(-1)}>
                {t('common.prev')}
              </button>
              <span className="review-label">
                {reviewIndex === -1
                  ? t('common.start')
                  : reviewIndex !== null && game
                    ? `${reviewIndex + 1}/${game.boardHistory.length}`
                    : t('common.end')}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => reviewStep(1)}>
                {t('common.next')}
              </button>
            </div>
          )}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setMenuOpen((o) => !o)}
              style={{ minWidth: 80 }}
            >
              {t('game.menu')}
            </button>
            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  right: 0,
                  marginBottom: 4,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  minWidth: 160,
                  padding: 4,
                  zIndex: 100,
                  animation: 'fadeIn 100ms ease',
                }}
              >
                {!isFinished && (
                  <>
                    {isSpectator ? (
                      <MenuItem label={t('game.leave')} onClick={handleResign} />
                    ) : (
                      <MenuItem
                        label={resignConfirmed ? t('game.areYouSure') : t('game.resign')}
                        onClick={handleResign}
                        danger
                      />
                    )}
                    {!isSpectator && game?.status === 'active' && (
                      <MenuItem
                        label={drawPending ? t('game.drawOffered') : t('game.offerDraw')}
                        onClick={handleOfferDraw}
                      />
                    )}
                    {waiting && !isSpectator && <MenuItem label={t('game.abortGame')} onClick={handleAbort} />}
                  </>
                )}
                {isFinished && (
                  <>
                    {!isSpectator && <MenuItem label={t('result.rematch')} onClick={handleOfferRematch} />}
                    <MenuItem label={t('common.backToLobby')} onClick={() => navigate('/lobby')} />
                  </>
                )}
                <MenuItem label={t('common.copyGameId')} onClick={handleCopyId} />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="sidebar">
        <MoveHistory moves={moves} />
        {gameId && <Chat gameId={gameId} />}
      </div>
      {promotion && <PromotionDialog color={playerColor} onSelect={handlePromotionSelect} />}

      {profilePlayerId && <PlayerProfileDialog playerId={profilePlayerId} onClose={() => setProfilePlayerId(null)} />}
    </div>
  );
}

/* Small helper for menu dropdown items */
function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      className="btn btn-ghost btn-sm"
      style={{
        width: '100%',
        justifyContent: 'flex-start',
        padding: '8px 12px',
        fontSize: 13,
        borderRadius: 6,
        color: danger ? 'var(--danger)' : 'var(--text)',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
