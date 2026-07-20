/**
 * Board — renders an 8×8 grid of Square components with drag-and-drop,
 * highlight overlays, and responsive sizing via ResizeObserver.
 *
 * Coordinate mapping: visual rows/cols (displayRank/displayFile) are flipped
 * when the board is rotated (black's perspective), but the underlying
 * logical board array (rank/file) stays fixed.
 */

import { useRef, useCallback, useState, useEffect, memo } from 'react';
import Square from './Square';
import { squareToIndices, indicesToSquare } from '../chess';
import { getSetting } from '../settings';
import type { Board as BoardType, LegalMoveHint } from '../../types';
import logger from '../logger';

interface BoardProps {
  board: BoardType;
  playerColor: 'white' | 'black';
  selectedSquare: string | null;
  legalHints: LegalMoveHint[];
  lastMove: { from: string; to: string } | null;
  isActive: boolean;
  onSquareClick: (square: string) => void;
  onDragStart: (from: string) => void;
  onDragEnd: (to: string) => void;
  children?: React.ReactNode;
  alwaysBottom?: boolean;
  premove?: { from: string; to: string } | null;
  bestMoveHint?: { from: string; to: string } | null;
}

const Board = memo(function Board({
  board,
  playerColor,
  selectedSquare,
  legalHints,
  lastMove,
  isActive,
  onSquareClick,
  onDragStart,
  onDragEnd,
  children,
  alwaysBottom: alwaysBottomProp,
  premove,
  bestMoveHint,
}: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(480);
  const [hoverSquare, setHoverSquare] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<string | null>(null);

  /* ResizeObserver tracks board width for exact square sizing — more reliable than window resize events. */
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setBoardSize(entry.contentRect.width);
        boardRectRef.current = el.getBoundingClientRect();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Cancel drag on window blur/resize to prevent stale drag state. */
  const dragFromRef = useRef<string | null>(null);
  dragFromRef.current = dragFrom;
  useEffect(() => {
    const cancelDrag = () => {
      if (dragFromRef.current) {
        setDragFrom(null);
        setHoverSquare(null);
      }
    };
    window.addEventListener('blur', cancelDrag);
    window.addEventListener('resize', cancelDrag);
    return () => {
      window.removeEventListener('blur', cancelDrag);
      window.removeEventListener('resize', cancelDrag);
    };
  }, []);

  /* Log legal hints count when they change */
  useEffect(() => {
    if (legalHints.length > 0) {
      logger.debug('Legal moves calculated', {
        count: legalHints.length,
        color: playerColor,
        selectedSquare,
      });
    }
  }, [legalHints.length, playerColor, selectedSquare]);

  const sqSize = boardSize / 8;
  const boardRectRef = useRef<DOMRect | null>(null);
  const alwaysBottom = alwaysBottomProp ?? getSetting('alwaysWhiteBottom');
  const showCoordinates = getSetting('showCoordinates');
  const highlightLastMove = getSetting('highlightLastMove');
  /* Perspective flip: when flipped, display rows/cols invert but logical board stays fixed */
  const isWhiteBottom = alwaysBottom ? true : playerColor === 'white';

  /* Initialise cached board rect after first layout. */
  useEffect(() => {
    if (boardRef.current) boardRectRef.current = boardRef.current.getBoundingClientRect();
  }, [boardSize]);

  const handleClick = useCallback(
    (square: string) => {
      logger.debug('Square clicked', { square, playerColor, isActive });
      onSquareClick(square);
    },
    [onSquareClick, playerColor, isActive],
  );

  /* Pointer-based drag: pointer capture keeps drag active even outside the board element */
  const handlePointerDown = useCallback(
    (square: string, e: React.PointerEvent) => {
      if (!isActive) return;
      const [r, f] = squareToIndices(square);
      const piece = board[r]?.[f];
      if (!piece || piece.color !== playerColor) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      logger.info('Piece drag started', { from: square, piece: piece.type, color: piece.color });
      setDragFrom(square);
      onDragStart(square);
    },
    [isActive, board, playerColor, onDragStart],
  );

  /* Track which square the pointer is hovering over during a drag.
     Uses cached board rect to avoid layout thrashing. */
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragFrom || !boardRef.current) return;
      const rect = boardRectRef.current ?? boardRef.current.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;
      const hf = Math.floor(relX / sqSize);
      const hr = Math.floor(relY / sqSize);
      if (hf >= 0 && hf < 8 && hr >= 0 && hr < 8) {
        const bf = isWhiteBottom ? hf : 7 - hf;
        const br = isWhiteBottom ? hr : 7 - hr;
        setHoverSquare(indicesToSquare(br, bf));
      } else {
        setHoverSquare(null);
      }
    },
    [dragFrom, sqSize, isWhiteBottom],
  );

  /* Drop: map pointer coordinates back to board square; cancel if outside board */
  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragFrom || !boardRef.current) {
        setDragFrom(null);
        setHoverSquare(null);
        return;
      }
      const rect = boardRectRef.current ?? boardRef.current.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;
      const tf = Math.floor(relX / sqSize);
      const tr = Math.floor(relY / sqSize);
      setDragFrom(null);
      setHoverSquare(null);
      if (tf < 0 || tf >= 8 || tr < 0 || tr >= 8) {
        logger.info('Piece drag cancelled', { from: dragFrom, reason: 'outside board' });
        return;
      }
      const bf = isWhiteBottom ? tf : 7 - tf;
      const br = isWhiteBottom ? tr : 7 - tr;
      const toSquare = indicesToSquare(br, bf);
      logger.info('Piece dropped', { from: dragFrom, to: toSquare, playerColor });
      onDragEnd(toSquare);
    },
    [dragFrom, sqSize, isWhiteBottom, onDragEnd, playerColor],
  );

  function squareToDisplayCenter(sq: string): { x: number; y: number } {
    const [r, f] = squareToIndices(sq);
    const df = isWhiteBottom ? f : 7 - f;
    const dr = isWhiteBottom ? r : 7 - r;
    return { x: (df + 0.5) * sqSize, y: (dr + 0.5) * sqSize };
  }

  const getIsLegalHint = (sq: string) => legalHints.some((h) => h.to === sq);
  const getIsLegalCapture = (sq: string) => {
    const [r, f] = squareToIndices(sq);
    return legalHints.some((h) => h.to === sq) && !!board[r]?.[f];
  };

  return (
    <div
      ref={boardRef}
      className="board-container"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => setHoverSquare(null)}
    >
      {/* dr, df = display row/col; br, bf = board row/col (inverted when flipped) */}
      {Array.from({ length: 8 }, (_, dr) => {
        const br = isWhiteBottom ? dr : 7 - dr;
        return Array.from({ length: 8 }, (_, df) => {
          const bf = isWhiteBottom ? df : 7 - df;
          const squareName = indicesToSquare(br, bf);
          return (
            <Square
              key={squareName}
              rank={br}
              file={bf}
              displayRank={dr}
              displayFile={df}
              piece={board[br]?.[bf] ?? null}
              isLight={(dr + df) % 2 === 0}
              sqSize={sqSize}
              isSelected={selectedSquare === squareName}
              isLastMoveFrom={highlightLastMove && lastMove?.from === squareName}
              isLastMoveTo={highlightLastMove && lastMove?.to === squareName}
              isLegalHint={getIsLegalHint(squareName)}
              isLegalCapture={getIsLegalCapture(squareName)}
              isHovered={hoverSquare === squareName && getIsLegalHint(squareName)}
              isPremoveFrom={premove?.from === squareName}
              isPremoveTo={premove?.to === squareName}
              isBestMoveFrom={bestMoveHint?.from === squareName}
              isBestMoveTo={bestMoveHint?.to === squareName}
              showCoordinates={showCoordinates}
              onClick={handleClick}
              onPointerDown={handlePointerDown}
            />
          );
        });
      })}
      {bestMoveHint &&
        (() => {
          const from = squareToDisplayCenter(bestMoveHint.from);
          const to = squareToDisplayCenter(bestMoveHint.to);
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 1) return null;
          const ux = dx / len;
          const uy = dy / len;
          const tipLen = Math.min(sqSize * 0.3, len * 0.4);
          const tipX = to.x - ux * tipLen;
          const tipY = to.y - uy * tipLen;
          const perp = sqSize * 0.12;
          return (
            <svg
              className="best-move-arrow"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: boardSize,
                height: boardSize,
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              {/* Arrow shaft */}
              <line
                x1={from.x}
                y1={from.y}
                x2={tipX}
                y2={tipY}
                stroke="rgba(255,215,0,0.85)"
                strokeWidth={Math.max(3, sqSize * 0.06)}
                strokeLinecap="round"
              />
              {/* Arrowhead */}
              <polygon
                points={`${to.x},${to.y} ${tipX + uy * perp},${tipY - ux * perp} ${tipX - uy * perp},${tipY + ux * perp}`}
                fill="rgba(255,215,0,0.85)"
              />
              {/* Glow effect */}
              <line
                x1={from.x}
                y1={from.y}
                x2={tipX}
                y2={tipY}
                stroke="rgba(255,215,0,0.25)"
                strokeWidth={Math.max(8, sqSize * 0.14)}
                strokeLinecap="round"
              />
            </svg>
          );
        })()}
      {children}
    </div>
  );
});

export default Board;
