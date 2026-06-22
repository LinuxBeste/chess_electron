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
  spectateMode: 'public' | 'code';
  spectateCode?: string;
  halfMoveClock: number;
  aiSkillLevel?: number;
  reason?: string;
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

export interface ArchivedGame {
  id: string;
  whitePlayerId: string | null;
  blackPlayerId: string | null;
  whiteDisplayName: string;
  blackDisplayName: string;
  winner: string | null;
  status: string;
  result: string;
  reason: string | null;
  moveHistory: string;
  boardHistory: string;
  pgn: string | null;
  playedAt: number;
  timeControl: string;
}

export interface TournamentData {
  id: string;
  name: string;
  type: 'single_elimination' | 'round_robin';
  status: 'registration' | 'active' | 'completed' | 'cancelled';
  createdBy: string;
  maxParticipants: number;
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface TournamentParticipant {
  playerId: string;
  username: string;
  displayName: string;
  seed: number;
  eliminated: boolean;
}

export interface TournamentMatch {
  id: string;
  round: number;
  position: number;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  gameId: string | null;
  completed: boolean;
}
declare global {
  namespace Express {
    interface Request {
      player: Player;
    }
  }
}
