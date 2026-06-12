export type Color = 'white' | 'black';

export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';

export type GameStatus = 'waiting' | 'active' | 'checkmate' | 'stalemate' | 'draw' | 'resigned';

export interface Piece {
  type: PieceType;
  color: Color;
}

export interface Move {
  from: string;
  to: string;
  piece: Piece;
  captured?: Piece;
  isCastling?: 'kingside' | 'queenside';
  isEnPassant?: boolean;
  promotion?: PieceType;
}

export interface CastlingRights {
  white: { kingside: boolean; queenside: boolean };
  black: { kingside: boolean; queenside: boolean };
}

export type Board = (Piece | null)[][];

export interface GameState {
  id: string;
  board: Board;
  turn: Color;
  status: GameStatus;
  players: { white?: string; black?: string };
  whiteName?: string;
  blackName?: string;
  whiteAvatarUrl?: string;
  blackAvatarUrl?: string;
  moveHistory: string[];
  boardHistory: { board: SerializedSquare[]; move: string }[];
  enPassantTarget: string | null;
  castlingRights: CastlingRights;
  lastMove: { from: string; to: string } | null;
  winner: Color | null;
  createdAt: number;
  visibility: 'public' | 'private';
  halfMoveClock: number;
}

export interface Player {
  id: string;
  username: string;
  displayName: string;
  tokens: string[];
  isRegistered: boolean;
}

export interface SerializedSquare {
  square: string;
  piece: string;
  color: string;
}

export interface RatingEntry {
  playerId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

declare global {
  namespace Express {
    interface Request {
      player: Player;
    }
  }
}
