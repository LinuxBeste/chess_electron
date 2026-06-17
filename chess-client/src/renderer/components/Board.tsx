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
}: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(480);
  const [hoverSquare, setHoverSquare] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<string | null>(null);

  /* Track the board DOM element's width so square sizing is always exact.
     A ResizeObserver is more reliable than window resize events.
     Also caches the board DOM rect to avoid layout thrashing on drag. */
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
  const rafRef = useRef<number | null>(null);
  const alwaysBottom = useRef(getSetting('alwaysWhiteBottom')).current;
  const showCoordinates = useRef(getSetting('showCoordinates')).current;
  const highlightLastMove = useRef(getSetting('highlightLastMove')).current;
  /* When alwaysWhiteBottom is on, white is always at the visual bottom
     regardless of player colour.  Otherwise the active player's side is at the bottom. */
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

  /* Pointer-event-based drag-and-drop.  Uses pointer capture semantics
     so the drag continues even if the pointer leaves the board element.
     Coordinates are transformed from visual (display) space to logical
     (board array) space via isWhiteBottom. */
  const handlePointerDown = useCallback(
    (square: string, _e: React.PointerEvent) => {
      if (!isActive) return;
      const [r, f] = squareToIndices(square);
      const piece = board[r]?.[f];
      if (!piece || piece.color !== playerColor) return;
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

  /* End the drag: convert pointer position back to a board square.
     If the pointer is outside the board, the move is cancelled. */
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
              showCoordinates={showCoordinates}
              onClick={handleClick}
              onPointerDown={handlePointerDown}
            />
          );
        });
      })}
      {children}
    </div>
  );
});

export default Board;
