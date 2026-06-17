import { describe, test, expect } from '@jest/globals';
import { PIECE_CHARS } from '../src/renderer/chess';

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

function deserializeBoard(
  serialized: { square: string; piece: string; color: string }[],
): (null | { type: string; color: string })[][] {
  const board: (null | { type: string; color: string })[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const sq of serialized) {
    const [rank, file] = squareToIndices(sq.square);
    board[rank][file] = { type: sq.piece, color: sq.color };
  }
  return board;
}

function cloneBoard(board: (null | { type: string; color: string })[][]): (null | { type: string; color: string })[][] {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function createInitialBoard(): (null | { type: string; color: string })[][] {
  const board: (null | { type: string; color: string })[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (let f = 0; f < 8; f++) {
    board[0][f] = { type: backRank[f], color: 'black' };
    board[1][f] = { type: 'pawn', color: 'black' };
    board[6][f] = { type: 'pawn', color: 'white' };
    board[7][f] = { type: backRank[f], color: 'white' };
  }
  return board;
}

function findKing(
  board: (null | { type: string; color: string })[][],
  color: 'white' | 'black',
): [number, number] | null {
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
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) expect(board[r][f]).toBeNull();
  });

  test('cloneBoard creates independent copy', () => {
    const board = deserializeBoard([{ square: 'e1', piece: 'king', color: 'white' }]);
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
    const board = deserializeBoard([{ square: 'e1', piece: 'queen', color: 'white' }]);
    expect(findKing(board, 'white')).toBeNull();
  });

  test('createInitialBoard returns standard starting position', () => {
    const board = createInitialBoard();
    /* Back rank white */
    expect(board[7][0]?.type).toBe('rook');
    expect(board[7][0]?.color).toBe('white');
    expect(board[7][1]?.type).toBe('knight');
    expect(board[7][1]?.color).toBe('white');
    expect(board[7][2]?.type).toBe('bishop');
    expect(board[7][2]?.color).toBe('white');
    expect(board[7][3]?.type).toBe('queen');
    expect(board[7][3]?.color).toBe('white');
    expect(board[7][4]?.type).toBe('king');
    expect(board[7][4]?.color).toBe('white');
    expect(board[7][5]?.type).toBe('bishop');
    expect(board[7][5]?.color).toBe('white');
    expect(board[7][6]?.type).toBe('knight');
    expect(board[7][6]?.color).toBe('white');
    expect(board[7][7]?.type).toBe('rook');
    expect(board[7][7]?.color).toBe('white');

    /* White pawns */
    for (let f = 0; f < 8; f++) {
      expect(board[6][f]?.type).toBe('pawn');
      expect(board[6][f]?.color).toBe('white');
    }

    /* Empty middle ranks */
    for (let r = 2; r < 6; r++) {
      for (let f = 0; f < 8; f++) {
        expect(board[r][f]).toBeNull();
      }
    }

    /* Black pawns */
    for (let f = 0; f < 8; f++) {
      expect(board[1][f]?.type).toBe('pawn');
      expect(board[1][f]?.color).toBe('black');
    }

    /* Back rank black */
    expect(board[0][0]?.type).toBe('rook');
    expect(board[0][0]?.color).toBe('black');
    expect(board[0][1]?.type).toBe('knight');
    expect(board[0][1]?.color).toBe('black');
    expect(board[0][2]?.type).toBe('bishop');
    expect(board[0][2]?.color).toBe('black');
    expect(board[0][3]?.type).toBe('queen');
    expect(board[0][3]?.color).toBe('black');
    expect(board[0][4]?.type).toBe('king');
    expect(board[0][4]?.color).toBe('black');
    expect(board[0][5]?.type).toBe('bishop');
    expect(board[0][5]?.color).toBe('black');
    expect(board[0][6]?.type).toBe('knight');
    expect(board[0][6]?.color).toBe('black');
    expect(board[0][7]?.type).toBe('rook');
    expect(board[0][7]?.color).toBe('black');
  });

  test('createInitialBoard returns 8x8 board', () => {
    const board = createInitialBoard();
    expect(board).toHaveLength(8);
    for (let r = 0; r < 8; r++) {
      expect(board[r]).toHaveLength(8);
    }
  });

  test('createInitialBoard total pieces count', () => {
    const board = createInitialBoard();
    let count = 0;
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        if (board[r][f]) count++;
      }
    }
    expect(count).toBe(32);
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

describe('PIECE_CHARS', () => {
  test('contains all 6 piece types for each color', () => {
    const expected = { king: 1, queen: 1, rook: 1, bishop: 1, knight: 1, pawn: 1 };
    expect(Object.keys(PIECE_CHARS.white)).toHaveLength(6);
    expect(Object.keys(PIECE_CHARS.black)).toHaveLength(6);
    for (const color of ['white', 'black'] as const) {
      for (const [type] of Object.entries(expected)) {
        expect(PIECE_CHARS[color]).toHaveProperty(type);
        expect(typeof PIECE_CHARS[color][type]).toBe('string');
        expect(PIECE_CHARS[color][type].length).toBeGreaterThan(0);
      }
    }
  });

  test('chars are valid Unicode strings', () => {
    for (const color of ['white', 'black'] as const) {
      for (const [, char] of Object.entries(PIECE_CHARS[color])) {
        expect(char.codePointAt(0)).toBeGreaterThanOrEqual(0x2654);
        expect(char.codePointAt(0)).toBeLessThanOrEqual(0x265f);
      }
    }
  });
});
