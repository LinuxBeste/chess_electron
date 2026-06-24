import { useState, useEffect, useCallback } from 'react';
import { Repeat, Search, ChevronLeft, ChevronRight, Copy, Keyboard } from 'lucide-react';
import { api, GameReplayResponse } from './api';

const PIECES: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

function toAlgebraic(move: string): string {
  const pieceMap: Record<string, string> = { K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N', P: '' };
  if (move.length < 4) return move;
  const piece = move[0];
  const pieceChar = pieceMap[piece] || '';
  const file = move[1];
  const rank = move[2];
  const destFile = move[3];
  if (piece >= 'A' && piece <= 'Z') {
    if (piece === 'P') return destFile + rank;
    return pieceChar + destFile + rank;
  }
  if (move === 'O-O') return 'O-O';
  if (move === 'O-O-O') return 'O-O-O';
  return move;
}

interface BoardState {
  squares: (string | null)[][];
}

function parseFen(fen: string): BoardState {
  const rows = fen.split(' ')[0].split('/');
  const squares: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  for (let r = 0; r < 8; r++) {
    let c = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') {
        c += parseInt(ch);
      } else {
        squares[r][c] = ch;
        c++;
      }
    }
  }
  return { squares };
}

function BoardSvg({ board }: { board: (string | null)[][] }) {
  const size = 280;
  const sq = size / 8;
  return (
    <svg width={size} height={size} className="rounded border border-[#333]">
      {board.map((row, r) =>
        row.map((piece, c) => (
          <g key={r + '-' + c}>
            <rect x={c * sq} y={r * sq} width={sq} height={sq}
              fill={(r + c) % 2 === 0 ? '#f0d9b5' : '#b58863'} />
            {piece && (
              <text x={c * sq + sq / 2} y={r * sq + sq / 2 + 2}
                textAnchor="middle" dominantBaseline="central"
                fontSize={sq * 0.75} fill={(r + c) % 2 === 0 ? '#333' : '#fff'}
                style={{ userSelect: 'none', pointerEvents: 'none' }}>
                {PIECES[piece] || piece}
              </text>
            )}
          </g>
        ))
      )}
      {/* File labels */}
      {Array(8).fill(null).map((_, c) => (
        <text key={'f' + c} x={c * sq + sq - 3} y={size - 2}
          fontSize={8} fill="#555" textAnchor="end"
          style={{ userSelect: 'none', pointerEvents: 'none' }}>
          {'abcdefgh'[c]}
        </text>
      ))}
      {/* Rank labels */}
      {Array(8).fill(null).map((_, r) => (
        <text key={'r' + r} x={3} y={r * sq + 10}
          fontSize={8} fill="#555"
          style={{ userSelect: 'none', pointerEvents: 'none' }}>
          {8 - r}
        </text>
      ))}
    </svg>
  );
}

function generatePgn(moves: string[], white: string, black: string, result: string): string {
  const lines: string[] = [];
  lines.push('[Event "Chess Game"]');
  lines.push('[White "' + white + '"]');
  lines.push('[Black "' + black + '"]');
  lines.push('[Result "' + result + '"]');
  const moveText: string[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    const num = Math.floor(i / 2) + 1;
    const w = moves[i] || '';
    const b = moves[i + 1] || '';
    moveText.push(num + '. ' + w + (b ? ' ' + b : ''));
  }
  lines.push('');
  lines.push(moveText.join(' ') + ' ' + result);
  return lines.join('\n');
}

export default function GameReplayTab({ initialGameId }: { initialGameId?: string }) {
  const [gameId, setGameId] = useState('');
  const [loading, setLoading] = useState(false);
  const [replay, setReplay] = useState<GameReplayResponse | null>(null);
  const [currentMove, setCurrentMove] = useState(0);
  const [error, setError] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);

  async function handleLoad(id?: string) {
    const gid = (id || gameId).trim();
    if (!gid) return;
    setLoading(true);
    setError('');
    setReplay(null);
    setCurrentMove(0);
    try {
      const data = await api<GameReplayResponse>('/games/' + gid + '/replay');
      setReplay(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!replay) return;
    if (e.key === 'ArrowLeft') {
      setCurrentMove((m) => Math.max(0, m - 1));
    } else if (e.key === 'ArrowRight') {
      setCurrentMove((m) => Math.min(replay.moves.length, m + 1));
    } else if (e.key === 'Home') {
      setCurrentMove(0);
    } else if (e.key === 'End') {
      setCurrentMove(replay.moves.length);
    }
  }, [replay]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (initialGameId) {
      setGameId(initialGameId);
      handleLoad(initialGameId);
    }
  }, [initialGameId]);

  const board = replay && replay.boardHistory && replay.boardHistory[currentMove]
    ? parseFen(replay.boardHistory[currentMove]).squares
    : null;

  const result = replay?.result || '*';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-semibold text-[#e0e0e0] flex items-center gap-2">
            <Repeat size={16} className="text-green-400" />
            Game Replay
          </h2>
        </div>

        <div className="p-4">
          <div className="flex gap-2 mb-4">
            <input type="text" value={gameId} onChange={(e) => setGameId(e.target.value)}
              placeholder="Enter game ID to replay..."
              onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
              className="flex-1 px-3 py-2 text-sm bg-[#222] border border-[#333] rounded-lg text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#4a9eff]" />
            <button onClick={() => handleLoad()} disabled={loading || !gameId.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[#4a9eff] text-white rounded-lg hover:bg-[#3a8eef] disabled:opacity-40">
              <Search size={14} /> {loading ? 'Loading...' : 'Load'}
            </button>
          </div>

          {error && <p className="text-red-500 text-xs mb-4">{error}</p>}

          {replay && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-center mb-3">
                  {board ? <BoardSvg board={board} /> : (
                    <div className="w-[280px] h-[280px] bg-[#222] rounded flex items-center justify-center text-xs text-[#555]">
                      No board position
                    </div>
                  )}
                </div>

                <div className="bg-[#222] rounded-lg p-3 text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="text-[#888]">White:</span>
                    <span className="text-[#e0e0e0]">{replay.white}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#888]">Black:</span>
                    <span className="text-[#e0e0e0]">{replay.black}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#888]">Status:</span>
                    <span className="text-[#e0e0e0] capitalize">{replay.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#888]">Result:</span>
                    <span className="text-[#e0e0e0]">{result}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button onClick={() => navigator.clipboard.writeText(generatePgn(replay.moves, replay.white, replay.black, result))}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333]">
                    <Copy size={12} /> Copy PGN
                  </button>
                  <button onClick={() => setShowShortcuts(!showShortcuts)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333]">
                    <Keyboard size={12} /> Shortcuts
                  </button>
                </div>

                {showShortcuts && (
                  <div className="mt-2 px-3 py-2 bg-[#222] rounded-lg text-[10px] text-[#888]">
                    ← Previous move · → Next move · Home Start · End End
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentMove(0)} disabled={currentMove <= 0}
                      className="p-1 bg-[#222] rounded text-[#888] hover:text-[#ccc] disabled:opacity-30" title="Start">
                      <ChevronLeft size={14} />
                    </button>
                    <button onClick={() => setCurrentMove(Math.max(0, currentMove - 1))} disabled={currentMove <= 0}
                      className="p-1 bg-[#222] rounded text-[#888] hover:text-[#ccc] disabled:opacity-30">
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs text-[#888] min-w-[80px] text-center">
                      {currentMove} / {replay.moves.length}
                    </span>
                    <button onClick={() => setCurrentMove(Math.min(replay.moves.length, currentMove + 1))} disabled={currentMove >= replay.moves.length}
                      className="p-1 bg-[#222] rounded text-[#888] hover:text-[#ccc] disabled:opacity-30">
                      <ChevronRight size={16} />
                    </button>
                    <button onClick={() => setCurrentMove(replay.moves.length)} disabled={currentMove >= replay.moves.length}
                      className="p-1 bg-[#222] rounded text-[#888] hover:text-[#ccc] disabled:opacity-30" title="End">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3" style={{ maxHeight: 350, overflowY: 'auto' }}>
                  <div className="grid grid-cols-2 gap-1 text-xs font-mono">
                    {replay.moves.map((move, i) => (
                      <div key={i}
                        className={`px-2 py-1 rounded cursor-pointer ${
                          i === currentMove - 1
                            ? 'bg-[#4a9eff] text-white'
                            : i < currentMove
                              ? 'bg-[#1a3a5c] text-[#4a9eff]'
                              : 'text-[#ccc] hover:bg-[#222]'
                        }`}
                        onClick={() => setCurrentMove(i + 1)}>
                        <span className="text-[#888] mr-1.5">{Math.floor(i / 2) + 1}{i % 2 === 0 ? '.' : '...'}</span>
                        {toAlgebraic(move)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
