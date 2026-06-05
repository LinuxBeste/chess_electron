/* Core chess engine.
 *
 * This file implements every FIDE rule of chess entirely from scratch.
 * There are no external chess libraries — every piece movement rule,
 * every special case (castling, en passant, promotion), and every
 * game-end condition (checkmate, stalemate) is computed here.
 *
 * Design philosophy:
 *   - All functions are pure: given a board state they return a result
 *     without side effects.  This makes testing trivial and bugs obvious.
 *   - The board is never mutated in-place for move calculation.  Instead
 *     we clone it for hypothetical positions (legal-move filtering) and
 *     only write the result back once validated.
 *   - Coordinate system: board[rank][file] where rank 0 = rank 8 (black's
 *     home), rank 7 = rank 1 (white's home).  File 0 = a-file, file 7 = h-file.
 *     This matches standard visual top-to-bottom rendering.
 */

import { Piece, Color, PieceType, Board, Move, CastlingRights, SerializedSquare } from './types';

/**
 * Convert algebraic square notation like "e2" to zero-indexed board
 * coordinates [rank, file].  'a' → file 0, '1' → rank 7.
 *
 * The ASCII code for 'a' is 97, so subtracting 97 maps 'a' → 0, 'h' → 7.
 * The rank digit is subtracted from 8 so that '1' → rank 7 and '8' → rank 0.
 */
export function squareToIndices(square: string): [number, number] {
  const file = square.charCodeAt(0) - 97;
  const rank = 8 - parseInt(square[1], 10);
  return [rank, file];
}

/**
 * Reverse of squareToIndices: given board indices, produce the algebraic
 * string like "e2".  Adding 97 converts file 0 → 'a', file 7 → 'h'.
 * Subtracting rank from 8 converts rank 7 → '1', rank 0 → '8'.
 */
export function indicesToSquare(rank: number, file: number): string {
  return String.fromCharCode(file + 97) + (8 - rank).toString();
}

/**
 * Bounds check: verify that (rank, file) is within the 0..7 range for
 * both coordinates.  The board is exactly 8×8, so any value outside
 * this range is off the board and cannot hold a piece or be moved to.
 */
export function isInBounds(rank: number, file: number): boolean {
  return rank >= 0 && rank < 8 && file >= 0 && file < 8;
}

/**
 * Build the standard chess starting position according to FIDE rules.
 *
 * Row layout (index 0 = top = rank 8, index 7 = bottom = rank 1):
 *   0: black back-rank (rook, knight, bishop, queen, king, bishop, knight, rook)
 *   1: black pawns (×8)
 *   2–5: empty
 *   6: white pawns (×8)
 *   7: white back-rank (rook, knight, bishop, queen, king, bishop, knight, rook)
 *
 * The back-rank ordering places the king on e1/e8 and queen on d1/d8
 * (queen always matches her square color in standard chess).
 */
export function createInitialBoard(): Board {
  /* Create a blank 8×8 grid filled with null (empty squares) */
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));

  const backRank: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

  /* Iterate over each file (column) and place the correct piece */
  for (let f = 0; f < 8; f++) {
    board[0][f] = { type: backRank[f], color: 'black' };
    board[1][f] = { type: 'pawn', color: 'black' };
    board[6][f] = { type: 'pawn', color: 'white' };
    board[7][f] = { type: backRank[f], color: 'white' };
  }

  return board;
}

/**
 * Deep-clone an 8×8 board.
 *
 * We use `.map()` on each row and spread the Piece object (if present)
 * to produce a fully independent copy.  This is essential because
 * getLegalMoves calls applyMove on hypothetical positions and must
 * not corrupt the real board.  A shallow clone would share Piece
 * references between the real board and the hypothetical clone,
 * leading to impossible-to-debug state corruption.
 *
 * Performance note: cloning is O(64) per call.  getLegalMoves may call
 * this dozens of times per turn (once per pseudo-legal move), but 64
 * object spreads is negligibly fast in modern JS engines.
 */
export function cloneBoard(board: Board): Board {
  /* Map each row to a new array; spread each Piece so changes to the
   * clone's pieces don't affect the original board's pieces */
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

/**
 * Generate moves for a sliding piece by stepping outward in each direction.
 *
 * Sliding pieces (rook, bishop, queen) move any number of squares along
 * straight lines until the edge of the board, a capture, or a block.
 *
 * For each direction vector (dr, df) we:
 *   1. Step one square at a time in that direction.
 *   2. If the square is empty, add a move and keep going.
 *   3. If it holds an enemy piece, add a capture move and stop (can't jump over).
 *   4. If it holds a friendly piece, stop (can't capture own pieces, can't jump).
 *   5. If we step off the board, stop.
 *
 * @param directions — array of [deltaRank, deltaFile] vectors, e.g.
 *   rook uses [[0,1],[0,-1],[1,0],[-1,0]] for the four orthogonal axes.
 */
function generateSlidingMoves(
  board: Board,
  rank: number,
  file: number,
  piece: Piece,
  directions: [number, number][],
): Move[] {
  const moves: Move[] = [];
  const from = indicesToSquare(rank, file);

  /* Iterate over each direction vector (e.g. north, south, east, west) */
  for (const [dr, df] of directions) {
    /* Start one step from the origin in this direction */
    let r = rank + dr;
    let f = file + df;

    /* Walk until we leave the board or hit another piece */
    while (isInBounds(r, f)) {
      const target = board[r][f];
      const to = indicesToSquare(r, f);

      if (target === null) {
        /* Empty square — we can move here and continue scanning past it */
        moves.push({ from, to, piece });
      } else {
        /* Occupied square — check if it's capturable */
        if (target.color !== piece.color) {
          moves.push({ from, to, piece, captured: target });
        }
        /* Whether capture or block, we cannot see past this square */
        break;
      }
      /* Advance further in the same direction */
      r += dr;
      f += df;
    }
  }

  return moves;
}

/* Rook slides along ranks (horizontal) and files (vertical).
 * Four orthogonal directions: east, west, south, north. */
export function generateRookMoves(board: Board, rank: number, file: number, piece: Piece): Move[] {
  return generateSlidingMoves(board, rank, file, piece, [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ]);
}

/* Bishop slides along the four diagonal axes:
 *   [1,1]   = southeast (increasing rank, increasing file)
 *   [1,-1]  = southwest (increasing rank, decreasing file)
 *   [-1,1]  = northeast (decreasing rank, increasing file)
 *   [-1,-1] = northwest (decreasing rank, decreasing file) */
export function generateBishopMoves(board: Board, rank: number, file: number, piece: Piece): Move[] {
  return generateSlidingMoves(board, rank, file, piece, [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]);
}

/* Queen combines rook (orthogonal) and bishop (diagonal) sliding.
 * This is the most powerful piece because it moves along every rank,
 * file, and diagonal — 8 directions total. */
export function generateQueenMoves(board: Board, rank: number, file: number, piece: Piece): Move[] {
  return [...generateRookMoves(board, rank, file, piece), ...generateBishopMoves(board, rank, file, piece)];
}

/* All 8 L-shaped offsets a knight can jump to.
 * Knights move in a "2-and-1" pattern: two squares along one axis and
 * one square along the perpendicular axis.  Unlike sliding pieces,
 * knights leap directly to their destination, ignoring any pieces
 * on intermediate squares. */
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

/* Generate all pseudo-legal knight moves from (rank, file).
 * Knights are unique in chess as the only piece that can jump over
 * other pieces.  The generated moves are filtered to:
 *   1. Stay within the 8×8 board boundary.
 *   2. Not land on a square occupied by a friendly piece.
 * Captures are recorded when the destination holds an enemy piece. */
export function generateKnightMoves(board: Board, rank: number, file: number, piece: Piece): Move[] {
  const moves: Move[] = [];
  const from = indicesToSquare(rank, file);

  /* Try each of the 8 L-shaped offsets */
  for (const [dr, df] of KNIGHT_OFFSETS) {
    const r = rank + dr;
    const f = file + df;
    if (!isInBounds(r, f)) continue;
    const target = board[r][f];
    /* Skip if a friendly piece sits on the destination */
    if (target !== null && target.color === piece.color) continue;
    moves.push({ from, to: indicesToSquare(r, f), piece, captured: target ?? undefined });
  }

  return moves;
}

/* Generate all pseudo-legal pawn moves from (rank, file).
 *
 * Pawns are the most complex piece in chess because they have several
 * special rules that no other piece uses:
 *   - Asymmetric movement: they only move forward (direction depends on color).
 *   - Double push from the starting rank.
 *   - Diagonal captures only (cannot capture straight ahead).
 *   - En passant: a special capture responding to an opponent's double push.
 *   - Promotion: upon reaching the last rank, the pawn must be replaced.
 *
 * Direction convention: white pawns have dir = -1 (moving from rank 6 toward
 * rank 0), black pawns have dir = +1 (moving from rank 1 toward rank 7). */
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

  /* ------------------------------------------------------------------
   * Forward movement: single advance and (from starting rank only) double push.
   * The square directly in front must be empty for either move.
   * For the double push, the intermediate square must also be empty. */
  const forwardR = rank + dir;
  if (isInBounds(forwardR, file) && board[forwardR][file] === null) {
    const to = indicesToSquare(forwardR, file);

    /* Promotion: if the pawn reaches the 8th rank (white, rank 0) or
     * 1st rank (black, rank 7), it must promote.  We generate four
     * candidate moves — one for each possible promotion piece — and
     * let the caller pick.  Queen is the default if unspecified. */
    if (forwardR === 0 || forwardR === 7) {
      for (const promo of ['queen', 'rook', 'bishop', 'knight'] as PieceType[]) {
        moves.push({ from, to, piece, promotion: promo });
      }
    } else {
      /* Normal single push (non-promotion) */
      moves.push({ from, to, piece });
    }

    /* Double push: only available from the pawn's starting rank, and only
     * if the square two steps ahead is also empty */
    const doubleR = rank + 2 * dir;
    if (rank === startRank && board[doubleR][file] === null) {
      moves.push({ from, to: indicesToSquare(doubleR, file), piece });
    }
  }

  /* ------------------------------------------------------------------
   * Captures: pawns capture diagonally forward (left and right).
   * Also handles en passant (see below). */
  for (const df of [-1, 1]) {
    const cr = rank + dir;
    const cf = file + df;
    if (!isInBounds(cr, cf)) continue;
    const target = board[cr][cf];
    const to = indicesToSquare(cr, cf);

    /* Standard diagonal capture — destination must hold an enemy piece */
    if (target !== null && target.color !== piece.color) {
      if (cr === 0 || cr === 7) {
        /* Capturing onto the promotion rank: promote AND capture simultaneously */
        for (const promo of ['queen', 'rook', 'bishop', 'knight'] as PieceType[]) {
          moves.push({ from, to, piece, captured: target, promotion: promo });
        }
      } else {
        moves.push({ from, to, piece, captured: target });
      }
    }

    /* En passant capture: a special rule unique to chess.
     *
     * When an opponent pawn advances two squares from its starting rank
     * (double push), it passes through a square that is on the same rank
     * as if it had moved only one square.  That passed-through square is
     * recorded as the en-passant target.  On the immediate next move only,
     * a pawn on the 5th rank (white) or 4th rank (black) may capture the
     * opponent pawn as if it had moved only one square.
     *
     * The captured pawn is removed from the board even though the capturing
     * pawn lands on a different square (the en-passant target square). */
    if (enPassantTarget === to) {
      const capturedPiece = board[rank][cf];
      if (capturedPiece && capturedPiece.color !== piece.color) {
        moves.push({ from, to, piece, captured: capturedPiece, isEnPassant: true });
      }
    }
  }

  return moves;
}

/* All 8 adjacent squares a king can move to (one step in any direction).
 * The king is the most important piece on the board — the game ends when
 * it is checkmated.  Despite its importance, its movement is simple:
 * exactly one square orthogonally or diagonally.  Think of it as a queen
 * limited to a range of 1. */
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

/* Generate all pseudo-legal king moves from (rank, file), including
 * castling candidates.
 *
 * A king has two categories of moves:
 *   1. Standard one-square moves in any of 8 directions (friendly-occupied
 *      destinations are excluded).
 *   2. Castling — a special double move that simultaneously relocates
 *      the king two squares toward a rook and places that rook on the
 *      square the king passed over.
 *
 * Only the piece-placement preconditions for castling are checked here
 * (empty intervening squares, rook existence and color).  The attack
 * constraints (king not in check, not passing through check, not landing
 * on check) are enforced later in getLegalMoves. */
export function generateKingMoves(
  board: Board,
  rank: number,
  file: number,
  piece: Piece,
  castlingRights: CastlingRights,
): Move[] {
  const moves: Move[] = [];
  const from = indicesToSquare(rank, file);

  /* Step 1: regular king moves — one square in each of 8 directions */
  for (const [dr, df] of KING_OFFSETS) {
    const r = rank + dr;
    const f = file + df;
    if (!isInBounds(r, f)) continue;
    const target = board[r][f];
    if (target !== null && target.color === piece.color) continue;
    moves.push({ from, to: indicesToSquare(r, f), piece, captured: target ?? undefined });
  }

  /* Step 2: castling — the king must be on its home square (e1/e8).
   * The starting file for the king in standard chess is always the
   * e-file, which corresponds to index 4 in our zero-based system. */
  const rights = piece.color === 'white' ? castlingRights.white : castlingRights.black;
  const homeRank = piece.color === 'white' ? 7 : 0;

  if (rank === homeRank && file === 4) {
    /* Kingside castling (O-O):
     *   - King moves e1→g1 (e8→g8 for black).
     *   - Rook moves h1→f1 (h8→f8).
     *   - Squares f1/f8 (index 5) and g1/g8 (index 6) must be empty.
     *   - The rook must be on h1/h8 (index 7) and be owned by the same player. */
    if (rights.kingside && board[homeRank][5] === null && board[homeRank][6] === null) {
      const rook = board[homeRank][7];
      if (rook?.type === 'rook' && rook.color === piece.color) {
        moves.push({ from, to: indicesToSquare(homeRank, 6), piece, isCastling: 'kingside' });
      }
    }
    /* Queenside castling (O-O-O):
     *   - King moves e1→c1 (e8→c8 for black).
     *   - Rook moves a1→d1 (a8→d8).
     *   - Squares b1/b8 (index 1), c1/c8 (index 2), d1/d8 (index 3) are checked.
     *     (b1/b8 must be empty for the rook to pass through, even though the
     *     king does not cross it.)
     *   - The rook must be on a1/a8 (index 0) and be owned by the same player. */
    if (rights.queenside && board[homeRank][1] === null && board[homeRank][2] === null && board[homeRank][3] === null) {
      const rook = board[homeRank][0];
      if (rook?.type === 'rook' && rook.color === piece.color) {
        moves.push({ from, to: indicesToSquare(homeRank, 2), piece, isCastling: 'queenside' });
      }
    }
  }

  return moves;
}

/**
 * Dispatch to the correct move generator based on piece type.
 * Returns pseudo-legal moves (obey piece movement rules but may
 * leave the king in check — that filtering happens later).
 */
function getPseudoLegalMoves(
  board: Board,
  rank: number,
  file: number,
  piece: Piece,
  enPassantTarget: string | null,
  castlingRights: CastlingRights,
): Move[] {
  switch (piece.type) {
    /* Pawn needs enPassantTarget for en-passant detection */
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
    /* King needs castlingRights for castling-availability check */
    case 'king':
      return generateKingMoves(board, rank, file, piece, castlingRights);
  }
}

/**
 * Check whether any piece of `byColor` attacks the square at (rank, file).
 *
 * Instead of iterating all opponent pieces (O(n)), we scan outward from the
 * target using each piece-movement pattern.  This is faster because most
 * positions have many pieces but only a few attack any given square.
 * Called heavily inside getLegalMoves (once per candidate), so performance
 * matters.
 */
export function isSquareAttackedBy(board: Board, rank: number, file: number, byColor: Color): boolean {
  /* Check all 8 knight positions relative to target */
  for (const [dr, df] of KNIGHT_OFFSETS) {
    const r = rank + dr;
    const f = file + df;
    if (isInBounds(r, f)) {
      const p = board[r][f];
      if (p?.type === 'knight' && p.color === byColor) return true;
    }
  }

  /* Check all 8 adjacent squares for an enemy king */
  for (const [dr, df] of KING_OFFSETS) {
    const r = rank + dr;
    const f = file + df;
    if (isInBounds(r, f)) {
      const p = board[r][f];
      if (p?.type === 'king' && p.color === byColor) return true;
    }
  }

  /* Check for pawn attacks: white pawns attack upward (decreasing rank),
   * black pawns attack downward (increasing rank) */
  const pawnDir = byColor === 'white' ? 1 : -1;
  for (const df of [-1, 1]) {
    const r = rank + pawnDir;
    const f = file + df;
    if (isInBounds(r, f)) {
      const p = board[r][f];
      if (p?.type === 'pawn' && p.color === byColor) return true;
    }
  }

  /* Scan outward along ranks and files (4 orthogonal directions) for rook/queen */
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
        break; /* First piece blocks further view in this direction */
      }
      r += dr;
      f += df;
    }
  }

  /* Scan outward along diagonals (4 diagonal directions) for bishop/queen */
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

/**
 * Determine whether `color`'s king is currently under attack.
 *
 * Scans the entire board for a king of the given color, then checks
 * if any enemy piece attacks that square.  Returns false if no king
 * is found (should not happen in a valid game position, but we handle
 * it defensively).
 */
export function isInCheck(board: Board, color: Color): boolean {
  const enemy: Color = color === 'white' ? 'black' : 'white';
  /* Linear scan for the king — there is always exactly one per side */
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

/**
 * Apply a move on a cloned board and return the updated state.
 *
 * CRITICAL: We never mutate the original board.  Every call clones the
 * board first.  This is essential because getLegalMoves calls applyMove
 * for every pseudo-legal candidate (often 30+ times per turn) and must
 * not corrupt the real position.
 *
 * Returns the new board, the updated en-passant target, and the updated
 * castling rights all as a single object.
 */
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

  /* ------------------------------------------------------------------
   * Update castling rights before moving pieces on the board.
   * Rights are tracked per-side (white/black) and per-side (kingside/queenside).
   * Three things can forfeit castling:
   *   1. The king moves (forfeits both sides for that color).
   *   2. A rook moves from its starting square (forfeits that side).
   *   3. An opponent's rook is captured on its starting square (forfeits that side for them). */
  const newCastlingRights: CastlingRights = {
    white: { ...castlingBefore.white },
    black: { ...castlingBefore.black },
  };

  /* King moving: loses both castling rights for that side */
  if (movingPiece.type === 'king') {
    if (color === 'white') {
      newCastlingRights.white.kingside = false;
      newCastlingRights.white.queenside = false;
    } else {
      newCastlingRights.black.kingside = false;
      newCastlingRights.black.queenside = false;
    }
  }

  /* Rook moving from its starting square: loses the corresponding side */
  if (movingPiece.type === 'rook') {
    if (fromRank === 7 && fromFile === 0) newCastlingRights.white.queenside = false;
    if (fromRank === 7 && fromFile === 7) newCastlingRights.white.kingside = false;
    if (fromRank === 0 && fromFile === 0) newCastlingRights.black.queenside = false;
    if (fromRank === 0 && fromFile === 7) newCastlingRights.black.kingside = false;
  }

  /* Rook captured on its starting square: opponent loses that side */
  if (toRank === 7 && toFile === 0) newCastlingRights.white.queenside = false;
  if (toRank === 7 && toFile === 7) newCastlingRights.white.kingside = false;
  if (toRank === 0 && toFile === 0) newCastlingRights.black.queenside = false;
  if (toRank === 0 && toFile === 7) newCastlingRights.black.kingside = false;

  /* En-passant target resets to null unless this move is a double pawn push */
  let newEnPassantTarget: string | null = null;

  /* ------------------------------------------------------------------
   * Execute special moves (castling, en passant) before the standard
   * piece relocation, because they affect additional squares. */

  /* Castling: relocate the rook to its post-castle square */
  if (move.isCastling === 'kingside') {
    newBoard[toRank][5] = newBoard[toRank][7];
    newBoard[toRank][7] = null;
  } else if (move.isCastling === 'queenside') {
    newBoard[toRank][3] = newBoard[toRank][0];
    newBoard[toRank][0] = null;
  }

  /* En-passant: remove the captured pawn (it's not on the destination square) */
  if (move.isEnPassant) {
    newBoard[fromRank][toFile] = null;
  }

  /* Standard piece relocation: move from source to destination */
  newBoard[toRank][toFile] = movingPiece;
  newBoard[fromRank][fromFile] = null;

  /* Promotion: replace the pawn with the chosen piece type */
  if (move.promotion) {
    newBoard[toRank][toFile] = { type: move.promotion, color };
  }

  /* Double pawn push: set the en-passant target to the square the pawn passed through */
  if (movingPiece.type === 'pawn' && Math.abs(toRank - fromRank) === 2) {
    newEnPassantTarget = indicesToSquare(fromRank + (toRank - fromRank) / 2, fromFile);
  }

  return { newBoard, enPassantTarget: newEnPassantTarget, castlingRights: newCastlingRights };
}

/**
 * Compute every legal move for `color` in the current position.
 *
 * Algorithm:
 *   1. Generate pseudo-legal moves for each piece (movement rules only).
 *   2. For each pseudo-legal move, apply it on a cloned board.
 *   3. If the moving player's king is NOT in check on the resulting board,
 *      the move is legal.
 *   4. For castling, a pre-check also verifies the king doesn't pass through
 *      or land on an attacked square.
 *
 * This "generate-filter" approach is simpler and more obviously correct
 * than integrating check-avoidance into each piece generator.  The perf
 * cost of cloning O(64) per candidate is negligible in practice.
 */
export function getLegalMoves(
  board: Board,
  color: Color,
  enPassantTarget: string | null,
  castlingRights: CastlingRights,
): Move[] {
  const legalMoves: Move[] = [];
  const enemy: Color = color === 'white' ? 'black' : 'white';

  /* Iterate every square on the board */
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      /* Skip empty squares and opponent pieces */
      if (!piece || piece.color !== color) continue;

      /* Generate all pseudo-legal moves for this piece */
      const pseudoMoves = getPseudoLegalMoves(board, r, f, piece, enPassantTarget, castlingRights);

      /* Filter each pseudo-legal move through the legality check */
      for (const move of pseudoMoves) {
        /* Castling has an extra precondition: the king cannot pass through
         * or land on an attacked square.  We check this on the original
         * board (before cloning) for efficiency. */
        if (move.isCastling) {
          const [kingRank, kingFile] = squareToIndices(move.from);
          const [, toFile] = squareToIndices(move.to);
          const step = toFile > kingFile ? 1 : -1;
          let safe = true;
          /* Sweep across every square the king touches: starting square,
           * intermediate square(s), and destination square */
          for (let cf = kingFile; cf !== toFile + step; cf += step) {
            if (isSquareAttackedBy(board, kingRank, cf, enemy)) {
              safe = false;
              break;
            }
          }
          if (!safe) continue;
        }

        /* Apply the move on a cloned board and check if the king is safe */
        const { newBoard } = applyMove(board, move, castlingRights);
        if (!isInCheck(newBoard, color)) {
          legalMoves.push(move);
        }
      }
    }
  }

  return legalMoves;
}

/**
 * Evaluate the game status from `color`'s perspective.
 *
 * Four possible return values:
 *   - active:    game continues normally
 *   - check:     king is attacked but has legal escapes
 *   - checkmate: king is attacked with no legal escapes (game over)
 *   - stalemate: king is not attacked but has no legal moves (game over)
 *
 * In standard chess, checkmate and stalemate are the only terminal
 * conditions computed from the board.  Draw by agreement, repetition,
 * or the 50-move rule are handled at the application layer.
 */
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
  /* 50-move rule: 100 half-moves without a pawn move or capture */
  if (halfMoveClock !== undefined && halfMoveClock >= 100) {
    return { status: 'draw' };
  }
  return { status: inCheck ? 'check' : 'active' };
}

/**
 * Calculate the updated half-move clock after a move.
 * Resets to 0 on pawn move or capture, otherwise increments by 1.
 */
export function updateHalfMoveClock(move: Move, currentClock: number): number {
  if (move.piece.type === 'pawn' || move.captured) {
    return 0;
  }
  return currentClock + 1;
}

/**
 * Flatten the 2D board into an array of non-empty squares for JSON output.
 * Each occupied square produces one object with its algebraic coordinate,
 * piece type (e.g. "pawn", "king"), and color ("white" | "black").
 *
 * Empty squares are omitted entirely — the client can assume any square
 * not in this list is vacant.
 */
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

/** Maps each PieceType to its standard algebraic notation letter.
 *  Knights are 'N' (not 'K', which is reserved for the king).
 *  Pawns have no letter — their moves are specified by destination only. */
const PIECE_LETTER: Record<PieceType, string> = {
  king: 'K',
  queen: 'Q',
  rook: 'R',
  bishop: 'B',
  knight: 'N',
  pawn: '',
};

/**
 * Generate standard algebraic notation for a move (without check/mate markers).
 *
 * Handles:
 *   - Castling: O-O / O-O-O
 *   - Pawn moves: "e4" (non-capture), "exd5" (capture), "e8=Q" (promotion)
 *   - Piece moves: "Nf3", "Bxe5"
 *   - Disambiguation: "Rad1" (two rooks on the a-file and f-file, both can go to d1)
 *
 * This implementation does NOT append "+" for check or "#" for checkmate,
 * as those require knowing the opponent's response.  Add them at the
 * application layer if desired.
 */
export function moveToAlgebraic(move: Move, capturedPiece: Piece | undefined, legalMoves: Move[]): string {
  /* Castling uses the special notation O-O / O-O-O */
  if (move.isCastling) {
    return move.isCastling === 'kingside' ? 'O-O' : 'O-O-O';
  }

  const pieceLetter = PIECE_LETTER[move.piece.type];
  /* 'x' is inserted between piece and destination for captures */
  const captureSign = capturedPiece ? 'x' : '';

  /* Pawn notation omits the piece letter and uses the source file for captures */
  if (move.piece.type === 'pawn') {
    const file = move.from[0];
    const base = capturedPiece ? `${file}x${move.to}` : move.to;
    return move.promotion ? `${base}=${PIECE_LETTER[move.promotion]}` : base;
  }

  /* Disambiguation: when two identical pieces (same type, same color) can
   * both reach the destination, we need to specify which one moved.
   * Convention (per FIDE rules):
   *   - If they share a file → disambiguate by rank (e.g. "R1a3", "R8a3").
   *   - If they share a rank → disambiguate by file (e.g. "Rdf8", "Rff8").
   *   - If both differ → disambiguate by file (simplest unique specifier). */
  let disambig = '';
  const ambiguous = legalMoves.filter(
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
