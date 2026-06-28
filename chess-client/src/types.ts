/**
 * Shared type definitions for the chess client.
 *
 * Most game-domain types (Piece, Board, GameState, Move, etc.) are
 * re-exported from ../chess-api/src/types to keep a single source of truth
 * between client and server.  UI-only types (DragState, ToastMessage,
 * WsStatus, LegalMoveHint) are defined here locally.
 */

/* Color for the two sides — used everywhere in board state and moves */
export type { Color } from '../../chess-api/src/types';

/* All six FIDE piece types: king, queen, rook, bishop, knight, pawn */
export type { PieceType } from '../../chess-api/src/types';

/* Lifecycle: waiting → active → checkmate/stalemate/draw/resigned */
export type { GameStatus } from '../../chess-api/src/types';

/* A piece on the board: { type: PieceType, color: Color } */
export type { Piece } from '../../chess-api/src/types';

/* A single move: from/to algebraic, plus optional capture/castling/en-passant/promotion metadata */
export type { Move } from '../../chess-api/src/types';

/* Castling availability per side (kingside/queenside) */
export type { CastlingRights } from '../../chess-api/src/types';

/* The 8x8 board: Board[rank][file], rank 0=rank 8, file 0=a-file, null=empty */
export type { Board } from '../../chess-api/src/types';

/* Full game snapshot including board, turn, status, players, move history, etc. */
export type { GameState } from '../../chess-api/src/types';

/* A registered player: id, username, tokens[] */
export type { Player } from '../../chess-api/src/types';

/* Flattened occupied-square representation used in WebSocket messages
 * and (presumably) JSON API responses: { square, piece, color } */
export type { SerializedSquare } from '../../chess-api/src/types';

/* Tournament and archived game types */
export type { TournamentData, TournamentParticipant, TournamentMatch, ArchivedGame } from '../../chess-api/src/types';

/** View names for the hash-based router */
export type ViewName = 'login' | 'lobby' | 'game' | 'result';

/** UI state for a piece being dragged */
export interface DragState {
  pieceType: string;
  color: string;
  fromSquare: string;
  /** Current pixel position of the drag ghost (relative to the board container) */
  x: number;
  y: number;
}

/** A lightweight toast message shown at the top of the current view */
export interface ToastMessage {
  text: string;
  type: 'error' | 'info';
  id: number;
}

/** Callback subscribed to a store key change */
export type StoreListener<T> = (value: T) => void;

/** Legal move hint from /games/:gameId/moves */
export interface LegalMoveHint {
  from: string;
  to: string;
}

/** WS connection status */
export type WsStatus = 'disconnected' | 'connecting' | 'connected';

/** Friend info returned by the friends API */
export interface FriendInfo {
  playerId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isOnline: boolean;
  currentGameId: string | null;
}

/** Friend request info */
export interface FriendRequestInfo {
  id: string;
  playerId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: number;
}

/** Chat conversation info */
export interface ConversationInfo {
  id: string;
  type: 'lobby' | 'private' | 'group' | 'game';
  name: string | null;
  lastMessageAt: number;
  unread: number;
  ownerId?: string;
}

export interface GroupMember {
  playerId: string;
  username: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member';
}

/** A single chat message */
export interface ChatMessageData {
  messageId?: string;
  playerId: string;
  username: string;
  text: string;
  timestamp: number;
}

/** Electron preload API exposed via contextBridge */
declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      openNewWindow: () => void;
      clipboardWrite: (text: string) => void;
      serverUrl: string;
      wsUrl: string;
      defaultUsername: string;
      autoConnect: boolean;
      defaultTheme: string;
      defaultSound: boolean;
      defaultHints: boolean;
    };
  }
}
