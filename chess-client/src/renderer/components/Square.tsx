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

import { getPieceSvg, indicesToSquare } from '../chess';
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
  alwaysBottom: boolean;
  playerColor: 'white' | 'black';
  onClick: (square: string) => void;
  onPointerDown: (square: string, e: React.PointerEvent) => void;
  onPointerEnter: (square: string) => void;
}

export default function Square({
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
  onPointerEnter,
}: SquareProps) {
  const squareName = indicesToSquare(rank, file);
  /* Build CSS class list dynamically — .filter(Boolean) removes falsey values,
     so only active modifiers are included in the final class string. */
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

  return (
    <div
      className={classes}
      data-rank={rank}
      data-file={file}
      data-square={squareName}
      style={{
        position: 'absolute',
        top: displayRank * sqSize,
        left: displayFile * sqSize,
        width: sqSize,
        height: sqSize,
      }}
      onClick={() => onClick(squareName)}
      onPointerDown={(e) => onPointerDown(squareName, e)}
      onPointerEnter={() => onPointerEnter(squareName)}
    >
      {/* Coordinate labels: file letters (a–h) on the bottom row only,
          rank numbers (1–8) on the leftmost column only.  Positioned
          via CSS classes inside the square. */}
      {showCoordinates && displayRank === 7 && (
        <span className="sq-label sq-label-file">{String.fromCharCode(97 + displayFile)}</span>
      )}
      {showCoordinates && displayFile === 0 && <span className="sq-label sq-label-rank">{8 - displayRank}</span>}
      {piece && (
        <span
          className="piece-char"
          style={{
            fontSize: 36,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            textShadow: '0 2px 4px rgba(0,0,0,0.4)',
            color: piece.color === 'white' ? '#ffffff' : '#1a1a1a',
          }}
          dangerouslySetInnerHTML={{ __html: getPieceSvg(piece.type, piece.color) }}
        />
      )}
      {isLegalHint && <div className="legal-dot" />}
      {isLegalCapture && <div className="legal-capture" />}
    </div>
  );
}
