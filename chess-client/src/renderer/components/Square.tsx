/**
 * Square — a single cell on the chess board.
 *
 * Renders the piece (if any), coordinate labels (rank/file),
 * legal-move dots/capture rings, and highlights for selection,
 * last move, and drag hover.
 *
 * Positioning is done via absolute coordinates (top/left) based on
 * displayRank/displayFile, which are already perspective-adjusted.
 */

import { memo } from 'react';
import { PIECE_CHARS, indicesToSquare } from '../chess';
import type { Piece } from '../../types';

interface SquareProps {
  rank: number;
  file: number;
  displayRank: number;
  displayFile: number;
  piece: Piece | null;
  isLight: boolean;
  sqSize: number;
  isSelected: boolean;
  isLastMoveFrom: boolean;
  isLastMoveTo: boolean;
  isLegalHint: boolean;
  isLegalCapture: boolean;
  isHovered: boolean;
  showCoordinates: boolean;
  onClick: (square: string) => void;
  onPointerDown: (square: string, e: React.PointerEvent) => void;
}

function Square({
  rank,
  file,
  displayRank,
  displayFile,
  piece,
  isLight,
  sqSize,
  isSelected,
  isLastMoveFrom,
  isLastMoveTo,
  isLegalHint,
  isLegalCapture,
  isHovered,
  showCoordinates,
  onClick,
  onPointerDown,
}: SquareProps) {
  const squareName = indicesToSquare(rank, file);
  const classes = [
    'square',
    isLight ? 'sq-light' : 'sq-dark',
    isSelected && 'hl-selected',
    isLastMoveFrom && 'hl-last-from',
    isLastMoveTo && 'hl-last-to',
    isHovered && 'hl-hover',
  ]
    .filter(Boolean)
    .join(' ');

  const pieceChar = piece ? PIECE_CHARS[piece.color]?.[piece.type] : null;

  return (
    <div
      className={classes}
      data-rank={rank}
      data-file={file}
      data-square={squareName}
      style={{
        position: 'absolute', // Board uses absolute positioning for all squares
        top: displayRank * sqSize,
        left: displayFile * sqSize,
        width: sqSize,
        height: sqSize,
      }}
      onClick={() => onClick(squareName)}
      onPointerDown={(e) => onPointerDown(squareName, e)}
    >
      {/* Show file labels (a-h) on bottom row, rank labels (1-8) on leftmost column */}
      {showCoordinates && displayRank === 7 && (
        <span className="sq-label sq-label-file">{String.fromCharCode(97 + displayFile)}</span>
      )}
      {showCoordinates && displayFile === 0 && <span className="sq-label sq-label-rank">{8 - displayRank}</span>}
      {pieceChar && (
        <span
          className="piece-char"
          style={{
            fontSize: Math.round(sqSize * 0.75),
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            textShadow: '0 2px 4px rgba(0,0,0,0.4)', // dark shadow makes light pieces pop on both backgrounds
            color: piece!.color === 'white' ? '#ffffff' : '#1a1a1a',
          }}
        >
          {pieceChar}
        </span>
      )}
      {isLegalHint && <div className="legal-dot" />}
      {isLegalCapture && <div className="legal-capture" />}
    </div>
  );
}

export default memo(Square); // memo: skip re-render unless props change (Board re-renders on every move)
