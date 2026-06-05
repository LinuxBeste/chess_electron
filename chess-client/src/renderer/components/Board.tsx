import { useRef, useCallback, useState, useEffect } from 'react';
import Square from './Square';
import { squareToIndices, indicesToSquare } from '../chess';
import { getSetting } from '../settings';
import type { Board as BoardType, LegalMoveHint } from '../../types';

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

export default function Board({
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

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setBoardSize(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sqSize = boardSize / 8;
  const alwaysBottom = getSetting('alwaysWhiteBottom');
  const showCoordinates = getSetting('showCoordinates');
  const highlightLastMove = getSetting('highlightLastMove');
  const isWhiteBottom = alwaysBottom ? true : playerColor === 'white';

  const handleClick = useCallback(
    (square: string) => {
      onSquareClick(square);
    },
    [onSquareClick],
  );

  const handlePointerDown = useCallback(
    (square: string, _e: React.PointerEvent) => {
      if (!isActive) return;
      const [r, f] = squareToIndices(square);
      const piece = board[r]?.[f];
      if (!piece || piece.color !== playerColor) return;
      setDragFrom(square);
      onDragStart(square);
    },
    [isActive, board, playerColor, onDragStart],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragFrom || !boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
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

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragFrom || !boardRef.current) {
        setDragFrom(null);
        setHoverSquare(null);
        return;
      }
      const rect = boardRef.current.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;
      const tf = Math.floor(relX / sqSize);
      const tr = Math.floor(relY / sqSize);
      setDragFrom(null);
      setHoverSquare(null);
      if (tf < 0 || tf >= 8 || tr < 0 || tr >= 8) return;
      const bf = isWhiteBottom ? tf : 7 - tf;
      const br = isWhiteBottom ? tr : 7 - tr;
      onDragEnd(indicesToSquare(br, bf));
    },
    [dragFrom, sqSize, isWhiteBottom, onDragEnd],
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
      style={{ width: 'min(65vh, 600px)', height: 'min(65vh, 600px)' }}
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
              alwaysBottom={alwaysBottom}
              playerColor={playerColor}
              onClick={handleClick}
              onPointerDown={handlePointerDown}
              onPointerEnter={() => setHoverSquare(squareName)}
            />
          );
        });
      })}
      {children}
    </div>
  );
}
