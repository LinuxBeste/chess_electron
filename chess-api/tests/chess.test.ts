/* Chess engine unit tests.
 *
 * Every function in chess.ts is tested independently with targeted
 * positions.  These tests do not use HTTP or WebSocket — they call
 * the chess module functions directly with synthetic board states.
 */

import * as chess from '../src/chess';
import { Board, Piece, CastlingRights } from '../src/types';

/**
 * Build a board from an 8-string visual representation.
 *
 * Each string is one rank (rank 8 at index 0, rank 1 at index 7).
 * Uppercase letters = white pieces, lowercase = black pieces.
 * '.' = empty square.
 *
 * Example:
 *   boardFromFenLike([
 *     'rnbqkbnr',   // rank 8 (black back rank)
 *     'pppppppp',   // rank 7 (black pawns)
 *     '........',   // rank 6
 *     '........',   // rank 5
 *     '........',   // rank 4
 *     '........',   // rank 3
 *     'PPPPPPPP',   // rank 2 (white pawns)
 *     'RNBQKBNR',   // rank 1 (white back rank)
 *   ]);
 */
function boardFromFenLike(lines: string[]): Board {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const ch = lines[r][f];
      if (ch === '.') continue;
      const isWhite = ch === ch.toUpperCase();
      const typeMap: Record<string, 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn'> = {
        K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn',
        k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn',
      };
      board[r][f] = {
        type: typeMap[ch],
        color: isWhite ? 'white' : 'black',
      } as Piece;
    }
  }
  return board;
}

/* ------------------------------------------------------------------ */
/*  Board utilities                                                     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Board utilities                                                     */
/* ------------------------------------------------------------------ */

describe('board utilities', () => {
  test('squareToIndices and indicesToSquare are inverses', () => {
    /* Verify round-trip conversion for corners, center, and edge squares.
     * Both functions must be consistent: indicesToSquare(squareToIndices(s)) === s */
    const squares = ['a1', 'a8', 'h1', 'h8', 'e2', 'e4', 'b7', 'd5'];
    for (const sq of squares) {
      const [r, f] = chess.squareToIndices(sq);
      expect(chess.indicesToSquare(r, f)).toBe(sq);
    }
  });

  test('createInitialBoard has 32 pieces', () => {
    /* Standard chess starts with exactly 16 pieces per side */
    const board = chess.createInitialBoard();
    let count = 0;
    for (let r = 0; r < 8; r++)
      for (let f = 0; f < 8; f++)
        if (board[r][f]) count++;
    expect(count).toBe(32);
  });
});

/* ------------------------------------------------------------------ */
/*  Pawn                                                                */
/* ------------------------------------------------------------------ */

describe('pawn moves', () => {
  test('single push from starting position', () => {
    /* White pawn on e2 (rank 6) can push to e3 or double-push to e4 */
    const board = chess.createInitialBoard();
    const moves = chess.generatePawnMoves(board, 6, 4, board[6][4]!, null);
    /* e3 = single push */
    expect(moves.some(m => m.to === 'e3')).toBe(true);
    /* e4 = double push */
    expect(moves.some(m => m.to === 'e4')).toBe(true);
  });

  test('double push blocked by piece in front', () => {
    /* White pawn on b2 with nothing blocking — can push to b3 or b4 */
    const board = boardFromFenLike([
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '.P......',
      '........',
    ]);
    const moves = chess.generatePawnMoves(board, 6, 1, board[6][1]!, null);
    expect(moves.some(m => m.to === 'b3')).toBe(true);
    expect(moves.some(m => m.to === 'b4')).toBe(true);
  });

  test('blocked pawn cannot move forward', () => {
    /* White pawn on b2, black pawn on b3 blocks (pieces block regardless of color) */
    const board = boardFromFenLike([
      '........',
      '........',
      '........',
      '........',
      '........',
      '.p......',
      '.P......',
      '........',
    ]);
    const moves = chess.generatePawnMoves(board, 6, 1, board[6][1]!, null);
    /* No moves from b2 should exist — the pawn is stuck */
    expect(moves.every(m => m.from !== 'b2')).toBe(true);
  });

  test('pawn captures diagonally', () => {
    /* White pawn on c3, black pawn on d4. White can capture dxd4 diagonally,
     * push to c4, or double-push to c4 (from starting rank). */
    const board = boardFromFenLike([
      '........',
      '........',
      '........',
      '........',
      '........',
      '...p....',
      '..P.....',
      '........',
    ]);
    const moves = chess.generatePawnMoves(board, 6, 2, board[6][2]!, null);
    /* Diagonal capture: c3 → d4 */
    expect(moves.some(m => m.to === 'd3' && m.captured)).toBe(true);
    /* Single push: c3 → c4 */
    expect(moves.some(m => m.to === 'c3')).toBe(true);
    /* Double push: c3 → c4 */
    expect(moves.some(m => m.to === 'c4')).toBe(true);
  });

  test('en passant capture', () => {
    /* White pawn on e5 (row 3, col 4), black pawn on d5 (row 3, col 3).
     * Black just double-pushed from d7 to d5, so en passant target is d6.
     * White's pawn on e5 can capture en passant: exd6. */
    const board = boardFromFenLike([
      '........',
      '........',
      '........',
      '...pP...',
      '........',
      '........',
      '........',
      '........',
    ]);
    const whitePawn = board[3][4]!;
    const moves = chess.generatePawnMoves(board, 3, 4, whitePawn, 'd6');
    /* En-passant capture to d6 */
    expect(moves.some(m => m.to === 'd6' && m.isEnPassant)).toBe(true);
    /* Normal single push to e6 should also be available */
    expect(moves.some(m => m.to === 'e6')).toBe(true);
  });

  test('pawn promotion to queen at last rank', () => {
    /* White pawn on c7, about to promote on c8.
     * Should generate 4 promotion options: queen, rook, bishop, knight */
    const board = boardFromFenLike([
      '........',
      '..P.....',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ]);
    const pawn = board[1][2]!;
    const moves = chess.generatePawnMoves(board, 1, 2, pawn, null);
    /* All four promotion pieces must be present */
    expect(moves.some(m => m.to === 'c8' && m.promotion === 'queen')).toBe(true);
    expect(moves.some(m => m.to === 'c8' && m.promotion === 'rook')).toBe(true);
    expect(moves.some(m => m.to === 'c8' && m.promotion === 'bishop')).toBe(true);
    expect(moves.some(m => m.to === 'c8' && m.promotion === 'knight')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Knight                                                              */
/* ------------------------------------------------------------------ */

describe('knight moves', () => {
  test('knight in center has 8 legal moves', () => {
    /* Knight on d4 (center) — all 8 L-shaped squares are on the board */
    const board = boardFromFenLike([
      '........',
      '........',
      '........',
      '...N....',
      '........',
      '........',
      '........',
      '........',
    ]);
    const knight = board[3][3]!;
    const moves = chess.generateKnightMoves(board, 3, 3, knight);
    expect(moves).toHaveLength(8);
  });

  test('knight on corner has 2 moves', () => {
    /* Knight on a1 (corner) — only b3 and c2 are reachable */
    const board = boardFromFenLike([
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      'N.......',
    ]);
    const knight = board[7][0]!;
    const moves = chess.generateKnightMoves(board, 7, 0, knight);
    expect(moves).toHaveLength(2);
    expect(moves.some(m => m.to === 'b3')).toBe(true);
    expect(moves.some(m => m.to === 'c2')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Bishop                                                              */
/* ------------------------------------------------------------------ */

describe('bishop moves', () => {
  test('unblocked bishop on center has 13 moves', () => {
    /* Bishop on d4 — 13 squares on the two diagonals (7 on one, 6 on the other) */
    const board = boardFromFenLike([
      '........',
      '........',
      '........',
      '...B....',
      '........',
      '........',
      '........',
      '........',
    ]);
    const bishop = board[3][3]!;
    const moves = chess.generateBishopMoves(board, 3, 3, bishop);
    expect(moves).toHaveLength(13);
  });

  test('bishop blocked by own piece cannot reach blocked square', () => {
    /* Bishop on d4, friendly white pawn on c7 blocks the a7-g1 diagonal.
     * The pawn at c7 blocks further movement — b8 is unreachable. */
    const board = boardFromFenLike([
      '........',
      '..P.....',
      '........',
      '...B....',
      '........',
      '........',
      '........',
      '........',
    ]);
    const bishop = board[3][3]!;
    const moves = chess.generateBishopMoves(board, 3, 3, bishop);
    expect(moves.some(m => m.to === 'c7')).toBe(false);
    expect(moves.some(m => m.to === 'b8')).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Rook                                                                */
/* ------------------------------------------------------------------ */

describe('rook moves', () => {
  test('unblocked rook on center has 14 moves', () => {
    /* Rook on d4 — 7 squares on the same rank + 7 on the same file = 14 */
    const board = boardFromFenLike([
      '........',
      '........',
      '........',
      '...R....',
      '........',
      '........',
      '........',
      '........',
    ]);
    const rook = board[3][3]!;
    const moves = chess.generateRookMoves(board, 3, 3, rook);
    expect(moves).toHaveLength(14);
  });
});

/* ------------------------------------------------------------------ */
/*  Queen                                                               */
/* ------------------------------------------------------------------ */

describe('queen moves', () => {
  test('unblocked queen on center has 27 moves (13+14)', () => {
    /* Queen on d4 — combines bishop moves (13) + rook moves (14) = 27 */
    const board = boardFromFenLike([
      '........',
      '........',
      '........',
      '...Q....',
      '........',
      '........',
      '........',
      '........',
    ]);
    const queen = board[3][3]!;
    const moves = chess.generateQueenMoves(board, 3, 3, queen);
    expect(moves).toHaveLength(27);
  });
});

/* ------------------------------------------------------------------ */
/*  King                                                                */
/* ------------------------------------------------------------------ */

describe('king moves', () => {
  test('king on center has 8 moves', () => {
    /* King on d4 — all 8 adjacent squares are in-bounds and empty */
    const board = boardFromFenLike([
      '........',
      '........',
      '........',
      '...K....',
      '........',
      '........',
      '........',
      '........',
    ]);
    const king = board[3][3]!;
    const rights: CastlingRights = { white: { kingside: false, queenside: false }, black: { kingside: false, queenside: false } };
    const moves = chess.generateKingMoves(board, 3, 3, king, rights);
    expect(moves).toHaveLength(8);
  });

  test('castling rights allow kingside castling', () => {
    /* White king on e1, rooks on a1 and h1, no pieces in between */
    const board = boardFromFenLike([
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      'R...K..R',
    ]);
    const king = board[7][4]!;
    const rights: CastlingRights = { white: { kingside: true, queenside: true }, black: { kingside: false, queenside: false } };
    const moves = chess.generateKingMoves(board, 7, 4, king, rights);
    expect(moves.some(m => m.isCastling === 'kingside')).toBe(true);
    expect(moves.some(m => m.isCastling === 'queenside')).toBe(true);
  });

  test('castling blocked when pieces in between', () => {
    /* White king on e1, bishop on d1 blocks queenside.
     * Kingside is clear (f1, g1 empty, rook on h1). */
    const board = boardFromFenLike([
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      'R..BK..R',
    ]);
    const king = board[7][4]!;
    const rights: CastlingRights = { white: { kingside: true, queenside: true }, black: { kingside: false, queenside: false } };
    const moves = chess.generateKingMoves(board, 7, 4, king, rights);
    expect(moves.some(m => m.isCastling === 'kingside')).toBe(true);
    expect(moves.some(m => m.isCastling === 'queenside')).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Check detection                                                     */
/* ------------------------------------------------------------------ */

describe('check detection', () => {
  test('simple check by rook along same file', () => {
    /* King on a8, rook on a1 — same file, nothing in between = check */
    const board = boardFromFenLike([
      'k.......',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      'R.......',
    ]);
    expect(chess.isInCheck(board, 'black')).toBe(true);
    /* White is not in check — no black piece attacks white's king on e1 */
    expect(chess.isInCheck(board, 'white')).toBe(false);
  });

  test('check by rook along same rank', () => {
    /* King on a4, rook on h4 — same rank, nothing in between = check */
    const board = boardFromFenLike([
      '........',
      '........',
      '........',
      '........',
      'k......R',
      '........',
      '........',
      '........',
    ]);
    expect(chess.isInCheck(board, 'black')).toBe(true);
  });

  test('discovered check — bishop moves off file, revealing rook', () => {
    /* King on a8, white bishop on a2 blocks white rook on a1.
     * Currently NOT check because bishop blocks the line.
     * After "moving" the bishop away (setting it to null),
     * the rook delivers check. */
    const board = boardFromFenLike([
      'k.......',
      '........',
      '........',
      '........',
      '........',
      '........',
      'B.......',
      'R.......',
    ]);
    /* Bishop at a2 blocks rook's line to king at a8 */
    expect(chess.isInCheck(board, 'black')).toBe(false);

    /* Simulate the bishop moving away — rook now has a clear line */
    board[6][0] = null;
    expect(chess.isInCheck(board, 'black')).toBe(true);
  });

  test('no false positive when path is blocked', () => {
    /* King on a8, rook on h1, but black pawn on h8 blocks the 8th rank.
     * The rook cannot reach the king through its own pawn. */
    const board = boardFromFenLike([
      'k......p',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '.......R',
    ]);
    expect(chess.isInCheck(board, 'black')).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Checkmate                                                          */
/* ------------------------------------------------------------------ */

describe('checkmate', () => {
  test("Scholar's mate position (after 4.Qxf7#)", () => {
    /* Set up the board immediately after 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6 4.Qxf7#.
     * Black king on e8 is attacked by queen on f7 defended by bishop on c4.
     * King cannot escape to d8 (attacked by queen along rank 8 and bishop
     * along diagonal), d7 (attacked by queen), e7 (attacked by queen), or f8. */
    const board = boardFromFenLike([
      'r.bqk..r',
      'pppp.Qpp',
      '..n..n..',
      '....p...',
      '..B.P...',
      '........',
      'PPPP.PPP',
      'RN..K.NR',
    ]);
    /* Verify black is in checkmate */
    expect(chess.isInCheck(board, 'black')).toBe(true);
    const legalMoves = chess.getLegalMoves(board, 'black', null, {
      white: { kingside: true, queenside: true },
      black: { kingside: true, queenside: true },
    });
    expect(legalMoves).toHaveLength(0);
    const { status } = chess.getGameStatus(board, 'black', null, {
      white: { kingside: true, queenside: true },
      black: { kingside: true, queenside: true },
    });
    expect(status).toBe('checkmate');
  });

  test('back-rank checkmate', () => {
    /* Black king on h8, white rook on g8 delivers check.  Queen on g6
     * covers g8 (capture square), g7, and h7.  King has no safe square. */
    const board = boardFromFenLike([
      '......Rk',
      '........',
      '......Q.',
      '........',
      '........',
      '........',
      '........',
      '........',
    ]);
    expect(chess.isInCheck(board, 'black')).toBe(true);
    const legalMoves = chess.getLegalMoves(board, 'black', null, {
      white: { kingside: true, queenside: true },
      black: { kingside: true, queenside: true },
    });
    expect(legalMoves).toHaveLength(0);
    const { status } = chess.getGameStatus(board, 'black', null, {
      white: { kingside: true, queenside: true },
      black: { kingside: true, queenside: true },
    });
    expect(status).toBe('checkmate');
  });
});

/* ------------------------------------------------------------------ */
/*  Stalemate                                                          */
/* ------------------------------------------------------------------ */

describe('stalemate', () => {
  test('classic stalemate position', () => {
    /* White king on a5, queen on b6, black king on a8.
     * Black to move: not in check but has zero legal moves.
     * Queen at b6 covers a7, b7, b8.  White king at a5 covers a7, b6.
     * King cannot move to a7 (attacked by both), b7 (attacked by queen),
     * or b8 (attacked by queen). */
    const board = boardFromFenLike([
      'k.......',
      '........',
      '.Q......',
      'K.......',
      '........',
      '........',
      '........',
      '........',
    ]);
    expect(chess.isInCheck(board, 'black')).toBe(false);
    const legalMoves = chess.getLegalMoves(board, 'black', null, {
      white: { kingside: false, queenside: false },
      black: { kingside: false, queenside: false },
    });
    expect(legalMoves).toHaveLength(0);
    const { status } = chess.getGameStatus(board, 'black', null, {
      white: { kingside: false, queenside: false },
      black: { kingside: false, queenside: false },
    });
    expect(status).toBe('stalemate');
  });
});

/* ------------------------------------------------------------------ */
/*  Legal-move constraints                                             */
/* ------------------------------------------------------------------ */

describe('legal move constraints', () => {
  test('cannot move into check', () => {
    /* White king on e1, black rook on e8 attacks the e-file.
     * e2 is on the e-file, so the king cannot move there (still in check).
     * d1, d2, f1, f2 are off the e-file and safe. */
    const board = boardFromFenLike([
      '....r...',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '....K...',
    ]);
    const legalMoves = chess.getLegalMoves(board, 'white', null, {
      white: { kingside: false, queenside: false },
      black: { kingside: false, queenside: false },
    });
    /* e2 stays on the e-file — still attacked by the rook */
    expect(legalMoves.every(m => m.to !== 'e2')).toBe(true);
    /* These squares are off the e-file and safe */
    expect(legalMoves.some(m => m.to === 'd1')).toBe(true);
    expect(legalMoves.some(m => m.to === 'd2')).toBe(true);
    expect(legalMoves.some(m => m.to === 'f1')).toBe(true);
    expect(legalMoves.some(m => m.to === 'f2')).toBe(true);
  });

  test('must resolve check (block or capture)', () => {
    /* King on e1, rook on e8 checking.  White bishop on c1 can
     * interpose on e3 to block the check.  The bishop has no other
     * legal moves because any other move would leave the king exposed. */
    const board = boardFromFenLike([
      '....r...',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '..B.K...',
    ]);
    const legalMoves = chess.getLegalMoves(board, 'white', null, {
      white: { kingside: false, queenside: false },
      black: { kingside: false, queenside: false },
    });
    /* Bishop can block on e3 */
    expect(legalMoves.some(m => m.from === 'c1' && m.to === 'e3')).toBe(true);
    /* Bishop cannot make any other move (would leave king in check) */
    expect(legalMoves.every(m => !(m.from === 'c1' && m.to !== 'e3'))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Apply move                                                         */
/* ------------------------------------------------------------------ */

describe('applyMove', () => {
  test('captured piece is recorded in move', () => {
    /* White pawn on f4, black pawn on e5 — white can capture e5.
     * The captured pawn should be recorded in the move. */
    const board = boardFromFenLike([
      '........',
      '........',
      '........',
      '....p...',
      '.....P..',
      '........',
      '........',
      '........',
    ]);
    const legalMoves = chess.getLegalMoves(board, 'white', null, {
      white: { kingside: false, queenside: false },
      black: { kingside: false, queenside: false },
    });
    const captureMove = legalMoves.find(m => m.from === 'f4' && m.to === 'e5');
    expect(captureMove).toBeDefined();
    /* The captured piece must be a black pawn */
    expect(captureMove!.captured).toBeDefined();
    expect(captureMove!.captured!.type).toBe('pawn');
    expect(captureMove!.captured!.color).toBe('black');

    if (captureMove) {
      const { newBoard } = chess.applyMove(board, captureMove, {
        white: { kingside: false, queenside: false },
        black: { kingside: false, queenside: false },
      });
      /* White pawn should now be on e5 */
      const [r, f] = chess.squareToIndices('e5');
      expect(newBoard[r][f]?.type).toBe('pawn');
      expect(newBoard[r][f]?.color).toBe('white');
      /* Source square should be empty */
      const [fr, ff] = chess.squareToIndices('f4');
      expect(newBoard[fr][ff]).toBeNull();
    }
  });

  test('en passant removes correct pawn', () => {
    /* White pawn on e5, black pawn on d5 (just double-pushed from d7).
     * En-passant target = d6.  White captures exd6, black pawn on d5
     * is removed. */
    const board = boardFromFenLike([
      '........',
      '........',
      '........',
      '...pP...',
      '........',
      '........',
      '........',
      '........',
    ]);
    const legalMoves = chess.getLegalMoves(board, 'white', 'd6', {
      white: { kingside: false, queenside: false },
      black: { kingside: false, queenside: false },
    });
    const epMove = legalMoves.find(m => m.from === 'e5' && m.to === 'd6' && m.isEnPassant);
    expect(epMove).toBeDefined();

    if (epMove) {
      const { newBoard } = chess.applyMove(board, epMove, {
        white: { kingside: false, queenside: false },
        black: { kingside: false, queenside: false },
      });
      /* White pawn on d6 */
      const [dr, df] = chess.squareToIndices('d6');
      expect(newBoard[dr][df]?.type).toBe('pawn');
      expect(newBoard[dr][df]?.color).toBe('white');
      /* Black pawn on d5 must be removed (en-passant capture) */
      const [br, bf] = chess.squareToIndices('d5');
      expect(newBoard[br][bf]).toBeNull();
    }
  });

  test('castling moves rook correctly', () => {
    /* White king on e1, rooks on a1 and h1.  Kingside castle:
     * king to g1, rook from h1 to f1.  Both e1 and h1 become empty. */
    const board = boardFromFenLike([
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      'R...K..R',
    ]);
    const rights: CastlingRights = { white: { kingside: true, queenside: true }, black: { kingside: false, queenside: false } };
    const legalMoves = chess.getLegalMoves(board, 'white', null, rights);
    const ksCastle = legalMoves.find(m => m.isCastling === 'kingside');
    expect(ksCastle).toBeDefined();

    if (ksCastle) {
      const { newBoard, castlingRights: newRights } = chess.applyMove(board, ksCastle, rights);
      /* King on g1 */
      const [kr, kf] = chess.squareToIndices('g1');
      expect(newBoard[kr][kf]?.type).toBe('king');
      /* Rook on f1 */
      const [rr, rf] = chess.squareToIndices('f1');
      expect(newBoard[rr][rf]?.type).toBe('rook');
      /* King's original square is empty */
      const [er, ef] = chess.squareToIndices('e1');
      expect(newBoard[er][ef]).toBeNull();
      /* Rook's original square is empty */
      const [hr, hf] = chess.squareToIndices('h1');
      expect(newBoard[hr][hf]).toBeNull();
      /* Castling rights are forfeited after the king moves */
      expect(newRights.white.kingside).toBe(false);
      expect(newRights.white.queenside).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  serializeBoard                                                      */
/* ------------------------------------------------------------------ */

describe('serializeBoard', () => {
  test('returns correct piece count and square names', () => {
    const board = chess.createInitialBoard();
    const serialized = chess.serializeBoard(board);
    expect(serialized).toHaveLength(32);
    const whitePawnE2 = serialized.find(s => s.square === 'e2');
    expect(whitePawnE2).toBeDefined();
    expect(whitePawnE2!.piece).toBe('pawn');
    expect(whitePawnE2!.color).toBe('white');
  });
});

/* ------------------------------------------------------------------ */
/*  moveToAlgebraic                                                     */
/* ------------------------------------------------------------------ */

describe('moveToAlgebraic', () => {
  test('castling kingside', () => {
    const notation = chess.moveToAlgebraic(
      { from: 'e1', to: 'g1', piece: { type: 'king', color: 'white' }, isCastling: 'kingside' },
      undefined,
      [],
    );
    expect(notation).toBe('O-O');
  });
});
