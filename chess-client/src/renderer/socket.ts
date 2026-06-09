/**
 * WebSocket connection manager.
 *
 * Connects using the same host/port as the REST API with the bearer token
 * as a query parameter (confirmed in ../chess-api/src/index.ts lines 42-43
 * and ../chess-api/docs/api.md lines 142-146):
 *   ws://host:port/?token=<bearer-token>
 *
 * Implements automatic reconnection with exponential backoff capped at 10s,
 * up to 5 attempts.  Incoming JSON is parsed and dispatched to registered
 * listeners by the `type` field.
 *
 * Listener registration returns an unsubscribe function — consumers are
 * responsible for calling it on unmount (preventing leaks).
 */

import { store } from './store';
import type { SerializedSquare } from '../types';

/** Shape of a "move" WS message — confirmed in ../chess-api/src/game.ts lines 324-331 */
export interface MoveMessage {
  type: 'move';
  gameId: string;
  board: SerializedSquare[];
  turn: 'white' | 'black';
  lastMove: { from: string; to: string };
  status: string;
}

/** Shape of a "game_started" WS message — broadcast when a second player joins */
export interface GameStartedMessage {
  type: 'game_started';
  gameId: string;
  game: import('../types').GameState;
}

/** Shape of a "game_over" WS message — confirmed in ../chess-api/src/game.ts lines 333-339 and 370-378 */
export interface GameOverMessage {
  type: 'game_over';
  gameId: string;
  board: SerializedSquare[];
  turn: 'white' | 'black';
  lastMove: { from: string; to: string } | null;
  status: string;
  result: string;
  reason: string;
  winner?: 'white' | 'black';
}

export interface ChatMessage {
  type: 'chat_message';
  gameId: string;
  playerId: string;
  username: string;
  text: string;
  timestamp: number;
}

export interface GameAbortedMessage {
  type: 'game_aborted';
  gameId: string;
}

export interface DrawOfferedMessage {
  type: 'draw_offered';
  gameId: string;
  byPlayerId: string;
}

export interface DrawDeclinedMessage {
  type: 'draw_declined';
  gameId: string;
}

/* ─── Friend messages ─── */

export interface FriendOnlineMessage {
  type: 'friend_online';
  playerId: string;
  username: string;
  displayName: string;
  currentGameId: string | null;
}

export interface FriendOfflineMessage {
  type: 'friend_offline';
  playerId: string;
}

export interface FriendRequestWsMessage {
  type: 'friend_request';
  requestId: string;
  fromPlayerId: string;
  fromUsername: string;
  fromDisplayName: string;
}

export interface FriendRequestAcceptedMessage {
  type: 'friend_request_accepted';
  byPlayerId: string;
  byUsername: string;
  byDisplayName: string;
}

export interface ChallengeMessage {
  type: 'challenge';
  gameId: string;
  fromPlayerId: string;
  fromUsername: string;
  fromDisplayName: string;
}

export interface ChallengeAcceptMessage {
  type: 'challenge_accept';
  gameId: string;
  fromPlayerId: string;
}

export interface ChallengeDeclineMessage {
  type: 'challenge_decline';
  gameId: string;
  fromPlayerId: string;
}

type WsMessage =
  | MoveMessage
  | GameOverMessage
  | GameStartedMessage
  | ChatMessage
  | GameAbortedMessage
  | DrawOfferedMessage
  | DrawDeclinedMessage
  | FriendOnlineMessage
  | FriendOfflineMessage
  | FriendRequestWsMessage
  | FriendRequestAcceptedMessage
  | ChallengeMessage
  | ChallengeAcceptMessage
  | ChallengeDeclineMessage;

/** Handler type for move events */
export type MoveHandler = (msg: MoveMessage) => void;

/** Handler type for game-over events */
export type GameOverHandler = (msg: GameOverMessage) => void;

/** Handler type for game-started events */
export type GameStartedHandler = (msg: GameStartedMessage) => void;

/** Handler type for chat messages */
export type ChatHandler = (msg: ChatMessage) => void;

/** Handler type for game-aborted events */
export type GameAbortedHandler = (msg: GameAbortedMessage) => void;

/** Handler type for draw-offered events */
export type DrawOfferedHandler = (msg: DrawOfferedMessage) => void;

/** Handler type for draw-declined events */
export type DrawDeclinedHandler = (msg: DrawDeclinedMessage) => void;

/** Handler type for friend events */
export type FriendOnlineHandler = (msg: FriendOnlineMessage) => void;
export type FriendOfflineHandler = (msg: FriendOfflineMessage) => void;
export type FriendRequestHandler = (msg: FriendRequestWsMessage) => void;
export type FriendRequestAcceptedHandler = (msg: FriendRequestAcceptedMessage) => void;
export type ChallengeHandler = (msg: ChallengeMessage) => void;
export type ChallengeAcceptHandler = (msg: ChallengeAcceptMessage) => void;
export type ChallengeDeclineHandler = (msg: ChallengeDeclineMessage) => void;

/** Maximum number of reconnect attempts before giving up */
const MAX_RETRIES = 5;

/** Capped exponential backoff delay in ms */
const MAX_BACKOFF_MS = 10_000;

/** Base delay for the first reconnect attempt in ms */
const INITIAL_BACKOFF_MS = 1_000;

class SocketManager {
  private ws: WebSocket | null = null;
  private retryCount = 0;
  private shouldReconnect = false;
  private moveHandlers = new Set<MoveHandler>();
  private gameOverHandlers = new Set<GameOverHandler>();
  private gameStartedHandlers = new Set<GameStartedHandler>();
  private chatHandlers = new Set<ChatHandler>();
  private gameAbortedHandlers = new Set<GameAbortedHandler>();
  private drawOfferedHandlers = new Set<DrawOfferedHandler>();
  private drawDeclinedHandlers = new Set<DrawDeclinedHandler>();
  private friendOnlineHandlers = new Set<FriendOnlineHandler>();
  private friendOfflineHandlers = new Set<FriendOfflineHandler>();
  private friendRequestHandlers = new Set<FriendRequestHandler>();
  private friendRequestAcceptedHandlers = new Set<FriendRequestAcceptedHandler>();
  private challengeHandlers = new Set<ChallengeHandler>();
  private challengeAcceptHandlers = new Set<ChallengeAcceptHandler>();
  private challengeDeclineHandlers = new Set<ChallengeDeclineHandler>();
  private serverUrl = 'http://localhost:3000';

  /** Set a custom server URL for the WebSocket connection */
  setServerUrl(url: string): void {
    this.serverUrl = url;
  }

  /**
   * Connect to the WebSocket endpoint.
   *
   * The token is read from the store and appended as a query parameter.
   * This authentication method confirmed in ../chess-api/src/index.ts
   * lines 34-45: the server parses `req.url` for the `token` query param.
   */
  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = store.get('token');
    if (!token) return;

    this.shouldReconnect = true;
    store.set('wsStatus', 'connecting');

    const wsBase = this.serverUrl.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/?token=${encodeURIComponent(token!)}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.retryCount = 0;
      store.set('wsStatus', 'connected');
    };

    /**
     * Parse incoming JSON messages and dispatch by type field.
     * The `type` values are confirmed in ../chess-api/src/game.ts.
     */
    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);

        switch (msg.type) {
          case 'move':
            this.moveHandlers.forEach((h) => h(msg as MoveMessage));
            break;
          case 'game_over':
            this.gameOverHandlers.forEach((h) => h(msg as GameOverMessage));
            break;
          case 'game_started':
            this.gameStartedHandlers.forEach((h) => h(msg as GameStartedMessage));
            break;
          case 'chat_message':
            this.chatHandlers.forEach((h) => h(msg as ChatMessage));
            break;
          case 'game_aborted':
            this.gameAbortedHandlers.forEach((h) => h(msg as GameAbortedMessage));
            break;
          case 'draw_offered':
            this.drawOfferedHandlers.forEach((h) => h(msg as DrawOfferedMessage));
            break;
          case 'draw_declined':
            this.drawDeclinedHandlers.forEach((h) => h(msg as DrawDeclinedMessage));
            break;
          case 'friend_online':
            this.friendOnlineHandlers.forEach((h) => h(msg as FriendOnlineMessage));
            break;
          case 'friend_offline':
            this.friendOfflineHandlers.forEach((h) => h(msg as FriendOfflineMessage));
            break;
          case 'friend_request':
            this.friendRequestHandlers.forEach((h) => h(msg as FriendRequestWsMessage));
            break;
          case 'friend_request_accepted':
            this.friendRequestAcceptedHandlers.forEach((h) => h(msg as FriendRequestAcceptedMessage));
            break;
          case 'challenge':
            this.challengeHandlers.forEach((h) => h(msg as ChallengeMessage));
            break;
          case 'challenge_accept':
            this.challengeAcceptHandlers.forEach((h) => h(msg as ChallengeAcceptMessage));
            break;
          case 'challenge_decline':
            this.challengeDeclineHandlers.forEach((h) => h(msg as ChallengeDeclineMessage));
            break;
        }
      } catch {
        /* Silently drop malformed messages — they're not from our server */
      }
    };

    this.ws.onclose = () => {
      store.set('wsStatus', 'disconnected');
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      /* onclose will fire after onerror, so reconnect logic lives there */
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    store.set('wsStatus', 'disconnected');
  }

  /* 1s → 2s → 4s → 8s → 10s (capped), stops after MAX_RETRIES failures */
  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.retryCount >= MAX_RETRIES) {
      store.set('wsStatus', 'disconnected');
      return;
    }

    const delay = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, this.retryCount), MAX_BACKOFF_MS);
    this.retryCount++;
    store.set('wsStatus', 'connecting');

    setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect();
      }
    }, delay);
  }

  /** Send a JSON message through the WebSocket */
  send(msg: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /** onMove/onGameOver return unsubscribe functions */
  onMove(handler: MoveHandler): () => void {
    this.moveHandlers.add(handler);
    return () => {
      this.moveHandlers.delete(handler);
    };
  }

  onGameOver(handler: GameOverHandler): () => void {
    this.gameOverHandlers.add(handler);
    return () => {
      this.gameOverHandlers.delete(handler);
    };
  }

  onGameStarted(handler: GameStartedHandler): () => void {
    this.gameStartedHandlers.add(handler);
    return () => {
      this.gameStartedHandlers.delete(handler);
    };
  }

  onChat(handler: ChatHandler): () => void {
    this.chatHandlers.add(handler);
    return () => {
      this.chatHandlers.delete(handler);
    };
  }

  onGameAborted(handler: GameAbortedHandler): () => void {
    this.gameAbortedHandlers.add(handler);
    return () => {
      this.gameAbortedHandlers.delete(handler);
    };
  }

  onDrawOffered(handler: DrawOfferedHandler): () => void {
    this.drawOfferedHandlers.add(handler);
    return () => {
      this.drawOfferedHandlers.delete(handler);
    };
  }

  onDrawDeclined(handler: DrawDeclinedHandler): () => void {
    this.drawDeclinedHandlers.add(handler);
    return () => {
      this.drawDeclinedHandlers.delete(handler);
    };
  }

  onFriendOnline(handler: FriendOnlineHandler): () => void {
    this.friendOnlineHandlers.add(handler);
    return () => {
      this.friendOnlineHandlers.delete(handler);
    };
  }

  onFriendOffline(handler: FriendOfflineHandler): () => void {
    this.friendOfflineHandlers.add(handler);
    return () => {
      this.friendOfflineHandlers.delete(handler);
    };
  }

  onFriendRequest(handler: FriendRequestHandler): () => void {
    this.friendRequestHandlers.add(handler);
    return () => {
      this.friendRequestHandlers.delete(handler);
    };
  }

  onFriendRequestAccepted(handler: FriendRequestAcceptedHandler): () => void {
    this.friendRequestAcceptedHandlers.add(handler);
    return () => {
      this.friendRequestAcceptedHandlers.delete(handler);
    };
  }

  onChallenge(handler: ChallengeHandler): () => void {
    this.challengeHandlers.add(handler);
    return () => {
      this.challengeHandlers.delete(handler);
    };
  }

  onChallengeAccept(handler: ChallengeAcceptHandler): () => void {
    this.challengeAcceptHandlers.add(handler);
    return () => {
      this.challengeAcceptHandlers.delete(handler);
    };
  }

  onChallengeDecline(handler: ChallengeDeclineHandler): () => void {
    this.challengeDeclineHandlers.add(handler);
    return () => {
      this.challengeDeclineHandlers.delete(handler);
    };
  }
}

export const socketManager = new SocketManager();
