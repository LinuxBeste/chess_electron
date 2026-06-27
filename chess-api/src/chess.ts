/* Core chess engine implementing every FIDE rule from scratch.
 * All functions are pure: no side effects, no mutation of inputs.
 * Coordinate system: board[rank][file] with rank 0 = rank 8 (black's home),
 * rank 7 = rank 1 (white's home). */

import { Piece, Color, PieceType, Board, Move, CastlingRights, SerializedSquare } from './types.js';

export function squareToIndices(square: string): [number, number] {
  const file = square.charCodeAt(0) - 97;
  const rank = 8 - parseInt(square[1], 10);
  return [rank, file];
}

export function indicesToSquare(rank: number, file: number): string {
  return String.fromCharCode(file + 97) + (8 - rank).toString();
}

export function isInBounds(rank: number, file: number): boolean {
  return rank >= 0 && rank < 8 && file >= 0 && file < 8;
}

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (let f = 0; f < 8; f++) {
    board[0][f] = { type: backRank[f], color: 'black' };
    board[1][f] = { type: 'pawn', color: 'black' };
    board[6][f] = { type: 'pawn', color: 'white' };
    board[7][f] = { type: backRank[f], color: 'white' };
  }
  return board;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

/* Sliding pieces (rook, bishop, queen): step outward in each direction
 * until edge, capture, or block. */
function generateSlidingMoves(
  board: Board,
  rank: number,
  file: number,
  piece: Piece,
  directions: [number, number][],
): Move[] {
  const moves: Move[] = [];
  const from = indicesToSquare(rank, file);
  for (const [dr, df] of directions) {
    let r = rank + dr;
    let f = file + df;
    while (isInBounds(r, f)) {
      const target = board[r][f];
      const to = indicesToSquare(r, f);
      if (target === null) {
        moves.push({ from, to, piece });
      } else {
        if (target.color !== piece.color) {
          moves.push({ from, to, piece, captured: target });
        }
        break;
      }
      r += dr;
      f += df;
    }
  }
  return moves;
}

export function generateRookMoves(board: Board, rank: number, file: number, piece: Piece): Move[] {
  return generateSlidingMoves(board, rank, file, piece, [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ]);
}

export function generateBishopMoves(board: Board, rank: number, file: number, piece: Piece): Move[] {
  return generateSlidingMoves(board, rank, file, piece, [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]);
}

export function generateQueenMoves(board: Board, rank: number, file: number, piece: Piece): Move[] {
  return [...generateRookMoves(board, rank, file, piece), ...generateBishopMoves(board, rank, file, piece)];
}

const KNIGHT_OFFSETS: [number, number][] = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];

export function generateKnightMoves(board: Board, rank: number, file: number, piece: Piece): Move[] {
  const moves: Move[] = [];
  const from = indicesToSquare(rank, file);
  for (const [dr, df] of KNIGHT_OFFSETS) {
    const r = rank + dr;
    const f = file + df;
    if (!isInBounds(r, f)) continue;
    const target = board[r][f];
    if (target !== null && target.color === piece.color) continue;
    moves.push({ from, to: indicesToSquare(r, f), piece, captured: target ?? undefined });
  }
  return moves;
}

/* Pawns: asymmetric movement (direction depends on color), double push from
 * starting rank, diagonal captures, en passant, promotion. */
export function generatePawnMoves(
  board: Board,
  rank: number,
  file: number,
  piece: Piece,
  enPassantTarget: string | null,
): Move[] {
  const moves: Move[] = [];
  const from = indicesToSquare(rank, file);
  const dir = piece.color === 'white' ? -1 : 1;
  const startRank = piece.color === 'white' ? 6 : 1;

  const forwardR = rank + dir;
  if (isInBounds(forwardR, file) && board[forwardR][file] === null) {
    const to = indicesToSquare(forwardR, file);
    if (forwardR === 0 || forwardR === 7) {
      for (const promo of ['queen', 'rook', 'bishop', 'knight'] as PieceType[]) {
        moves.push({ from, to, piece, promotion: promo });
      }
    } else {
      moves.push({ from, to, piece });
    }
    const doubleR = rank + 2 * dir;
    if (rank === startRank && board[doubleR][file] === null) {
      moves.push({ from, to: indicesToSquare(doubleR, file), piece });
    }
  }

  for (const df of [-1, 1]) {
    const cr = rank + dir;
    const cf = file + df;
    if (!isInBounds(cr, cf)) continue;
    const target = board[cr][cf];
    const to = indicesToSquare(cr, cf);

    if (target !== null && target.color !== piece.color) {
      if (cr === 0 || cr === 7) {
        for (const promo of ['queen', 'rook', 'bishop', 'knight'] as PieceType[]) {
          moves.push({ from, to, piece, captured: target, promotion: promo });
        }
      } else {
        moves.push({ from, to, piece, captured: target });
      }
    }

    /* En passant: capture the pawn that just double-pushed */
    if (enPassantTarget === to) {
      // Capture diagonal-adjacent pawn after double push
      const capturedPiece = board[rank][cf];
      if (capturedPiece && capturedPiece.color !== piece.color) {
        moves.push({ from, to, piece, captured: capturedPiece, isEnPassant: true });
      }
    }
  }

  return moves;
}

const KING_OFFSETS: [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

/* King moves: one square in any direction + castling candidates.
 * Attack constraints for castling (can't castle through check) are checked
 * later in getLegalMoves. */
export function generateKingMoves(
  board: Board,
  rank: number,
  file: number,
  piece: Piece,
  castlingRights: CastlingRights,
): Move[] {
  const moves: Move[] = [];
  const from = indicesToSquare(rank, file);

  for (const [dr, df] of KING_OFFSETS) {
    const r = rank + dr;
    const f = file + df;
    if (!isInBounds(r, f)) continue;
    const target = board[r][f];
    if (target !== null && target.color === piece.color) continue;
    moves.push({ from, to: indicesToSquare(r, f), piece, captured: target ?? undefined });
  }

  /* Castling: king must be on e1/e8, intervening squares empty, rook present */
  const rights = piece.color === 'white' ? castlingRights.white : castlingRights.black;
  const homeRank = piece.color === 'white' ? 7 : 0;

  if (rank === homeRank && file === 4) {
    if (rights.kingside && board[homeRank][5] === null && board[homeRank][6] === null) {
      const rook = board[homeRank][7];
      if (rook?.type === 'rook' && rook.color === piece.color) {
        // Verify rook hasn't moved
        moves.push({ from, to: indicesToSquare(homeRank, 6), piece, isCastling: 'kingside' });
      }
    }
    if (rights.queenside && board[homeRank][1] === null && board[homeRank][2] === null && board[homeRank][3] === null) {
      const rook = board[homeRank][0];
      if (rook?.type === 'rook' && rook.color === piece.color) {
        moves.push({ from, to: indicesToSquare(homeRank, 2), piece, isCastling: 'queenside' });
      }
    }
  }

  return moves;
}

/* Dispatch to the correct move generator. Returns pseudo-legal moves
 * (may leave king in check — filtering happens in getLegalMoves). */
function getPseudoLegalMoves(
  board: Board,
  rank: number,
  file: number,
  piece: Piece,
  enPassantTarget: string | null,
  castlingRights: CastlingRights,
): Move[] {
  switch (piece.type) {
    case 'pawn':
      return generatePawnMoves(board, rank, file, piece, enPassantTarget);
    case 'knight':
      return generateKnightMoves(board, rank, file, piece);
    case 'bishop':
      return generateBishopMoves(board, rank, file, piece);
    case 'rook':
      return generateRookMoves(board, rank, file, piece);
    case 'queen':
      return generateQueenMoves(board, rank, file, piece);
    case 'king':
      return generateKingMoves(board, rank, file, piece, castlingRights);
  }
}

/* Outward-scanning attack detection: checks if byColor attacks (rank, file).
 * Faster than iterating all opponent pieces since most squares aren't
 * attacked by most pieces. */
export function isSquareAttackedBy(board: Board, rank: number, file: number, byColor: Color): boolean {
  /* Knights */
  for (const [dr, df] of KNIGHT_OFFSETS) {
    const r = rank + dr;
    const f = file + df;
    if (isInBounds(r, f)) {
      const p = board[r][f];
      if (p?.type === 'knight' && p.color === byColor) return true;
    }
  }

  /* King */
  for (const [dr, df] of KING_OFFSETS) {
    const r = rank + dr;
    const f = file + df;
    if (isInBounds(r, f)) {
      const p = board[r][f];
      if (p?.type === 'king' && p.color === byColor) return true;
    }
  }

  /* Pawns */
  const pawnDir = byColor === 'white' ? 1 : -1;
  for (const df of [-1, 1]) {
    const r = rank + pawnDir;
    const f = file + df;
    if (isInBounds(r, f)) {
      const p = board[r][f];
      if (p?.type === 'pawn' && p.color === byColor) return true;
    }
  }

  /* Orthogonal (rook/queen) */
  for (const [dr, df] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ]) {
    let r = rank + dr;
    let f = file + df;
    while (isInBounds(r, f)) {
      const p = board[r][f];
      if (p !== null) {
        if (p.color === byColor && (p.type === 'rook' || p.type === 'queen')) return true;
        break;
      }
      r += dr;
      f += df;
    }
  }

  /* Diagonal (bishop/queen) */
  for (const [dr, df] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    let r = rank + dr;
    let f = file + df;
    while (isInBounds(r, f)) {
      const p = board[r][f];
      if (p !== null) {
        if (p.color === byColor && (p.type === 'bishop' || p.type === 'queen')) return true;
        break;
      }
      r += dr;
      f += df;
    }
  }

  return false;
}

/* Returns true if color's king is under attack. */
export function isInCheck(board: Board, color: Color): boolean {
  const enemy: Color = color === 'white' ? 'black' : 'white';
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (p?.type === 'king' && p.color === color) {
        return isSquareAttackedBy(board, r, f, enemy);
      }
    }
  }
  return false;
}

/* Apply a move on a cloned board. Never mutates the original.
 * Returns new board, updated en-passant target, and updated castling rights. */
export function applyMove(
  board: Board,
  move: Move,
  castlingBefore: CastlingRights,
): { newBoard: Board; enPassantTarget: string | null; castlingRights: CastlingRights } {
  const newBoard = cloneBoard(board);
  const [fromRank, fromFile] = squareToIndices(move.from);
  const [toRank, toFile] = squareToIndices(move.to);
  const movingPiece = newBoard[fromRank][fromFile]!;
  const color = movingPiece.color;

  /* Update castling rights: king moving, rook moving from start, or rook captured */
  const newCastlingRights: CastlingRights = {
    white: { ...castlingBefore.white },
    black: { ...castlingBefore.black },
  };

  if (movingPiece.type === 'king') {
    if (color === 'white') {
      newCastlingRights.white.kingside = false;
      newCastlingRights.white.queenside = false;
    } else {
      newCastlingRights.black.kingside = false;
      newCastlingRights.black.queenside = false;
    }
  }

  if (movingPiece.type === 'rook') {
    if (fromRank === 7 && fromFile === 0) newCastlingRights.white.queenside = false;
    if (fromRank === 7 && fromFile === 7) newCastlingRights.white.kingside = false;
    if (fromRank === 0 && fromFile === 0) newCastlingRights.black.queenside = false;
    if (fromRank === 0 && fromFile === 7) newCastlingRights.black.kingside = false;
  }

  if (toRank === 7 && toFile === 0) newCastlingRights.white.queenside = false;
  if (toRank === 7 && toFile === 7) newCastlingRights.white.kingside = false;
  if (toRank === 0 && toFile === 0) newCastlingRights.black.queenside = false;
  if (toRank === 0 && toFile === 7) newCastlingRights.black.kingside = false;

  let newEnPassantTarget: string | null = null;

  /* Castling: move the rook */
  if (move.isCastling === 'kingside') {
    newBoard[toRank][5] = newBoard[toRank][7];
    newBoard[toRank][7] = null;
  } else if (move.isCastling === 'queenside') {
    newBoard[toRank][3] = newBoard[toRank][0];
    newBoard[toRank][0] = null;
  }

  /* En passant: remove captured pawn */
  if (move.isEnPassant) {
    newBoard[fromRank][toFile] = null;
  }

  newBoard[toRank][toFile] = movingPiece;
  newBoard[fromRank][fromFile] = null;

  if (move.promotion) {
    newBoard[toRank][toFile] = { type: move.promotion, color };
  }

  /* Double push: set en passant target */
  if (movingPiece.type === 'pawn' && Math.abs(toRank - fromRank) === 2) {
    // En passant target only on double push
    newEnPassantTarget = indicesToSquare(fromRank + (toRank - fromRank) / 2, fromFile);
  }

  return { newBoard, enPassantTarget: newEnPassantTarget, castlingRights: newCastlingRights };
}

/* Compute every legal move for color. Algorithm:
 *   1. Generate pseudo-legal moves for each piece.
 *   2. Apply each on a cloned board; if king isn't in check, the move is legal.
 *   3. Castling also checks king doesn't pass through or land on an attacked square. */
export function getLegalMoves(
  board: Board,
  color: Color,
  enPassantTarget: string | null,
  castlingRights: CastlingRights,
): Move[] {
  const legalMoves: Move[] = [];
  const enemy: Color = color === 'white' ? 'black' : 'white';

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece || piece.color !== color) continue;

      const pseudoMoves = getPseudoLegalMoves(board, r, f, piece, enPassantTarget, castlingRights);

      for (const move of pseudoMoves) {
        /* Castling: verify king doesn't pass through or land on an attacked square */
        if (move.isCastling) {
          const [kingRank, kingFile] = squareToIndices(move.from);
          const [, toFile] = squareToIndices(move.to);
          const step = toFile > kingFile ? 1 : -1;
          let safe = true;
          for (let cf = kingFile; cf !== toFile + step; cf += step) {
            if (isSquareAttackedBy(board, kingRank, cf, enemy)) {
              safe = false;
              break;
            }
          }
          if (!safe) continue;
        }

        const { newBoard } = applyMove(board, move, castlingRights);
        if (!isInCheck(newBoard, color)) {
          legalMoves.push(move);
        }
      }
    }
  }

  return legalMoves;
}

/* Evaluate game status from color's perspective.
 * Returns 'active', 'check', 'checkmate', 'stalemate', or 'draw'
 * (50-move rule). Other draws (agreement, repetition) handled at app layer. */
export function getGameStatus(
  board: Board,
  color: Color,
  enPassantTarget: string | null,
  castlingRights: CastlingRights,
  halfMoveClock?: number,
): { status: 'active' | 'check' | 'checkmate' | 'stalemate' | 'draw' } {
  const inCheck = isInCheck(board, color);
  const legalMoves = getLegalMoves(board, color, enPassantTarget, castlingRights);

  if (legalMoves.length === 0) {
    return { status: inCheck ? 'checkmate' : 'stalemate' };
  }
  if (halfMoveClock !== undefined && halfMoveClock >= 100) {
    // 50-move rule: 100 half-moves without pawn/capture
    return { status: 'draw' };
  }
  return { status: inCheck ? 'check' : 'active' };
}

export function updateHalfMoveClock(move: Move, currentClock: number): number {
  if (move.piece.type === 'pawn' || move.captured) {
    return 0;
  }
  return currentClock + 1;
}

/* Flatten 2D board to array of non-empty squares for JSON/WS messages. */
export function serializeBoard(board: Board): SerializedSquare[] {
  const result: SerializedSquare[] = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (piece) {
        result.push({
          square: indicesToSquare(r, f),
          piece: piece.type,
          color: piece.color,
        });
      }
    }
  }
  return result;
}

const PIECE_FEN: Record<PieceType, string> = {
  king: 'k',
  queen: 'q',
  rook: 'r',
  bishop: 'b',
  knight: 'n',
  pawn: 'p',
};

const FEN_PIECE: Record<string, PieceType> = {
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
};

export function boardToFen(
  board: Board,
  color: Color,
  castlingRights: CastlingRights,
  enPassantTarget: string | null,
  halfMoveClock: number,
  fullMoveNumber: number,
): string {
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
        const letter = PIECE_FEN[p.type];
        fen += p.color === 'white' ? letter.toUpperCase() : letter;
      } else {
        empty++;
      }
    }
    if (empty > 0) fen += empty;
    if (r < 7) fen += '/';
  }

  fen += color === 'white' ? ' w ' : ' b ';

  let castling = '';
  if (castlingRights.white.kingside) castling += 'K';
  if (castlingRights.white.queenside) castling += 'Q';
  if (castlingRights.black.kingside) castling += 'k';
  if (castlingRights.black.queenside) castling += 'q';
  fen += castling || '-';

  fen += ' ' + (enPassantTarget || '-');
  fen += ' ' + halfMoveClock;
  fen += ' ' + fullMoveNumber;

  return fen;
}

export function fenToBoard(fen: string): {
  board: Board;
  color: Color;
  castlingRights: CastlingRights;
  enPassantTarget: string | null;
  halfMoveClock: number;
  fullMoveNumber: number;
} | null {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 1) return null;
  const rows = parts[0].split('/');
  if (rows.length !== 8) return null;

  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') {
        f += parseInt(ch, 10);
      } else {
        const lower = ch.toLowerCase();
        const type = FEN_PIECE[lower];
        if (!type || f >= 8) return null;
        board[r][f] = { type, color: ch === ch.toUpperCase() ? 'white' : 'black' };
        f++;
      }
    }
    if (f !== 8) return null;
  }

  const color: Color = (parts[1] || 'w') === 'w' ? 'white' : 'black';

  const castlingRights: CastlingRights = {
    white: { kingside: false, queenside: false },
    black: { kingside: false, queenside: false },
  };
  const castlingStr = parts[2] || '-';
  if (castlingStr !== '-') {
    if (castlingStr.includes('K')) castlingRights.white.kingside = true;
    if (castlingStr.includes('Q')) castlingRights.white.queenside = true;
    if (castlingStr.includes('k')) castlingRights.black.kingside = true;
    if (castlingStr.includes('q')) castlingRights.black.queenside = true;
  }

  const enPassant = parts[3] && parts[3] !== '-' ? parts[3] : null;
  const halfMoveClock = parts[4] ? parseInt(parts[4], 10) : 0;
  const fullMoveNumber = parts[5] ? parseInt(parts[5], 10) : 1;

  return { board, color, castlingRights, enPassantTarget: enPassant, halfMoveClock, fullMoveNumber };
}

/* PieceType to algebraic notation letter (knight = 'N', pawn = ''). */
const PIECE_LETTER: Record<PieceType, string> = {
  king: 'K',
  queen: 'Q',
  rook: 'R',
  bishop: 'B',
  knight: 'N',
  pawn: '',
};

/* Generate standard algebraic notation (without check/mate markers).
 * Handles castling, pawn moves, captures, promotion, disambiguation. */
export function moveToAlgebraic(move: Move, capturedPiece: Piece | undefined, legalMoves: Move[]): string {
  if (move.isCastling) {
    return move.isCastling === 'kingside' ? 'O-O' : 'O-O-O';
  }

  const pieceLetter = PIECE_LETTER[move.piece.type];
  const captureSign = capturedPiece ? 'x' : '';

  if (move.piece.type === 'pawn') {
    const file = move.from[0];
    const base = capturedPiece ? `${file}x${move.to}` : move.to;
    return move.promotion ? `${base}=${PIECE_LETTER[move.promotion]}` : base;
  }

  /* Disambiguation: two identical pieces can reach the same square */
  let disambig = '';
  const ambiguous = legalMoves.filter(
    // Disambiguate when multiple pieces can reach same target
    (m) => m !== move && m.piece.type === move.piece.type && m.piece.color === move.piece.color && m.to === move.to,
  );
  if (ambiguous.length > 0) {
    const sameFile = ambiguous.some((m) => m.from[0] === move.from[0]);
    if (!sameFile) {
      disambig = move.from[0];
    } else {
      const sameRank = ambiguous.some((m) => m.from[1] === move.from[1]);
      disambig = sameRank ? move.from : move.from[1];
    }
  }

  return `${pieceLetter}${disambig}${captureSign}${move.to}`;
}
