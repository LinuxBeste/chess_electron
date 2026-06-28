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

// Globally augment Express.Request with player property
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

/** Fields returned by the /games/archive API endpoints (snake_case = raw DB row shape). */
export interface ArchivedGame {
  id: string;
  white_player_id: string | null;
  black_player_id: string | null;
  white_display_name: string;
  black_display_name: string;
  winner: string | null;
  status: string;
  result: string;
  reason: string | null;
  move_history: string;
  board_history: string;
  pgn: string | null;
  played_at: number;
  time_control: string;
}

/** Fields returned by the /tournaments API endpoints (snake_case = raw DB row shape). */
export interface TournamentData {
  id: string;
  name: string;
  status: string;
  created_by?: string;
  max_players: number;
  is_private: number;
  join_code?: string;
  created_at?: number;
  started_at?: number | null;
  completed_at?: number | null;
  winner_id?: string | null;
  participantCount?: number;
  participants?: TournamentParticipant[];
  matches?: TournamentMatch[];
}

export interface TournamentParticipant {
  id?: string;
  player_id: string;
  display_name?: string;
}

export interface TournamentMatch {
  id: string;
  round: number;
  position: number;
  white_player_id: string | null;
  black_player_id: string | null;
  game_id: string | null;
  winner_id: string | null;
  status: string;
}
// Augment Express.Request with authenticated player
declare global {
  namespace Express {
    interface Request {
      player: Player;
    }
  }
}
