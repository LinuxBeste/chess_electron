/* Algebraic color — the two sides in chess */
export type Color = 'white' | 'black';

/* All six piece types recognized by FIDE rules */
export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';

/* Lifecycle states for a game: waiting (lobby), active (playing), or terminal (checkmate/stalemate/draw/resigned) */
export type GameStatus = 'waiting' | 'active' | 'checkmate' | 'stalemate' | 'draw' | 'resigned';

/* A single piece on the board: what it is and whom it belongs to */
export interface Piece {
  type: PieceType;
  color: Color;
}

/* A move from one square to another, enriched with metadata about special cases.
 * `from` and `to` are algebraic strings like "e2" or "e4".
 * `captured` tracks the opponent piece removed (undefined if no capture).
 * `isCastling` / `isEnPassant` / `promotion` are only set for those special moves. */
export interface Move {
  from: string;
  to: string;
  piece: Piece;
  captured?: Piece;
  isCastling?: 'kingside' | 'queenside';
  isEnPassant?: boolean;
  promotion?: PieceType;
}

/* Tracks whether each side can still castle kingside and queenside.
 * Rights are lost when the king moves, a rook moves, or a rook is captured. */
export interface CastlingRights {
  white: { kingside: boolean; queenside: boolean };
  black: { kingside: boolean; queenside: boolean };
}

/* The 8×8 board. board[rank][file] with rank 0 = rank 8, file 0 = a-file.
 * null means an empty square. */
export type Board = (Piece | null)[][];

/* Full snapshot of a game at a point in time.
 * `turn` indicates whose turn it is.
 * `status` controls which API operations are allowed.
 * `players.white`/`players.black` are player IDs (undefined before join).
 * `enPassantTarget` is set when a pawn double-pushes (the square the capturing pawn moves to).
 * `lastMove` tracks the most recent move for UI highlight purposes.
 * `winner` is set when the game ends with a decisive result. */
export interface GameState {
  id: string;
  board: Board;
  turn: Color;
  status: GameStatus;
  players: { white?: string; black?: string };
  moveHistory: string[];
  enPassantTarget: string | null;
  castlingRights: CastlingRights;
  lastMove: { from: string; to: string } | null;
  winner: Color | null;
  createdAt: number;
}

/* A registered human player.  `tokens` is a list of bearer tokens so the
 * same person can authenticate from multiple devices or browser tabs. */
export interface Player {
  id: string;
  username: string;
  tokens: string[];
}

/* Flattened representation of one occupied square, used for JSON API responses.
 * `piece` is the piece type string ("pawn", "king", …).
 * `color` is "white" or "black". */
export interface SerializedSquare {
  square: string;
  piece: string;
  color: string;
}

/* Augment the Express Request type globally so every route handler can
 * access `req.player` without a cast.  Set by authMiddleware after
 * validating the bearer token. */
declare global {
  namespace Express {
    interface Request {
      player: Player;
    }
  }
}
