/**
 * LocalGamePage — full pass-and-play chess on a single screen.
 *
 * Unlike the online game flow (where the server validates moves), this file
 * implements its own move generation, check/checkmate/stalemate detection,
 * and promotion handling — all client-side, no network required.
 *
 * The board history + review index allows players to step through
 * the game after it ends (similar to analysing a finished match).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import logger from '../logger';
import Board from '../components/Board';
import MoveHistory from '../components/MoveHistory';
import PromotionDialog from '../components/PromotionDialog';
import { cloneBoard, createInitialBoard, squareToIndices, indicesToSquare } from '../chess';
import { getSetting } from '../settings';
import { playMoveSound, playCaptureSound, playCheckSound, playGameOverSound } from '../sound';
import type { Board as BoardType, PieceType, Move, LegalMoveHint } from '../../types';
import { t } from '../translate';

export default function LocalGamePage() {
  const navigate = useNavigate();
  const [board, setBoard] = useState<BoardType>(createInitialBoard);
  const [turn, setTurn] = useState<'white' | 'black'>('white');
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalHints, setLegalHints] = useState<LegalMoveHint[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [moves, setMoves] = useState<string[]>([]);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const [gameOver, setGameOver] = useState<{ status: string; winner?: string } | null>(null);
  const initialMs = getSetting('timeControlMinutes') * 60 * 1000;
  const [whiteTime, setWhiteTime] = useState(initialMs);
  const [blackTime, setBlackTime] = useState(initialMs);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [boardHistory, setBoardHistory] = useState<{ board: BoardType; move: string }[]>([]);

  /* Refs that always reflect current state — used inside closures that would
      otherwise capture stale values from the render cycle */
  const boardRef = useRef(board);
  boardRef.current = board;
  const turnRef = useRef(turn);
  turnRef.current = turn;
  const gameOverRef = useRef(gameOver);
  gameOverRef.current = gameOver;

  useEffect(() => {
    logger.info('LocalGamePage mounted');
    return () => logger.info('LocalGamePage unmounting');
  }, []);

  /* Countdown timer: decrement the active player every 50ms and detect timeout */
  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      if (turnRef.current === 'white') {
        setWhiteTime((t) => {
          const next = t - 50;
          if (next <= 0) {
            logger.info('Timeout: black wins');
            setGameOver({ status: 'timeout', winner: 'black' });
            return 0;
          }
          return next;
        });
      } else {
        setBlackTime((t) => {
          const next = t - 50;
          if (next <= 0) {
            logger.info('Timeout: white wins');
            setGameOver({ status: 'timeout', winner: 'white' });
            return 0;
          }
          return next;
        });
      }
    }, 50);
    return () => clearInterval(interval);
  }, [gameOver]);

  /* Generate pseudo-legal moves — every possible destination for the given
     colour's pieces, ignoring whether the move leaves the king in check.
     Actual legality is filtered separately in getLegalMoves(). */
  function getPseudoLegalMoves(b: BoardType, color: 'white' | 'black'): Move[] {
    const result: Move[] = [];
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const piece = b[r][f];
        if (!piece || piece.color !== color) continue;
        const from = indicesToSquare(r, f);
        const targets = getMovesForPiece(b, r, f, piece);
        for (const [tr, tf] of targets) {
          const to = indicesToSquare(tr, tf);
          result.push({ from, to, piece, captured: b[tr][tf] || undefined });
        }
      }
    }
    return result;
  }

  /* Per-piece ray/path generator.  Sliding pieces (bishop/rook/queen) iterate
     until blocked; knights/king/pawns have fixed direction sets.  En passant
     and castling are NOT implemented here — the local game is basic 1v1. */
  function getMovesForPiece(
    b: BoardType,
    r: number,
    f: number,
    piece: { type: PieceType; color: 'white' | 'black' },
  ): [number, number][] {
    const targets: [number, number][] = [];
    const dirs: Record<string, [number, number][]> = {
      pawn:
        piece.color === 'white'
          ? [
              [-1, 0],
              [-2, 0],
              [-1, -1],
              [-1, 1],
            ]
          : [
              [1, 0],
              [2, 0],
              [1, -1],
              [1, 1],
            ],
      knight: [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ],
      bishop: [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ],
      rook: [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ],
      queen: [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ],
      king: [
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
      ],
    };
    const pieceDirs = dirs[piece.type] || [];
    const isSliding = piece.type !== 'knight' && piece.type !== 'king' && piece.type !== 'pawn';

    for (let di = 0; di < pieceDirs.length; di++) {
      const ddr = pieceDirs[di][0];
      const ddf = pieceDirs[di][1];

      if (piece.type === 'pawn') {
        if (ddf === 0) {
          const nr = r + ddr;
          if (nr < 0 || nr > 7) continue;
          if (b[nr][f]) continue;
          targets.push([nr, f]);
          if ((piece.color === 'white' && r === 6) || (piece.color === 'black' && r === 1)) {
            const nr2 = r + ddr * 2;
            if (!b[nr2]?.[f]) targets.push([nr2, f]);
          }
        } else {
          const nr = r + ddr;
          const nf = f + ddf;
          if (nr < 0 || nr > 7 || nf < 0 || nf > 7) continue;
          const target = b[nr][nf];
          if (target && target.color !== piece.color) targets.push([nr, nf]);
        }
        continue;
      }

      if (!isSliding) {
        const nr = r + ddr;
        const nf = f + ddf;
        if (nr < 0 || nr > 7 || nf < 0 || nf > 7) continue;
        const target = b[nr][nf];
        if (target && target.color === piece.color) continue;
        targets.push([nr, nf]);
      } else {
        for (let i = 1; i < 8; i++) {
          const nr = r + ddr * i;
          const nf = f + ddf * i;
          if (nr < 0 || nr > 7 || nf < 0 || nf > 7) break;
          const target = b[nr][nf];
          if (target && target.color === piece.color) break;
          targets.push([nr, nf]);
          if (target) break;
        }
      }
    }
    return targets;
  }

  /* Check if the given colour's king is under attack by any enemy piece */
  function isInCheck(b: BoardType, color: 'white' | 'black'): boolean {
    const kingPos = findKingPos(b, color);
    if (!kingPos) return false;
    const [kr, kf] = kingPos;
    const enemy = color === 'white' ? 'black' : 'white';
    const enemyMoves = getPseudoLegalMoves(b, enemy);
    return enemyMoves.some((m) => m.to === indicesToSquare(kr, kf));
  }

  function findKingPos(b: BoardType, color: 'white' | 'black'): [number, number] | null {
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = b[r][f];
        if (p && p.type === 'king' && p.color === color) return [r, f];
      }
    }
    return null;
  }

  /* Filter pseudo-legal moves: simulate each on a clone, keep only those
     that don't leave the moving side's king in check. */
  function getLegalMoves(b: BoardType, color: 'white' | 'black'): Move[] {
    const pseudo = getPseudoLegalMoves(b, color);
    return pseudo.filter((m) => {
      const testBoard = cloneBoard(b);
      const [fr, ff] = squareToIndices(m.from);
      const [tr, tf] = squareToIndices(m.to);
      testBoard[tr][tf] = testBoard[fr][ff];
      testBoard[fr][ff] = null;
      return !isInCheck(testBoard, color);
    });
  }

  /* Terminal conditions: in check + no legal moves → checkmate;
     not in check + no legal moves → stalemate (draw). */
  function isCheckmate(b: BoardType, color: 'white' | 'black'): boolean {
    return isInCheck(b, color) && getLegalMoves(b, color).length === 0;
  }

  function isStalemate(b: BoardType, color: 'white' | 'black'): boolean {
    return !isInCheck(b, color) && getLegalMoves(b, color).length === 0;
  }

  function checkPromotion(from: string, to: string): boolean {
    const [fr, ff] = squareToIndices(from);
    const [tr] = squareToIndices(to);
    const piece = boardRef.current[fr]?.[ff];
    return !!piece && piece.type === 'pawn' && (tr === 0 || tr === 7);
  }

  /* Commit a move to the board: clone, apply, check for terminal states,
      then switch turn.  Sound effects are delayed by 100 ms so the board
      re-renders first (avoiding audio clipping). */
  function executeMove(from: string, to: string, promotionPiece?: PieceType) {
    const newBoard = cloneBoard(boardRef.current);
    const [fr, ff] = squareToIndices(from);
    const [tr, tf] = squareToIndices(to);
    const piece = newBoard[fr][ff];
    if (!piece) return;

    const wasCapture = newBoard[tr][tf] !== null;
    logger.info('Local move', { from, to, promotion: promotionPiece, capture: wasCapture });
    newBoard[tr][tf] = promotionPiece ? { type: promotionPiece, color: piece.color } : piece;
    newBoard[fr][ff] = null;

    setBoard(newBoard);
    setLastMove({ from, to });
    setSelectedSquare(null);
    setLegalHints([]);

    if (getSetting('soundEnabled')) {
      if (wasCapture) playCaptureSound();
      else playMoveSound();
    }

    const nextTurn = turnRef.current === 'white' ? 'black' : 'white';
    /* Apply increment to the player who just moved */
    const incMs = getSetting('timeControlIncrement') * 1000;
    if (turnRef.current === 'white') setWhiteTime((t) => t + incMs);
    else setBlackTime((t) => t + incMs);
    setMoves((prev) => [...prev, `${from}-${to}`]);
    setBoardHistory((prev) => [...prev, { board: cloneBoard(newBoard), move: `${from}-${to}` }]);

    if (isCheckmate(newBoard, nextTurn)) {
      logger.info('Game over: checkmate', { winner: turnRef.current });
      setGameOver({ status: 'checkmate', winner: turnRef.current });
      if (getSetting('soundEnabled')) setTimeout(() => playGameOverSound(), 100);
      return;
    }
    if (isStalemate(newBoard, nextTurn)) {
      logger.info('Game over: stalemate');
      setGameOver({ status: 'stalemate' });
      if (getSetting('soundEnabled')) setTimeout(() => playGameOverSound(), 100);
      return;
    }
    if (isInCheck(newBoard, nextTurn)) {
      if (getSetting('soundEnabled')) setTimeout(() => playCheckSound(), 100);
    }

    setTurn(nextTurn);
    setPromotion(null);
  }

  const handleSquareClick = useCallback(
    (square: string) => {
      if (gameOver) return;
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

      if (clickedPiece && clickedPiece.color === turnRef.current) {
        setSelectedSquare(square);
        const moves = getLegalMoves(boardRef.current, turnRef.current);
        setLegalHints(moves.filter((m) => m.from === square));
        return;
      }

      setSelectedSquare(null);
      setLegalHints([]);
    },
    [selectedSquare, legalHints, gameOver],
  );

  const dragFrom = useRef<string | null>(null);

  const handleDragStart = useCallback(
    (from: string) => {
      if (gameOver) return;
      dragFrom.current = from;
      setSelectedSquare(from);
      const moves = getLegalMoves(boardRef.current, turnRef.current);
      setLegalHints(moves.filter((m) => m.from === from));
    },
    [gameOver],
  );

  const handleDragEnd = useCallback(
    (to: string) => {
      const from = dragFrom.current;
      dragFrom.current = null;
      if (!from || gameOver) {
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
    [legalHints, gameOver],
  );

  function handlePromotionSelect(pt: PieceType) {
    if (promotion) {
      executeMove(promotion.from, promotion.to, pt);
      setPromotion(null);
    }
  }

  function reviewStep(direction: number) {
    if (reviewIndex === null || boardHistory.length === 0) return;
    const newIndex = reviewIndex + direction;
    if (newIndex < -1 || newIndex >= boardHistory.length) return;
    setReviewIndex(newIndex);
    if (newIndex === -1) {
      setBoard(createInitialBoard());
      setLastMove(null);
      setMoves([]);
    } else {
      setBoard(cloneBoard(boardHistory[newIndex].board));
      const parts = boardHistory[newIndex].move.split('-');
      setLastMove(parts.length === 2 ? { from: parts[0], to: parts[1] } : null);
      setMoves(boardHistory.slice(0, newIndex + 1).map((e) => e.move));
    }
  }

  function newGame() {
    logger.info('Starting new local game');
    setBoard(createInitialBoard());
    setTurn('white');
    setSelectedSquare(null);
    setLegalHints([]);
    setLastMove(null);
    setMoves([]);
    setPromotion(null);
    setGameOver(null);
    const resetMs = getSetting('timeControlMinutes') * 60 * 1000;
    setWhiteTime(resetMs);
    setBlackTime(resetMs);
    setReviewIndex(null);
    setBoardHistory([]);
  }

  function formatTime(ms: number): string {
    const totalSec = Math.max(0, ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    const decimals = getSetting('clockDecimalPlaces');
    const dec = decimals > 0 ? '.' + String(Math.floor((totalSec % 1) * 10 ** decimals)).padStart(decimals, '0') : '';
    return `${m}:${String(s).padStart(2, '0')}${dec}`;
  }

  return (
    <div className="game-layout">
      <div className="game-center">
        <div className="player-bar">
          <span className="player-name">
            {turn === 'black' && !gameOver ? t('localGame.blackToMove') : t('common.black')}
          </span>
          <span className="player-clock">{formatTime(blackTime)}</span>
        </div>
        <Board
          board={board}
          playerColor={turn}
          selectedSquare={selectedSquare}
          legalHints={legalHints}
          lastMove={lastMove}
          isActive={!gameOver && !promotion}
          onSquareClick={handleSquareClick}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {gameOver && (
            <div className="waiting-overlay">
              <div className="waiting-text" style={{ fontSize: 22 }}>
                {gameOver.status === 'checkmate'
                  ? t('localGame.wins', { color: gameOver.winner === 'white' ? t('common.white') : t('common.black') })
                  : gameOver.status === 'stalemate'
                    ? t('localGame.stalemate')
                    : gameOver.status === 'timeout'
                      ? t('localGame.ranOutOfTime', {
                          color: gameOver.winner === 'white' ? t('common.black') : t('common.white'),
                        })
                      : t('localGame.gameOver')}
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)' }}>
                {gameOver.status === 'checkmate'
                  ? t('localGame.checkmate')
                  : gameOver.status === 'stalemate'
                    ? t('localGame.noLegalMoves')
                    : gameOver.status === 'timeout'
                      ? t('localGame.timeout')
                      : ''}
              </div>
            </div>
          )}
        </Board>
        <div className="player-bar">
          <span className="player-name">
            {turn === 'white' && !gameOver ? t('localGame.whiteToMove') : t('common.white')}
          </span>
          <span className="player-clock">{formatTime(whiteTime)}</span>
        </div>
        <div className="game-btn-row">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/lobby')} style={{ minWidth: 80 }}>
            {t('localGame.leave')}
          </button>
          <button className="btn btn-primary btn-sm" onClick={newGame} style={{ minWidth: 80 }}>
            {t('localGame.newGame')}
          </button>
          {gameOver && boardHistory.length > 0 && (
            <div className="review-controls active">
              <button className="btn btn-ghost btn-sm" onClick={() => reviewStep(-1)}>
                {t('common.prev')}
              </button>
              <span className="review-label">
                {reviewIndex === -1
                  ? t('common.start')
                  : reviewIndex !== null
                    ? `${reviewIndex + 1}/${boardHistory.length}`
                    : t('common.end')}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => reviewStep(1)}>
                {t('common.next')}
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="sidebar">
        <h3 className="sidebar-title">{t('localGame.moves')}</h3>
        <MoveHistory moves={moves} />
        <div style={{ marginTop: 12, padding: '0 16px' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--muted)',
              marginBottom: 8,
            }}
          >
            {t('localGame.local1v1')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{t('localGame.instruction')}</div>
        </div>
      </div>
      {promotion && <PromotionDialog color={turn} onSelect={handlePromotionSelect} />}
    </div>
  );
}
