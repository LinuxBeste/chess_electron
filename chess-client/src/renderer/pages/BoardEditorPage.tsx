import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Square from '../components/Square';
import { indicesToSquare, squareToIndices, cloneBoard, PIECE_CHARS } from '../chess';
import type { Board as BoardType, PieceType } from '../../types';
import { t } from '../translate';

const PIECE_TYPES: (PieceType | null)[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn', null];

function emptyBoard(): BoardType {
  return Array.from({ length: 8 }, () => Array(8).fill(null));
}

function boardToFen(board: BoardType): string {
  const pieceMap: Record<string, string> = {
    'white-king': 'K',
    'white-queen': 'Q',
    'white-rook': 'R',
    'white-bishop': 'B',
    'white-knight': 'N',
    'white-pawn': 'P',
    'black-king': 'k',
    'black-queen': 'q',
    'black-rook': 'r',
    'black-bishop': 'b',
    'black-knight': 'n',
    'black-pawn': 'p',
  };
  let fen = '';
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (p) {
        if (empty > 0) {
          fen += empty;
          empty = 0;
        }
        fen += pieceMap[`${p.color}-${p.type}`] || '?';
      } else {
        empty++;
      }
    }
    if (empty > 0) fen += empty;
    if (r < 7) fen += '/';
  }
  fen += ' w KQkq - 0 1';
  return fen;
}

function fenToBoard(fen: string): BoardType | null {
  const board = emptyBoard();
  const rows = fen.split(' ')[0].split('/');
  if (rows.length !== 8) return null;
  const charMap: Record<string, { type: PieceType; color: 'white' | 'black' }> = {
    K: { type: 'king', color: 'white' },
    Q: { type: 'queen', color: 'white' },
    R: { type: 'rook', color: 'white' },
    B: { type: 'bishop', color: 'white' },
    N: { type: 'knight', color: 'white' },
    P: { type: 'pawn', color: 'white' },
    k: { type: 'king', color: 'black' },
    q: { type: 'queen', color: 'black' },
    r: { type: 'rook', color: 'black' },
    b: { type: 'bishop', color: 'black' },
    n: { type: 'knight', color: 'black' },
    p: { type: 'pawn', color: 'black' },
  };
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') {
        f += parseInt(ch, 10);
      } else {
        const piece = charMap[ch];
        if (!piece || f >= 8) return null;
        board[r][f] = piece;
        f++;
      }
    }
    if (f !== 8) return null;
  }
  return board;
}

export default function BoardEditorPage() {
  const navigate = useNavigate();
  const [board, setBoard] = useState<BoardType>(emptyBoard);
  const [selectedPiece, setSelectedPiece] = useState<PieceType | null>('king');
  const [selectedColor, setSelectedColor] = useState<'white' | 'black'>('white');
  const [flipped, setFlipped] = useState(false);
  const [fenInput, setFenInput] = useState('');
  const [fenError, setFenError] = useState('');
  const [copied, setCopied] = useState(false);

  function hasBothKings(): boolean {
    let whiteKing = false;
    let blackKing = false;
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = board[r][f];
        if (p) {
          if (p.type === 'king' && p.color === 'white') whiteKing = true;
          if (p.type === 'king' && p.color === 'black') blackKing = true;
        }
      }
    }
    return whiteKing && blackKing;
  }

  const handleSquareClick = useCallback(
    (square: string) => {
      const [r, f] = squareToIndices(square);
      setBoard((prev) => {
        const b = cloneBoard(prev);
        if (selectedPiece === null) {
          b[r][f] = null;
        } else {
          const existing = b[r][f];
          if (existing && existing.color === selectedColor && existing.type === selectedPiece) {
            b[r][f] = null;
          } else {
            b[r][f] = { type: selectedPiece, color: selectedColor };
          }
        }
        return b;
      });
    },
    [selectedPiece, selectedColor],
  );

  function clearBoard() {
    setBoard(emptyBoard());
  }

  function setStartPos() {
    const b = emptyBoard();
    const back: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    for (let f = 0; f < 8; f++) {
      b[0][f] = { type: back[f], color: 'black' };
      b[1][f] = { type: 'pawn', color: 'black' };
      b[6][f] = { type: 'pawn', color: 'white' };
      b[7][f] = { type: back[f], color: 'white' };
    }
    setBoard(b);
  }

  function handleImportFen() {
    const result = fenToBoard(fenInput.trim());
    if (result) {
      setBoard(result);
      setFenError('');
    } else {
      setFenError(t('boardEditor.invalidFen'));
    }
  }

  async function handleExportFen() {
    const fen = boardToFen(board);
    try {
      await navigator.clipboard.writeText(fen);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFenInput(fen);
    }
  }

  function handlePlayFromPosition() {
    if (!hasBothKings()) {
      setFenError(t('boardEditor.needBothKings'));
      return;
    }
    const fen = boardToFen(board);
    navigate(`/local?fen=${encodeURIComponent(fen)}`);
  }

  const files = flipped ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = flipped ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const sqSize = Math.min(56, (window.innerWidth - 40) / 8);

  return (
    <div
      className="page-container"
      style={{ padding: 16, display: 'flex', gap: 16, flexDirection: 'column', alignItems: 'center' }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>{t('boardEditor.title')}</h2>

      <div
        style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 800 }}
      >
        <div style={{ position: 'relative', width: sqSize * 8, height: sqSize * 8 }}>
          {ranks.map((r) =>
            files.map((f) => {
              const fileIdx = f.charCodeAt(0) - 97;
              const square = indicesToSquare(r, fileIdx);
              const piece = board[r][fileIdx];
              return (
                <Square
                  key={square}
                  rank={r}
                  file={fileIdx}
                  displayRank={ranks.indexOf(r)}
                  displayFile={files.indexOf(f)}
                  piece={piece}
                  isLight={(r + fileIdx) % 2 === 0}
                  sqSize={sqSize}
                  isSelected={false}
                  isLastMoveFrom={false}
                  isLastMoveTo={false}
                  isLegalHint={false}
                  isLegalCapture={false}
                  isHovered={false}
                  showCoordinates={true}
                  onClick={handleSquareClick}
                  onPointerDown={() => {}}
                />
              );
            }),
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 200 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>
              {t('boardEditor.piece')}
            </label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {PIECE_TYPES.map((pt) => (
                <button
                  key={pt ?? 'empty'}
                  className={`btn btn-sm ${selectedPiece === pt ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setSelectedPiece(pt)}
                  style={{ fontSize: 20, width: 40, height: 40, padding: 0 }}
                  title={pt ?? 'empty'}
                >
                  {pt === null ? '✕' : PIECE_CHARS[selectedColor]?.[pt] || '?'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>
              {t('boardEditor.color')}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`btn btn-sm ${selectedColor === 'white' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSelectedColor('white')}
                style={{ flex: 1 }}
              >
                {t('common.white')}
              </button>
              <button
                className={`btn btn-sm ${selectedColor === 'black' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSelectedColor('black')}
                style={{ flex: 1 }}
              >
                {t('common.black')}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={setStartPos} style={{ flex: 1 }}>
              {t('boardEditor.startPos')}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={clearBoard} style={{ flex: 1 }}>
              {t('boardEditor.clear')}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setFlipped(!flipped)} style={{ flex: 1 }}>
              {t('boardEditor.flipBoard')}
            </button>
          </div>

          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleExportFen} style={{ flex: 1 }}>
                {copied ? t('boardEditor.fenCopied') : t('boardEditor.exportFen')}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={fenInput}
                onChange={(e) => {
                  setFenInput(e.target.value);
                  setFenError('');
                }}
                placeholder={t('boardEditor.fenPlaceholder')}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  fontSize: 12,
                  background: '#1a1a1f',
                  border: '1px solid #333',
                  borderRadius: 6,
                  color: '#e0e0e0',
                }}
              />
              <button className="btn btn-secondary btn-sm" onClick={handleImportFen}>
                {t('boardEditor.importFen')}
              </button>
            </div>
            {fenError && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{fenError}</div>}
          </div>

          <button className="btn btn-primary" onClick={handlePlayFromPosition} style={{ marginTop: 4 }}>
            {t('boardEditor.play')}
          </button>
        </div>
      </div>
    </div>
  );
}
