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
import logger from './logger';
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

export interface ChatHistoryMessage {
  type: 'chat_history';
  gameId: string;
  messages: { playerId: string; username: string; text: string; timestamp: number }[];
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
  username: string;
  displayName: string;
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

export interface FriendRequestDeclinedMessage {
  type: 'friend_request_declined';
  byPlayerId: string;
  byUsername: string;
  byDisplayName: string;
}

export interface FriendRemovedMessage {
  type: 'friend_removed';
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

export interface GameListUpdateMessage {
  type: 'game_list_update';
  openGames: import('../types').GameState[];
  activeGames: import('../types').GameState[];
}

export interface SpectatorCountMessage {
  type: 'spectator_count';
  gameId: string;
  count: number;
}

export interface OpponentDisconnectedMessage {
  type: 'opponent_disconnected';
  gameId: string;
}

export interface OpponentReconnectedMessage {
  type: 'opponent_reconnected';
  gameId: string;
}

export interface RematchOfferMessage {
  type: 'rematch_offered';
  gameId: string;
  byPlayerId: string;
}

export interface RematchAcceptedMessage {
  type: 'rematch_accepted';
  gameId: string;
  newGameId: string;
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
  | FriendRequestDeclinedMessage
  | FriendRemovedMessage
  | ChallengeMessage
  | ChallengeAcceptMessage
  | ChallengeDeclineMessage
  | GameListUpdateMessage
  | ChatHistoryMessage
  | SpectatorCountMessage
  | RematchOfferMessage
  | RematchAcceptedMessage
  | OpponentDisconnectedMessage
  | OpponentReconnectedMessage;

/** Handler type for move events */
export type MoveHandler = (msg: MoveMessage) => void;
// All on* methods below return an unsubscribe function — call on unmount to prevent leaks

/** Handler type for game-over events */
export type GameOverHandler = (msg: GameOverMessage) => void;

/** Handler type for game-started events */
export type GameStartedHandler = (msg: GameStartedMessage) => void;

/** Handler type for chat messages */
export type ChatHandler = (msg: ChatMessage) => void;
export type ChatHistoryHandler = (msg: ChatHistoryMessage) => void;
export type SpectatorCountHandler = (msg: SpectatorCountMessage) => void;

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
export type FriendRequestDeclinedHandler = (msg: FriendRequestDeclinedMessage) => void;
export type FriendRemovedHandler = (msg: FriendRemovedMessage) => void;
export type ChallengeHandler = (msg: ChallengeMessage) => void;
export type ChallengeAcceptHandler = (msg: ChallengeAcceptMessage) => void;
export type ChallengeDeclineHandler = (msg: ChallengeDeclineMessage) => void;
export type GameListUpdateHandler = (msg: GameListUpdateMessage) => void;
export type RematchOfferHandler = (msg: RematchOfferMessage) => void;
export type RematchAcceptedHandler = (msg: RematchAcceptedMessage) => void;
export type OpponentDisconnectedHandler = (msg: OpponentDisconnectedMessage) => void;
export type OpponentReconnectedHandler = (msg: OpponentReconnectedMessage) => void;

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
  private chatHistoryHandlers = new Set<ChatHistoryHandler>();
  private gameAbortedHandlers = new Set<GameAbortedHandler>();
  private drawOfferedHandlers = new Set<DrawOfferedHandler>();
  private drawDeclinedHandlers = new Set<DrawDeclinedHandler>();
  private friendOnlineHandlers = new Set<FriendOnlineHandler>();
  private friendOfflineHandlers = new Set<FriendOfflineHandler>();
  private friendRequestHandlers = new Set<FriendRequestHandler>();
  private friendRequestAcceptedHandlers = new Set<FriendRequestAcceptedHandler>();
  private friendRequestDeclinedHandlers = new Set<FriendRequestDeclinedHandler>();
  private friendRemovedHandlers = new Set<FriendRemovedHandler>();
  private challengeHandlers = new Set<ChallengeHandler>();
  private challengeAcceptHandlers = new Set<ChallengeAcceptHandler>();
  private challengeDeclineHandlers = new Set<ChallengeDeclineHandler>();
  private gameListUpdateHandlers = new Set<GameListUpdateHandler>();
  private rematchOfferHandlers = new Set<RematchOfferHandler>();
  private spectatorCountHandlers = new Set<SpectatorCountHandler>();
  private rematchAcceptedHandlers = new Set<RematchAcceptedHandler>();
  private opponentDisconnectedHandlers = new Set<OpponentDisconnectedHandler>();
  private opponentReconnectedHandlers = new Set<OpponentReconnectedHandler>();
  private serverUrl = 'http://localhost:3000';

  /** Set a custom server URL for the WebSocket connection */
  setServerUrl(url: string): void {
    logger.info('Socket: setting server URL', url);
    this.serverUrl = url;
  }

  /**
   * Connect to the WebSocket endpoint.
   *
   * The token is sent as a Sec-WebSocket-Protocol subprotocol header,
   * avoiding exposure in URL query strings (which can be logged by
   * proxies and web servers).
   */
  connect(): void {
    logger.info('Socket: connect called');

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      logger.info('Socket: already connected or connecting');
      return;
    }

    const token = store.get('token');
    if (!token) {
      logger.warn('Socket: no token available, cannot connect');
      return;
    }

    this.shouldReconnect = true;
    store.set('wsStatus', 'connecting');

    const wsBase = this.serverUrl.replace(/^http/, 'ws') + '/chess-ws';
    this.ws = new WebSocket(wsBase, [token]); // token sent as subprotocol header, not query param

    this.ws.onopen = () => {
      this.retryCount = 0;
      store.set('wsStatus', 'connected');
      logger.info('Socket: connection opened');
    };

    /**
     * Parse incoming JSON messages and dispatch by type field.
     * The `type` values are confirmed in ../chess-api/src/game.ts.
     */
    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        logger.info('Socket: received message type:', msg.type);

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
          case 'chat_history':
            this.chatHistoryHandlers.forEach((h) => h(msg as ChatHistoryMessage));
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
          case 'friend_request_declined':
            this.friendRequestDeclinedHandlers.forEach((h) => h(msg as FriendRequestDeclinedMessage));
            break;
          case 'friend_removed':
            this.friendRemovedHandlers.forEach((h) => h(msg as FriendRemovedMessage));
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
          case 'game_list_update':
            this.gameListUpdateHandlers.forEach((h) => h(msg as GameListUpdateMessage));
            break;
          case 'spectator_count':
            this.spectatorCountHandlers.forEach((h) => h(msg as SpectatorCountMessage));
            break;
          case 'rematch_offered':
            this.rematchOfferHandlers.forEach((h) => h(msg as RematchOfferMessage));
            break;
          case 'rematch_accepted':
            this.rematchAcceptedHandlers.forEach((h) => h(msg as RematchAcceptedMessage));
            break;
          case 'opponent_disconnected':
            this.opponentDisconnectedHandlers.forEach((h) => h(msg as OpponentDisconnectedMessage));
            break;
          case 'opponent_reconnected':
            this.opponentReconnectedHandlers.forEach((h) => h(msg as OpponentReconnectedMessage));
            break;
        }
      } catch {
        logger.warn('Socket: failed to parse incoming message');
      }
    };

    this.ws.onclose = () => {
      logger.info('Socket: connection closed');
      store.set('wsStatus', 'disconnected');
      this.scheduleReconnect();
    };

    this.ws.onerror = (event: Event) => {
      logger.error('Socket: connection error', event);
    };
  }

  disconnect(): void {
    logger.info('Socket: disconnect called');
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
      logger.warn('Socket: max reconnect attempts reached');
      store.set('wsStatus', 'disconnected');
      return;
    }

    const delay = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, this.retryCount), MAX_BACKOFF_MS);
    this.retryCount++;
    logger.info('Socket: scheduling reconnect attempt', this.retryCount, 'in', delay, 'ms');
    store.set('wsStatus', 'connecting');

    setTimeout(() => {
      if (this.shouldReconnect) {
        logger.info('Socket: attempting reconnect');
        this.connect(); // onclose triggers scheduleReconnect again if still shouldReconnect
      }
    }, delay);
  }

  /** Send a JSON message through the WebSocket */
  send(msg: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msgType = (msg as { type?: string }).type ?? 'unknown';
      logger.info('Socket: sending message type:', msgType);
      this.ws.send(JSON.stringify(msg));
    }
  }

  /** onMove/onGameOver return unsubscribe functions */
  onMove(handler: MoveHandler): () => void {
    logger.info('Socket: move handler registered');
    this.moveHandlers.add(handler);
    return () => {
      this.moveHandlers.delete(handler);
    };
  }

  onGameOver(handler: GameOverHandler): () => void {
    logger.info('Socket: game_over handler registered');
    this.gameOverHandlers.add(handler);
    return () => {
      this.gameOverHandlers.delete(handler);
    };
  }

  onGameStarted(handler: GameStartedHandler): () => void {
    logger.info('Socket: game_started handler registered');
    this.gameStartedHandlers.add(handler);
    return () => {
      this.gameStartedHandlers.delete(handler);
    };
  }

  onChat(handler: ChatHandler): () => void {
    logger.info('Socket: chat_message handler registered');
    this.chatHandlers.add(handler);
    return () => {
      this.chatHandlers.delete(handler);
    };
  }

  onGameAborted(handler: GameAbortedHandler): () => void {
    logger.info('Socket: game_aborted handler registered');
    this.gameAbortedHandlers.add(handler);
    return () => {
      this.gameAbortedHandlers.delete(handler);
    };
  }

  onDrawOffered(handler: DrawOfferedHandler): () => void {
    logger.info('Socket: draw_offered handler registered');
    this.drawOfferedHandlers.add(handler);
    return () => {
      this.drawOfferedHandlers.delete(handler);
    };
  }

  onDrawDeclined(handler: DrawDeclinedHandler): () => void {
    logger.info('Socket: draw_declined handler registered');
    this.drawDeclinedHandlers.add(handler);
    return () => {
      this.drawDeclinedHandlers.delete(handler);
    };
  }

  onFriendOnline(handler: FriendOnlineHandler): () => void {
    logger.info('Socket: friend_online handler registered');
    this.friendOnlineHandlers.add(handler);
    return () => {
      this.friendOnlineHandlers.delete(handler);
    };
  }

  onFriendOffline(handler: FriendOfflineHandler): () => void {
    logger.info('Socket: friend_offline handler registered');
    this.friendOfflineHandlers.add(handler);
    return () => {
      this.friendOfflineHandlers.delete(handler);
    };
  }

  onFriendRequest(handler: FriendRequestHandler): () => void {
    logger.info('Socket: friend_request handler registered');
    this.friendRequestHandlers.add(handler);
    return () => {
      this.friendRequestHandlers.delete(handler);
    };
  }

  onFriendRequestAccepted(handler: FriendRequestAcceptedHandler): () => void {
    logger.info('Socket: friend_request_accepted handler registered');
    this.friendRequestAcceptedHandlers.add(handler);
    return () => {
      this.friendRequestAcceptedHandlers.delete(handler);
    };
  }

  onFriendRequestDeclined(handler: FriendRequestDeclinedHandler): () => void {
    logger.info('Socket: friend_request_declined handler registered');
    this.friendRequestDeclinedHandlers.add(handler);
    return () => {
      this.friendRequestDeclinedHandlers.delete(handler);
    };
  }

  onFriendRemoved(handler: FriendRemovedHandler): () => void {
    logger.info('Socket: friend_removed handler registered');
    this.friendRemovedHandlers.add(handler);
    return () => {
      this.friendRemovedHandlers.delete(handler);
    };
  }

  onChallenge(handler: ChallengeHandler): () => void {
    logger.info('Socket: challenge handler registered');
    this.challengeHandlers.add(handler);
    return () => {
      this.challengeHandlers.delete(handler);
    };
  }

  onChallengeAccept(handler: ChallengeAcceptHandler): () => void {
    logger.info('Socket: challenge_accept handler registered');
    this.challengeAcceptHandlers.add(handler);
    return () => {
      this.challengeAcceptHandlers.delete(handler);
    };
  }

  onChallengeDecline(handler: ChallengeDeclineHandler): () => void {
    logger.info('Socket: challenge_decline handler registered');
    this.challengeDeclineHandlers.add(handler);
    return () => {
      this.challengeDeclineHandlers.delete(handler);
    };
  }

  onGameListUpdate(handler: GameListUpdateHandler): () => void {
    logger.info('Socket: game_list_update handler registered');
    this.gameListUpdateHandlers.add(handler);
    return () => {
      this.gameListUpdateHandlers.delete(handler);
    };
  }

  onRematchOffer(handler: RematchOfferHandler): () => void {
    logger.info('Socket: rematch_offer handler registered');
    this.rematchOfferHandlers.add(handler);
    return () => {
      this.rematchOfferHandlers.delete(handler);
    };
  }

  onRematchAccepted(handler: RematchAcceptedHandler): () => void {
    logger.info('Socket: rematch_accepted handler registered');
    this.rematchAcceptedHandlers.add(handler);
    return () => {
      this.rematchAcceptedHandlers.delete(handler);
    };
  }

  onSpectatorCount(handler: SpectatorCountHandler): () => void {
    logger.info('Socket: spectator_count handler registered');
    this.spectatorCountHandlers.add(handler);
    return () => {
      this.spectatorCountHandlers.delete(handler);
    };
  }

  onOpponentDisconnected(handler: OpponentDisconnectedHandler): () => void {
    logger.info('Socket: opponent_disconnected handler registered');
    this.opponentDisconnectedHandlers.add(handler);
    return () => {
      this.opponentDisconnectedHandlers.delete(handler);
    };
  }

  onOpponentReconnected(handler: OpponentReconnectedHandler): () => void {
    logger.info('Socket: opponent_reconnected handler registered');
    this.opponentReconnectedHandlers.add(handler);
    return () => {
      this.opponentReconnectedHandlers.delete(handler);
    };
  }

  onChatHistory(handler: ChatHistoryHandler): () => void {
    logger.info('Socket: chat_history handler registered');
    this.chatHistoryHandlers.add(handler);
    return () => {
      this.chatHistoryHandlers.delete(handler);
    };
  }

  requestChatHistory(gameId: string): void {
    logger.info('Socket: requesting chat history', { gameId });
    this.send({ type: 'get_chat_history', gameId });
  }

  sendRematchOffer(gameId: string): void {
    logger.info('Socket: sending rematch_offer', { gameId });
    this.send({ type: 'rematch_offer', gameId });
  }

  sendRematchAccept(gameId: string): void {
    logger.info('Socket: sending rematch_accept', { gameId });
    this.send({ type: 'rematch_accept', gameId });
  }
}

export const socketManager = new SocketManager();
