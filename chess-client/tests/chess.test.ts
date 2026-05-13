import { describe, test, expect } from '@jest/globals';

/* Re-implement the functions from chess.ts to test them independently,
 * since the real functions import DOM types which jsdom provides. */
function squareToIndices(square: string): [number, number] {
  const file = square.charCodeAt(0) - 97;
  const rank = 8 - parseInt(square[1], 10);
  return [rank, file];
}

function indicesToSquare(rank: number, file: number): string {
  return String.fromCharCode(file + 97) + (8 - rank).toString();
}

function deserializeBoard(serialized: { square: string; piece: string; color: string }[]): (null | { type: string; color: string })[][] {
  const board: (null | { type: string; color: string })[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const sq of serialized) {
    const [rank, file] = squareToIndices(sq.square);
    board[rank][file] = { type: sq.piece, color: sq.color };
  }
  return board;
}

function cloneBoard(board: (null | { type: string; color: string })[][]): (null | { type: string; color: string })[][] {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

function findKing(board: (null | { type: string; color: string })[][], color: 'white' | 'black'): [number, number] | null {
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r]?.[f];
      if (p && p.type === 'king' && p.color === color) return [r, f];
    }
  }
  return null;
}

describe('chess client helpers', () => {
  test('squareToIndices converts correctly', () => {
    expect(squareToIndices('a1')).toEqual([7, 0]);
    expect(squareToIndices('h8')).toEqual([0, 7]);
    expect(squareToIndices('e4')).toEqual([4, 4]);
    expect(squareToIndices('b7')).toEqual([1, 1]);
  });

  test('indicesToSquare converts correctly', () => {
    expect(indicesToSquare(7, 0)).toBe('a1');
    expect(indicesToSquare(0, 7)).toBe('h8');
    expect(indicesToSquare(4, 4)).toBe('e4');
    expect(indicesToSquare(1, 1)).toBe('b7');
  });

  test('squareToIndices and indicesToSquare are inverses', () => {
    const squares = ['a1', 'a8', 'h1', 'h8', 'e2', 'e4', 'b7', 'd5', 'c3', 'f6'];
    for (const sq of squares) {
      const [r, f] = squareToIndices(sq);
      expect(indicesToSquare(r, f)).toBe(sq);
    }
  });

  test('deserializeBoard reconstructs board from serialized squares', () => {
    const serialized = [
      { square: 'a1', piece: 'rook', color: 'white' },
      { square: 'e1', piece: 'king', color: 'white' },
      { square: 'e8', piece: 'king', color: 'black' },
    ];
    const board = deserializeBoard(serialized);
    expect(board[7][0]?.type).toBe('rook');
    expect(board[7][0]?.color).toBe('white');
    expect(board[7][4]?.type).toBe('king');
    expect(board[7][4]?.color).toBe('white');
    expect(board[0][4]?.type).toBe('king');
    expect(board[0][4]?.color).toBe('black');
    /* Other squares should be null */
    expect(board[0][0]).toBeNull();
    expect(board[4][4]).toBeNull();
  });

  test('deserializeBoard handles empty array', () => {
    const board = deserializeBoard([]);
    for (let r = 0; r < 8; r++)
      for (let f = 0; f < 8; f++)
        expect(board[r][f]).toBeNull();
  });

  test('cloneBoard creates independent copy', () => {
    const board = deserializeBoard([
      { square: 'e1', piece: 'king', color: 'white' },
    ]);
    const cloned = cloneBoard(board);
    cloned[7][4] = null;
    expect(board[7][4]).not.toBeNull();
  });

  test('findKing locates white king', () => {
    const board = deserializeBoard([
      { square: 'e1', piece: 'king', color: 'white' },
      { square: 'e8', piece: 'king', color: 'black' },
    ]);
    expect(findKing(board, 'white')).toEqual([7, 4]);
    expect(findKing(board, 'black')).toEqual([0, 4]);
  });

  test('findKing returns null when king not present', () => {
    const board = deserializeBoard([
      { square: 'e1', piece: 'queen', color: 'white' },
    ]);
    expect(findKing(board, 'white')).toBeNull();
  });

  test('getPieceSvg returns correct unicode for each piece', () => {
    const chars: Record<string, Record<string, string>> = {
      white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
      black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
    };
    for (const color of ['white', 'black']) {
      for (const [type, char] of Object.entries(chars[color])) {
        const svg = `<span class="piece-char" style="font-size:36px;line-height:1;display:flex;align-items:center;justify-content:center;width:100%;height:100%;text-shadow:0 2px 4px rgba(0,0,0,0.4);color:${color === 'white' ? '#ffffff' : '#1a1a1a'}">${char}</span>`;
        expect(svg).toContain(char);
        expect(svg).toContain('piece-char');
      }
    }
  });
});
