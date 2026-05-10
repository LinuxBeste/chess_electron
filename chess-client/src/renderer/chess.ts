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

/** 12 inline SVGs (6 piece types × 2 colors), built at module load */
const PIECE_SVGS: Record<string, Record<string, string>> = {
  white: {},
  black: {},
};

function defineSvg(color: string, type: string, path: string): void {
  const fill = color === 'white' ? '#f0f0f0' : '#1a1a1a';
  const stroke = color === 'white' ? '#888' : '#555';
  PIECE_SVGS[color][type] = `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
    <path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

/* White pieces — fill #f0f0f0, stroke #888 */
defineSvg('white', 'king',
  'M22.5 2v4M20 8l2.5-2L25 8l-2.5-2zm-2 6h9v2h-2l1 4h-7l1-4h-2v-2zm1 6h7l1 3v3h-9v-3l1-3zm0 8h7v2h-7v-2zM14 24l3 4h-3l-2-5 2 1zm17 0l-3 4h3l2-5-2 1zM21 20h3l-1.5 3L21 20z');
defineSvg('white', 'queen',
  'M22.5 4c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zM16 10c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm14 0c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zM10 14l2 13h21l2-13-6 3-4-7-4 7-6-3-5 7zm4 17h17v2H14v-2z');
defineSvg('white', 'rook',
  'M9 35v-4l3-2V15l-3-2V9h6v3h4V9h6v3h4V9h6v4l-3 2v14l3 2v4H9zm4-22h4v4h4v-4h4v4h4v-4h4v2l-3 1v4l3 2v3H12v-3l3-2v-4l-3-1v-2h2zm-2 18h22v1H11v-1z');
defineSvg('white', 'bishop',
  'M15 36c0 2 2 3 7.5 3s7.5-1 7.5-3H15zM22.5 4c-1 0-2 .9-2 2 0 .4.1.7.3 1-.2.2-.3.4-.3.7 0 .6.4 1 1 1s1-.4 1-1c0-.3-.1-.5-.3-.7.2-.3.3-.6.3-1 0-1.1-.9-2-2-2zm-4 5l1 3h-2l2 4-4 7 1 4-2 2v3h16v-3l-2-2 1-4-4-7 2-4h-2l1-3h-8z');
defineSvg('white', 'knight',
  'M22 10c-2 0-4 1-5 3l-3 6 2 1 2-3 1 2-2 2h4l1-2 1 2h3l-2-4c2-1 3-3 3-5 0-3-2-5-5-5zM12 20l-2 3h2l1-3h-1zm1 2v1h2l-1-2-1 1zm6 9h3v2h-3v-2zM12 26c-1 0-2 1-2 2l4 5h2l-4-5c0-1-1-2-2-2h2z');
defineSvg('white', 'pawn',
  'M22.5 9c-2.2 0-4 1.8-4 4 0 .6.1 1.2.4 1.7-2.5 1.2-4.4 3.7-4.4 6.3 0 1.7 1.3 3 3 3h10c1.7 0 3-1.3 3-3 0-2.6-1.9-5.1-4.4-6.3.3-.5.4-1.1.4-1.7 0-2.2-1.8-4-4-4zm-1 17h2v1h-2v-1zm-3 1h8v2h-8v-2z');

/* Black pieces — fill #1a1a1a, stroke #555 */
defineSvg('black', 'king',
  'M22.5 2v4M20 8l2.5-2L25 8l-2.5-2zm-2 6h9v2h-2l1 4h-7l1-4h-2v-2zm1 6h7l1 3v3h-9v-3l1-3zm0 8h7v2h-7v-2zM14 24l3 4h-3l-2-5 2 1zm17 0l-3 4h3l2-5-2 1zM21 20h3l-1.5 3L21 20z');
defineSvg('black', 'queen',
  'M22.5 4c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zM16 10c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm14 0c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zM10 14l2 13h21l2-13-6 3-4-7-4 7-6-3-5 7zm4 17h17v2H14v-2z');
defineSvg('black', 'rook',
  'M9 35v-4l3-2V15l-3-2V9h6v3h4V9h6v3h4V9h6v4l-3 2v14l3 2v4H9zm4-22h4v4h4v-4h4v4h4v-4h4v2l-3 1v4l3 2v3H12v-3l3-2v-4l-3-1v-2h2zm-2 18h22v1H11v-1z');
defineSvg('black', 'bishop',
  'M15 36c0 2 2 3 7.5 3s7.5-1 7.5-3H15zM22.5 4c-1 0-2 .9-2 2 0 .4.1.7.3 1-.2.2-.3.4-.3.7 0 .6.4 1 1 1s1-.4 1-1c0-.3-.1-.5-.3-.7.2-.3.3-.6.3-1 0-1.1-.9-2-2-2zm-4 5l1 3h-2l2 4-4 7 1 4-2 2v3h16v-3l-2-2 1-4-4-7 2-4h-2l1-3h-8z');
defineSvg('black', 'knight',
  'M22 10c-2 0-4 1-5 3l-3 6 2 1 2-3 1 2-2 2h4l1-2 1 2h3l-2-4c2-1 3-3 3-5 0-3-2-5-5-5zM12 20l-2 3h2l1-3h-1zm1 2v1h2l-1-2-1 1zm6 9h3v2h-3v-2zM12 26c-1 0-2 1-2 2l4 5h2l-4-5c0-1-1-2-2-2h2z');
defineSvg('black', 'pawn',
  'M22.5 9c-2.2 0-4 1.8-4 4 0 .6.1 1.2.4 1.7-2.5 1.2-4.4 3.7-4.4 6.3 0 1.7 1.3 3 3 3h10c1.7 0 3-1.3 3-3 0-2.6-1.9-5.1-4.4-6.3.3-.5.4-1.1.4-1.7 0-2.2-1.8-4-4-4zm-1 17h2v1h-2v-1zm-3 1h8v2h-8v-2z');

/**
 * Get the inline SVG HTML for a piece type and color.
 * Returns an empty string for invalid inputs.
 */
export function getPieceSvg(type: string, color: string): string {
  if (!PIECE_SVGS[color] || !PIECE_SVGS[color][type]) return '';
  return PIECE_SVGS[color][type];
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
