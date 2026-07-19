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
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import Board from '../components/Board';
import MoveHistory from '../components/MoveHistory';
import Chat from '../components/Chat';
import PromotionDialog from '../components/PromotionDialog';
import PlayerProfileDialog from '../components/PlayerProfileDialog';
import { deserializeBoard, cloneBoard, createInitialBoard, squareToIndices, boardToFen } from '../chess';
import { getSetting } from '../settings';
import { playMoveSound, playCaptureSound, playCheckSound, playGameOverSound } from '../sound';
import type { Board as BoardType, GameState, PieceType, LegalMoveHint, GameStatus } from '../../types';
import type { MoveQuality } from '../components/MoveQualityIndicator';
import type {
  MoveMessage,
  GameOverMessage,
  GameStartedMessage,
  GameAbortedMessage,
  DrawOfferedMessage,
  DrawDeclinedMessage,
  TakebackOfferedMessage,
  TakebackDeclinedMessage,
  RematchOfferMessage,
  RematchAcceptedMessage,
  OpponentDisconnectedMessage,
  OpponentReconnectedMessage,
} from '../socket';
import { t } from '../translate';
import { copyToClipboard } from '../clipboard';
import { SkeletonBoard } from '../components/Skeleton';

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [premove, setPremove] = useState<{ from: string; to: string } | null>(null);
  const [pendingMove, setPendingMove] = useState<{ from: string; to: string; promotion?: PieceType } | null>(null);
  const [resignConfirmed, setResignConfirmed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [timeout, setTimeout_] = useState<'white' | 'black' | null>(null);
  const [drawOfferedBy, setDrawOfferedBy] = useState<string | null>(null);
  const [drawPending, setDrawPending] = useState(false);
  const [takebackOfferedBy, setTakebackOfferedBy] = useState<string | null>(null);
  const [takebackPending, setTakebackPending] = useState(false);
  const [rematchOfferedBy, setRematchOfferedBy] = useState<string | null>(null);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [opponentConnected, setOpponentConnected] = useState(true);
  const [moveQualities, setMoveQualities] = useState<Record<string, MoveQuality>>({});
  const [evalScore, setEvalScore] = useState<number | null>(null);
  const [boardFlipped, setBoardFlipped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  /* Spectator mode: read-only, set via ?spectate=1 query param from LobbyPage */
  const isSpectator = searchParams.get('spectate') === '1';
  /* Refs to avoid stale closures — WS handlers registered once use these instead of render-cycle values */
  const boardRef = useRef(board);
  boardRef.current = board;
  const gameRef = useRef(game);
  gameRef.current = game;
  const timeoutRef = useRef(timeout);
  timeoutRef.current = timeout;
  const playerColorRef = useRef(playerColor);
  playerColorRef.current = playerColor;
  const moveInProgressRef = useRef(false);
  const mountedRef = useRef(true);
  const unsubSpectatorRef = useRef<(() => void) | null>(null);
  const whiteTimeRef = useRef(whiteTime);
  whiteTimeRef.current = whiteTime;
  const blackTimeRef = useRef(blackTime);
  blackTimeRef.current = blackTime;
  const premoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Chess clock: decrement active player every 50ms; stops on timeout or game end */
  useEffect(() => {
    if (!game || game.status !== 'active' || timeout) return;
    const interval = setInterval(() => {
      if (!mountedRef.current) return;
      if (gameRef.current && gameRef.current.turn === 'white') {
        setWhiteTime((t) => {
          if (t <= 50) return 0;
          return t - 50;
        });
        /* Use a ref to detect timeout reliably after state update */
        const wt = whiteTimeRef.current;
        if (wt !== undefined && wt <= 50) {
          setTimeout_('black');
        }
      } else {
        setBlackTime((t) => {
          if (t <= 50) return 0;
          return t - 50;
        });
        const bt = blackTimeRef.current;
        if (bt !== undefined && bt <= 50) {
          setTimeout_('white');
        }
      }
    }, 50);
    return () => clearInterval(interval);
  }, [game, timeout]);

  /* Handle timeout: resign if the local player timed out, navigate to result */
  useEffect(() => {
    if (!timeout || !gameId) return;
    const myId = store.get('playerId');
    if (!myId) return;
    const winner = timeout;
    const loser = winner === 'white' ? 'black' : 'white';
    const iTimedOut = playerColorRef.current === loser;
    if (iTimedOut) {
      api
        .resignGame(gameId)
        .then((updated) => {
          store.set('currentGame', updated);
          navigate(`/result/${updated.id}`);
        })
        .catch((err: unknown) => {
          logger.error('Auto-resign after timeout failed', { error: err });
        });
    } else {
      const g = gameRef.current;
      if (g) {
        const updated = { ...g, status: 'resigned' as GameStatus, winner };
        store.set('currentGame', updated);
        setTimeout(() => navigate(`/result/${gameId}`), 500);
      }
    }
  }, [timeout]);

  /* Composite condition: must be player's turn, game active, not spectating, no timeout */
  const isActive = !!game && game.turn === playerColor && game.status === 'active' && !isSpectator && !timeout;

  useEffect(() => {
    if (!gameId) {
      logger.warn('GamePage mounted without gameId, redirecting to lobby');
      navigate('/lobby');
      return;
    }
    logger.info('GamePage mounted', { gameId, isSpectator });
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
    const unsubTakebackOffered = socketManager.onTakebackOffered((msg: TakebackOfferedMessage) => {
      if (msg.gameId === gameId) {
        if (msg.byPlayerId === store.get('playerId')) {
          setTakebackPending(true);
        } else {
          setTakebackOfferedBy(msg.byPlayerId);
        }
      }
    });
    const unsubTakebackDeclined = socketManager.onTakebackDeclined((msg: TakebackDeclinedMessage) => {
      if (msg.gameId === gameId) setTakebackPending(false);
    });
    const unsubTakebackAccepted = socketManager.onTakebackAccepted((msg) => {
      if (msg.gameId === gameId) {
        setTakebackPending(false);
        setTakebackOfferedBy(null);
        fetchGame(gameId);
      }
    });
    const unsubRematchOffer = socketManager.onRematchOffer((msg) => {
      if (msg.gameId === gameId) handleRematchOffer(msg);
    });
    const unsubRematchAccepted = socketManager.onRematchAccepted((msg) => {
      if (msg.gameId === gameId) handleRematchAccepted(msg);
    });
    const unsubSpectatorCount = socketManager.onSpectatorCount((msg) => {
      if (msg.gameId === gameId) setSpectatorCount(msg.count);
    });
    const unsubOpponentDisconnected = socketManager.onOpponentDisconnected((msg: OpponentDisconnectedMessage) => {
      if (msg.gameId === gameId) setOpponentConnected(false);
    });
    const unsubOpponentReconnected = socketManager.onOpponentReconnected((msg: OpponentReconnectedMessage) => {
      if (msg.gameId === gameId) setOpponentConnected(true);
    });

    if (initialGame) {
      logger.info('Using cached game state', { gameId });
      initGame(initialGame);
    } else {
      fetchGame(gameId);
    }

    if (isSpectator) {
      mountedRef.current = true;
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
        unsubSpectatorRef.current = unsub;
      }
    }

    return () => {
      mountedRef.current = false;
      if (unsubSpectatorRef.current) {
        unsubSpectatorRef.current();
        unsubSpectatorRef.current = null;
      }
      moveQualityAbortRef.current?.abort();
      logger.info('GamePage unmounting, cleaning up WS handlers', { gameId });
      unsubMove();
      unsubGameOver();
      unsubGameStarted();
      unsubGameAborted();
      unsubDrawOffered();
      unsubDrawDeclined();
      unsubTakebackOffered();
      unsubTakebackDeclined();
      unsubTakebackAccepted();
      unsubRematchOffer();
      unsubRematchAccepted();
      unsubSpectatorCount();
      unsubOpponentDisconnected();
      unsubOpponentReconnected();
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

  /* Sync reviewIndex to ?move= URL param */
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (reviewIndex !== null && game && reviewIndex >= -1 && reviewIndex < game.boardHistory.length) {
          next.set('move', String(reviewIndex));
        } else {
          next.delete('move');
        }
        return next;
      },
      { replace: true },
    );
  }, [reviewIndex]);

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

  /* Keyboard shortcut listeners for board flip and move review */
  useEffect(() => {
    function handleFlipBoard() {
      setBoardFlipped((p) => !p);
    }
    function handlePrevMove() {
      reviewStep(-1);
    }
    function handleNextMove() {
      reviewStep(1);
    }
    function handleStartReview() {
      setReviewIndex((prev) => {
        if (prev === null || !gameRef.current) return prev;
        return prev !== -1 ? -1 : prev;
      });
    }
    function handleEndReview() {
      setReviewIndex((prev) => {
        if (prev === null || !gameRef.current) return prev;
        const last = gameRef.current.boardHistory.length - 1;
        return prev !== last ? last : prev;
      });
    }
    window.addEventListener('shortcut:flipBoard', handleFlipBoard);
    window.addEventListener('shortcut:prevMove', handlePrevMove);
    window.addEventListener('shortcut:nextMove', handleNextMove);
    window.addEventListener('shortcut:startReview', handleStartReview);
    window.addEventListener('shortcut:endReview', handleEndReview);
    return () => {
      window.removeEventListener('shortcut:flipBoard', handleFlipBoard);
      window.removeEventListener('shortcut:prevMove', handlePrevMove);
      window.removeEventListener('shortcut:nextMove', handleNextMove);
      window.removeEventListener('shortcut:startReview', handleStartReview);
      window.removeEventListener('shortcut:endReview', handleEndReview);
    };
  }, []);

  /* REST polling fallback: if WS game_started is missed (reconnect race), poll every 2s */
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
    const moveParam = searchParams.get('move');
    if (moveParam !== null && g.boardHistory.length > 0) {
      const idx = parseInt(moveParam, 10);
      if (!isNaN(idx) && idx >= -1 && idx < g.boardHistory.length) {
        setReviewIndex(idx);
        if (idx === -1) {
          setBoard(createInitialBoard());
          setLastMove(null);
          setMoves([]);
        } else {
          const snapshot = g.boardHistory[idx];
          setBoard(deserializeBoard(snapshot.board));
          setLastMove(extractLastMoveFromHistory(g.moveHistory, idx));
          setMoves(g.moveHistory.slice(0, idx + 1));
        }
      } else {
        setReviewIndex(null);
      }
    } else {
      setReviewIndex(null);
    }
    setDrawOfferedBy(null);
    setDrawPending(false);
    setRematchOfferedBy(null);
    const ms = getSetting('timeControlMinutes') * 60 * 1000;
    setWhiteTime(ms);
    setBlackTime(ms);
    setEvalScore(null);
  }

  async function fetchGame(gid: string) {
    logger.info('Fetching game', { gameId: gid });
    try {
      const g = await api.getGame(gid);
      store.set('currentGame', g);
      initGame(g);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.info('Game not found via /games/, trying archive fallback', { gameId: gid });
      try {
        const g = (await api.getArchivedGame(gid)) as unknown as GameState;
        store.set('currentGame', g);
        initGame(g);
      } catch (err2: unknown) {
        const msg2 = err2 instanceof Error ? err2.message : String(err2);
        logger.error('Failed to fetch game (both live and archive)', { gameId: gid, error: msg2 });
        store.toast(msg || t('game.failedLoad'));
        navigate('/lobby');
      }
    }
  }

  // Server-broadcast move: update board, clock increment, play sound for opponent's move
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
    setTakebackOfferedBy(null);
    setTakebackPending(false);
    const incMs = getSetting('timeControlIncrement') * 1000;
    if (msg.turn === 'black') setWhiteTime((t) => t + incMs);
    else setBlackTime((t) => t + incMs);

    if (getSetting('soundEnabled') && playerColorRef.current !== msg.turn) {
      if (wasCapture) playCaptureSound();
      else playMoveSound();
      if (msg.status === 'check') setTimeout(() => playCheckSound(), 100);
    }
    const opponentMoveStr = `${msg.lastMove.from}-${msg.lastMove.to}`;
    const fen = boardToFen(boardRef.current);
    evaluateMoveQuality(opponentMoveStr, fen);

    /* Execute queued premove when it becomes this player's turn */
    if (premoveTimerRef.current) clearTimeout(premoveTimerRef.current);
    setPremove((prev) => {
      if (!prev || msg.turn !== playerColorRef.current) return null;
      return prev;
    });
    /* Process premove outside state updater (next tick so React has processed the board update) */
    premoveTimerRef.current = setTimeout(() => {
      const g = gameRef.current;
      const p = premove;
      if (g && g.status === 'active' && g.turn === playerColorRef.current && p) {
        executeMove(p.from, p.to, checkPromotion(p.from, p.to) ? 'queen' : undefined);
      }
      setPremove(null);
    }, 0);
  }

  function handleWsGameOver(msg: GameOverMessage) {
    if (!gameRef.current) return;
    setPremove(null);
    logger.info('WS game_over received', { gameId: msg.gameId, status: msg.status, winner: msg.winner });
    setBoard(deserializeBoard(msg.board));
    setLastMove(msg.lastMove);
    const updated = {
      ...gameRef.current,
      status: msg.status as GameStatus,
      winner: msg.winner || null,
      reason: msg.reason,
    };
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

  function handleOfferTakeback() {
    if (!gameId) return;
    logger.info('Offering takeback', { gameId });
    setMenuOpen(false);
    socketManager.send({ type: 'offer_takeback', gameId });
  }

  function handleAcceptTakeback() {
    if (!gameId) return;
    logger.info('Accepting takeback', { gameId });
    setTakebackOfferedBy(null);
    socketManager.send({ type: 'accept_takeback', gameId });
  }

  function handleDeclineTakeback() {
    if (!gameId) return;
    logger.info('Declining takeback', { gameId });
    setTakebackOfferedBy(null);
    socketManager.send({ type: 'decline_takeback', gameId });
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
      if (!gameRef.current || gameRef.current.status !== 'active') return;
      const [r, f] = squareToIndices(square);
      const clickedPiece = boardRef.current[r]?.[f];

      /* Premove: when it's not the player's turn, queue a move */
      if (gameRef.current.turn !== playerColor) {
        if (getSetting('premove') && clickedPiece && clickedPiece.color === playerColor) {
          setSelectedSquare(square);
          setPremove(null);
          return;
        }
        if (getSetting('premove') && selectedSquare && clickedPiece?.color !== playerColor) {
          setPremove({ from: selectedSquare, to: square });
          setSelectedSquare(null);
          return;
        }
        return;
      }

      if (square === selectedSquare) {
        setSelectedSquare(null);
        setLegalHints([]);
        return;
      }
      if (selectedSquare && legalHints.some((h) => h.from === selectedSquare && h.to === square)) {
        setPremove(null);
        if (checkPromotion(selectedSquare, square) && !getSetting('autoPromoteQueen')) {
          setPromotion({ from: selectedSquare, to: square });
        } else if (getSetting('confirmMove')) {
          setPendingMove({
            from: selectedSquare,
            to: square,
            promotion: checkPromotion(selectedSquare, square) ? 'queen' : undefined,
          });
        } else {
          executeMove(selectedSquare, square, checkPromotion(selectedSquare, square) ? 'queen' : undefined);
        }
        return;
      }
      if (clickedPiece && clickedPiece.color === playerColor) {
        setSelectedSquare(square);
        setPremove(null);
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
        } else if (getSetting('confirmMove')) {
          setPendingMove({ from, to, promotion: checkPromotion(from, to) ? 'queen' : undefined });
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

  // Optimistic update: apply move locally first, then confirm with server; rollback on error
  async function executeMove(from: string, to: string, promotion?: PieceType) {
    if (!gameRef.current) return;
    if (moveInProgressRef.current) return;
    moveInProgressRef.current = true;
    logger.info('Executing move', { gameId: gameRef.current.id, from, to, promotion });
    setSelectedSquare(null);
    setLegalHints([]);
    const oldBoard = cloneBoard(boardRef.current); // save for rollback on failure
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
      const lastMoveStr = updated.moveHistory[updated.moveHistory.length - 1];
      if (lastMoveStr) {
        const fen = boardToFen(oldBoard);
        evaluateMoveQuality(lastMoveStr, fen);
      }
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Move failed', { gameId: gameRef.current?.id, from, to, error: msg });
      setBoard(oldBoard);
      setLastMove(gameRef.current?.lastMove || null);
      store.toast(msg || t('game.moveFailed'));
    } finally {
      moveInProgressRef.current = false;
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
      copyToClipboard(id);
    }
    setMenuOpen(false);
  }

  async function handleAbort() {
    logger.info('Aborting game', { gameId });
    try {
      if (gameId) await api.abortGame(gameId);
    } catch (err) {
      logger.error('Failed to abort game', { gameId, error: err });
    }
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
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Resignation failed', { error: msg });
        store.toast(msg || t('game.failedResign'));
      })
      .finally(() => setResignConfirmed(false));
  }

  // Step through board history snapshots after game ends (-1 = initial position)
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

  const moveQualityAbortRef = useRef<AbortController | null>(null);

  function evaluateMoveQuality(moveStr: string, fen: string) {
    moveQualityAbortRef.current?.abort();
    const controller = new AbortController();
    moveQualityAbortRef.current = controller;
    const baseUrl = localStorage.getItem('chess_server_url') || 'http://localhost:3000';
    const moveNoDash = moveStr.replace('-', '');
    fetch(`${baseUrl}/analysis/move-quality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen, move: moveNoDash }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (mountedRef.current) {
          if (data.quality) {
            setMoveQualities((prev) => ({ ...prev, [moveStr]: data.quality }));
          }
          if (data.score !== undefined) {
            setEvalScore(data.score);
          }
        }
      })
      .catch(() => {});
  }

  const isFinished = (game && ['checkmate', 'stalemate', 'resigned', 'draw'].includes(game.status)) || !!timeout;
  const showReview = isFinished && !window.location.hash.startsWith('#result/');

  if (!game) {
    return (
      <div className="game-layout">
        <div className="game-center">
          <SkeletonBoard />
        </div>
      </div>
    );
  }

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
          premove={premove}
          alwaysBottom={boardFlipped ? !getSetting('alwaysWhiteBottom') : undefined}
        >
          {waiting && game && (
            <div className="waiting-overlay">
              <div className="waiting-text">{t('game.waiting')}</div>
              <div className="waiting-id-row">
                <span className="waiting-id-label">{t('game.gameId')}</span>
                <span className="waiting-id-value">{game.id}</span>
                <button className="btn btn-secondary btn-xs" onClick={() => copyToClipboard(game.id)}>
                  {t('common.copy')}
                </button>
              </div>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 6 }}>
                <span className={`badge ${game.rated ? 'badge-rated' : 'badge-casual'}`}>
                  {game.rated ? 'Rated' : 'Casual'}
                </span>
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
          {takebackOfferedBy && !isFinished && (
            <div className="waiting-overlay" style={{ background: 'rgba(0,0,0,0.75)' }}>
              <div className="waiting-text" style={{ fontSize: 16, marginBottom: 16 }}>
                {t('game.opponentTakeback')}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-primary btn-sm" onClick={handleAcceptTakeback}>
                  {t('game.accept')}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleDeclineTakeback}>
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
          {!opponentConnected && !isFinished && (
            <div className="waiting-overlay" style={{ background: 'rgba(0,0,0,0.75)' }}>
              <div className="waiting-text" style={{ fontSize: 14 }}>
                {t('game.opponentDisconnected')}
              </div>
            </div>
          )}
          {pendingMove && (
            <div className="waiting-overlay" style={{ background: 'rgba(0,0,0,0.75)' }}>
              <div className="waiting-text" style={{ fontSize: 16, marginBottom: 16 }}>
                {t('game.confirmMoveTitle')}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const m = pendingMove;
                    setPendingMove(null);
                    executeMove(m.from, m.to, m.promotion);
                  }}
                >
                  {t('game.accept')}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setPendingMove(null)}>
                  {t('game.decline')}
                </button>
              </div>
            </div>
          )}
        </Board>
        {getSetting('showEvalBar') && evalScore !== null && (
          <div style={{ width: '100%', maxWidth: 800, marginTop: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                color: 'var(--muted)',
              }}
            >
              <span style={{ fontWeight: 700, minWidth: 40, textAlign: 'right' }}>
                {evalScore > 0 ? '+' : ''}
                {evalScore.toFixed(1)}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  background: '#333',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: '50%',
                    right: '50%',
                    background: '#888',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    transition: 'all 0.3s ease',
                    width: `${Math.max(0, Math.min(100, 50 + evalScore * 5))}%`,
                    right: `${Math.max(0, Math.min(100, 50 - evalScore * 5))}%`,
                    background: evalScore > 0 ? 'var(--primary)' : '#000',
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          </div>
        )}
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
          {spectatorCount > 0 && (
            <span style={{ fontSize: 12, color: 'var(--muted)', marginRight: 8 }}>
              {t('game.spectators')}: {spectatorCount}
            </span>
          )}
          {showReview && (
            <div className="review-controls active">
              <button className="btn btn-ghost btn-sm" onClick={() => reviewStep(-1)}>
                <ChevronLeft size={14} /> {t('common.prev')}
              </button>
              <span className="review-label">
                {reviewIndex === -1
                  ? t('common.start')
                  : reviewIndex !== null && game
                    ? `${reviewIndex + 1}/${game.boardHistory.length}`
                    : t('common.end')}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => reviewStep(1)}>
                {t('common.next')} <ChevronRight size={14} />
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
                  maxHeight: 'calc(100vh - 120px)',
                  overflowY: 'auto',
                  padding: 4,
                  zIndex: 3000,
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
                    {!isSpectator && game?.status === 'active' && (
                      <MenuItem
                        label={takebackPending ? t('game.takebackRequested') : t('game.requestTakeback')}
                        onClick={handleOfferTakeback}
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
          <button
            className="btn btn-ghost btn-sm"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            style={{ padding: 6 }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>
      <div className="sidebar">
        <MoveHistory moves={moves} moveQualities={moveQualities} />
        {gameId && <Chat gameId={gameId} />}
      </div>
      {promotion && <PromotionDialog color={playerColor} onSelect={handlePromotionSelect} />}

      {profilePlayerId && <PlayerProfileDialog playerId={profilePlayerId} onClose={() => setProfilePlayerId(null)} />}
    </div>
  );
}

/* Inline menu item component — avoids pulling in a dropdown library */
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
