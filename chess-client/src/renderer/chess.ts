import logger from './logger';

/**
 * Client-side chess helpers: board creation, coordinate conversion,
 * deserialisation from WebSocket messages, and SVG piece rendering.
 *
 * The board rendering converts a 2D Board array or a SerializedSquare[]
 * (from WebSocket messages) into DOM elements.  Legal move hints are
 * fetched from the API and displayed as dots on the board.
 *
 * This file does NOT implement chess logic — that lives in the server's
 * chess.ts.  The client only needs to render the board and provide visual
 * feedback for user interactions.
 *
 * NOTE: the "SVG pieces" here are actually Unicode chess characters;
 * they're light, text-based, and scale cleanly at any resolution.
 */

import type { Board, SerializedSquare, PieceType } from '../types';

/**
 * Create the standard 8×8 starting position.
 * Rank 0 = back rank (black), rank 7 = back rank (white).
 */
export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (let f = 0; f < 8; f++) {
    board[0][f] = { type: backRank[f], color: 'black' };
    board[1][f] = { type: 'pawn', color: 'black' };
    board[6][f] = { type: 'pawn', color: 'white' };
    board[7][f] = { type: backRank[f], color: 'white' };
  }
  logger.info('Initial board created');
  return board;
}

// Convert algebraic square (e.g. "e4") to board indices
export function squareToIndices(square: string): [number, number] {
  const file = square.charCodeAt(0) - 97;
  const rank = 8 - parseInt(square[1], 10);
  logger.debug('Square converted to indices', { square, rank, file });
  return [rank, file];
}

/**
 * Convert board indices back to algebraic notation.
 * rank 7 → '1', file 0 → 'a'.
 * Confirmed in ../chess-api/src/chess.ts lines 39-41.
 */
export function indicesToSquare(rank: number, file: number): string {
  const square = String.fromCharCode(file + 97) + (8 - rank).toString();
  logger.debug('Indices converted to square', { rank, file, square });
  return square;
}

/**
 * Convert a SerializedSquare[] (as received from WebSocket "move" events)
 * back into a 2D Board[rank][file] array for rendering.
 *
 * The WebSocket broadcasts `board` as an array of SerializedSquare objects,
 * confirmed in ../chess-api/src/game.ts line 327 where chess.serializeBoard(newBoard)
 * is called, and ../chess-api/src/chess.ts lines 718-733 for the serialization
 * format.
 */
export function deserializeBoard(serialized: SerializedSquare[]): Board {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const sq of serialized) {
    const [rank, file] = squareToIndices(sq.square);
    board[rank][file] = { type: sq.piece as PieceType, color: sq.color as 'white' | 'black' };
  }
  logger.debug('Board deserialized from', serialized.length, 'squares');
  return board;
}

/**
 * Deep-clone a Board for optimistic updates.
 * Each cell's Piece is spread so mutations to the clone don't affect the original.
 */
export function cloneBoard(board: Board): Board {
  const cloned = board.map((row) => row.map((cell) => (cell ? { ...cell } : null))); // shallow-clone each piece to avoid mutation leaks
  logger.debug('Board cloned');
  return cloned;
}

/**
 * Find the king position of a given color on the board.
 * Returns [rank, file] or null if no king found (should never happen in valid games).
 */
export function findKing(board: Board, color: 'white' | 'black'): [number, number] | null {
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r]?.[f];
      if (p && p.type === 'king' && p.color === color) {
        logger.debug('King found', { color, rank: r, file: f });
        return [r, f];
      }
    }
  }
  logger.warn('King not found for color', color);
  return null;
}

const PIECE_MAP: Record<string, string> = {
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

// Serialize a Board to FEN notation
export function boardToFen(board: Board): string {
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
        fen += PIECE_MAP[`${p.color}-${p.type}`] || '?';
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

// Parse a FEN string back into a Board
export function fenToBoard(fen: string): Board | null {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
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

/** Unicode chess characters for piece rendering */
// Unicode chess chars — no SVG assets needed, scale cleanly at any resolution
export const PIECE_CHARS: Record<string, Record<string, string>> = {
  white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
  black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
};

// Render a piece as a Unicode character wrapped in HTML
export function getPieceSvg(type: string, color: string): string {
  const char = PIECE_CHARS[color]?.[type];
  if (!char) {
    logger.warn('Unknown piece', { type, color });
    return '';
  }
  logger.debug('Piece rendered', { type, color });
  return `<span class="piece-char" style="font-size:36px;line-height:1;display:flex;align-items:center;justify-content:center;width:100%;height:100%;text-shadow:0 2px 4px rgba(0,0,0,0.4);color:${color === 'white' ? '#ffffff' : '#1a1a1a'}">${char}</span>`;
}

/**
 * Create a DOM element with classes, attributes, and children.
 * This avoids repetitive createElement/setAttribute chains throughout the views.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classes: string[] = [],
  attrs: Record<string, string> = {},
  ...children: (string | Node)[]
): HTMLElementTagNameMap[K] {
  const elem = document.createElement(tag);
  if (classes.length) elem.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    elem.setAttribute(k, v);
  }
  for (const child of children) {
    if (typeof child === 'string') {
      elem.appendChild(document.createTextNode(child));
    } else {
      elem.appendChild(child);
    }
  }
  logger.debug('DOM element created', { tag, classes: classes.join(' ') });
  return elem;
}
