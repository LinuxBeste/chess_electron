/**
 * Client-side chess helpers: board parsing, legal move hints, SVG piece paths.
 *
 * The board rendering converts a 2D Board array or a SerializedSquare[]
 * (from WebSocket messages) into DOM elements.  Legal move hints are
 * fetched from the API and displayed as dots on the board.
 *
 * This file does NOT implement chess logic — that lives in the server's
 * chess.ts.  The client only needs to render the board and provide visual
 * feedback for user interactions.
 */

import type { Board, SerializedSquare, Piece } from '../types';

/**
 * Convert algebraic square notation to [rank, file] indices.
 * 'a' → file 0, '1' → rank 7 (matching the API's coordinate system
 * confirmed in ../chess-api/src/chess.ts lines 28-32).
 */
export function squareToIndices(square: string): [number, number] {
  const file = square.charCodeAt(0) - 97;
  const rank = 8 - parseInt(square[1], 10);
  return [rank, file];
}

/**
 * Convert board indices back to algebraic notation.
 * rank 7 → '1', file 0 → 'a'.
 * Confirmed in ../chess-api/src/chess.ts lines 39-41.
 */
export function indicesToSquare(rank: number, file: number): string {
  return String.fromCharCode(file + 97) + (8 - rank).toString();
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
    board[rank][file] = { type: sq.piece as any, color: sq.color as any };
  }
  return board;
}

/**
 * Deep-clone a Board for optimistic updates.
 * Each cell's Piece is spread so mutations to the clone don't affect the original.
 */
export function cloneBoard(board: Board): Board {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

/**
 * Find the king position of a given color on the board.
 * Returns [rank, file] or null if no king found (should never happen in valid games).
 */
export function findKing(board: Board, color: 'white' | 'black'): [number, number] | null {
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r]?.[f];
      if (p && p.type === 'king' && p.color === color) return [r, f];
    }
  }
  return null;
}

/** Unicode chess characters for piece rendering */
const PIECE_CHARS: Record<string, Record<string, string>> = {
  white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
  black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
};

export function getPieceSvg(type: string, color: string): string {
  const char = PIECE_CHARS[color]?.[type];
  if (!char) return '';
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
  return elem;
}
