import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../translate';
import type { SerializedSquare } from '../../types';
import { SkipBack, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';

interface ReviewBoardProps {
  boardHistory: SerializedSquare[][];
  whiteName?: string;
  blackName?: string;
  result?: string;
  gameId?: string;
  compact?: boolean;
}

// Interactive board review with move-by-move navigation
function renderBoardState(serialized: SerializedSquare[], flipped: boolean, cellSize: number): React.ReactNode {
  const squares: React.ReactNode[] = [];
  const pieceChars: Record<string, Record<string, string>> = {
    white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
    black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
  };

  const board: (SerializedSquare | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const sq of serialized) {
    const file = sq.square.charCodeAt(0) - 97;
    const rank = 8 - parseInt(sq.square[1], 10);
    if (rank >= 0 && rank < 8 && file >= 0 && file < 8) {
      board[rank][file] = sq;
    }
  }

  const ranks = flipped ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const files = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  for (const r of ranks) {
    for (const f of files) {
      const sq = board[r][f];
      const isLight = (r + f) % 2 === 0;
      squares.push(
        <div
          key={r + '-' + f}
          style={{
            width: cellSize,
            height: cellSize,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: cellSize * 0.67,
            background: isLight ? '#f0d9b5' : '#b58863',
          }}
        >
          {sq && (
            <span style={{ filter: sq.color === 'white' ? 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))' : 'none' }}>
              {(pieceChars[sq.color] || {})[sq.piece] || '?'}
            </span>
          )}
        </div>,
      );
    }
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, ' + cellSize + 'px)',
        borderRadius: 4,
        overflow: 'hidden',
        border: '1px solid var(--border)',
      }}
    >
      {squares}
    </div>
  );
}

export default function ReviewBoard({ boardHistory, whiteName, blackName, result, gameId, compact }: ReviewBoardProps) {
  const [currentMove, setCurrentMove] = useState(boardHistory.length > 0 ? boardHistory.length - 1 : 0);
  const [flipped, setFlipped] = useState(false);
  const navigate = useNavigate();

  const cellSize = compact ? 28 : 36;
  const maxMove = Math.max(0, boardHistory.length - 1);
  const displayBoard = boardHistory[currentMove] || boardHistory[0] || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {whiteName && <span style={{ fontSize: compact ? 11 : 13, fontWeight: 600 }}>{whiteName}</span>}
        <span style={{ fontSize: compact ? 10 : 12, color: '#888' }}>{result || ''}</span>
        {blackName && <span style={{ fontSize: compact ? 11 : 13, fontWeight: 600 }}>{blackName}</span>}
      </div>
      {renderBoardState(displayBoard, flipped, cellSize)}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          className="btn btn-ghost"
          style={{ padding: '4px 8px', fontSize: 11 }}
          onClick={() => setCurrentMove(0)}
          disabled={currentMove <= 0}
        >
          <SkipBack size={14} />
        </button>
        <button
          className="btn btn-ghost"
          style={{ padding: '4px 8px', fontSize: 11 }}
          onClick={() => setCurrentMove(Math.max(0, currentMove - 1))}
          disabled={currentMove <= 0}
        >
          <ChevronLeft size={14} />
        </button>
        <span style={{ fontSize: 11, minWidth: 40, textAlign: 'center' }}>
          {currentMove}/{maxMove}
        </span>
        <button
          className="btn btn-ghost"
          style={{ padding: '4px 8px', fontSize: 11 }}
          onClick={() => setCurrentMove(Math.min(maxMove, currentMove + 1))}
          disabled={currentMove >= maxMove}
        >
          <ChevronRight size={14} />
        </button>
        <button
          className="btn btn-ghost"
          style={{ padding: '4px 8px', fontSize: 11 }}
          onClick={() => setCurrentMove(maxMove)}
          disabled={currentMove >= maxMove}
        >
          <SkipForward size={14} />
        </button>
        <button
          className="btn btn-ghost"
          style={{ padding: '4px 8px', fontSize: 11 }}
          onClick={() => setFlipped(!flipped)}
        >
          {t('gameReview.flipBoard')}
        </button>
      </div>
      {!compact && gameId && (
        <button
          className="btn btn-primary"
          style={{ padding: '6px 16px', fontSize: 12 }}
          onClick={() => navigate('/game/' + gameId)}
        >
          {t('gameReview.review')}
        </button>
      )}
    </div>
  );
}
