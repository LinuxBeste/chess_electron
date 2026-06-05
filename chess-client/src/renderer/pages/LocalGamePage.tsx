import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Board from '../components/Board';
import MoveHistory from '../components/MoveHistory';
import PromotionDialog from '../components/PromotionDialog';
import { cloneBoard, createInitialBoard, squareToIndices, indicesToSquare } from '../chess';
import { getSetting } from '../settings';
import { playMoveSound, playCaptureSound, playCheckSound, playGameOverSound } from '../sound';
import type { Board as BoardType, PieceType, Move, LegalMoveHint } from '../../types';

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
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [boardHistory, setBoardHistory] = useState<{ board: BoardType; move: string }[]>([]);

  const boardRef = useRef(board);
  boardRef.current = board;
  const turnRef = useRef(turn);
  turnRef.current = turn;

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

  function getMovesForPiece(b: BoardType, r: number, f: number, piece: { type: PieceType; color: 'white' | 'black' }): [number, number][] {
    const targets: [number, number][] = [];
    const dirs: Record<string, [number, number][]> = {
      pawn: piece.color === 'white' ? [[-1, 0], [-2, 0], [-1, -1], [-1, 1]] : [[1, 0], [2, 0], [1, -1], [1, 1]],
      knight: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]],
      bishop: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
      rook: [[-1, 0], [1, 0], [0, -1], [0, 1]],
      queen: [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]],
      king: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
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

  function executeMove(from: string, to: string, promotionPiece?: PieceType) {
    const newBoard = cloneBoard(boardRef.current);
    const [fr, ff] = squareToIndices(from);
    const [tr, tf] = squareToIndices(to);
    const piece = newBoard[fr][ff];
    if (!piece) return;

    const wasCapture = newBoard[tr][tf] !== null;
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
    setWhiteTime((t) => t + 1);
    setMoves((prev) => [...prev, `${from}-${to}`]);
    setBoardHistory((prev) => [...prev, { board: cloneBoard(newBoard), move: `${from}-${to}` }]);

    if (isCheckmate(newBoard, nextTurn)) {
      setGameOver({ status: 'checkmate', winner: turnRef.current });
      if (getSetting('soundEnabled')) setTimeout(() => playGameOverSound(), 100);
      return;
    }
    if (isStalemate(newBoard, nextTurn)) {
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

  const handleDragStart = useCallback((from: string) => {
    if (gameOver) return;
    dragFrom.current = from;
    setSelectedSquare(from);
    const moves = getLegalMoves(boardRef.current, turnRef.current);
    setLegalHints(moves.filter((m) => m.from === from));
  }, [gameOver]);

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
    } else {
      setBoard(cloneBoard(boardHistory[newIndex].board));
      const prevBoard = newIndex > 0 ? boardHistory[newIndex - 1].board : null;
      if (prevBoard) {
        const prevMap = new Map<string, boolean>();
        for (let r = 0; r < 8; r++)
          for (let f = 0; f < 8; f++)
            if (prevBoard[r][f]) prevMap.set(indicesToSquare(r, f), true);
        const curMap = new Map<string, boolean>();
        const curBoard = boardHistory[newIndex].board;
        for (let r = 0; r < 8; r++)
          for (let f = 0; f < 8; f++)
            if (curBoard[r][f]) curMap.set(indicesToSquare(r, f), true);
        let from: string | null = null;
        let to: string | null = null;
        for (const sq of prevMap.keys()) if (!curMap.has(sq)) from = sq;
        for (const sq of curMap.keys()) if (!prevMap.has(sq)) to = sq;
        setLastMove(from && to ? { from, to } : null);
      } else {
        setLastMove(null);
      }
    }
  }

  function newGame() {
    setBoard(createInitialBoard());
    setTurn('white');
    setSelectedSquare(null);
    setLegalHints([]);
    setLastMove(null);
    setMoves([]);
    setPromotion(null);
    setGameOver(null);
    setWhiteTime(0);
    setBlackTime(0);
    setReviewIndex(null);
    setBoardHistory([]);
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return (
    <div className="game-layout">
      <div className="game-center">
        <div className="player-bar">
          <span className="player-name">
            {turn === 'black' && !gameOver ? '◄ ' : ''}Black
            {turn === 'black' && !gameOver ? ' to move' : ''}
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
                  ? `${gameOver.winner === 'white' ? 'White' : 'Black'} wins!`
                  : gameOver.status === 'stalemate'
                    ? 'Stalemate — Draw'
                    : 'Game Over'}
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)' }}>
                {gameOver.status === 'checkmate' ? 'Checkmate' : gameOver.status === 'stalemate' ? 'No legal moves' : ''}
              </div>
            </div>
          )}
        </Board>
        <div className="player-bar">
          <span className="player-name">
            White
            {turn === 'white' && !gameOver ? ' to move ◄' : ''}
          </span>
          <span className="player-clock">{formatTime(whiteTime)}</span>
        </div>
        <div className="game-btn-row">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/lobby')} style={{ minWidth: 80 }}>
            Leave
          </button>
          <button className="btn btn-primary btn-sm" onClick={newGame} style={{ minWidth: 80 }}>
            New Game
          </button>
          {gameOver && boardHistory.length > 0 && (
            <div className="review-controls active">
              <button className="btn btn-ghost btn-sm" onClick={() => reviewStep(-1)}>◀ Prev</button>
              <span className="review-label">
                {reviewIndex === -1 ? 'Start' : reviewIndex !== null ? `${reviewIndex + 1}/${boardHistory.length}` : 'End'}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => reviewStep(1)}>Next ▶</button>
            </div>
          )}
        </div>
      </div>
      <div className="sidebar">
        <h3 className="sidebar-title">Moves</h3>
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
            Local 1v1
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
            Pass the keyboard to your opponent after each move.
          </div>
        </div>
      </div>
      {promotion && <PromotionDialog color={turn} onSelect={handlePromotionSelect} />}
    </div>
  );
}
