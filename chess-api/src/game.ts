import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';
import { Player, GameState, Color, PieceType } from './types';
import * as chess from './chess';

/* In-memory data stores.  Everything resets on process restart — there is
 * no database or persistent storage.  Three data structures:
 *
 *   games:        gameId → GameState
 *   players:      playerId → Player (with token list)
 *   tokenIndex:   bearerToken → playerId (reverse lookup for fast auth)
 *   wsConnections: playerId → Set<WebSocket> (multi-tab support) */
const games = new Map<string, GameState>();
const players = new Map<string, Player>();

/* Bearer-token reverse index: maps each token directly to its owner.
 * Without this we'd have to iterate every player's token array on every
 * authenticated request — O(n) instead of O(1). */
const tokenIndex = new Map<string, string>();

/* WebSocket connections per player.  Using a Set allows a player to have
 * multiple simultaneous connections (e.g., browser tabs on different
 * devices) while broadcasting game events to all of them. */
const wsConnections = new Map<string, Set<WebSocket>>();

/* Spectator WebSocket connections per game. Non-players can watch active games. */
const spectatorConnections = new Map<string, Set<WebSocket>>();

/**
 * Register a new player with a display-only username.
 *
 * Generates a UUID for the player ID and another UUID for the bearer token.
 * The token is stored in both the player's token list and the reverse index.
 * Returns both so the client can immediately authenticate.
 */
export function registerPlayer(username: string): { playerId: string; token: string } {
  const playerId = uuidv4();
  const token = uuidv4();

  const player: Player = { id: playerId, username, tokens: [token] };
  players.set(playerId, player);
  tokenIndex.set(token, playerId);

  return { playerId, token };
}

/**
 * Authenticate a bearer token.
 *
 * Uses the reverse index (tokenIndex) for O(1) lookup instead of scanning
 * all players.  Returns null if the token is unknown or the player was
 * deleted (shouldn't happen in normal operation).
 */
export function authenticatePlayer(token: string): Player | null {
  const playerId = tokenIndex.get(token);
  if (!playerId) return null;
  return players.get(playerId) ?? null;
}

/**
 * Issue an additional bearer token for an existing player.
 *
 * Useful when the same player wants to authenticate from a second device
 * without invalidating the first session.  Each token independently
 * authorizes the player.
 */
export function addToken(playerId: string): string | null {
  const player = players.get(playerId);
  if (!player) return null;
  const token = uuidv4();
  player.tokens.push(token);
  tokenIndex.set(token, playerId);
  return token;
}

/**
 * Associate a WebSocket connection with a player.
 *
 * Multiple connections per player are supported (Set semantics) so that
 * a player can have the game open in several browser tabs and receive
 * real-time updates in all of them.
 */
export function registerWSConnection(playerId: string, ws: WebSocket): void {
  if (!wsConnections.has(playerId)) {
    wsConnections.set(playerId, new Set());
  }
  wsConnections.get(playerId)!.add(ws);
}

/**
 * Remove a WebSocket connection when it closes or errors.
 *
 * Must be called to prevent memory leaks.  Bound to the 'close' event
 * on each WebSocket in index.ts.
 */
export function removeWSConnection(playerId: string, ws: WebSocket): void {
  wsConnections.get(playerId)?.delete(ws);
}

/**
 * Send a JSON message to all WebSocket connections owned by a player.
 *
 * Uses Record<string, unknown> instead of `any` to maintain type safety
 * while allowing different event shapes (move events, game_over events, etc.).
 * Only sends to connections in the OPEN state (readyState === 1).
 */
function sendToPlayer(playerId: string, message: Record<string, unknown>): void {
  const conns = wsConnections.get(playerId);
  if (!conns) return;
  const data = JSON.stringify(message);
  for (const ws of conns) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

/**
 * Register a WebSocket as a spectator of a game.
 */
export function registerSpectator(gameId: string, ws: WebSocket): boolean {
  const game = games.get(gameId);
  if (!game || game.status !== 'active') return false;
  if (!spectatorConnections.has(gameId)) {
    spectatorConnections.set(gameId, new Set());
  }
  spectatorConnections.get(gameId)!.add(ws);
  return true;
}

/**
 * Remove a spectator WebSocket connection.
 */
export function removeSpectator(gameId: string, ws: WebSocket): void {
  spectatorConnections.get(gameId)?.delete(ws);
}

function sendToSpectators(gameId: string, message: Record<string, unknown>): void {
  const conns = spectatorConnections.get(gameId);
  if (!conns) return;
  const data = JSON.stringify(message);
  for (const ws of conns) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

/**
 * Send a message to both participants of a game.
 *
 * Called after every move, resignation, or game-end event.  Both players
 * receive the same payload so the UI stays in sync without polling.
 */
function broadcastToGame(gameId: string, message: Record<string, unknown>): void {
  const game = games.get(gameId);
  if (!game) return;
  const { white, black } = game.players;
  if (white) sendToPlayer(white, message);
  if (black) sendToPlayer(black, message);
  /* Also forward to spectators */
  sendToSpectators(gameId, message);
}

/**
 * Check whether a player is already participating in an active game.
 *
 * Enforces the one-active-game-per-player rule.  This prevents players
 * from joining multiple games and stalling them, and simplifies the
 * concurrency model significantly. */
function isPlayerInActiveGame(playerId: string): boolean {
  for (const g of games.values()) {
    if (g.status === 'active' && (g.players.white === playerId || g.players.black === playerId)) {
      return true;
    }
  }
  return false;
}

/**
 * Create a new game with the given player as white.
 *
 * The game starts in 'waiting' status — it needs a second player (black)
 * to join before any moves can be made.  The board is set to the standard
 * starting position and both sides have full castling rights initially.
 *
 * @param playerId - The white player's ID.
 * @param visibility - Whether the game appears in the open games list.
 *   Defaults to 'public'.  Private games can only be joined by direct ID.
 */
export function createGame(playerId: string, visibility: 'public' | 'private' = 'public'): GameState {
  const id = uuidv4();
  const game: GameState = {
    id,
    board: chess.createInitialBoard(),
    /* White always moves first in chess */
    turn: 'white',
    /* Waiting for black to join */
    status: 'waiting',
    players: { white: playerId },
    moveHistory: [],
    boardHistory: [],
    enPassantTarget: null,
    /* Both sides start with full castling rights */
    castlingRights: {
      white: { kingside: true, queenside: true },
      black: { kingside: true, queenside: true },
    },
    lastMove: null,
    winner: null,
    createdAt: Date.now(),
    visibility,
    halfMoveClock: 0,
  };
  games.set(id, game);
  return game;
}

/**
 * List all games that are waiting for a second player and public.
 * Private games are excluded — they must be joined by direct ID.
 */
export function getActiveGames(): GameState[] {
  return Array.from(games.values()).filter(g => g.status === 'active');
}

export function getOpenGames(): GameState[] {
  return Array.from(games.values()).filter(g => g.status === 'waiting' && g.visibility === 'public');
}

/**
 * Get a game by its ID.  Returns null if no such game exists.
 */
export function getGame(gameId: string): GameState | null {
  return games.get(gameId) ?? null;
}

/**
 * Join a game as the black player.
 *
 * Validates:
 *   - Game exists and is in 'waiting' status.
 *   - The joining player is not the creator (can't play yourself).
 *   - The joining player is not already in another active game.
 *
 * On success, the game transitions to 'active' and black is assigned.
 */
export function joinGame(
  gameId: string,
  playerId: string,
): { success: boolean; error?: string; game?: GameState } {
  const game = games.get(gameId);
  if (!game) return { success: false, error: 'Game not found' };
  if (game.status !== 'waiting') return { success: false, error: 'Game is not open for joining' };
  if (game.players.white === playerId) return { success: false, error: 'Cannot join your own game' };
  if (isPlayerInActiveGame(playerId)) return { success: false, error: 'Already in an active game' };

  /* Black joins and the game immediately becomes active */
  game.players.black = playerId;
  game.status = 'active';

  /* Broadcast to P1 (white) so their game view updates from waiting → active.
     P2 gets the game state from the REST response. */
  broadcastToGame(gameId, {
    type: 'game_started',
    gameId,
    game,
  });

  return { success: true, game };
}

/**
 * Attempt to make a move in a game.
 *
 * This is the core action in the API.  It performs extensive validation
 * before modifying any state:
 *   1. Game exists and is active.
 *   2. Requesting player is a participant and it's their turn.
 *   3. Source and destination are valid algebraic squares.
 *   4. Source square has a piece belonging to the player.
 *   5. The move exists in the legal move list.
 *
 * On success, the game state is updated, algebraic notation is recorded,
 * a WebSocket broadcast is sent to both players, and the new state is
 * returned.
 */
export function makeMove(
  gameId: string,
  playerId: string,
  from: string,
  to: string,
  promotion?: PieceType,
): { success: boolean; error?: string; state?: GameState } {
  const game = games.get(gameId);
  if (!game) return { success: false, error: 'Game not found' };

  /* Only active games accept moves */
  if (game.status !== 'active') return { success: false, error: 'Game is not active' };

  /* Determine which color the requesting player controls */
  let playerColor: Color | null = null;
  if (game.players.white === playerId) playerColor = 'white';
  else if (game.players.black === playerId) playerColor = 'black';
  if (!playerColor) return { success: false, error: 'You are not a player in this game' };

  /* Verify it's this player's turn */
  if (game.turn !== playerColor) return { success: false, error: 'Not your turn' };

  /* Validate square format: algebraic notation a1-h8 */
  if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) {
    return { success: false, error: 'Invalid square format' };
  }

  /* Check that the source square holds one of the player's pieces */
  const [fromRank, fromFile] = chess.squareToIndices(from);
  const piece = game.board[fromRank][fromFile];
  if (!piece) return { success: false, error: 'No piece at source square' };
  if (piece.color !== playerColor) return { success: false, error: 'That is not your piece' };

  /* Compute legal moves for this position */
  const legalMoves = chess.getLegalMoves(
    game.board,
    playerColor,
    game.enPassantTarget,
    game.castlingRights,
  );

  /* Find the matching legal move (considering promotion piece choice) */
  const matchedMove = legalMoves.find(m => {
    if (m.from !== from || m.to !== to) return false;
    if (promotion && m.promotion !== promotion) return false;
    /* If no promotion piece was specified but this move IS a promotion,
     * default to queen (by far the most common choice in practice) */
    if (!promotion && m.promotion && m.promotion !== 'queen') return false;
    return true;
  });

  if (!matchedMove) return { success: false, error: 'Illegal move' };

  /* Apply the move on the board */
  const { newBoard, enPassantTarget, castlingRights } = chess.applyMove(
    game.board,
    matchedMove,
    game.castlingRights,
  );

  /* Generate algebraic notation for the move history */
  const notation = chess.moveToAlgebraic(matchedMove, matchedMove.captured, legalMoves);

  /* Update half-move clock for 50-move rule */
  const newHalfMoveClock = chess.updateHalfMoveClock(matchedMove, game.halfMoveClock);

  /* Determine the next turn and check for game-ending conditions */
  const nextTurn: Color = game.turn === 'white' ? 'black' : 'white';
  const { status: rawStatus } = chess.getGameStatus(newBoard, nextTurn, enPassantTarget, castlingRights, newHalfMoveClock);

  let newStatus = rawStatus;
  let winner: Color | null = null;

  if (rawStatus === 'checkmate') {
    /* The player who just moved wins */
    newStatus = 'checkmate';
    winner = game.turn;
  } else if (rawStatus === 'stalemate' || rawStatus === 'draw') {
    newStatus = rawStatus;
  } else {
    /* 'check' is informational only — game continues as 'active' */
    newStatus = 'active';
  }

  /* Update the game state in-place */
  game.board = newBoard;
  game.turn = nextTurn;
  game.status = newStatus;
  game.moveHistory.push(notation);
  game.boardHistory.push({ board: chess.serializeBoard(newBoard), move: notation });
  game.enPassantTarget = enPassantTarget;
  game.castlingRights = castlingRights;
  game.lastMove = { from, to };
  game.halfMoveClock = newHalfMoveClock;
  if (winner) game.winner = winner;

  /* Build and broadcast the WebSocket event to both players */
  const isTerminal = newStatus === 'checkmate' || newStatus === 'stalemate' || newStatus === 'draw';
  const message: Record<string, unknown> = {
    type: isTerminal ? 'game_over' : 'move',
    gameId,
    board: chess.serializeBoard(newBoard),
    turn: nextTurn,
    lastMove: { from, to },
    status: newStatus,
  };

  if (newStatus === 'checkmate') {
    message.result = 'checkmate';
    message.reason = `${winner} wins by checkmate`;
    message.winner = winner;
  } else if (newStatus === 'stalemate') {
    message.result = 'stalemate';
    message.reason = 'Draw by stalemate';
  } else if (newStatus === 'draw') {
    message.result = 'draw';
    message.reason = 'Draw by 50-move rule';
  }

  broadcastToGame(gameId, message);
  return { success: true, state: game };
}

/**
 * Resign from a game.
 *
 * The resigning player immediately loses and the opponent wins.
 * The game board is preserved in its current state for review.
 * A WebSocket game_over event is broadcast to both players.
 */
export function resignGame(
  gameId: string,
  playerId: string,
): { success: boolean; error?: string; state?: GameState } {
  const game = games.get(gameId);
  if (!game) return { success: false, error: 'Game not found' };

  let resigningColor: Color | null = null;
  if (game.players.white === playerId) resigningColor = 'white';
  else if (game.players.black === playerId) resigningColor = 'black';
  if (!resigningColor) return { success: false, error: 'You are not a player in this game' };

  if (game.status !== 'active') return { success: false, error: 'Game is not active' };

  /* The opponent is declared the winner */
  const winner: Color = resigningColor === 'white' ? 'black' : 'white';
  game.status = 'resigned';
  game.winner = winner;

  broadcastToGame(gameId, {
    type: 'game_over',
    gameId,
    board: chess.serializeBoard(game.board),
    turn: game.turn,
    lastMove: game.lastMove,
    status: 'resigned',
    result: 'resigned',
    reason: `${resigningColor} resigned`,
    winner,
  });

  return { success: true, state: game };
}

/**
 * Get all legal moves for a player in a game.
 *
 * Returns simplified { from, to } objects (no captured piece, no
 * promotion info) for the game client to highlight valid destination
 * squares or implement move suggestions.
 */
export function getLegalMovesForPlayer(
  gameId: string,
  playerId: string,
): { success: boolean; error?: string; moves?: { from: string; to: string }[] } {
  const game = games.get(gameId);
  if (!game) return { success: false, error: 'Game not found' };

  let playerColor: Color | null = null;
  if (game.players.white === playerId) playerColor = 'white';
  else if (game.players.black === playerId) playerColor = 'black';
  if (!playerColor) return { success: false, error: 'You are not a player in this game' };

  if (game.status !== 'active') return { success: false, error: 'Game is not active' };

  const legalMoves = chess.getLegalMoves(game.board, playerColor, game.enPassantTarget, game.castlingRights);
  return { success: true, moves: legalMoves.map(m => ({ from: m.from, to: m.to })) };
}

/**
 * Get completed games for a player (games they participated in that have ended).
 */
export function getPlayerGames(playerId: string): GameState[] {
  return Array.from(games.values()).filter(g => {
    const isPlayer = g.players.white === playerId || g.players.black === playerId;
    const isFinished = g.status === 'checkmate' || g.status === 'stalemate' || g.status === 'resigned' || g.status === 'draw';
    return isPlayer && isFinished;
  });
}

/**
 * Store recent chat messages per game (in-memory, last 50 messages).
 */
const chatHistory = new Map<string, { playerId: string; username: string; text: string; timestamp: number }[]>();

/**
 * Handle a chat message from a player in a game.
 * Validates the player is part of the game or is spectating, then broadcasts.
 */
export function handleChatMessage(gameId: string, playerId: string, text: string, ws: WebSocket): void {
  if (!text) return;
  const player = players.get(playerId);
  if (!player) return;
  const game = games.get(gameId);
  if (!game) return;

  const isPlayer = game.players.white === playerId || game.players.black === playerId;
  const isSpectating = spectatorConnections.get(gameId)?.has(ws);

  if (!isPlayer && !isSpectating) return;

  if (!chatHistory.has(gameId)) {
    chatHistory.set(gameId, []);
  }
  const history = chatHistory.get(gameId)!;
  history.push({ playerId, username: player.username, text, timestamp: Date.now() });
  if (history.length > 50) history.shift();

  const message: Record<string, unknown> = {
    type: 'chat_message',
    gameId,
    playerId,
    username: player.username,
    text,
    timestamp: Date.now(),
  };

  /* Send to players and spectators */
  const { white, black } = game.players;
  if (white) sendToPlayer(white, message);
  if (black) sendToPlayer(black, message);
  sendToSpectators(gameId, message);
}

/**
 * Aggregate stats for the health check endpoint.
 *
 * Games are counted as active when their status is 'active' (not waiting,
 * not finished).  Players are counted as online when they have at least
 * one open WebSocket connection.
 */
export function getStats(): { gamesActive: number; playersOnline: number } {
  let gamesActive = 0;
  for (const g of games.values()) {
    if (g.status === 'active') gamesActive++;
  }
  return { gamesActive, playersOnline: wsConnections.size };
}
